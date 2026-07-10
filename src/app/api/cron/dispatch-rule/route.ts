// Endpoint dedicado por regra — processa UMA dispatch rule de forma independente.
// Pode ser chamado manualmente para debug ou pelo coordinator de forma fire-and-forget.
// NÃO SUBSTITUI o /api/cron/automation — funciona de forma complementar.
//
// Uso manual/debug:
//   GET /api/cron/dispatch-rule?ruleId=<uuid>
//   Authorization: Bearer <CRON_SECRET>
//
// Uso pelo coordinator (via pg_net — fire and forget):
//   SELECT net.http_get(url := '...dispatch-rule?ruleId=X', headers := '{"Authorization":"Bearer ..."}');
// 60s max: keeps this function out of Vercel Fluid billing (>60s triggers Fluid).
export const maxDuration = 60;

import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { dispatchGroup } from '@/lib/dispatch';

// Register connectors
import '@/lib/connectors/amazon';
import '@/lib/connectors/mercadolivre';
import '@/lib/connectors/shopee';
import '@/lib/connectors/aliexpress';
import '@/lib/connectors/kabum';

const CRON_SECRET = process.env.CRON_SECRET;

export async function GET(req: NextRequest) {
  const authHeader = req.headers.get('authorization');
  if (!CRON_SECRET || authHeader !== `Bearer ${CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const ruleId = req.nextUrl.searchParams.get('ruleId');
  if (!ruleId) {
    return NextResponse.json({ error: 'ruleId query param is required' }, { status: 400 });
  }

  // Fetch the specific rule
  const { data: rule } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('id', ruleId)
    .eq('is_active', true)
    .eq('rule_type', 'dispatch')
    .maybeSingle();

  if (!rule) {
    return NextResponse.json({ ok: true, skipped: 'Rule not found or not an active dispatch rule' });
  }

  // Check time window (BRT = UTC-3)
  const brtHour = (new Date().getUTCHours() - 3 + 24) % 24;
  const effectiveEnd = rule.end_hour === 0 ? 24 : rule.end_hour;
  const inWindow = !(brtHour < rule.start_hour || brtHour >= effectiveEnd);

  if (!inWindow) {
    return NextResponse.json({
      ok: true,
      skipped: `Outside time window (${rule.start_hour}h–${effectiveEnd}h BRT, current: ${brtHour}h BRT)`,
    });
  }

  // Check dispatch interval
  if (rule.last_run_at) {
    const elapsed = (Date.now() - new Date(rule.last_run_at).getTime()) / 60000;
    if (elapsed < rule.interval_minutes) {
      return NextResponse.json({
        ok: true,
        skipped: `Interval not elapsed (${elapsed.toFixed(1)}/${rule.interval_minutes} min)`,
      });
    }
  }

  const groupIds: string[] = rule.target_group_ids ?? [];
  if (groupIds.length === 0) {
    return NextResponse.json({ ok: true, skipped: 'No target groups configured for this rule' });
  }

  // Batch-validate — 1 query, filters only active groups belonging to this user
  const { data: activeGroups } = await supabaseAdmin
    .from('dispatch_groups')
    .select('*')
    .eq('user_id', rule.user_id)
    .in('id', groupIds)
    .eq('is_active', true);

  const activeGroupMap = new Map((activeGroups ?? []).map(g => [g.id as string, g]));

  if (activeGroupMap.size === 0) {
    return NextResponse.json({ ok: true, skipped: 'No active groups found for this rule' });
  }

  // Update last_run_at immediately — prevent re-queuing on next tick if we time out
  await supabaseAdmin
    .from('automation_rules')
    .update({ last_run_at: new Date().toISOString() })
    .eq('id', rule.id);

  const results: Record<string, unknown>[] = [];

  // Groups within a rule are serial (same WhatsApp instance, respect rate limits)
  for (const groupId of groupIds) {
    const group = activeGroupMap.get(groupId);
    if (!group) {
      results.push({ groupId, skipped: 'group inactive or not found' });
      continue;
    }

    const { data: destinations } = await supabaseAdmin
      .from('group_destinations')
      .select('*')
      .eq('group_id', groupId);

    if (!destinations?.length) {
      results.push({ groupId, skipped: 'no destinations configured' });
      continue;
    }

    try {
      const dispatchResult = await dispatchGroup(group, destinations, {
        maxOffers: 1,
        marketplace: rule.marketplace ?? undefined,
      });
      results.push({
        groupId,
        groupName: group.name,
        marketplace: rule.marketplace,
        dispatched: dispatchResult.dispatched,
        skipped: dispatchResult.skipped,
        errors: dispatchResult.errors,
      });
    } catch (err) {
      results.push({ groupId, error: err instanceof Error ? err.message : String(err) });
    }
  }

  return NextResponse.json({
    ok: true,
    ruleId,
    marketplace: rule.marketplace,
    userId: rule.user_id,
    groupsProcessed: results.length,
    results,
  });
}
