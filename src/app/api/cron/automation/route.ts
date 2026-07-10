// Vercel Cron / Supabase pg_cron: runs every 5 minutes
// COORDINATOR: Não executa processos pesados. Apenas lê as regras do banco
// e enfileira (enqueue) as ações na fila pgmq ('fetch_jobs' e 'dispatch_jobs').
//
// O processamento real ficará a cargo do /api/cron/worker (rodando a cada 1m)
// em múltiplos paralelos baseados na visibilidade dos jobs.
export const maxDuration = 30; // Coordenador agora é muito rápido, 30s é sobra.

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  // Current hour in BRT (UTC-3)
  const brtHour = (new Date().getUTCHours() - 3 + 24) % 24;

  const { data: allRules } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('is_active', true);

  // Load plans for all users in the rules — skip users with expired plans.
  // plan_expires_at = null means unlimited (no expiry).
  const userIds = [...new Set((allRules ?? []).map(r => r.user_id as string))];
  const { data: plans } = await supabaseAdmin
    .from('user_plans')
    .select('user_id, plan_expires_at')
    .in('user_id', userIds);

  const now = new Date();
  const activeUserIds = new Set(
    (plans ?? [])
      .filter(p => p.plan_expires_at === null || new Date(p.plan_expires_at) > now)
      .map(p => p.user_id as string)
  );

  const validRules = (allRules ?? []).filter(r => activeUserIds.has(r.user_id as string));

  const dispatchRules = validRules.filter(r => r.rule_type === 'dispatch');
  const fetchRules = validRules.filter(r => r.rule_type === 'fetch');

  const results: Record<string, unknown>[] = [];
  const debug: Record<string, unknown>[] = [];
  const fetchResults: Record<string, unknown>[] = [];

  // --- ENFILEIRAMENTO FETCH ---
  for (const rule of fetchRules) {
    let intervalOk = true;
    if (rule.last_run_at) {
      const elapsed = (Date.now() - new Date(rule.last_run_at).getTime()) / 60000;
      intervalOk = elapsed >= rule.interval_minutes;
    }

    if (!intervalOk) {
      debug.push({ type: 'fetch', ruleId: rule.id, skipped: 'interval not elapsed' });
      continue;
    }

    // Marca como enfileirado para não duplicar no mesmo 5 minutos
    await supabaseAdmin
      .from('automation_rules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', rule.id);

    const { error: fErr } = await supabaseAdmin.rpc('dz_enqueue_fetch', {
      job: {
        ruleId: rule.id,
        userId: rule.user_id,
        marketplace: rule.marketplace,
        enqueuedAt: new Date().toISOString()
      }
    });

    if (fErr) {
      fetchResults.push({ ruleId: rule.id, error: `Falha ao enfileirar: ${fErr.message}` });
    } else {
      fetchResults.push({ ruleId: rule.id, status: 'Enqueued' });
    }
  }

  // --- ENFILEIRAMENTO DISPATCH ---
  for (const rule of dispatchRules) {
    const effectiveEnd = rule.end_hour === 0 ? 24 : rule.end_hour;
    const inWindow = !(brtHour < rule.start_hour || brtHour >= effectiveEnd);
    
    let intervalOk = true;
    if (rule.last_run_at) {
      const elapsed = (Date.now() - new Date(rule.last_run_at).getTime()) / 60000;
      intervalOk = elapsed >= rule.interval_minutes;
    }
    
    debug.push({ ruleId: rule.id, brtHour, start: rule.start_hour, end: effectiveEnd, inWindow, intervalOk });

    if (!inWindow || !intervalOk) continue;

    const groupIds: string[] = rule.target_group_ids ?? [];
    if (groupIds.length === 0) continue;

    // Enfileiramento do job completo por regra — Worker fará a validação minuciosa
    await supabaseAdmin
      .from('automation_rules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', rule.id);

    const { error: dErr } = await supabaseAdmin.rpc('dz_enqueue_dispatch', {
      job: {
        ruleId: rule.id,
        userId: rule.user_id,
        marketplace: rule.marketplace,
        groupIds: groupIds,
        enqueuedAt: new Date().toISOString()
      }
    });

    if (dErr) {
      results.push({ ruleId: rule.id, error: `Falha ao enfileirar: ${dErr.message}` });
    } else {
      results.push({ ruleId: rule.id, status: 'Enqueued', groupIds });
    }
  }

  return NextResponse.json({
    ok: true,
    hour: brtHour,
    fetchEnqueuedCount: fetchResults.filter(r => r.status === 'Enqueued').length,
    dispatchEnqueuedCount: results.filter(r => r.status === 'Enqueued').length,
    debug,
    results,
    fetchResults
  });
}
