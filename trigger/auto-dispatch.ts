// trigger/auto-dispatch.ts
// Trigger.dev background task: dispatches pending products for active automation dispatch rules.
// Triggered by /api/cron/automation every 5 minutes.
import { task } from '@trigger.dev/sdk/v3';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import { dispatchGroup } from '@/lib/dispatch';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const autoDispatchTask = task({
  id: 'auto-dispatch',
  maxDuration: 600,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: {
    ruleId: string;
    userId: string;
    marketplace: string;
    groupId: string;
  }) => {
    const { ruleId, userId, groupId } = payload;

    // 1. Load automation_rule, verify is_active and rule_type='dispatch'
    const { data: rule, error: ruleErr } = await supabaseAdmin
      .from('automation_rules')
      .select('*')
      .eq('id', ruleId)
      .eq('user_id', userId)
      .single();

    if (ruleErr || !rule) {
      throw new Error(`Automation rule not found: ${ruleId}`);
    }

    if (!rule.is_active) {
      return { skipped: true, reason: 'rule is inactive' };
    }

    if (rule.rule_type !== 'dispatch') {
      throw new Error(`Rule ${ruleId} is not a dispatch rule`);
    }

    // 2. Check interval: skip if not enough time has elapsed since last_run_at
    if (rule.last_run_at) {
      const elapsedMinutes = (Date.now() - new Date(rule.last_run_at).getTime()) / 60000;
      if (elapsedMinutes < rule.interval_minutes) {
        return { skipped: true, reason: 'interval not elapsed' };
      }
    }

    // 3. Check time window using BRT timezone (UTC-3). end_hour=0 means midnight (end of day).
    const brtHour = (new Date().getUTCHours() - 3 + 24) % 24;
    const effectiveEnd = rule.end_hour === 0 ? 24 : rule.end_hour;
    if (brtHour < rule.start_hour || brtHour >= effectiveEnd) {
      return { skipped: true, reason: 'outside time window' };
    }

    // 4. Load dispatch_group by groupId, verify it belongs to user and is_active
    const { data: group, error: groupErr } = await supabaseAdmin
      .from('dispatch_groups')
      .select('*')
      .eq('id', groupId)
      .eq('user_id', userId)
      .single();

    if (groupErr || !group) {
      throw new Error(`Dispatch group not found: ${groupId}`);
    }

    if (!group.is_active) {
      return { skipped: true, reason: 'dispatch group is inactive' };
    }

    // 5. Load group_destinations for the group
    const { data: destinations, error: destErr } = await supabaseAdmin
      .from('group_destinations')
      .select('*')
      .eq('group_id', groupId);

    if (destErr) {
      throw new Error(`Failed to load destinations: ${destErr.message}`);
    }

    if (!destinations || destinations.length === 0) {
      return { skipped: true, reason: 'no destinations configured' };
    }

    // 6. Call dispatchGroup — 1 offer per automation run; interval is controlled
    // by automation_rules.interval_minutes + the cron schedule, not by setTimeout inside dispatchGroup
    const dispatchResult = await dispatchGroup(group, destinations, { maxOffers: 1 });

    // 7. Update automation_rule: last_run_at = now()
    await supabaseAdmin
      .from('automation_rules')
      .update({
        last_run_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId);

    // 8. Return dispatch result
    return dispatchResult;
  },
});
