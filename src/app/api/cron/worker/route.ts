// Worker de fila pgmq — processa jobs de dispatch e fetch da fila.
// Deve ser chamado via pg_cron a cada 1 minuto APÓS o coordinator ser ativado.
//
// ATIVAÇÃO: Use o arquivo disparazap_cron.sql para agendar este worker via Supabase SQL Editor.
// O cron chama a Edge Function /functions/v1/worker (não esta rota Next.js).
//
// E desabilite o coordinator atual:
//   SELECT cron.unschedule('auto-automation-5m');
//   -- Ative o novo coordinator que apenas enfileira (não processa diretamente)
//
// Status: INFRAESTRUTURA PRONTA — aguardando ativação (o auto-automation-5m ainda é o ativo)
// 60s max: keeps this function out of Vercel Fluid billing (>60s triggers Fluid).
// The worker dequeues up to 10 dispatch + 5 fetch jobs per call and typically finishes
// in 20-40s. If a batch takes longer, pgmq will retry unfinished jobs on the next tick.
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatchGroup } from '@/lib/dispatch';
import { getConnector } from '@/lib/connectors/registry';
import { loadMarketplaceCredentials } from '@/lib/credentials';

// Register connectors
import '@/lib/connectors/amazon';
import '@/lib/connectors/mercadolivre';
import '@/lib/connectors/shopee';
import '@/lib/connectors/aliexpress';
import '@/lib/connectors/kabum';
import '@/lib/connectors/temu';
import '@/lib/connectors/shein';

const CRON_SECRET = process.env.CRON_SECRET;

interface DispatchJob {
  ruleId: string;
  userId: string;
  marketplace: string;
  groupIds: string[];
  enqueuedAt: string;
}

interface FetchJob {
  ruleId: string;
  userId: string;
  marketplace: string;
  enqueuedAt: string;
}

export async function POST(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const dispatchResults: Record<string, unknown>[] = [];
  const fetchResults: Record<string, unknown>[] = [];

  // --- Read dispatch jobs from pgmq queue (up to 10 at a time) ---
  // vt=120: job becomes visible again after 120s if not completed (retry)
  const { data: dispatchJobs, error: dqError } = await supabaseAdmin
    .rpc('dz_dequeue_dispatch', { batch_size: 10 });

  if (dqError) {
    return NextResponse.json({ error: `Failed to read dispatch queue: ${dqError.message}` }, { status: 500 });
  }

  // --- Read fetch jobs from pgmq queue (up to 5 at a time) ---
  const { data: fetchJobs, error: fqError } = await supabaseAdmin
    .rpc('dz_dequeue_fetch', { batch_size: 5 });

  if (fqError) {
    return NextResponse.json({ error: `Failed to read fetch queue: ${fqError.message}` }, { status: 500 });
  }

  // --- Process dispatch jobs in parallel (different users/marketplaces) ---
  if (dispatchJobs && dispatchJobs.length > 0) {
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (dispatchJobs as any[]).map(async (row) => {
        const msgId: bigint = row.msg_id;
        const job = row.message as DispatchJob;
        const { ruleId, userId, marketplace, groupIds } = job;

        try {
          // Guard: skip if user's plan is expired
          const { data: plan } = await supabaseAdmin
            .from('user_plans')
            .select('plan_expires_at')
            .eq('user_id', userId)
            .maybeSingle();

          if (plan) {
            const expiresAt = plan.plan_expires_at ? new Date(plan.plan_expires_at) : null;
            if (expiresAt !== null && expiresAt <= new Date()) {
              await supabaseAdmin.rpc('dz_complete_dispatch', { job_id: msgId });
              dispatchResults.push({ ruleId, skipped: 'plan expired' });
              return;
            }
          }

          // Check time window before dispatching
          const brtHour = (new Date().getUTCHours() - 3 + 24) % 24;
          const { data: ruleCheck } = await supabaseAdmin
            .from('automation_rules')
            .select('start_hour, end_hour')
            .eq('id', ruleId)
            .maybeSingle();

          if (ruleCheck) {
            const effectiveEnd = ruleCheck.end_hour === 0 ? 24 : ruleCheck.end_hour;
            const inWindow = !(brtHour < ruleCheck.start_hour || brtHour >= effectiveEnd);
            if (!inWindow) {
              // Outside time window — discard job (don't retry)
              await supabaseAdmin.rpc('dz_complete_dispatch', { job_id: msgId });
              dispatchResults.push({
                ruleId,
                skipped: `Outside time window (${ruleCheck.start_hour}h–${effectiveEnd}h BRT, current: ${brtHour}h BRT)`,
              });
              return;
            }
          }

          // Batch-validate active groups for this user
          const { data: activeGroups } = await supabaseAdmin
            .from('dispatch_groups')
            .select('*')
            .eq('user_id', userId)
            .in('id', groupIds)
            .eq('is_active', true);

          const activeGroupMap = new Map((activeGroups ?? []).map(g => [g.id as string, g]));

          // Groups within a rule: serial (same WhatsApp instance, respect rate limits)
          for (const groupId of groupIds) {
            const group = activeGroupMap.get(groupId);
            if (!group) continue;

            const { data: destinations } = await supabaseAdmin
              .from('group_destinations')
              .select('*')
              .eq('group_id', groupId);

            if (!destinations?.length) continue;

            const result = await dispatchGroup(group, destinations, {
              maxOffers: 1,
              marketplace,
            });

            dispatchResults.push({
              ruleId,
              groupId,
              groupName: group.name,
              marketplace,
              dispatched: result.dispatched,
              errors: result.errors,
            });
          }

          // Mark job as complete — remove from queue
          await supabaseAdmin.rpc('dz_complete_dispatch', { job_id: msgId });
        } catch (err) {
          // DO NOT delete job on error — pgmq will retry after VT expires (120s)
          dispatchResults.push({
            ruleId,
            error: err instanceof Error ? err.message : String(err),
            willRetry: true,
          });
        }
      })
    );
  }

  // --- Process fetch jobs in parallel ---
  if (fetchJobs && fetchJobs.length > 0) {
    await Promise.allSettled(
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (fetchJobs as any[]).map(async (row) => {
        const msgId: bigint = row.msg_id;
        const job = row.message as FetchJob;
        const { ruleId, userId, marketplace } = job;

        try {
          const { data: conn } = await supabaseAdmin
            .from('marketplace_connections')
            .select('encrypted_credentials')
            .eq('user_id', userId)
            .eq('marketplace', marketplace)
            .single();

          if (!conn) throw new Error(`No credentials for ${marketplace}`);

          const credentials = loadMarketplaceCredentials(conn.encrypted_credentials);
          const connector = getConnector(marketplace);
          const allOffers = [];

          for (let page = 1; page <= 2; page++) {
            const pageOffers = await connector.fetchOffers({
              credentials, keywords: [], categories: [], minDiscount: 0, maxPrice: null, minSales: 0, page,
            });
            allOffers.push(...pageOffers);
            if (pageOffers.length === 0) break;
          }

          if (allOffers.length > 0) {
            await supabaseAdmin.from('offers').upsert(
              allOffers.map((o) => ({
                user_id: userId,
                marketplace,
                external_id: o.externalId,
                title: o.title,
                current_price: o.currentPrice,
                original_price: o.originalPrice ?? null,
                discount_percent: o.discountPercent ?? null,
                image_url: o.imageUrl || null,
                product_url: o.productUrl,
                affiliate_link: o.affiliateLink ?? null,
                condition: o.condition ?? null,
                installments: o.installments ?? null,
                category: o.category ?? null,
                fetched_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
              })),
              { onConflict: 'user_id,marketplace,external_id' }
            );
          }

          const todayStr = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];
          await supabaseAdmin.from('automation_rules').update({
            last_run_at: new Date().toISOString(),
            products_found_today: allOffers.length,
            products_found_reset_at: todayStr,
            updated_at: new Date().toISOString(),
          }).eq('id', ruleId);

          // Detect expired ML cookie
          if (marketplace === 'mercadolivre' && allOffers.length >= 5) {
            const nullCount = allOffers.filter((o) => o.affiliateLink === null).length;
            if (nullCount / allOffers.length >= 0.8) {
              await supabaseAdmin.from('marketplace_connections').update({
                is_valid: false,
                validation_error: 'Cookie de sessão expirado — links de afiliado não estão sendo gerados. Atualize o cookie em Marketplaces.',
                updated_at: new Date().toISOString(),
              }).eq('user_id', userId).eq('marketplace', 'mercadolivre');
            }
          }

          // Mark job as complete
          await supabaseAdmin.rpc('dz_complete_fetch', { job_id: msgId });
          fetchResults.push({ ruleId, marketplace, fetched: allOffers.length });
        } catch (err) {
          // DO NOT delete — pgmq retries after VT expires (300s)
          fetchResults.push({
            ruleId,
            error: err instanceof Error ? err.message : String(err),
            willRetry: true,
          });
        }
      })
    );
  }

  return NextResponse.json({
    ok: true,
    dispatchJobsRead: dispatchJobs?.length ?? 0,
    fetchJobsRead: fetchJobs?.length ?? 0,
    dispatchResults,
    fetchResults,
  });
}
