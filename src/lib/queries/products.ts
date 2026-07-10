import { supabaseAdmin } from '@/lib/supabase/admin';

export interface ProductQueueFilters {
  marketplace?: string;
  status?: 'pending' | 'sent' | 'failed';
  search?: string;
  page?: number;
  limit?: number;
}

export interface ProductQueueItem {
  id: string;
  user_id: string;
  marketplace: string;
  external_id: string;
  title: string;
  current_price: number;
  original_price: number | null;
  discount_percent: number | null;
  image_url: string | null;
  product_url: string;
  condition: string | null;
  installments: string | null;
  category: string | null;
  affiliate_link: string | null;
  fetched_at: string;
  expires_at: string | null;
  created_at: string;
  status: 'pending' | 'sent' | 'failed';
  last_dispatched_at: string | null;
  last_dispatched_status: string | null;
}

export interface ProductStats {
  total: number;
  pending: number;
  sentToday: number;
  failed: number;
}

// Fetches product queue with computed status, server-side filtering, and pagination
export async function getProductQueue(
  userId: string,
  filters: ProductQueueFilters = {}
): Promise<{ items: ProductQueueItem[]; total: number }> {
  const now = new Date().toISOString();
  const todaySlash = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0]; // BRT date
  const pageLimit = filters.limit ?? 50;
  const page = Math.max(1, filters.page ?? 1);
  const offset = (page - 1) * pageLimit;

  // Step 1: Fetch today's logs to build status maps for DB-level filtering
  const { data: todayLogs } = await supabaseAdmin
    .from('dispatch_logs')
    .select('offer_id, status')
    .eq('user_id', userId)
    .eq('dispatched_date', todaySlash);

  const sentIds = new Set<string>();
  const failedIds = new Set<string>();

  for (const log of todayLogs ?? []) {
    if (!log.offer_id) continue;
    if (['sent', 'delivered', 'read'].includes(log.status)) {
      sentIds.add(log.offer_id);
    } else if (log.status === 'failed') {
      failedIds.add(log.offer_id);
    }
  }
  // Best case wins: sent overrides failed
  for (const id of sentIds) failedIds.delete(id);
  const dispatchedIds = new Set([...sentIds, ...failedIds]);

  // Early exit when filter can't match anything
  if (filters.status === 'sent' && sentIds.size === 0) return { items: [], total: 0 };
  if (filters.status === 'failed' && failedIds.size === 0) return { items: [], total: 0 };

  // Step 2: Build offers query with exact count for pagination
  let offersQuery = supabaseAdmin
    .from('offers')
    .select('*', { count: 'exact' })
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`)
    .order('fetched_at', { ascending: false });

  if (filters.marketplace) {
    offersQuery = offersQuery.eq('marketplace', filters.marketplace);
  }

  if (filters.search) {
    offersQuery = offersQuery.ilike('title', `%${filters.search}%`);
  }

  // Apply status filter at DB level using today's log ID sets
  if (filters.status === 'sent') {
    offersQuery = offersQuery.in('id', Array.from(sentIds));
  } else if (filters.status === 'failed') {
    offersQuery = offersQuery.in('id', Array.from(failedIds));
  } else if (filters.status === 'pending' && dispatchedIds.size > 0) {
    offersQuery = offersQuery.not('id', 'in', `(${Array.from(dispatchedIds).join(',')})`);
  }

  // Apply pagination window
  offersQuery = offersQuery.range(offset, offset + pageLimit - 1);

  const { data: offers, error, count } = await offersQuery;

  if (error) throw new Error(`getProductQueue: ${error.message}`);
  if (!offers || offers.length === 0) return { items: [], total: count ?? 0 };

  // Step 3: Fetch 30-day logs only for current page's items (efficient)
  const thirtyDaysAgo = new Date(Date.now() - 30 * 24 * 3600 * 1000).toISOString();
  const pageOfferIds = offers.map((o) => o.id);

  const { data: logs } = await supabaseAdmin
    .from('dispatch_logs')
    .select('offer_id, status, dispatched_at')
    .eq('user_id', userId)
    .in('offer_id', pageOfferIds)
    .gte('dispatched_at', thirtyDaysAgo);

  // Build last-dispatch map for history display
  const lastDispatchMap = new Map<string, { at: string; status: string }>();
  for (const log of logs ?? []) {
    if (!log.offer_id) continue;
    const existing = lastDispatchMap.get(log.offer_id);
    if (!existing || new Date(log.dispatched_at) > new Date(existing.at)) {
      lastDispatchMap.set(log.offer_id, { at: log.dispatched_at, status: log.status });
    }
  }

  // Step 4: Compute per-offer status from today's log sets
  const items: ProductQueueItem[] = offers.map((offer) => {
    let status: 'pending' | 'sent' | 'failed' = 'pending';
    if (sentIds.has(offer.id)) status = 'sent';
    else if (failedIds.has(offer.id)) status = 'failed';
    return {
      ...offer,
      status,
      last_dispatched_at: lastDispatchMap.get(offer.id)?.at ?? null,
      last_dispatched_status: lastDispatchMap.get(offer.id)?.status ?? null,
    };
  });

  return { items, total: count ?? 0 };
}

// Returns aggregated counts for product stats panel
export async function getProductStats(userId: string): Promise<ProductStats> {
  const now = new Date().toISOString();
  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0]; // BRT date

  // 1. Get all active offers for this user
  const { data: offers, error: offersError } = await supabaseAdmin
    .from('offers')
    .select('id')
    .eq('user_id', userId)
    .or(`expires_at.is.null,expires_at.gt.${now}`);

  if (offersError) {
    console.error('[getProductStats] Error fetching offers:', offersError);
    return { total: 0, pending: 0, sentToday: 0, failed: 0 };
  }

  const activeOfferIds = new Set((offers ?? []).map((o) => o.id));
  const total = activeOfferIds.size;

  // 2. Fetch today's dispatch_logs
  const { data: logs, error: logsError } = await supabaseAdmin
    .from('dispatch_logs')
    .select('offer_id, status')
    .eq('user_id', userId)
    .eq('dispatched_date', today);

  if (logsError) {
    console.error('[getProductStats] Error fetching logs:', logsError);
    return { total, pending: total, sentToday: 0, failed: 0 };
  }

  const sentOfferIds = new Set<string>();
  const failedOfferIds = new Set<string>();

  for (const log of logs ?? []) {
    // Only count if the offer is still active (not cleared)
    if (!activeOfferIds.has(log.offer_id)) continue;

    if (['sent', 'delivered', 'read'].includes(log.status)) {
      sentOfferIds.add(log.offer_id);
    } else if (log.status === 'failed') {
      failedOfferIds.add(log.offer_id);
    }
  }

  // Remove failed if they were also sent (best case wins)
  for (const id of sentOfferIds) {
    failedOfferIds.delete(id);
  }

  const sentToday = sentOfferIds.size;
  const failed = failedOfferIds.size;
  const pending = Math.max(0, total - sentToday - failed);

  return { total, pending, sentToday, failed };
}

// Validates that all offerIds belong to userId.
// Actual dispatch_log insertion happens in the dispatch flow.
export async function markProductsSent(
  userId: string,
  offerIds: string[]
): Promise<{ valid: string[]; invalid: string[] }> {
  if (offerIds.length === 0) return { valid: [], invalid: [] };

  const { data } = await supabaseAdmin
    .from('offers')
    .select('id')
    .eq('user_id', userId)
    .in('id', offerIds);

  const validIds = new Set((data ?? []).map((o) => o.id));
  const valid = offerIds.filter((id) => validIds.has(id));
  const invalid = offerIds.filter((id) => !validIds.has(id));

  return { valid, invalid };
}

