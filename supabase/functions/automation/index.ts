// Supabase Edge Function: automation coordinator
// Reads active automation_rules and enqueues jobs into pgmq.
// Runs every 5 minutes via pg_cron.
//
// pg_cron schedule (run in Supabase SQL Editor):
//   SELECT cron.schedule('dz-automation-5m', '*/5 * * * *',
//     $$ SELECT net.http_post(
//          url := 'https://yuypedritsizhuegslej.supabase.co/functions/v1/automation',
//          headers := '{"Authorization": "Bearer <CRON_SECRET>", "Content-Type": "application/json"}'::jsonb,
//          body := '{}'::jsonb
//        ); $$
//   );

import { supabaseAdmin } from '../_shared/supabase.ts';

const CRON_SECRET = Deno.env.get('CRON_SECRET');

Deno.serve(async (req: Request) => {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return new Response(JSON.stringify({ error: 'Unauthorized' }), {
      status: 401, headers: { 'Content-Type': 'application/json' },
    });
  }

  // Current hour in BRT (UTC-3)
  const brtHour = (new Date().getUTCHours() - 3 + 24) % 24;

  const { data: allRules } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('is_active', true);

  // Load plans for all users in the rules — skip users with expired plans.
  // plan_expires_at = null means unlimited (no expiry).
  const userIds = [...new Set((allRules ?? []).map((r: Record<string, unknown>) => r.user_id as string))];
  const { data: plans } = await supabaseAdmin
    .from('user_plans')
    .select('user_id, plan_expires_at')
    .in('user_id', userIds);

  const now = new Date();
  const activeUserIds = new Set(
    (plans ?? [])
      .filter((p: Record<string, unknown>) =>
        p.plan_expires_at === null || new Date(p.plan_expires_at as string) > now
      )
      .map((p: Record<string, unknown>) => p.user_id as string)
  );

  const validRules = (allRules ?? []).filter((r: Record<string, unknown>) => activeUserIds.has(r.user_id as string));

  const dispatchRules = validRules.filter((r: Record<string, unknown>) => r.rule_type === 'dispatch');
  const fetchRules = validRules.filter((r: Record<string, unknown>) => r.rule_type === 'fetch');

  const results: Record<string, unknown>[] = [];
  const debug: Record<string, unknown>[] = [];
  const fetchResults: Record<string, unknown>[] = [];

  // --- Enqueue fetch jobs ---
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

  // --- Enqueue dispatch jobs ---
  for (const rule of dispatchRules) {
    let inWindow = false;
    if (rule.start_hour < rule.end_hour) {
      inWindow = brtHour >= rule.start_hour && brtHour < rule.end_hour;
    } else if (rule.start_hour > rule.end_hour) {
      inWindow = brtHour >= rule.start_hour || brtHour < rule.end_hour;
    } else {
      inWindow = true; // start == end means 24/7
    }

    let intervalOk = true;
    if (rule.last_run_at) {
      const elapsed = (Date.now() - new Date(rule.last_run_at).getTime()) / 60000;
      intervalOk = elapsed >= rule.interval_minutes;
    }

    debug.push({ ruleId: rule.id, brtHour, start: rule.start_hour, end: rule.end_hour, inWindow, intervalOk });

    if (!inWindow || !intervalOk) continue;

    const groupIds: string[] = rule.target_group_ids ?? [];
    if (groupIds.length === 0) continue;

    await supabaseAdmin
      .from('automation_rules')
      .update({ last_run_at: new Date().toISOString() })
      .eq('id', rule.id);

    // Split groupIds into batches of 3 to avoid worker timeout with many groups
    const BATCH_SIZE = 3;
    for (let i = 0; i < groupIds.length; i += BATCH_SIZE) {
      const batch = groupIds.slice(i, i + BATCH_SIZE);
      const { error: dErr } = await supabaseAdmin.rpc('dz_enqueue_dispatch', {
        job: {
          ruleId: rule.id,
          userId: rule.user_id,
          marketplace: rule.marketplace,
          groupIds: batch,
          enqueuedAt: new Date().toISOString()
        }
      });

      if (dErr) {
        results.push({ ruleId: rule.id, error: `Falha ao enfileirar: ${dErr.message}` });
      } else {
        results.push({ ruleId: rule.id, status: 'Enqueued', groupIds: batch });
      }
    }
  }

  return new Response(JSON.stringify({
    ok: true,
    hour: brtHour,
    fetchEnqueuedCount: fetchResults.filter((r: Record<string, unknown>) => r.status === 'Enqueued').length,
    dispatchEnqueuedCount: results.filter((r: Record<string, unknown>) => r.status === 'Enqueued').length,
    debug,
    results,
    fetchResults
  }), { headers: { 'Content-Type': 'application/json' } });
});
