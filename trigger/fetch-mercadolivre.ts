// trigger/fetch-mercadolivre.ts
import { task } from '@trigger.dev/sdk/v3';
import { createClient as createAdminClient } from '@supabase/supabase-js';
import type { FetchConfig } from '@/lib/connectors/types';

// Import connector to trigger auto-registration
import '@/lib/connectors/mercadolivre';
import { getConnector } from '@/lib/connectors/registry';
import { loadMarketplaceCredentials } from '@/lib/credentials';

const supabaseAdmin = createAdminClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.SUPABASE_SERVICE_ROLE_KEY!
);

export const fetchMercadoLivreTask = task({
  id: 'fetch-mercadolivre',
  maxDuration: 300,
  retry: {
    maxAttempts: 3,
    factor: 2,
    minTimeoutInMs: 5000,
    maxTimeoutInMs: 30000,
  },
  run: async (payload: {
    userId: string;
    connectionId: string;
    config: Omit<FetchConfig, 'credentials'>;
  }) => {
    const { userId, connectionId, config } = payload;

    const { data: conn, error: connErr } = await supabaseAdmin
      .from('marketplace_connections')
      .select('encrypted_credentials')
      .eq('id', connectionId)
      .eq('user_id', userId)
      .single();

    if (connErr || !conn) {
      throw new Error(`Connection not found: ${connectionId}`);
    }

    const credentials = loadMarketplaceCredentials(conn.encrypted_credentials);

    const connector = getConnector('mercadolivre');
    const offers = await connector.fetchOffers({ ...config, credentials });

    if (offers.length > 0) {
      const { error: upsertErr } = await supabaseAdmin.from('offers').upsert(
        offers.map((o) => ({
          user_id: userId,
          marketplace: 'mercadolivre',
          external_id: o.externalId,
          title: o.title,
          current_price: o.currentPrice,
          original_price: o.originalPrice,
          discount_percent: o.discountPercent,
          image_url: o.imageUrl,
          product_url: o.productUrl,
          affiliate_link: o.affiliateLink,
          condition: o.condition,
          installments: o.installments,
          category: o.category,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        })),
        { onConflict: 'user_id,marketplace,external_id' }
      );
      if (upsertErr) throw new Error(`Offers upsert failed: ${upsertErr.message}`);
    }

    return { fetched: offers.length, userId, marketplace: 'mercadolivre' };
  },
});
