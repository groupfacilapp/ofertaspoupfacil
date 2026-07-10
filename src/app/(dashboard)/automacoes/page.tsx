export const dynamic = 'force-dynamic';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { AutomacoesClient } from './components/AutomacoesClient';
import type { AutomationRule } from '@/lib/queries/automation';

export default async function AutomacoesPage() {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) return null;

  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];

  // Fetch all automation rules for user
  const { data: rulesRaw } = await supabaseAdmin
    .from('automation_rules')
    .select('*')
    .eq('user_id', user.id)
    .order('marketplace')
    .order('rule_type');

  const rules: AutomationRule[] = (rulesRaw ?? []).map((row) => ({
    ...row,
    target_group_ids: row.target_group_ids ?? [],
  }));

  // Fetch active dispatch groups for user (for the group selector)
  const { data: groupsRaw } = await supabaseAdmin
    .from('dispatch_groups')
    .select('id, name, marketplaces')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name');

  const groups = (groupsRaw ?? []).map((g) => ({
    id: g.id as string,
    name: g.name as string,
    marketplaces: (g.marketplaces ?? []) as string[],
  }));

  // Fetch connected marketplaces
  const { data: mpConnections } = await supabaseAdmin
    .from('marketplace_connections')
    .select('marketplace')
    .eq('user_id', user.id)
    .eq('is_valid', true);

  const connectedMarketplaces = (mpConnections ?? []).map((m) => m.marketplace as string);

  // Stats: pending products count
  // "Pendentes" = offers vivos (não expirados) que ainda não foram enviados nos últimos 7 dias
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];
  const [aliveOffersResult, dispatched7dResult, lastDispatchResult] = await Promise.all([
    supabaseAdmin
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', user.id)
      .gt('expires_at', new Date().toISOString()),
    supabaseAdmin
      .from('dispatch_logs')
      .select('offer_id')
      .eq('user_id', user.id)
      .gte('dispatched_date', sevenDaysAgo)
      .in('status', ['sent', 'delivered', 'read']),
    supabaseAdmin
      .from('dispatch_logs')
      .select('created_at')
      .eq('user_id', user.id)
      .in('status', ['sent', 'delivered', 'read'])
      .order('created_at', { ascending: false })
      .limit(1)
      .maybeSingle(),
  ]);

  const aliveOffers = aliveOffersResult.count ?? 0;
  const dispatched7dIds = new Set((dispatched7dResult.data ?? []).map((l) => l.offer_id));
  const pending = Math.max(0, aliveOffers - dispatched7dIds.size);

  // Products found today: sum from fetch rules
  const fetchedToday = rules
    .filter((r) => r.rule_type === 'fetch')
    .reduce((sum, r) => sum + (r.products_found_today ?? 0), 0);

  // Last dispatch: actual last sent timestamp from dispatch_logs (not last_run_at which can lag)
  const lastDispatchAt = lastDispatchResult.data?.created_at ?? null;

  const stats = { pending, fetchedToday, lastDispatchAt };

  return (
    <AutomacoesClient
      rules={rules}
      groups={groups}
      connectedMarketplaces={connectedMarketplaces}
      stats={stats}
    />
  );
}
