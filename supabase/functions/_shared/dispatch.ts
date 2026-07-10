import { supabaseAdmin } from './supabase.ts';
import { getConnector } from './connectors/registry.ts';
import { loadMarketplaceCredentials, loadChannelConfig } from './credentials.ts';
import { getWhatsAppClient, makeInstanceName } from './platform-settings.ts';
import type { WhatsAppClient } from './whatsapp-client.ts';
import { TelegramClient, formatForTelegram } from './telegram.ts';
import type { NormalizedOffer } from './connectors/types.ts';
import { formatMessage, DEFAULT_TEMPLATE } from './format-message.ts';

// Register all connectors
import './connectors/amazon.ts';
import './connectors/mercadolivre.ts';
import './connectors/shopee.ts';
import './connectors/aliexpress.ts';
import './connectors/kabum.ts';
import './connectors/temu.ts';
import './connectors/shein.ts';

import { FILTER_ISBN, FILTER_DIGITAIS } from './connectors/amazon.ts';

function normalizeStr(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

function matchesWord(title: string, kw: string): boolean {
  const normalizedTitle = title.replace(/-/g, ' ');
  const normalizedKw = kw.replace(/-/g, ' ');
  const escaped = normalizedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  return new RegExp(`\\b${escaped}\\b`, 'i').test(normalizedTitle);
}

export interface DispatchGroupConfig {
  id: string;
  user_id: string;
  name: string;
  marketplaces: string[];
  min_discount: number;
  min_price: number | null;
  max_price: number | null;
  min_sales: number;
  daily_limit: number;
  messaging_interval_minutes: number;
  template_text: string | null;
  keywords: string[] | null;
  blocked_keywords: string[] | null;
}

export interface DispatchDestination {
  id: string;
  target_id: string;
  target_name: string | null;
  channel_type: string;
}

export interface DispatchResult {
  groupId: string;
  dispatched: number;
  skipped: number;
  failed: number;
  errors: string[];
}

export async function dispatchGroup(
  group: DispatchGroupConfig,
  destinations: DispatchDestination[],
  options?: { maxOffers?: number; marketplace?: string }
): Promise<DispatchResult> {
  const result: DispatchResult = { groupId: group.id, dispatched: 0, skipped: 0, failed: 0, errors: [] };

  if (destinations.length === 0) {
    result.errors.push('Nenhum destino configurado');
    return result;
  }

  const now = new Date();
  const brtOffset = -3;
  const brtDate = new Date(now.getTime() + brtOffset * 3600000);
  const today = brtDate.toISOString().split('T')[0];
  const sevenDaysAgo = new Date(brtDate.getTime() - 7 * 24 * 3600000).toISOString().split('T')[0];

  const { data: recentLogs } = await supabaseAdmin
    .from('dispatch_logs')
    .select('offer_id, dispatched_date, offers(external_id, marketplace)')
    .eq('group_id', group.id)
    .gte('dispatched_date', sevenDaysAgo)
    .in('status', ['sent', 'pending', 'delivered', 'read']);

  const alreadyDispatchedToday = (recentLogs ?? []).filter((l) => l.dispatched_date === today).length;
  const remainingSlots = group.daily_limit - alreadyDispatchedToday;
  if (remainingSlots <= 0) {
    result.skipped++;
    result.errors.push('Limite diário atingido');
    return result;
  }

  // deno-lint-ignore no-explicit-any
  const dispatchedOfferIds = new Set((recentLogs ?? []).map((l) => l.offer_id));
  // deno-lint-ignore no-explicit-any
  const dispatchedExternalIds = new Set((recentLogs ?? []).map((l) => (l as any).offers?.external_id).filter(Boolean));

  const mpDispatchCount: Record<string, number> = {};
  for (const log of recentLogs ?? []) {
    if (log.dispatched_date !== today) continue;
    // deno-lint-ignore no-explicit-any
    const mp = (log as any).offers?.marketplace;
    if (mp) mpDispatchCount[mp] = (mpDispatchCount[mp] ?? 0) + 1;
  }

  const marketplacesToFetch = options?.marketplace
    ? group.marketplaces.filter((mp) => mp === options.marketplace)
    : group.marketplaces;

  const { data: queuedRows } = await (() => {
    const q = supabaseAdmin
      .from('offers')
      .select('id, external_id, marketplace, title, current_price, original_price, discount_percent, image_url, product_url, affiliate_link, condition, installments, category')
      .eq('user_id', group.user_id)
      .in('marketplace', marketplacesToFetch)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(500);
    if (group.keywords && group.keywords.length > 0) {
      const patterns = new Set<string>();
      for (const kw of group.keywords) {
        patterns.add(kw.trim());
        const unaccented = normalizeStr(kw);
        if (unaccented !== kw.toLowerCase()) patterns.add(unaccented);
      }
      return q.or([...patterns].map(p => `title.ilike.%${p}%`).join(','));
    }
    return q;
  })();

  const allOffers: NormalizedOffer[] = [];
  const dbIdMap = new Map<string, string>();

  for (const row of queuedRows ?? []) {
    dbIdMap.set(row.external_id as string, row.id as string);
    allOffers.push({
      externalId: row.external_id as string,
      marketplace: row.marketplace as 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress' | 'kabum' | 'temu' | 'shein',
      title: row.title as string,
      currentPrice: row.current_price as number,
      originalPrice: row.original_price as number | null,
      discountPercent: row.discount_percent as number | null,
      imageUrl: (row.image_url as string | null) ?? '',
      productUrl: row.product_url as string,
      affiliateLink: row.affiliate_link as string | null,
      condition: row.condition as string | null,
      installments: row.installments as string | null,
      category: row.category as string | null,
      sales: null,
      couponCode: null,
    });
  }

  // Regenerate null ML affiliate links
  const mlNullOffers = allOffers.filter((o) => o.marketplace === 'mercadolivre' && o.affiliateLink === null);
  if (mlNullOffers.length > 0) {
    const { data: mlConn } = await supabaseAdmin
      .from('marketplace_connections')
      .select('encrypted_credentials')
      .eq('user_id', group.user_id)
      .eq('marketplace', 'mercadolivre')
      .maybeSingle();
    if (mlConn) {
      const mlCreds = loadMarketplaceCredentials(mlConn.encrypted_credentials);
      if (mlCreds.cookie_session) {
        const mlConnector = getConnector('mercadolivre');
        for (const offer of mlNullOffers) {
          try {
            const link = await mlConnector.generateAffiliateLink(offer.productUrl, mlCreds);
            offer.affiliateLink = link;
            const dbId = dbIdMap.get(offer.externalId);
            if (dbId) await supabaseAdmin.from('offers').update({ affiliate_link: link }).eq('id', dbId);
          } catch { /* Keep null */ }
        }
      }
    }
  }

  const freshFromDB = allOffers.filter((o) => {
    if (dispatchedExternalIds.has(o.externalId)) return false;
    if (o.discountPercent !== null && o.discountPercent < group.min_discount) return false;
    if (group.min_price && o.currentPrice < group.min_price) return false;
    if (group.max_price && o.currentPrice > group.max_price) return false;
    if (group.keywords && group.keywords.length > 0) {
      const titleNorm = normalizeStr(o.title);
      if (!group.keywords.some((kw) => matchesWord(titleNorm, normalizeStr(kw)))) return false;
    }
    if (group.blocked_keywords && group.blocked_keywords.length > 0) {
      const searchText = normalizeStr(o.title + (o.category ? ' ' + o.category : ''));
      if (group.blocked_keywords.some((kw) => matchesWord(searchText, normalizeStr(kw)))) return false;
    }
    if (o.marketplace === 'mercadolivre' && o.affiliateLink === null) return false;
    return true;
  }).length;

  const hasKeywords = group.keywords && group.keywords.length > 0;
  const liveFetchThreshold = options?.maxOffers != null ? Math.min(remainingSlots, options.maxOffers) : remainingSlots;

  if (hasKeywords || freshFromDB < liveFetchThreshold) {
    const liveOffers: NormalizedOffer[] = [];

    for (const marketplace of marketplacesToFetch) {
      try {
        const connector = getConnector(marketplace);
        const { data: conn } = await supabaseAdmin
          .from('marketplace_connections')
          .select('encrypted_credentials')
          .eq('user_id', group.user_id)
          .eq('marketplace', marketplace)
          .single();
        if (!conn) continue;

        const creds = loadMarketplaceCredentials(conn.encrypted_credentials);
        const baseConfig = { credentials: creds, keywords: group.keywords ?? [], categories: [], minDiscount: group.min_discount, maxPrice: group.max_price, minSales: group.min_sales };

        if (hasKeywords) {
          const shuffledKeywords = [...group.keywords!].sort(() => Math.random() - 0.5);
          for (const keyword of shuffledKeywords) {
            for (let page = 1; page <= 3; page++) {
              const pageOffers = await connector.fetchOffers({ ...baseConfig, keywords: [keyword], page });
              if (pageOffers.length === 0) break;
              liveOffers.push(...pageOffers);
              const newSoFar = liveOffers.filter((o) => !dispatchedExternalIds.has(o.externalId)).length;
              if (newSoFar >= liveFetchThreshold) break;
            }
            const totalNew = liveOffers.filter((o) => !dispatchedExternalIds.has(o.externalId)).length;
            if (totalNew >= liveFetchThreshold) break;
          }
        } else {
          let consecutiveEmptyPages = 0;
          for (let page = 1; page <= 3; page++) {
            const pageOffers = await connector.fetchOffers({ ...baseConfig, page });
            liveOffers.push(...pageOffers);
            const newCount = pageOffers.filter((o) => !dispatchedExternalIds.has(o.externalId)).length;
            if (pageOffers.length === 0) break;
            if (newCount === 0) { consecutiveEmptyPages++; if (consecutiveEmptyPages >= 3) break; } else { consecutiveEmptyPages = 0; }
            if (newCount >= remainingSlots) break;
          }
        }
      } catch (err) {
        result.errors.push(`${marketplace}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    if (liveOffers.length > 0) {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: savedOffers } = await supabaseAdmin
        .from('offers')
        .upsert(
          liveOffers.map((offer) => ({
            user_id: group.user_id, marketplace: offer.marketplace, external_id: offer.externalId,
            title: offer.title, current_price: offer.currentPrice, original_price: offer.originalPrice ?? null,
            discount_percent: offer.discountPercent ?? null, image_url: offer.imageUrl || null,
            product_url: offer.productUrl, affiliate_link: offer.affiliateLink ?? null,
            condition: offer.condition ?? null, installments: offer.installments ?? null,
            category: offer.category ?? null, fetched_at: new Date().toISOString(), expires_at: expiresAt,
          })),
          { onConflict: 'user_id,marketplace,external_id' }
        )
        .select('id, external_id');

      for (const row of savedOffers ?? []) { dbIdMap.set(row.external_id, row.id); }
      allOffers.push(...liveOffers);
    }
  }

  if (allOffers.length === 0) {
    result.errors.push('Nenhuma oferta encontrada nos marketplaces');
    return result;
  }

  const seenExternalIds = new Set<string>();
  const dedupedOffers = allOffers.filter((o) => {
    if (seenExternalIds.has(o.externalId)) return false;
    seenExternalIds.add(o.externalId);
    return true;
  });

  const filtered = dedupedOffers.filter((offer) => {
    if (offer.marketplace === 'amazon') {
      if (FILTER_ISBN.test(offer.externalId)) return false;
      if (FILTER_DIGITAIS.test(offer.title)) return false;
      if (offer.category === 'livros') return false;
    }
    if (offer.discountPercent !== null && offer.discountPercent < group.min_discount) return false;
    if (group.min_price && offer.currentPrice < group.min_price) return false;
    if (group.max_price && offer.currentPrice > group.max_price) return false;
    if (group.min_sales && (offer.sales ?? 0) < group.min_sales) return false;
    if (group.keywords && group.keywords.length > 0) {
      const titleNorm = normalizeStr(offer.title);
      if (!group.keywords.some((kw) => matchesWord(titleNorm, normalizeStr(kw)))) return false;
    }
    if (group.blocked_keywords && group.blocked_keywords.length > 0) {
      const searchText = normalizeStr(offer.title + (offer.category ? ' ' + offer.category : ''));
      if (group.blocked_keywords.some((kw) => matchesWord(searchText, normalizeStr(kw)))) return false;
    }
    if (offer.marketplace === 'mercadolivre' && offer.affiliateLink === null) return false;
    return true;
  });

  if (filtered.length === 0 && dedupedOffers.length > 0) {
    result.errors.push(
      `${dedupedOffers.length} oferta(s) encontrada(s) mas nenhuma passou os filtros do grupo` +
      (group.min_discount > 0 ? ` (desconto mín: ${group.min_discount}%)` : '') +
      (group.keywords?.length ? ` (keywords: ${group.keywords.join(', ')})` : '')
    );
    return result;
  }

  filtered.sort((a, b) => {
    const aCount = mpDispatchCount[a.marketplace] ?? 0;
    const bCount = mpDispatchCount[b.marketplace] ?? 0;
    if (aCount !== bCount) return aCount - bCount;
    if (a.marketplace !== b.marketplace) return Math.random() - 0.5;
    return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
  });

  const needsWhatsApp = destinations.some((d) => d.channel_type === 'whatsapp');
  const needsTelegram = destinations.some((d) => d.channel_type === 'telegram');

  let evo: WhatsAppClient | null = null;
  let instanceName = '';
  let waProviderToken: string | undefined;
  if (needsWhatsApp) {
    try {
      evo = await getWhatsAppClient();
      instanceName = await makeInstanceName(group.user_id);
      const { data: waInst } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('provider_token')
        .eq('user_id', group.user_id)
        .maybeSingle();
      waProviderToken = waInst?.provider_token ?? undefined;
    } catch (err) {
      result.errors.push(`WhatsApp: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  let tg: TelegramClient | null = null;
  if (needsTelegram) {
    try {
      const { data: tgConn } = await supabaseAdmin
        .from('channel_connections')
        .select('encrypted_config')
        .eq('user_id', group.user_id)
        .eq('channel_type', 'telegram')
        .maybeSingle();
      if (tgConn) {
        const config = loadChannelConfig(tgConn.encrypted_config);
        tg = new TelegramClient(config.botToken as string);
      } else {
        result.errors.push('Telegram: bot não configurado');
      }
    } catch (err) {
      result.errors.push(`Telegram: ${err instanceof Error ? err.message : String(err)}`);
    }
  }

  const template = group.template_text || DEFAULT_TEMPLATE;
  const intervalMs = group.messaging_interval_minutes * 60 * 1000;
  const maxOffers = options?.maxOffers ?? remainingSlots;

  let dispatched = 0;
  for (const offer of filtered) {
    if (dispatched >= remainingSlots) break;
    if (dispatched >= maxOffers) break;

    const savedOfferId = dbIdMap.get(offer.externalId);
    if (!savedOfferId) continue;
    if (dispatchedOfferIds.has(savedOfferId)) { result.skipped++; continue; }

    const message = formatMessage(template, offer);

    for (const dest of destinations) {
      if (dest.channel_type === 'whatsapp' && !evo) continue;
      if (dest.channel_type === 'telegram' && !tg) continue;
      if (dest.channel_type !== 'whatsapp' && dest.channel_type !== 'telegram') continue;

      const { data: log } = await supabaseAdmin
        .from('dispatch_logs')
        .insert({ user_id: group.user_id, group_id: group.id, offer_id: savedOfferId, channel_type: dest.channel_type, dispatched_date: today, status: 'pending' as const })
        .select('id')
        .single();

      try {
        if (dest.channel_type === 'whatsapp' && evo) {
          if (offer.imageUrl) {
            try {
              await evo.sendImage(instanceName, dest.target_id, offer.imageUrl, message, waProviderToken);
            } catch (imgErr) {
              const isHttpError = imgErr instanceof Error && (imgErr.message.startsWith('WhatsApp API ') || imgErr.message.startsWith('Evolution GO '));
              if (isHttpError) { await evo.sendText(instanceName, dest.target_id, message, waProviderToken); } else { throw imgErr; }
            }
          } else {
            await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
          }
        } else if (dest.channel_type === 'telegram' && tg) {
          const tgMessage = formatForTelegram(message);
          if (offer.imageUrl) { await tg.sendPhoto(dest.target_id, offer.imageUrl, tgMessage); }
          else { await tg.sendMessage(dest.target_id, tgMessage); }
        }

        if (log) await supabaseAdmin.from('dispatch_logs').update({ status: 'sent' }).eq('id', log.id);
      } catch (err) {
        result.failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`[${dest.channel_type}] ${dest.target_name ?? dest.target_id}: ${errMsg}`);
        if (log) await supabaseAdmin.from('dispatch_logs').update({ status: 'failed', error_message: errMsg }).eq('id', log.id);
      }
    }

    dispatchedOfferIds.add(savedOfferId);
    dispatched++;
    result.dispatched++;

    if (dispatched < remainingSlots && dispatched < maxOffers && filtered.indexOf(offer) < filtered.length - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
      const { data: freshGroup } = await supabaseAdmin.from('dispatch_groups').select('is_active').eq('id', group.id).single();
      if (!freshGroup?.is_active) break;
    }
  }

  // Fallback: se o dedup esgotou o pool (tudo skipado, nada enviado),
  // reenvia o produto mais antigo disponível — apenas para grupos SEM keywords.
  if (dispatched === 0 && result.skipped > 0 && remainingSlots > 0 && !hasKeywords) {
    for (const offer of filtered) {
      const savedOfferId = dbIdMap.get(offer.externalId);
      if (!savedOfferId) continue;

      const message = formatMessage(template, offer);
      for (const dest of destinations) {
        if (dest.channel_type === 'whatsapp' && !evo) continue;
        if (dest.channel_type === 'telegram' && !tg) continue;
        if (dest.channel_type !== 'whatsapp' && dest.channel_type !== 'telegram') continue;

        const { data: log } = await supabaseAdmin
          .from('dispatch_logs')
          .insert({ user_id: group.user_id, group_id: group.id, offer_id: savedOfferId, channel_type: dest.channel_type, dispatched_date: today, status: 'pending' as const })
          .select('id')
          .single();

        if (!log) continue;

        try {
          if (dest.channel_type === 'whatsapp' && evo) {
            if (offer.imageUrl) {
              try {
                await evo.sendImage(instanceName, dest.target_id, offer.imageUrl, message, waProviderToken);
              } catch (imgErr) {
                const isHttpError = imgErr instanceof Error && (imgErr.message.startsWith('WhatsApp API ') || imgErr.message.startsWith('Evolution GO '));
                if (isHttpError) { await evo.sendText(instanceName, dest.target_id, message, waProviderToken); } else { throw imgErr; }
              }
            } else {
              await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
            }
          } else if (dest.channel_type === 'telegram' && tg) {
            const tgMessage = formatForTelegram(message);
            if (offer.imageUrl) { await tg.sendPhoto(dest.target_id, offer.imageUrl, tgMessage); }
            else { await tg.sendMessage(dest.target_id, tgMessage); }
          }
          await supabaseAdmin.from('dispatch_logs').update({ status: 'sent' }).eq('id', log.id);
        } catch (err) {
          result.failed++;
          const errMsg = err instanceof Error ? err.message : String(err);
          result.errors.push(`[${dest.channel_type}] ${dest.target_name ?? dest.target_id}: ${errMsg}`);
          await supabaseAdmin.from('dispatch_logs').update({ status: 'failed', error_message: errMsg }).eq('id', log.id);
        }
      }
      result.dispatched++;
      break; // apenas 1 oferta no fallback
    }
  }

  return result;
}
