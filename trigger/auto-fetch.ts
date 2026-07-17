// trigger/auto-fetch.ts
// Trigger.dev background task: fetches products for active automation fetch rules.
// Triggered by /api/cron/automation every 5 minutes.
import { task } from '@trigger.dev/sdk/v3';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { FetchConfig } from '@/lib/connectors/types';

// Import connectors to register them
import '@/lib/connectors/amazon';
import '@/lib/connectors/mercadolivre';
import '@/lib/connectors/shopee';
import '@/lib/connectors/aliexpress';
import '@/lib/connectors/kabum';
import '@/lib/connectors/temu';
import '@/lib/connectors/shein';
import { getConnector } from '@/lib/connectors/registry';
import { loadMarketplaceCredentials } from '@/lib/credentials';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const autoFetchTask = task({
  id: 'auto-fetch',
  maxDuration: 600,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: { ruleId: string; userId: string; marketplace: string }) => {
    const { ruleId, userId, marketplace } = payload;

    // 1. Load automation_rule, verify is_active and rule_type='fetch'
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

    if (rule.rule_type !== 'fetch') {
      throw new Error(`Rule ${ruleId} is not a fetch rule`);
    }

    // 2. Check interval: skip if not enough time has elapsed since last_run_at
    if (rule.last_run_at) {
      const elapsedMinutes = (Date.now() - new Date(rule.last_run_at).getTime()) / 60000;
      if (elapsedMinutes < rule.interval_minutes) {
        return { skipped: true, reason: 'interval not elapsed' };
      }
    }

    // 3. Load marketplace_connection for user + marketplace, decrypt credentials
    const { data: conn, error: connErr } = await supabaseAdmin
      .from('marketplace_connections')
      .select('encrypted_credentials')
      .eq('user_id', userId)
      .eq('marketplace', marketplace)
      .single();

    if (connErr || !conn) {
      throw new Error(`Marketplace connection not found for user ${userId} / ${marketplace}`);
    }

    const credentials = loadMarketplaceCredentials(conn.encrypted_credentials);

    // 4. Use getConnector to fetch offers (pages 1-3)
    const connector = getConnector(marketplace);

    const fetchConfig: FetchConfig = {
      credentials,
      keywords: [],
      categories: [],
      minDiscount: 0,
      maxPrice: null,
      minSales: 0,
      page: 1,
    };

    const allOffers = [];
    let fetchError: string | null = null;
    try {
      for (let page = 1; page <= 3; page++) {
        const pageOffers = await connector.fetchOffers({ ...fetchConfig, page });
        allOffers.push(...pageOffers);
        if (pageOffers.length === 0) break;
      }
    } catch (err) {
      fetchError = err instanceof Error ? err.message : String(err);
      // Record the error in marketplace_connections for health display
      await supabaseAdmin
        .from('marketplace_connections')
        .update({
          last_fetch_error: fetchError,
          last_fetch_error_at: new Date().toISOString(),
        })
        .eq('user_id', userId)
        .eq('marketplace', marketplace);
      // Re-throw so Trigger.dev retry logic kicks in
      throw new Error(`Fetch failed for ${marketplace}: ${fetchError}`);
    }

    // 5. Record successful fetch in marketplace_connections
    await supabaseAdmin
      .from('marketplace_connections')
      .update({
        last_fetch_success_at: new Date().toISOString(),
        last_fetch_error: null,
        last_fetch_error_at: null,
      })
      .eq('user_id', userId)
      .eq('marketplace', marketplace);

    // 6. Upsert offers to offers table
    if (allOffers.length > 0) {
      const { error: upsertErr } = await supabaseAdmin.from('offers').upsert(
        allOffers.map((o) => ({
          user_id: userId,
          marketplace,
          external_id: o.externalId,
          title: o.title,
          current_price: o.currentPrice,
          original_price: o.originalPrice ?? null,
          discount_percent: o.discountPercent ?? null,
          image_url: o.imageUrl ?? null,
          product_url: o.productUrl,
          affiliate_link: o.affiliateLink ?? null,
          condition: o.condition ?? null,
          installments: o.installments ?? null,
          category: o.category ?? null,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 24 * 60 * 60 * 1000).toISOString(),
        })),
        { onConflict: 'user_id,marketplace,external_id' }
      );
      if (upsertErr) throw new Error(`Offers upsert failed: ${upsertErr.message}`);
    }

    // 7. Update automation_rule: last_run_at, products_found_today (reset if date changed)
    const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];
    const resetAt = rule.products_found_reset_at;
    const isNewDay = !resetAt || resetAt !== today;

    await supabaseAdmin
      .from('automation_rules')
      .update({
        last_run_at: new Date().toISOString(),
        products_found_today: isNewDay
          ? allOffers.length
          : (rule.products_found_today ?? 0) + allOffers.length,
        products_found_reset_at: today,
        updated_at: new Date().toISOString(),
      })
      .eq('id', ruleId);

    // 8. Return result
    return { fetched: allOffers.length, marketplace, userId };
  },
});
