import { supabaseAdmin } from '@/lib/supabase/admin';

export interface DashboardStats {
  totalProducts: number;
  messagesDispatched: number; // total dispatch_log entries sent today
  sentToday: number;          // unique offers sent today
  pending: number;
  successCount: number;
  failedCount: number;
}

export interface DailyDispatch {
  date: string;
  count: number;
}

export interface MarketplaceCount {
  marketplace: string;
  count: number;
}

// Returns aggregated dashboard stats for a user
export async function getDashboardStats(userId: string): Promise<DashboardStats> {
  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0]; // BRT date
  const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 60 * 60 * 1000).toISOString().split('T')[0];

  const [aliveOffersResult, todayLogsResult, dispatched7dResult] = await Promise.all([
    // Total produtos: apenas offers vivos (não expirados)
    supabaseAdmin
      .from('offers')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .gt('expires_at', new Date().toISOString()),
    // Logs de hoje para enviados/falhas
    supabaseAdmin
      .from('dispatch_logs')
      .select('offer_id, status')
      .eq('user_id', userId)
      .eq('dispatched_date', today),
    // Offers enviados nos últimos 7 dias (para calcular pendentes reais)
    supabaseAdmin
      .from('dispatch_logs')
      .select('offer_id')
      .eq('user_id', userId)
      .gte('dispatched_date', sevenDaysAgo)
      .in('status', ['sent', 'delivered', 'read']),
  ]);

  const totalProducts = aliveOffersResult.count ?? 0;
  const logs = todayLogsResult.data ?? [];

  const sentOfferIds = new Set<string>();
  let failedCount = 0;
  let messagesDispatched = 0;

  for (const log of logs) {
    if (['sent', 'delivered', 'read'].includes(log.status)) {
      sentOfferIds.add(log.offer_id);
      messagesDispatched++;
    } else if (log.status === 'failed') {
      failedCount++;
    }
  }

  const sentToday = sentOfferIds.size;
  const successCount = sentToday;
  const dispatched7dIds = new Set((dispatched7dResult.data ?? []).map((l) => l.offer_id));
  const pending = Math.max(0, totalProducts - dispatched7dIds.size);

  return { totalProducts, messagesDispatched, sentToday, pending, successCount, failedCount };
}

// Returns dispatch counts per day for the last 7 days
export async function getLast7DaysDispatches(userId: string): Promise<DailyDispatch[]> {
  // Calculate 7-day window using BRT dates (UTC-3)
  const brtNow = Date.now() - 3 * 3600000;
  const startDate = new Date(brtNow - 6 * 86400000).toISOString().split('T')[0];

  const { data, error } = await supabaseAdmin
    .from('dispatch_logs')
    .select('dispatched_date')
    .eq('user_id', userId)
    .gte('dispatched_date', startDate)
    .in('status', ['sent', 'delivered', 'read']);

  if (error) throw new Error(`getLast7DaysDispatches: ${error.message}`);

  // Group by date in memory
  const countsByDate = new Map<string, number>();

  // Initialize all 7 days with 0 (BRT dates)
  for (let i = 6; i >= 0; i--) {
    const dateStr = new Date(brtNow - i * 86400000).toISOString().split('T')[0];
    countsByDate.set(dateStr, 0);
  }

  // Count dispatches per day
  for (const row of data ?? []) {
    const date = row.dispatched_date;
    countsByDate.set(date, (countsByDate.get(date) ?? 0) + 1);
  }

  return Array.from(countsByDate.entries())
    .map(([date, count]) => ({ date, count }))
    .sort((a, b) => a.date.localeCompare(b.date));
}

// Returns offer count grouped by marketplace for a user (only alive offers)
export async function getProductsPerMarketplace(userId: string): Promise<MarketplaceCount[]> {
  const { data, error } = await supabaseAdmin
    .from('offers')
    .select('marketplace')
    .eq('user_id', userId)
    .gt('expires_at', new Date().toISOString());

  if (error) throw new Error(`getProductsPerMarketplace: ${error.message}`);

  // Group by marketplace in memory
  const counts = new Map<string, number>();
  for (const row of data ?? []) {
    counts.set(row.marketplace, (counts.get(row.marketplace) ?? 0) + 1);
  }

  return Array.from(counts.entries())
    .map(([marketplace, count]) => ({ marketplace, count }))
    .sort((a, b) => b.count - a.count);
}
