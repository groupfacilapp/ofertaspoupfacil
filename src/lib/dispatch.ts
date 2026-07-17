import { supabaseAdmin } from './supabase/admin';
import { getConnector } from './connectors/registry';
import { loadMarketplaceCredentials, loadChannelConfig } from './credentials';
import { getWhatsAppClient, makeInstanceName } from './platform-settings';
import type { WhatsAppClient } from './whatsapp-client';
import { TelegramClient, formatForTelegram } from './telegram';
import type { NormalizedOffer } from './connectors/types';
import { formatMessage, DEFAULT_TEMPLATE } from './format-message';

// Import connectors to register them
import './connectors/amazon';
import './connectors/mercadolivre';
import './connectors/shopee';
import './connectors/aliexpress';
import { FILTER_ISBN, FILTER_DIGITAIS } from './connectors/amazon';

// Strips diacritics (accents) and lowercases — used for keyword matching so that
// "bebê" matches "bebe", "café" matches "cafe", etc.
function normalizeStr(text: string): string {
  return text.toLowerCase().normalize('NFD').replace(/[\u0300-\u036f]/g, '');
}

// Checks if `title` contains `kw` as a whole word (not as part of another word).
// E.g. "gel" matches "gel de cabelo" but NOT "angelica".
// Both inputs should be pre-normalized with normalizeStr().
// Hyphens are normalized to spaces so "caça-palavras" matches blocked_keyword "caça palavras".
function matchesWord(title: string, kw: string): boolean {
  const normalizedTitle = title.replace(/-/g, ' ');
  const normalizedKw = kw.replace(/-/g, ' ');
  const escaped = normalizedKw.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
  
  // 1. Exact whole word match
  if (new RegExp(`\\b${escaped}\\b`, 'i').test(normalizedTitle)) return true;

  // 2. Portuguese plural/singular handling for keywords longer than 3 characters
  if (normalizedKw.length > 3) {
    if (normalizedKw.endsWith('s')) {
      // Remove trailing 's' to match singular form (e.g. "livros" matches "livro")
      const singular = normalizedKw.slice(0, -1);
      const escSingular = singular.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escSingular}\\b`, 'i').test(normalizedTitle)) return true;
    } else {
      // Add 's' to match plural form (e.g. "livro" matches "livros")
      const plural = normalizedKw + 's';
      const escPlural = plural.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
      if (new RegExp(`\\b${escPlural}\\b`, 'i').test(normalizedTitle)) return true;
    }
  }
  return false;
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
  target_id: string; // WhatsApp JID e.g. 123@g.us
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

// Re-export formatting utilities from shared module
export { formatMessage, splitTemplateVariants, DEFAULT_TEMPLATE } from './format-message';

export async function dispatchGroup(
  group: DispatchGroupConfig,
  destinations: DispatchDestination[],
  options?: { maxOffers?: number; marketplace?: string }
): Promise<DispatchResult> {
  const result: DispatchResult = {
    groupId: group.id,
    dispatched: 0,
    skipped: 0,
    failed: 0,
    errors: [],
  };

  if (destinations.length === 0) {
    result.errors.push('Nenhum destino configurado');
    return result;
  }

  // BRT date (UTC-3)
  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];
  // Cross-day dedup window: 2 days (prevents same offer from being sent on consecutive days,
  // but allows re-dispatch after 2 days so keyword groups with small pools don't stall)
  const sevenDaysAgo = new Date(Date.now() - (2 * 24 + 3) * 3600000).toISOString().split('T')[0];

  // Single query: load last 7 days of successful dispatches for this group
  // Used for: (1) daily limit count, (2) cross-day dedup, (3) marketplace fairness
  const { data: recentLogs } = await supabaseAdmin
    .from('dispatch_logs')
    .select('offer_id, dispatched_date, offers(external_id, marketplace)')
    .eq('group_id', group.id)
    .gte('dispatched_date', sevenDaysAgo)
    .in('status', ['sent', 'pending', 'delivered', 'read']);

  // Daily limit: count only today
  const alreadyDispatchedToday = (recentLogs ?? []).filter((l) => l.dispatched_date === today).length;
  const remainingSlots = group.daily_limit - alreadyDispatchedToday;
  if (remainingSlots <= 0) {
    result.skipped++;
    result.errors.push('Limite diário atingido');
    return result;
  }

  // Cross-day dedup: offers dispatched in the last 7 days won't be re-sent
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatchedOfferIds = new Set((recentLogs ?? []).map((l) => l.offer_id));
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const dispatchedExternalIds = new Set((recentLogs ?? []).map((l) => (l as any).offers?.external_id).filter(Boolean));

  // Marketplace fairness counter: only today (not 7 days, to avoid stale bias)
  const mpDispatchCount: Record<string, number> = {};
  for (const log of recentLogs ?? []) {
    if (log.dispatched_date !== today) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const mp = (log as any).offers?.marketplace;
    if (mp) mpDispatchCount[mp] = (mpDispatchCount[mp] ?? 0) + 1;
  }

  // If a specific marketplace is requested (e.g. from automation rule), only fetch that one
  const marketplacesToFetch = options?.marketplace
    ? group.marketplaces.filter((mp) => mp === options.marketplace)
    : group.marketplaces;

  // --- 1. DB queue: read active offers already stored for this user + marketplaces ---
  // Primary source — avoids hitting marketplace APIs when queue has enough fresh offers.
  // For keyword groups: filter at DB level so relevant offers are found even when
  // they're not among the 500 most-recently-fetched generic offers.
  // If DB returns 0 keyword matches → freshFromDB=0 → live-fetch runs as backup.
  const { data: queuedRows } = await (() => {
    const q = supabaseAdmin
      .from('offers')
      .select('id, external_id, marketplace, title, current_price, original_price, discount_percent, image_url, product_url, affiliate_link, condition, installments, category')
      .eq('user_id', group.user_id)
      .in('marketplace', marketplacesToFetch)
      .gt('expires_at', new Date().toISOString())
      .order('fetched_at', { ascending: false })
      .limit(500);
    // Apply keyword ilike filter at DB level for keyword-specific groups.
    // Include both the original keyword AND its unaccented form so that e.g.
    // "bebê" also matches products stored as "bebe" (without accent).
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
  const dbIdMap = new Map<string, string>(); // externalId → DB uuid

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

  // --- 1b. Try to regenerate null affiliate links for ML offers already in the DB pool ---
  // Happens when offers were fetched from /p/MLB... catalog URLs (createLink rejects them)
  // or when cookies were expired at fetch time. Regenerate once per dispatch call.
  const mlNullOffers = allOffers.filter(
    (o) => o.marketplace === 'mercadolivre' && o.affiliateLink === null
  );
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
        let successCount = 0;
        let attemptCount = 0;
        for (const offer of mlNullOffers) {
          attemptCount++;
          try {
            const link = await mlConnector.generateAffiliateLink(offer.productUrl, mlCreds);
            offer.affiliateLink = link;
            successCount++;
            const dbId = dbIdMap.get(offer.externalId);
            if (dbId) {
              await supabaseAdmin
                .from('offers')
                .update({ affiliate_link: link })
                .eq('id', dbId);
            }
          } catch {
            // Keep null — offer will be excluded from freshFromDB count
          }
        }

        // If we attempted to generate links but >80% failed, then it's a real cookie expiration!
        if (attemptCount >= 3) {
          const failureRate = (attemptCount - successCount) / attemptCount;
          if (failureRate >= 0.8) {
            await supabaseAdmin
              .from('marketplace_connections')
              .update({
                is_valid: false,
                validation_error: 'Cookie de sessão expirado — links de afiliado não estão sendo gerados. Atualize o cookie em Marketplaces.',
                updated_at: new Date().toISOString(),
              })
              .eq('user_id', group.user_id)
              .eq('marketplace', 'mercadolivre');
          }
        }
      }
    }
  }

  // How many DB offers are fresh AND pass the group's filters?
  // Must apply keyword/price/discount filter here so keyword-specific groups
  // don't incorrectly skip live-fetch due to unrelated DB offers inflating the count.
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
    // ML offers without an affiliate link would send a raw product URL — don't count them as fresh
    if (o.marketplace === 'mercadolivre' && o.affiliateLink === null) return false;
    return true;
  }).length;

  // --- 2. Live-fetch ---
  // Grupos com keywords: SEMPRE busca ao vivo, pesquisando cada keyword separadamente.
  // Isso garante que todas as keywords configuradas gerem buscas ativas no marketplace,
  // não apenas filtrem um pool genérico. Early-exit assim que tiver offers suficientes.
  //
  // Grupos sem keywords: só busca ao vivo quando o pool do DB está ralo.
  const hasKeywords = group.keywords && group.keywords.length > 0;
  const liveFetchThreshold = options?.maxOffers != null
    ? Math.min(remainingSlots, options.maxOffers)
    : remainingSlots;

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

        const baseConfig = {
          credentials: creds,
          keywords: group.keywords ?? [],
          categories: [],
          minDiscount: group.min_discount,
          maxPrice: group.max_price,
          minSales: group.min_sales,
        };

        if (hasKeywords) {
          // Keywords embaralhadas a cada ciclo: garante que todas ganham cobertura
          // ao longo do tempo, não ficando sempre na mesma ordem.
          const shuffledKeywords = [...group.keywords!].sort(() => Math.random() - 0.5);

          for (const keyword of shuffledKeywords) {
            // Até 20 páginas por keyword com early-exit por página vazia ou suficiência
            for (let page = 1; page <= 20; page++) {
              const pageOffers = await connector.fetchOffers({ ...baseConfig, keywords: [keyword], page });
              if (pageOffers.length === 0) break;
              liveOffers.push(...pageOffers);
              // Parar de paginar assim que tiver o suficiente para este ciclo
              const newSoFar = liveOffers.filter((o) => !dispatchedExternalIds.has(o.externalId)).length;
              if (newSoFar >= liveFetchThreshold) break;
            }
            // Parar de iterar keywords assim que tivermos o suficiente
            const totalNew = liveOffers.filter((o) => !dispatchedExternalIds.has(o.externalId)).length;
            if (totalNew >= liveFetchThreshold) break;
          }
        } else {
          // Grupo sem keywords: pagina até 20 páginas genéricas com early-exit
          let consecutiveEmptyPages = 0;
          for (let page = 1; page <= 20; page++) {
            const pageOffers = await connector.fetchOffers({ ...baseConfig, page });
            liveOffers.push(...pageOffers);
            const newCount = pageOffers.filter((o) => !dispatchedExternalIds.has(o.externalId)).length;
            if (pageOffers.length === 0) break;
            if (newCount === 0) {
              consecutiveEmptyPages++;
              if (consecutiveEmptyPages >= 3) break;
            } else {
              consecutiveEmptyPages = 0;
            }
            if (newCount >= remainingSlots) break;
          }
        }
      } catch (err) {
        result.errors.push(`${marketplace}: ${err instanceof Error ? err.message : String(err)}`);
      }
    }

    // Raw live-fetched offers have no affiliate_link by design. The expired cookie check
    // is now handled dynamically in the link generation step above to avoid false positives.

    // Upsert live-fetched offers to DB (adds new + refreshes affiliate_link/expiry on existing)
    if (liveOffers.length > 0) {
      const expiresAt = new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString();
      const { data: savedOffers } = await supabaseAdmin
        .from('offers')
        .upsert(
          liveOffers.map((offer) => ({
            user_id: group.user_id,
            marketplace: offer.marketplace,
            external_id: offer.externalId,
            title: offer.title,
            current_price: offer.currentPrice,
            original_price: offer.originalPrice ?? null,
            discount_percent: offer.discountPercent ?? null,
            image_url: offer.imageUrl || null,
            product_url: offer.productUrl,
            affiliate_link: offer.affiliateLink ?? null,
            condition: offer.condition ?? null,
            installments: offer.installments ?? null,
            category: offer.category ?? null,
            fetched_at: new Date().toISOString(),
            expires_at: expiresAt,
          })),
          { onConflict: 'user_id,marketplace,external_id' }
        )
        .select('id, external_id');

      for (const row of savedOffers ?? []) {
        dbIdMap.set(row.external_id, row.id);
      }

      allOffers.push(...liveOffers);
    }
  }

  if (allOffers.length === 0) {
    result.errors.push('Nenhuma oferta encontrada nos marketplaces');
    return result;
  }

  // Deduplicate allOffers by externalId (same product may appear on multiple pages)
  const seenExternalIds = new Set<string>();
  const dedupedOffers = allOffers.filter((o) => {
    if (seenExternalIds.has(o.externalId)) return false;
    seenExternalIds.add(o.externalId);
    return true;
  });

  // Apply filters
  const filtered = dedupedOffers.filter((offer) => {
    // Amazon: re-apply book filters as safety net for offers already in DB before the fix.
    // ISBN-10 ASINs (e.g. 8538089803) and titles matching FILTER_DIGITAIS are books/digital content.
    if (offer.marketplace === 'amazon') {
      if (FILTER_ISBN.test(offer.externalId)) return false;
      if (FILTER_DIGITAIS.test(offer.title)) return false;
      if (offer.category === 'livros') return false;
    }
    // Discount filter — skip when discountPercent is null (marketplace doesn't provide it, e.g. Shopee)
    if (offer.discountPercent !== null && offer.discountPercent < group.min_discount) return false;
    // Price range
    if (group.min_price && offer.currentPrice < group.min_price) return false;
    if (group.max_price && offer.currentPrice > group.max_price) return false;
    // Min sales (NormalizedOffer uses `sales` field)
    if (group.min_sales && (offer.sales ?? 0) < group.min_sales) return false;
    // Keywords (include) — normalize accents so "bebê" matches "bebe", etc.
    // Uses word-boundary matching so "gel" doesn't hit "angelica", etc.
    if (group.keywords && group.keywords.length > 0) {
      const titleNorm = normalizeStr(offer.title);
      const hasKeyword = group.keywords.some((kw) =>
        matchesWord(titleNorm, normalizeStr(kw))
      );
      if (!hasKeyword) return false;
    }
    // Blocked keywords — word-boundary so "gel" blocks "Gel X" but not "Angelica".
    // Checks both title and category so that e.g. "livros" blocks books even when
    // the book title doesn't contain the word "livros".
    if (group.blocked_keywords && group.blocked_keywords.length > 0) {
      const searchText = normalizeStr(offer.title + (offer.category ? ' ' + offer.category : ''));
      const isBlocked = group.blocked_keywords.some((kw) =>
        matchesWord(searchText, normalizeStr(kw))
      );
      if (isBlocked) return false;
    }
    // Never dispatch ML offers without an affiliate link — raw URL would be sent
    if (offer.marketplace === 'mercadolivre' && offer.affiliateLink === null) return false;
    return true;
  });

  if (filtered.length === 0 && dedupedOffers.length > 0) {
    result.errors.push(
      `${dedupedOffers.length} oferta(s) encontrada(s) mas nenhuma passou os filtros do grupo` +
      (group.min_discount > 0 ? ` (desconto mín: ${group.min_discount}%)` : '') +
      (group.min_price ? ` (preço mín: R$${(group.min_price / 100).toFixed(0)})` : '') +
      (group.max_price ? ` (preço máx: R$${(group.max_price / 100).toFixed(0)})` : '') +
      (group.keywords?.length ? ` (keywords: ${group.keywords.join(', ')})` : '')
    );
    return result;
  }

  // Sort by marketplace fairness first (fewest dispatches today goes first),
  // then interleave randomly between different marketplaces to mix them,
  // and use discount as tie-breaker for the same marketplace
  filtered.sort((a, b) => {
    const aCount = mpDispatchCount[a.marketplace] ?? 0;
    const bCount = mpDispatchCount[b.marketplace] ?? 0;
    if (aCount !== bCount) return aCount - bCount;
    
    // Add randomness for same marketplace dispatch counts to interleave
    if (a.marketplace !== b.marketplace) {
      return Math.random() - 0.5;
    }
    
    return (b.discountPercent ?? 0) - (a.discountPercent ?? 0);
  });

  // Determine which channel types are needed
  const needsWhatsApp = destinations.some((d) => d.channel_type === 'whatsapp');
  const needsTelegram = destinations.some((d) => d.channel_type === 'telegram');

  // Get WhatsApp client (only if WhatsApp destinations exist)
  let evo: WhatsAppClient | null = null;
  let instanceName = '';
  let waProviderToken: string | undefined;
  if (needsWhatsApp) {
    try {
      evo = await getWhatsAppClient();
      instanceName = await makeInstanceName(group.user_id);
      // Read the per-instance token (used by UAZAPI; null for Evolution)
      const { data: waInst } = await supabaseAdmin
        .from('whatsapp_instances')
        .select('provider_token')
        .eq('user_id', group.user_id)
        .maybeSingle();
      waProviderToken = waInst?.provider_token ?? undefined;
    } catch (err) {
      result.errors.push(`WhatsApp: ${err instanceof Error ? err.message : String(err)}`);
      // Don't return — Telegram destinations can still work
    }
  }

  // Get Telegram client (only if Telegram destinations exist)
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

    if (dispatchedOfferIds.has(savedOfferId)) {
      result.skipped++;
      continue;
    }

    const message = formatMessage(template, offer);

    // Send to all destinations
    for (const dest of destinations) {
      if (dest.channel_type === 'whatsapp' && !evo) continue;
      if (dest.channel_type === 'telegram' && !tg) continue;
      if (dest.channel_type !== 'whatsapp' && dest.channel_type !== 'telegram') continue;

      const { data: log } = await supabaseAdmin
        .from('dispatch_logs')
        .insert({
          user_id: group.user_id,
          group_id: group.id,
          offer_id: savedOfferId,
          channel_type: dest.channel_type,
          dispatched_date: today,
          status: 'pending' as const,
        })
        .select('id')
        .single();

      try {
        if (dest.channel_type === 'whatsapp' && evo) {
          if (offer.imageUrl) {
            try {
              await evo.sendImage(instanceName, dest.target_id, offer.imageUrl, message, waProviderToken);
            } catch (imgErr) {
              // Only fall back to sendText when the API returned a definitive HTTP error
              // (meaning it did NOT send the image). For network/timeout errors, the provider
              // may have already delivered the image — sending text too would duplicate.
              const isHttpError = imgErr instanceof Error && (imgErr.message.startsWith('WhatsApp API ') || imgErr.message.startsWith('Evolution GO '));
              if (isHttpError) {
                await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
              } else {
                throw imgErr;
              }
            }
          } else {
            await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
          }
        } else if (dest.channel_type === 'telegram' && tg) {
          const tgMessage = formatForTelegram(message);
          if (offer.imageUrl) {
            await tg.sendPhoto(dest.target_id, offer.imageUrl, tgMessage);
          } else {
            await tg.sendMessage(dest.target_id, tgMessage);
          }
        }

        if (log) {
          await supabaseAdmin
            .from('dispatch_logs')
            .update({ status: 'sent' })
            .eq('id', log.id);
        }
      } catch (err) {
        result.failed++;
        const errMsg = err instanceof Error ? err.message : String(err);
        result.errors.push(`[${dest.channel_type}] ${dest.target_name ?? dest.target_id}: ${errMsg}`);
        if (log) {
          await supabaseAdmin
            .from('dispatch_logs')
            .update({ status: 'failed', error_message: errMsg })
            .eq('id', log.id);
        }
      }
    }

    dispatchedOfferIds.add(savedOfferId);
    dispatched++;
    result.dispatched++;

    // Rate limiting between messages — skip if we've already hit maxOffers or remainingSlots
    if (dispatched < remainingSlots && dispatched < maxOffers && filtered.indexOf(offer) < filtered.length - 1) {
      await new Promise((r) => setTimeout(r, intervalMs));
      // Re-check if group is still active (user may have paused mid-dispatch)
      const { data: freshGroup } = await supabaseAdmin
        .from('dispatch_groups')
        .select('is_active')
        .eq('id', group.id)
        .single();
      if (!freshGroup?.is_active) break;
    }
  }

  // Fallback: se o dedup esgotou o pool (tudo skipado, nada enviado),
  // reenvia o produto mais antigo disponível — apenas para grupos SEM keywords.
  // Grupos com keywords sempre fazem live-fetch e nunca devem reciclar produto já enviado.
  // IMPORTANTE: só envia se o INSERT do log tiver sucesso — se falhar (unique constraint),
  // significa que o produto já foi enviado hoje e a mensagem NÃO deve ser disparada.
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
          .insert({
            user_id: group.user_id,
            group_id: group.id,
            offer_id: savedOfferId,
            channel_type: dest.channel_type,
            dispatched_date: today,
            status: 'pending' as const,
          })
          .select('id')
          .single();

        // Se o INSERT falhou (ex: unique constraint — produto já enviado hoje),
        // não envia a mensagem para evitar duplicatas.
        if (!log) continue;

        try {
          if (dest.channel_type === 'whatsapp' && evo) {
            if (offer.imageUrl) {
              try {
                await evo.sendImage(instanceName, dest.target_id, offer.imageUrl, message, waProviderToken);
              } catch (imgErr) {
                const isHttpError = imgErr instanceof Error && (imgErr.message.startsWith('WhatsApp API ') || imgErr.message.startsWith('Evolution GO '));
                if (isHttpError) {
                  await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
                } else {
                  throw imgErr;
                }
              }
            } else {
              await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
            }
          } else if (dest.channel_type === 'telegram' && tg) {
            const tgMessage = formatForTelegram(message);
            if (offer.imageUrl) {
              await tg.sendPhoto(dest.target_id, offer.imageUrl, tgMessage);
            } else {
              await tg.sendMessage(dest.target_id, tgMessage);
            }
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
