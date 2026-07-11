'use server';

import { revalidatePath } from 'next/cache';
import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhatsAppClient, makeInstanceName } from '@/lib/platform-settings';
import type { WhatsAppClient } from '@/lib/whatsapp-client';
import { TelegramClient, formatForTelegram } from '@/lib/telegram';
import { loadChannelConfig } from '@/lib/credentials';
import { formatMessage } from '@/lib/dispatch';
import type { NormalizedOffer } from '@/lib/connectors/types';
import { getConnector } from '@/lib/connectors/registry';
import { loadMarketplaceCredentials } from '@/lib/credentials';

// Side-effect imports to register connectors
import '@/lib/connectors/amazon';
import '@/lib/connectors/mercadolivre';
import '@/lib/connectors/shopee';
import '@/lib/connectors/aliexpress';
import '@/lib/connectors/kabum';
import '@/lib/connectors/temu';
import '@/lib/connectors/shein';

export async function sendProduct(
  offerId: string,
  options?: { groupIds?: string[]; customMessage?: string }
): Promise<{ success: boolean; error?: string; dispatched?: number }> {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return { success: false, error: 'Não autenticado' };
  }

  // Validate user owns the offer
  const { data: offer, error: offerError } = await supabaseAdmin
    .from('offers')
    .select('*')
    .eq('id', offerId)
    .eq('user_id', user.id)
    .single();

  if (offerError || !offer) {
    return { success: false, error: 'Produto não encontrado' };
  }

  // Find active dispatch_groups for user that include this offer's marketplace
  let groupQuery = supabaseAdmin
    .from('dispatch_groups')
    .select(
      `
      id, name, user_id, marketplaces, min_discount, min_price, max_price,
      min_sales, daily_limit, messaging_interval_minutes, template_text,
      keywords, blocked_keywords,
      group_destinations(id, target_id, target_name, channel_type)
    `
    )
    .eq('user_id', user.id)
    .eq('is_active', true)
    .contains('marketplaces', [offer.marketplace]);

  // Filter to specific groups if provided
  if (options?.groupIds && options.groupIds.length > 0) {
    groupQuery = groupQuery.in('id', options.groupIds);
  }

  const { data: groups } = await groupQuery;

  if (!groups || groups.length === 0) {
    return {
      success: false,
      error: 'Nenhum grupo de disparo ativo para este marketplace. Configure um grupo primeiro.',
    };
  }

  // Build a NormalizedOffer from the DB row
  const normalizedOffer: NormalizedOffer = {
    externalId: offer.external_id,
    marketplace: offer.marketplace,
    title: offer.title,
    currentPrice: offer.current_price,
    originalPrice: offer.original_price ?? null,
    discountPercent: offer.discount_percent ?? null,
    imageUrl: offer.image_url ?? null,
    productUrl: offer.product_url,
    affiliateLink: offer.affiliate_link ?? null,
    condition: offer.condition ?? null,
    installments: offer.installments ?? null,
    category: offer.category ?? null,
    sales: null,
    couponCode: null,
  };

  // Get WhatsApp client
  let evo: WhatsAppClient | null = null;
  let instanceName = '';
  let waProviderToken: string | undefined;
  try {
    evo = await getWhatsAppClient();
    instanceName = await makeInstanceName(user.id);
    const { data: waInst } = await supabaseAdmin
      .from('whatsapp_instances')
      .select('provider_token')
      .eq('user_id', user.id)
      .maybeSingle();
    waProviderToken = waInst?.provider_token ?? undefined;
  } catch {
    // WhatsApp unavailable — Telegram destinations can still work
  }

  // Get Telegram client (for Telegram destinations)
  let tg: TelegramClient | null = null;
  try {
    const { data: tgConn } = await supabaseAdmin
      .from('channel_connections')
      .select('encrypted_config')
      .eq('user_id', user.id)
      .eq('channel_type', 'telegram')
      .maybeSingle();
    if (tgConn) {
      const config = loadChannelConfig(tgConn.encrypted_config);
      tg = new TelegramClient(config.botToken as string);
    }
  } catch {
    // Telegram unavailable
  }

  if (!evo && !tg) {
    return { success: false, error: 'Nenhum canal disponível (WhatsApp desconectado e Telegram não configurado).' };
  }

  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];
  let totalDispatched = 0;

  for (const group of groups) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const destinations = (group as any).group_destinations ?? [];
    const template = group.template_text || null;
    const message = options?.customMessage ?? formatMessage(
      template ||
        `🔥 *{titulo}*\n\n💰 De ~R$ {preco_antigo}~ por *R$ {preco}* ({desconto}% OFF){parcelamento_line}\n\n🛍️ {marketplace}\n🔗 {link}`,
      normalizedOffer
    );

    for (const dest of destinations) {
      if (dest.channel_type === 'whatsapp' && !evo) continue;
      if (dest.channel_type === 'telegram' && !tg) continue;
      if (dest.channel_type !== 'whatsapp' && dest.channel_type !== 'telegram') continue;

      const { data: log } = await supabaseAdmin
        .from('dispatch_logs')
        .insert({
          user_id: user.id,
          group_id: group.id,
          offer_id: offerId,
          channel_type: dest.channel_type,
          dispatched_date: today,
          status: 'pending',
        })
        .select('id')
        .single();

      try {
        if (dest.channel_type === 'whatsapp' && evo) {
          if (normalizedOffer.imageUrl) {
            try {
              await evo.sendImage(instanceName, dest.target_id, normalizedOffer.imageUrl, message, waProviderToken);
            } catch {
              await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
            }
          } else {
            await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
          }
        } else if (dest.channel_type === 'telegram' && tg) {
          const tgMsg = formatForTelegram(message);
          if (normalizedOffer.imageUrl) {
            await tg.sendPhoto(dest.target_id, normalizedOffer.imageUrl, tgMsg);
          } else {
            await tg.sendMessage(dest.target_id, tgMsg);
          }
        }

        if (log) {
          await supabaseAdmin.from('dispatch_logs').update({ status: 'sent' }).eq('id', log.id);
        }
        totalDispatched++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        if (log) {
          await supabaseAdmin.from('dispatch_logs').update({ status: 'failed', error_message: errMsg }).eq('id', log.id);
        }
      }
    }
  }

  revalidatePath('/produtos');
  return { success: true, dispatched: totalDispatched };
}

export async function clearSentProducts(): Promise<{ deleted: number; error?: string }> {
  try {
    const supabase = await createClient();
    const {
      data: { user },
    } = await supabase.auth.getUser();

    if (!user) {
      return { deleted: 0, error: 'Não autenticado' };
    }

    // Use BRT-adjusted date to match getProductQueue
    const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];

    // Get IDs of offers that were successfully sent today
    const { data: logs, error: logsError } = await supabaseAdmin
      .from('dispatch_logs')
      .select('offer_id')
      .eq('user_id', user.id)
      .eq('dispatched_date', today)
      .in('status', ['sent', 'delivered', 'read']);

    if (logsError) {
      console.error('[clearSentProducts] Error fetching logs:', logsError);
      return { deleted: 0, error: `Erro ao buscar logs: ${logsError.message}` };
    }

    if (!logs || logs.length === 0) {
      revalidatePath('/produtos');
      return { deleted: 0 };
    }

    const offerIds = [...new Set(logs.map((l) => l.offer_id).filter(Boolean))];

    if (offerIds.length === 0) {
      revalidatePath('/produtos');
      return { deleted: 0 };
    }

    // Update in chunks to be safe (avoid "Bad Request" on large filters)
    let totalUpdated = 0;
    const chunkSize = 100;
    const pastTimestamp = new Date(0).toISOString();
    const now = new Date().toISOString();

    for (let i = 0; i < offerIds.length; i += chunkSize) {
      const chunk = offerIds.slice(i, i + chunkSize);
      
      // Only update if they are not already expired/archived
      const { data: updated, error: updateError } = await supabaseAdmin
        .from('offers')
        .update({ expires_at: pastTimestamp } as any)
        .eq('user_id', user.id)
        .in('id', chunk)
        .or(`expires_at.is.null,expires_at.gt.${now}`)
        .select('id');

      if (updateError) {
        console.error(`[clearSentProducts] Error updating batch starting at ${i}:`, updateError);
        return { deleted: totalUpdated, error: `Erro ao atualizar lote: ${updateError.message}` };
      }
      totalUpdated += (updated?.length ?? 0);
    }

    revalidatePath('/produtos');
    return { deleted: totalUpdated };
  } catch (err) {
    console.error('[clearSentProducts] Unexpected error:', err);
    return { deleted: 0, error: `Erro inesperado: ${err instanceof Error ? err.message : String(err)}` };
  }
}


// ─── Manual product search ────────────────────────────────────────────────────

type SingleMarketplace = 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein';

async function fetchAndUpsertOffers(
  userId: string,
  marketplace: SingleMarketplace,
  encryptedCredentials: string,
  input: { keyword?: string; category?: string; minDiscount: number; maxPrice: number | null }
): Promise<NormalizedOffer[]> {
  const credentials = loadMarketplaceCredentials(encryptedCredentials);
  const connector = getConnector(marketplace);
  const offers = await connector.fetchOffers({
    credentials,
    keywords: input.keyword ? [input.keyword] : [],
    categories: input.category && input.category !== 'all' ? [input.category] : [],
    minDiscount: input.minDiscount,
    maxPrice: input.maxPrice,
    minSales: 0,
    page: 1,
  });
  return offers;
}

export async function searchProducts(input: {
  marketplace: 'all' | SingleMarketplace;
  keyword?: string;
  category?: string;
  limit?: number;
  minDiscount?: number;
  maxPrice?: number | null; // in cents
}): Promise<{ found: number; added: number; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { found: 0, added: 0, error: 'Não autenticado' };

  const fetchParams = {
    keyword: input.keyword,
    category: input.category,
    minDiscount: input.minDiscount ?? 0,
    maxPrice: input.maxPrice ?? null,
  };

  let offersByMarketplace: { marketplace: SingleMarketplace; offers: NormalizedOffer[] }[] = [];

  if (input.marketplace === 'all') {
    // Fetch all valid connections in parallel
    const { data: connections } = await supabaseAdmin
      .from('marketplace_connections')
      .select('marketplace, encrypted_credentials')
      .eq('user_id', user.id)
      .eq('is_valid', true);

    if (!connections || connections.length === 0) {
      return {
        found: 0,
        added: 0,
        error: 'Nenhum marketplace configurado. Acesse Marketplaces para configurar.',
      };
    }

    const results = await Promise.allSettled(
      connections.map(async (conn) => {
        const mp = conn.marketplace as SingleMarketplace;
        const offers = await fetchAndUpsertOffers(user.id, mp, conn.encrypted_credentials, fetchParams);
        return { marketplace: mp, offers };
      })
    );

    for (const r of results) {
      if (r.status === 'fulfilled') offersByMarketplace.push(r.value);
    }

    if (offersByMarketplace.length === 0) {
      return { found: 0, added: 0, error: 'Erro ao buscar em todos os marketplaces.' };
    }
  } else {
    const { data: conn } = await supabaseAdmin
      .from('marketplace_connections')
      .select('encrypted_credentials')
      .eq('user_id', user.id)
      .eq('marketplace', input.marketplace)
      .eq('is_valid', true)
      .maybeSingle();

    if (!conn) {
      return {
        found: 0,
        added: 0,
        error: `Credenciais do ${input.marketplace} não configuradas. Acesse Marketplaces para configurar.`,
      };
    }

    try {
      const offers = await fetchAndUpsertOffers(user.id, input.marketplace, conn.encrypted_credentials, fetchParams);
      offersByMarketplace = [{ marketplace: input.marketplace, offers }];
    } catch (err) {
      return {
        found: 0,
        added: 0,
        error: `Erro ao buscar: ${err instanceof Error ? err.message : String(err)}`,
      };
    }
  }

  // Flatten all offers
  let allOffers = offersByMarketplace.flatMap(({ marketplace, offers }) =>
    offers.map((o) => ({ ...o, _marketplace: marketplace }))
  );

  // Apply post-fetch filters (connectors don't filter internally)
  if (input.maxPrice != null) {
    allOffers = allOffers.filter((o) => o.currentPrice <= input.maxPrice!);
  }
  if (input.minDiscount != null && input.minDiscount > 0) {
    allOffers = allOffers.filter((o) => (o.discountPercent ?? 0) >= input.minDiscount!);
  }

  // Sort by discount desc + apply limit
  allOffers.sort((a, b) => (b.discountPercent ?? 0) - (a.discountPercent ?? 0));
  const limited = allOffers.slice(0, input.limit ?? 20);

  if (limited.length === 0) return { found: 0, added: 0 };

  const expiresAt = new Date(Date.now() + 7 * 24 * 60 * 60 * 1000).toISOString();

  const { error: upsertErr, count } = await supabaseAdmin
    .from('offers')
    .upsert(
      limited.map((o) => ({
        user_id: user.id,
        marketplace: o._marketplace,
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
        expires_at: expiresAt,
      })),
      { onConflict: 'user_id,marketplace,external_id', count: 'estimated' }
    );

  if (upsertErr) return { found: limited.length, added: 0, error: upsertErr.message };

  revalidatePath('/produtos');
  return { found: allOffers.length, added: count ?? limited.length };
}

// ─── Remove single product from queue ────────────────────────────────────────

export async function removeProduct(
  offerId: string
): Promise<{ success: boolean; error?: string }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, error: 'Não autenticado' };

  // Confirma que a offer pertence ao usuário antes de deletar
  const { data: offer } = await supabaseAdmin
    .from('offers')
    .select('id')
    .eq('id', offerId)
    .eq('user_id', user.id)
    .single();

  if (!offer) return { success: false, error: 'Produto não encontrado' };

  // Archive instead of delete — preserves dispatch_log references and automation dedup
  const { error } = await supabaseAdmin
    .from('offers')
    .update({ expires_at: new Date(Date.now() - 1000).toISOString() })
    .eq('id', offerId);

  if (error) return { success: false, error: error.message };

  revalidatePath('/produtos');
  return { success: true };
}

// ─── Remove multiple products from queue ─────────────────────────────────────

export async function removeProducts(
  offerIds: string[]
): Promise<{ success: boolean; removed: number; error?: string }> {
  if (offerIds.length === 0) return { success: true, removed: 0 };

  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { success: false, removed: 0, error: 'Não autenticado' };

  const pastTimestamp = new Date(Date.now() - 1000).toISOString();
  const { data, error } = await supabaseAdmin
    .from('offers')
    .update({ expires_at: pastTimestamp })
    .in('id', offerIds)
    .eq('user_id', user.id)
    .select('id');

  if (error) return { success: false, removed: 0, error: error.message };

  revalidatePath('/produtos');
  return { success: true, removed: data?.length ?? 0 };
}
