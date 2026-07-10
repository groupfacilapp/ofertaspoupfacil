// Supabase Edge Function: worker
// Dequeues dispatch and fetch jobs from pgmq and processes them.
// Runs every 1 minute via pg_cron.
//
// pg_cron schedule (run in Supabase SQL Editor):
//   SELECT cron.schedule('dz-worker-1m', '* * * * *',
//     $$ SELECT net.http_post(
//          url := 'https://yuypedritsizhuegslej.supabase.co/functions/v1/worker',
//          headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
//          body := '{}'::jsonb
//        ); $$
//   );

import { supabaseAdmin } from '../_shared/supabase.ts';
import { dispatchGroup } from '../_shared/dispatch.ts';
import { getConnector } from '../_shared/connectors/registry.ts';
import { loadMarketplaceCredentials } from '../_shared/credentials.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

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

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  const dispatchResults: Record<string, unknown>[] = [];
  const fetchResults: Record<string, unknown>[] = [];
  const startAt = Date.now();

  // --- Dequeue dispatch jobs (increased to prevent backlog) ---
  const { data: dispatchJobs, error: dqError } = await supabaseAdmin
    .rpc('dz_dequeue_dispatch', { batch_size: 5 });

  if (dqError) {
    return new Response(JSON.stringify({ error: `Failed to read dispatch queue: ${dqError.message}` }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Dequeue fetch jobs (increased from 1) ---
  const { data: fetchJobs, error: fqError } = await supabaseAdmin
    .rpc('dz_dequeue_fetch', { batch_size: 3 });

  if (fqError) {
    return new Response(JSON.stringify({ error: `Failed to read fetch queue: ${fqError.message}` }), {
      status: 500, headers: { 'Content-Type': 'application/json' },
    });
  }

  // --- Process dispatch jobs in parallel ---
  if (dispatchJobs && dispatchJobs.length > 0) {
    await Promise.allSettled(
      // deno-lint-ignore no-explicit-any
      (dispatchJobs as any[]).map(async (row) => {
        const msgId: bigint = row.msg_id;
        const job = row.message as DispatchJob;
        const { ruleId, userId, marketplace, groupIds, enqueuedAt } = job;

        try {
          if (enqueuedAt) {
            const ageMs = Date.now() - new Date(enqueuedAt).getTime();
            if (ageMs > 15 * 60 * 1000) {
              console.warn(`[Worker] Skipping stale dispatch job ${msgId} (age: ${Math.round(ageMs/60000)}m)`);
              await supabaseAdmin.rpc('dz_complete_dispatch', { job_id: msgId });
              return;
            }
          }
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

          const { data: activeGroups } = await supabaseAdmin
            .from('dispatch_groups')
            .select('*')
            .eq('user_id', userId)
            .in('id', groupIds)
            .eq('is_active', true);

          const activeGroupMap = new Map((activeGroups ?? []).map((g: Record<string, unknown>) => [g.id as string, g]));

          // Process groups (bounded by time to avoid Edge Function timeout)
          const MAX_GROUPS_PER_RUN = 50;
          let groupsProcessed = 0;
          for (const groupId of groupIds) {
            if (groupsProcessed >= MAX_GROUPS_PER_RUN) break;
            // Safety: abort if taking too long (40s budget)
            if (Date.now() - startAt > 40000) {
              console.warn('[Worker] Dispatch taking too long, stopping group loop');
              break;
            }

            const group = activeGroupMap.get(groupId);
            if (!group) continue;

            const { data: destinations } = await supabaseAdmin
              .from('group_destinations')
              .select('*')
              .eq('group_id', groupId);

            if (!destinations?.length) continue;

            // deno-lint-ignore no-explicit-any
            const result = await dispatchGroup(group as any, destinations, { maxOffers: 1, marketplace });
            dispatchResults.push({ ruleId, groupId, groupName: (group as any).name, marketplace, dispatched: result.dispatched, errors: result.errors });
            groupsProcessed++;
          }

          await supabaseAdmin.rpc('dz_complete_dispatch', { job_id: msgId });
        } catch (err) {
          dispatchResults.push({ ruleId, error: err instanceof Error ? err.message : String(err), willRetry: true });
        }
      })
    );
  }

  // --- Process fetch jobs in parallel ---
  if (fetchJobs && fetchJobs.length > 0) {
    await Promise.allSettled(
      // deno-lint-ignore no-explicit-any
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

          // Get keywords from ALL active dispatch groups for this user/marketplace
          const { data: activeGroups } = await supabaseAdmin
            .from('dispatch_groups')
            .select('keywords')
            .eq('user_id', userId)
            .contains('marketplaces', [marketplace])
            .eq('is_active', true);

          const keywords = Array.from(new Set(((activeGroups ?? []) as any[]).flatMap((g) => g.keywords || [])));

          // If no keywords, use an empty string as "all offers" trigger for supported connectors
          const searchTerms = keywords.length > 0 ? keywords : [''];

          console.log(`[Worker] Fetching ${marketplace} for user ${userId}. Keywords: ${searchTerms.join(', ')}`);

          // Process keywords in parallel or series? To avoid rate-limits, we do search terms one by one,
          // but pages can be deep.
          for (const keyword of searchTerms) {
            for (let page = 1; page <= 10; page++) {
              try {
                // Check execution time to avoid hard timeouts
                if (Date.now() - startAt > 45000) {
                  console.warn('[Worker] Fetch taking too long, breaking loop');
                  break;
                }

                const pageOffers = await connector.fetchOffers({
                  credentials,
                  keywords: keyword ? [keyword] : [],
                  categories: [],
                  minDiscount: 0,
                  maxPrice: null,
                  minSales: 0,
                  page
                });

                if (pageOffers.length === 0) break;
                allOffers.push(...pageOffers);

                // Anti-throttling delay
                if (page < 10) await new Promise(r => setTimeout(r, 500));
              } catch (e: any) {
                console.error(`[Worker] Error fetching page ${page} for ${keyword}: ${e?.message || e}`);
                break;
              }
            }
            if (Date.now() - startAt > 45000) break;
          }

          if (allOffers.length > 0) {
            await supabaseAdmin.from('offers').upsert(
              allOffers.map((o) => ({
                user_id: userId, marketplace, external_id: o.externalId, title: o.title,
                current_price: o.currentPrice, original_price: o.originalPrice ?? null,
                discount_percent: o.discountPercent ?? null, image_url: o.imageUrl || null,
                product_url: o.productUrl, affiliate_link: o.affiliateLink ?? null,
                condition: o.condition ?? null, installments: o.installments ?? null,
                category: o.category ?? null, fetched_at: new Date().toISOString(),
                expires_at: new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString(),
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

          await supabaseAdmin.rpc('dz_complete_fetch', { job_id: msgId });
          fetchResults.push({ ruleId, marketplace, fetched: allOffers.length });
        } catch (err: any) {
          console.error(`[Worker] Error for ${marketplace}: ${err?.message || err}`);
          fetchResults.push({ ruleId, error: err?.message || String(err), willRetry: true });
        }
      })
    );
  }

  // --- Periodic Cleanup of disconnected/expired instances ---
  // Run roughly once per hour (1/60 chance per minute)
  if (Math.random() < 0.02) {
    try {
      const { data: disconnected } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('id, instance_name, provider_token, user_id')
        .neq('status', 'connected');

      if (disconnected && disconnected.length > 0) {
        const userIds = Array.from(new Set(disconnected.map(d => d.user_id)));
        const { data: plans } = await supabaseAdmin
          .from('user_plans')
          .select('user_id, plan_expires_at')
          .in('user_id', userIds);

        const activePlanUsers = new Set(
          (plans ?? [])
            .filter(p => !p.plan_expires_at || new Date(p.plan_expires_at) > new Date())
            .map(p => p.user_id)
        );

        const toDelete = disconnected.filter(d => !activePlanUsers.has(d.user_id));

        if (toDelete.length > 0) {
          console.log(`[Worker] Found ${toDelete.length} disconnected instances from expired plans. Cleaning up...`);
          const { getWhatsAppClient } = await import('../_shared/platform-settings.ts');
          const client = await getWhatsAppClient();
          
          for (const inst of toDelete) {
            try {
              await client.deleteInstance(inst.instance_name, inst.provider_token || undefined).catch(() => {});
              await supabaseAdmin.from('whatsapp_instances').delete().eq('id', inst.id);
            } catch (e) {}
          }
        }
      }
    } catch (err: any) {
      console.error('[Worker] Cleanup error:', err.message);
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    dispatchJobsRead: dispatchJobs?.length ?? 0,
    fetchJobsRead: fetchJobs?.length ?? 0,
    dispatchResults,
    fetchResults,
  }), { headers: { 'Content-Type': 'application/json' } });
});
