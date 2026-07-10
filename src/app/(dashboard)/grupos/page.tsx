export const dynamic = 'force-dynamic';
export const maxDuration = 30;
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { GroupsClient } from './components/GroupsClient';

export default async function GruposPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];

  // Load connected (valid) marketplaces + Telegram connection
  const [{ data: mpConnections }, { data: tgConn }] = await Promise.all([
    supabaseAdmin
      .from('marketplace_connections')
      .select('marketplace')
      .eq('user_id', user!.id)
      .eq('is_valid', true),
    supabaseAdmin
      .from('channel_connections')
      .select('id')
      .eq('user_id', user!.id)
      .eq('channel_type', 'telegram')
      .eq('is_connected', true)
      .maybeSingle(),
  ]);

  const connectedMarketplaces = (mpConnections ?? []).map((m) => m.marketplace as string);
  const hasTelegramConnected = !!tgConn;

  // Load groups with destination count and today's dispatch count
  const { data: groups } = await supabaseAdmin
    .from('dispatch_groups')
    .select(
      `
      id, name, marketplaces, is_active, daily_limit,
      min_discount, keywords, blocked_keywords,
      min_price, max_price, min_sales, template_text,
      group_destinations(target_id, target_name, channel_type)
    `
    )
    .eq('user_id', user!.id)
    .order('created_at', { ascending: false });

  // Get today's dispatch counts per group + active automation rules
  const [{ data: todayLogs }, { data: automationRules }] = await Promise.all([
    supabaseAdmin
      .from('dispatch_logs')
      .select('group_id')
      .eq('user_id', user!.id)
      .eq('dispatched_date', today)
      .in('status', ['sent', 'pending', 'delivered']),
    supabaseAdmin
      .from('automation_rules')
      .select('target_group_ids, is_active')
      .eq('user_id', user!.id)
      .eq('rule_type', 'dispatch'),
  ]);

  const dispatchCounts = (todayLogs ?? []).reduce<Record<string, number>>(
    (acc, log) => ({ ...acc, [log.group_id]: (acc[log.group_id] ?? 0) + 1 }),
    {}
  );

  // Build per-group automation status from target_group_ids arrays
  const groupAutomation: Record<string, { hasRule: boolean; isActive: boolean }> = {};
  for (const rule of automationRules ?? []) {
    for (const gid of rule.target_group_ids ?? []) {
      if (!groupAutomation[gid]) groupAutomation[gid] = { hasRule: false, isActive: false };
      groupAutomation[gid].hasRule = true;
      if (rule.is_active) groupAutomation[gid].isActive = true;
    }
  }

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const groupsWithMeta = (groups ?? []).map((g: any) => ({
    ...g,
    destinations_count: g.group_destinations?.length ?? 0,
    dispatched_today: dispatchCounts[g.id] ?? 0,
    automation_active: groupAutomation[g.id]?.isActive ?? false,
    has_automation_rule: groupAutomation[g.id]?.hasRule ?? false,
  }));

  return <GroupsClient groups={groupsWithMeta} connectedMarketplaces={connectedMarketplaces} hasTelegramConnected={hasTelegramConnected} />;
}
