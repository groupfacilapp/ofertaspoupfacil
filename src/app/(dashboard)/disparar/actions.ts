'use server';

import { createClient } from '@/lib/supabase/server';
import { supabaseAdmin } from '@/lib/supabase/admin';
import { getWhatsAppClient, makeInstanceName } from '@/lib/platform-settings';
import type { WhatsAppClient } from '@/lib/whatsapp-client';
import { loadMarketplaceCredentials, loadChannelConfig } from '@/lib/credentials';
import { TelegramClient, formatForTelegram } from '@/lib/telegram';
import { formatMessage, DEFAULT_TEMPLATE } from '@/lib/format-message';
import type { NormalizedOffer } from '@/lib/connectors/types';
import * as cheerio from 'cheerio';
import { buildShopeeSignature, buildShopeeQuery, normalizeShopeeProduct } from '@/lib/connectors/shopee';
import { normalizeCookieSession } from '@/lib/connectors/mercadolivre';
import { AmazonConnector } from '@/lib/connectors/amazon';
import { AliExpressConnector } from '@/lib/connectors/aliexpress';
import { generateKabumAffiliateLink, parseKabumJsonLd } from '@/lib/connectors/kabum';

// ─── URL Detection ────────────────────────────────────────────────────────────

function detectMarketplace(url: string): string | null {
  try {
    const u = new URL(url);
    const host = u.hostname.toLowerCase();
    if (host.includes('amazon.com.br') || host.includes('amzn.to')) return 'amazon';
    if (host.includes('mercadolivre.com.br') || host.includes('ml.com') || host.includes('mercadolibre.com')) return 'mercadolivre';
    if (host.includes('shopee.com.br')) return 'shopee';
    if (host.includes('aliexpress.com')) return 'aliexpress';
    if (host.includes('kabum.com.br')) return 'kabum';
    return null;
  } catch {
    return null;
  }
}

// ─── URL ID extractors ────────────────────────────────────────────────────────

function extractMLItemId(url: string): string | null {
  const match =
    url.match(/\/(?:p\/)?(MLB-?\d+)/i) ||
    url.match(/item_id[=:](MLB\d+)/i) ||   // item_id= or item_id: (pdp_filters format)
    url.match(/[?&#]wid=(MLB\d+)/i);        // wid= param present in /up/MLBU... share links
  if (!match) return null;
  return match[1].replace('-', '');
}

function extractShopeeIds(url: string): { shopId: string; itemId: string } | null {
  // Format 1: product-name-i.{shopId}.{itemId}
  const m1 = url.match(/-i\.(\d+)\.(\d+)/);
  if (m1) return { shopId: m1[1], itemId: m1[2] };
  // Format 2: shopee.com.br/product/{shopId}/{itemId}
  const m2 = url.match(/\/product\/(\d+)\/(\d+)/);
  if (m2) return { shopId: m2[1], itemId: m2[2] };
  return null;
}

function extractAmazonAsin(url: string): string | null {
  const match = url.match(/\/dp\/([A-Z0-9]{10})/i);
  return match ? match[1].toUpperCase() : null;
}

function extractAliExpressProductId(url: string): string | null {
  const match = url.match(/\/item\/(\d+)(?:\.html)?/);
  return match ? match[1] : null;
}

function extractKabumSku(url: string): string | null {
  const match = url.match(/\/produto\/(\d+)/);
  return match ? match[1] : null;
}

// ─── Price utilities ──────────────────────────────────────────────────────────

// Parses "R$ 189,90" or "189.90" or "189,90" → BRL cents
function parseBRLPrice(text: string | undefined | null): number {
  if (!text) return 0;
  const cleaned = text.replace(/R\$\s*/g, '').trim();
  // Brazilian format: 1.234,56 → 1234.56
  const normalized = cleaned.replace(/\./g, '').replace(',', '.');
  const val = parseFloat(normalized);
  return isNaN(val) ? 0 : Math.round(val * 100);
}

function stripQueryParams(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    return url;
  }
}

// ─── Shopee fetch ─────────────────────────────────────────────────────────────

// Unified Shopee affiliate GraphQL caller
async function callShopeeAffiliateGraphQL(
  appId: string,
  secret: string,
  query: string
): Promise<Record<string, unknown> | null> {
  try {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query });
    const signature = buildShopeeSignature(appId, timestamp, payload, secret);
    const res = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });
    if (!res.ok) return null;
    const json = await res.json() as Record<string, unknown>;
    if ((json.errors as unknown[])?.length) return null;
    return json;
  } catch {
    return null;
  }
}

async function generateShopeeAffiliateLinkForUrl(
  originalUrl: string,
  appId: string,
  secret: string
): Promise<string | null> {
  // Validate that it's a real URL before injecting into GraphQL string
  let validatedUrl: string;
  try {
    validatedUrl = new URL(originalUrl).toString();
  } catch {
    return null;
  }
  const escapedUrl = validatedUrl.replace(/\\/g, '\\\\').replace(/"/g, '\\"');
  const q = `{ generateShortLink(originUrl: "${escapedUrl}", subId: "") { shortLink } }`;
  const json = await callShopeeAffiliateGraphQL(appId, secret, q);
  const d = (json?.data ?? {}) as Record<string, unknown>;
  const ld = (d.generateShortLink ?? d.shortlinkCreate ?? d.generateLink ?? {}) as Record<string, unknown>;
  return (ld.shortLink ?? ld.shortlink ?? ld.link) as string ?? null;
}

// Extract searchable keywords from a Shopee product URL slug
function extractShopeeKeywords(rawUrl: string): string {
  try {
    const u = new URL(rawUrl);
    return decodeURIComponent(u.pathname)
      .replace(/^\//, '')
      .replace(/-i\.\d+\.\d+$/, '')   // Remove -i.shopId.itemId suffix
      .replace(/-/g, ' ')
      .trim()
      .slice(0, 100);
  } catch {
    return '';
  }
}

async function fetchShopeeProductByUrl(
  rawUrl: string,
  userId: string
): Promise<{ ok: boolean; offer?: NormalizedOffer; marketplace?: string; error?: string }> {
  const ids = extractShopeeIds(rawUrl);
  if (!ids) {
    return { ok: false, error: 'Não foi possível extrair o ID do produto Shopee. Use o link direto do produto (ex: shopee.com.br/produto-i.123.456).' };
  }

  // Credentials required — affiliate link is mandatory
  const { data: conn } = await supabaseAdmin
    .from('marketplace_connections')
    .select('encrypted_credentials')
    .eq('user_id', userId)
    .eq('marketplace', 'shopee')
    .maybeSingle();

  if (!conn) {
    return { ok: false, error: 'Shopee não conectada. Configure suas credenciais em Marketplaces antes de fazer disparo manual.' };
  }

  const creds = loadMarketplaceCredentials(conn.encrypted_credentials);
  if (!creds.app_id || !creds.secret) {
    return { ok: false, error: 'Credenciais da Shopee incompletas. Configure App ID e Secret em Marketplaces.' };
  }

  try {
    // Use the authenticated affiliate API to search for the product.
    // Shopee's public APIs and product pages block server-side requests (403/bot detection).
    // The affiliate API is authenticated via SHA256 signature and is the reliable path.
    const keywords = extractShopeeKeywords(rawUrl);
    if (!keywords) {
      return { ok: false, error: 'Não foi possível extrair palavras-chave do link Shopee.' };
    }

    // Search affiliate catalog with keywords extracted from the product URL slug
    const searchQuery = buildShopeeQuery({ listType: 0, sortType: 2, keyword: keywords, limit: 40, page: 1 });
    const searchData = await callShopeeAffiliateGraphQL(creds.app_id, creds.secret, searchQuery);
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const nodes: any[] = (searchData?.data as any)?.productOfferV2?.nodes ?? [];

    // Find the exact product by matching shopId + itemId in the productLink
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    let match = nodes.find((n: any) =>
      typeof n.productLink === 'string' && n.productLink.includes(`i.${ids.shopId}.${ids.itemId}`)
    );

    // If not found with full product name, retry searching by item ID alone (page 1)
    if (!match) {
      const idQuery = buildShopeeQuery({ listType: 0, sortType: 2, keyword: ids.itemId, limit: 20, page: 1 });
      const idData = await callShopeeAffiliateGraphQL(creds.app_id, creds.secret, idQuery);
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const idNodes: any[] = (idData?.data as any)?.productOfferV2?.nodes ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      match = idNodes.find((n: any) =>
        typeof n.productLink === 'string' && n.productLink.includes(`i.${ids.shopId}.${ids.itemId}`)
      );
    }

    if (!match) {
      return {
        ok: false,
        error: 'Produto não encontrado no catálogo de afiliados da Shopee. Certifique-se de que o produto está disponível no Programa de Afiliados Shopee.',
      };
    }

    // normalizeShopeeProduct converts to NormalizedOffer (offerLink → affiliateLink)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const offer = normalizeShopeeProduct(match as any);

    return { ok: true, offer: { ...offer, productUrl: rawUrl }, marketplace: 'shopee' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao buscar produto Shopee' };
  }
}

// ─── Amazon fetch ─────────────────────────────────────────────────────────────

const AMAZON_PAGE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
};

async function fetchAmazonProductByUrl(
  rawUrl: string,
  userId: string
): Promise<{ ok: boolean; offer?: NormalizedOffer; marketplace?: string; error?: string }> {
  const asin = extractAmazonAsin(rawUrl);
  if (!asin) {
    return { ok: false, error: 'Não foi possível extrair o ASIN. Use o link direto do produto (ex: amazon.com.br/dp/B08XYZ...).' };
  }

  // Credentials required — affiliate tag is mandatory
  const { data: conn } = await supabaseAdmin
    .from('marketplace_connections')
    .select('encrypted_credentials')
    .eq('user_id', userId)
    .eq('marketplace', 'amazon')
    .maybeSingle();

  if (!conn) {
    return { ok: false, error: 'Amazon não conectada. Configure sua tag de afiliado em Marketplaces antes de fazer disparo manual.' };
  }

  const creds = loadMarketplaceCredentials(conn.encrypted_credentials);
  if (!creds.tag) {
    return { ok: false, error: 'Tag de afiliado da Amazon não configurada. Complete a configuração em Marketplaces.' };
  }

  const productUrl = `https://www.amazon.com.br/dp/${asin}`;

  try {
    const res = await fetch(productUrl, { headers: AMAZON_PAGE_HEADERS });
    if (!res.ok) {
      return { ok: false, error: `Produto não encontrado na Amazon (${res.status}).` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    const title = $('#productTitle').text().trim() ||
      $('meta[property="og:title"]').attr('content')?.split(' : ')[0]?.trim() ||
      null;

    if (!title) {
      return { ok: false, error: 'Produto não encontrado. A Amazon pode estar bloqueando a busca — tente novamente em alguns segundos.' };
    }

    // Current price — try multiple selectors
    const currentPriceText =
      $('.priceToPay .a-offscreen').first().text().trim() ||
      $('.a-price.a-text-price .a-offscreen').first().text().trim() ||
      $('.a-price .a-offscreen').first().text().trim() ||
      $('#priceblock_ourprice').text().trim() ||
      $('#price_inside_buybox').text().trim() ||
      '';
    const currentPrice = parseBRLPrice(currentPriceText);

    // Original price
    const originalPriceText =
      $('.basisPrice .a-offscreen').first().text().trim() ||
      $('[data-a-strike="true"]').first().text().trim() ||
      $('.a-text-strike').first().text().trim() ||
      '';
    const originalPriceCents = parseBRLPrice(originalPriceText);
    const originalPrice = originalPriceCents > currentPrice ? originalPriceCents : null;
    const discountPercent = originalPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : null;

    // Image
    const imageUrl =
      $('#landingImage').attr('data-old-hires') ||
      $('#landingImage').attr('src') ||
      $('#imgBlkFront').attr('src') ||
      $('meta[property="og:image"]').attr('content') ||
      '';

    // Affiliate link
    const connector = new AmazonConnector();
    const affiliateLink = await connector.generateAffiliateLink(productUrl, creds);

    const offer: NormalizedOffer = {
      externalId: asin,
      marketplace: 'amazon',
      title,
      currentPrice,
      originalPrice,
      discountPercent,
      imageUrl,
      productUrl,
      affiliateLink,
      condition: null,
      installments: null,
      category: null,
      sales: null,
      couponCode: null,
    };

    return { ok: true, offer, marketplace: 'amazon' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao buscar produto Amazon' };
  }
}

// ─── AliExpress fetch ─────────────────────────────────────────────────────────

async function fetchAliExpressProductByUrl(
  rawUrl: string,
  userId: string
): Promise<{ ok: boolean; offer?: NormalizedOffer; marketplace?: string; error?: string }> {
  const productId = extractAliExpressProductId(rawUrl);
  if (!productId) {
    return { ok: false, error: 'Não foi possível extrair o ID do produto AliExpress. Use o link direto do produto.' };
  }

  // Credentials required
  const { data: conn } = await supabaseAdmin
    .from('marketplace_connections')
    .select('encrypted_credentials')
    .eq('user_id', userId)
    .eq('marketplace', 'aliexpress')
    .maybeSingle();

  if (!conn) {
    return { ok: false, error: 'AliExpress não conectado. Configure suas credenciais em Marketplaces antes de fazer disparo manual.' };
  }

  const creds = loadMarketplaceCredentials(conn.encrypted_credentials);
  if (!creds.api_key || !creds.app_secret || !creds.tracking_id) {
    return { ok: false, error: 'Credenciais do AliExpress incompletas. Configure App Key, Secret e TrackingID em Marketplaces.' };
  }

  const productUrl = `https://www.aliexpress.com/item/${productId}.html`;

  try {
    const res = await fetch(productUrl, {
      headers: {
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9',
      },
    });
    if (!res.ok) {
      return { ok: false, error: `Produto não encontrado no AliExpress (${res.status}).` };
    }

    const html = await res.text();
    const $ = cheerio.load(html);

    // Try OG tags first (most reliable for basic info)
    let title: string | null = $('meta[property="og:title"]').attr('content')?.trim() || null;
    const imageUrl = $('meta[property="og:image"]').attr('content') || '';

    let currentPrice = parseBRLPrice($('meta[property="og:price:amount"]').attr('content'));

    // Try JSON-LD
    $('script[type="application/ld+json"]').each((_i, el) => {
      try {
        const d = JSON.parse($(el).html() ?? '');
        if (d?.['@type'] === 'Product') {
          if (!title && d.name) title = String(d.name).trim();
          if (!currentPrice && d.offers?.price) {
            currentPrice = Math.round(parseFloat(String(d.offers.price)) * 100);
          }
        }
      } catch { /* ignore */ }
    });

    // Try window.runParams as last resort for title
    if (!title) {
      const m = html.match(/window\.runParams\s*=\s*(\{[\s\S]+?\});\s*window\./);
      if (m) {
        try {
          const params = JSON.parse(m[1]);
          title = String(params?.data?.pageTitle ?? params?.data?.title ?? '').trim() || null;
        } catch { /* ignore */ }
      }
    }

    // Fallback: page title
    if (!title) {
      const rawTitle = $('title').text().trim();
      title = rawTitle.replace(/\s*[-|].*$/, '').trim() || null;
    }

    if (!title) {
      return { ok: false, error: 'Produto não encontrado no AliExpress.' };
    }

    // Affiliate link
    const connector = new AliExpressConnector();
    const affiliateLink = await connector.generateAffiliateLink(productUrl, creds);

    const offer: NormalizedOffer = {
      externalId: productId,
      marketplace: 'aliexpress',
      title,
      currentPrice,
      originalPrice: null,
      discountPercent: null,
      imageUrl,
      productUrl,
      affiliateLink,
      condition: null,
      installments: null,
      category: null,
      sales: null,
      couponCode: null,
    };

    return { ok: true, offer, marketplace: 'aliexpress' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao buscar produto AliExpress' };
  }
}

// ─── KaBuM fetch ──────────────────────────────────────────────────────────────

const KABUM_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

async function fetchKabumProductByUrl(
  rawUrl: string,
  userId: string
): Promise<{ ok: boolean; offer?: NormalizedOffer; marketplace?: string; error?: string }> {
  const sku = extractKabumSku(rawUrl);
  if (!sku) {
    return { ok: false, error: 'Não foi possível extrair o SKU do produto KaBuM.' };
  }

  // Credentials required — Publisher ID (Awin) needed for affiliate link
  const { data: conn } = await supabaseAdmin
    .from('marketplace_connections')
    .select('encrypted_credentials')
    .eq('user_id', userId)
    .eq('marketplace', 'kabum')
    .maybeSingle();

  if (!conn) {
    return { ok: false, error: 'KaBuM não conectado. Configure seu Publisher ID (Awin) em Marketplaces antes de fazer disparo manual.' };
  }

  const creds = loadMarketplaceCredentials(conn.encrypted_credentials);
  if (!creds.publisher_id) {
    return { ok: false, error: 'Publisher ID do KaBuM não configurado. Complete a configuração em Marketplaces.' };
  }

  const productUrl = rawUrl.split('?')[0];

  try {
    const res = await fetch(productUrl, { headers: KABUM_HEADERS });
    if (!res.ok) {
      return { ok: false, error: `Produto não encontrado no KaBuM (${res.status}).` };
    }

    const html = await res.text();
    const products = parseKabumJsonLd(html);

    if (products.length === 0) {
      return { ok: false, error: 'Não foi possível extrair informações do produto KaBuM.' };
    }

    const product = products.find(p => p.sku === sku) ?? products[0];
    const currentPrice = Math.round(product.price * 100);
    const affiliateLink = generateKabumAffiliateLink(productUrl, creds.publisher_id);

    const offer: NormalizedOffer = {
      externalId: product.sku,
      marketplace: 'kabum',
      title: product.name,
      currentPrice,
      originalPrice: null,
      discountPercent: null,
      imageUrl: product.image,
      productUrl,
      affiliateLink,
      condition: null,
      installments: null,
      category: null,
      sales: null,
      couponCode: null,
    };

    return { ok: true, offer, marketplace: 'kabum' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao buscar produto KaBuM' };
  }
}

// ─── Fetch by URL (main router) ───────────────────────────────────────────────

export async function fetchProductByUrl(rawUrl: string): Promise<{
  ok: boolean;
  offer?: NormalizedOffer;
  marketplace?: string;
  error?: string;
}> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, error: 'Não autenticado' };

  const marketplace = detectMarketplace(rawUrl);
  if (!marketplace) return { ok: false, error: 'URL não reconhecida. Suportamos: Mercado Livre, Amazon, Shopee, AliExpress e KaBuM.' };

  if (marketplace === 'shopee') return fetchShopeeProductByUrl(rawUrl, user.id);
  if (marketplace === 'amazon') return fetchAmazonProductByUrl(rawUrl, user.id);
  if (marketplace === 'aliexpress') return fetchAliExpressProductByUrl(rawUrl, user.id);
  if (marketplace === 'kabum') return fetchKabumProductByUrl(rawUrl, user.id);

  // ── Mercado Livre ──────────────────────────────────────────────────────────
  const { data: conn } = await supabaseAdmin
    .from('marketplace_connections')
    .select('encrypted_credentials')
    .eq('user_id', user.id)
    .eq('marketplace', 'mercadolivre')
    .maybeSingle();

  if (!conn) return { ok: false, error: 'Mercado Livre não conectado. Configure sua Tag de Afiliado e Cookie em Marketplaces antes de fazer disparo manual.' };

  const creds = loadMarketplaceCredentials(conn.encrypted_credentials);

  if (!creds.tag_afiliado || !creds.cookie_session) {
    return { ok: false, error: 'Credenciais do Mercado Livre incompletas. Configure a Tag de Afiliado e o Cookie de sessão em Marketplaces.' };
  }

  // Detect URL type: catalog product (/p/MLB...) vs direct item (MLB...)
  const catalogMatch = rawUrl.match(/\/p\/(MLB\d+)/i);
  const itemId = catalogMatch ? null : extractMLItemId(rawUrl);

  if (!catalogMatch && !itemId) {
    return { ok: false, error: 'Não foi possível extrair o ID do produto do Mercado Livre. Certifique-se de copiar o link direto do produto.' };
  }

  // Helper: generate ML affiliate link via the affiliate program API (same as n8n workflow)
  async function generateMLAffiliateLink(productUrl: string): Promise<string | null> {
    try {
      const { tag_afiliado, cookie_session } = creds;
      if (!tag_afiliado || !cookie_session) return null;
      // Normalize cookie: stored as JSON array ([{"name":...}]) or raw "name=value; ..." string
      const cookieHeader = normalizeCookieSession(cookie_session);
      const res = await fetch('https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          'accept': 'application/json, text/plain, */*',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'origin': 'https://www.mercadolivre.com.br',
          'referer': 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
          'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
          'Cookie': cookieHeader,
        },
        body: JSON.stringify({ urls: [stripQueryParams(productUrl)], tag: tag_afiliado }),
      });
      if (!res.ok) return null;
      const data = await res.json();
      const shortUrl: string | undefined = data?.urls?.[0]?.short_url;
      if (!shortUrl) return null;
      // If ML returned the same catalog URL (/p/MLB...) without affiliate tracking,
      // it means createLink didn't work (auth failed or catalog not affiliatable) — treat as null
      if (/\/p\/MLB\d+/i.test(shortUrl)) return null;
      return shortUrl;
    } catch {
      return null;
    }
  }

  try {
    // ── Catalog product URL (/p/MLB...) ───────────────────────────────────────
    if (catalogMatch) {
      const catalogId = catalogMatch[1];

      // Strategy 1: extract wid=MLBXXXXXX from the URL (item ID embedded in recommendation links)
      // e.g. ...#...&wid=MLB4083314347&...
      const widMatch = rawUrl.match(/[?&#]wid=(MLB\d+)/i);
      const widItemId = widMatch ? widMatch[1] : null;

      if (widItemId) {
        // Direct item lookup — most reliable, no auth needed for public items
        const itemRes = await fetch(`https://api.mercadolibre.com/items/${widItemId}`, {
          headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
          next: { revalidate: 0 },
        });
        if (itemRes.ok) {
          const item = await itemRes.json();
          const currentPrice = Math.round((item.price ?? 0) * 100);
          // Deal items sometimes return price=0 from public API — fall through to next strategy
          if (currentPrice > 0) {
            const originalPrice = item.original_price ? Math.round(item.original_price * 100) : null;
            const discountPercent = originalPrice && originalPrice > currentPrice
              ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
              : null;
            // Use direct item URL for createLink — item.permalink often points to
            // a catalog page (/p/MLB...) which the createLink API rejects.
            // The /-/_/{id} format is always a valid direct item URL.
            const permalink = item.permalink ?? rawUrl;
            const productUrl = /\/p\/MLB\d+/i.test(permalink)
              ? `https://www.mercadolivre.com.br/-/_/${widItemId}`
              : permalink;
            const affiliateLink = await generateMLAffiliateLink(productUrl);
            const offer: NormalizedOffer = {
              externalId: widItemId,
              marketplace: 'mercadolivre',
              title: item.title ?? 'Produto sem título',
              currentPrice,
              originalPrice,
              discountPercent,
              imageUrl: item.thumbnail ? item.thumbnail.replace('/p/', '/D_') : '',
              productUrl,
              affiliateLink: affiliateLink ?? productUrl,
              condition: item.condition === 'new' ? 'novo' : item.condition ?? null,
              installments: null,
              category: item.category_id ?? null,
              sales: item.sold_quantity ?? null,
              couponCode: null,
            };
            return { ok: true, offer, marketplace: 'mercadolivre' };
          }
        }
      }

      // Strategy 2: ML Products API — returns product metadata + buy_box_winner
      const ML_BROWSER_HEADERS = {
        'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
        'Accept-Language': 'pt-BR,pt;q=0.9,en-US;q=0.8',
        'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      };

      const productRes = await fetch(`https://api.mercadolibre.com/products/${catalogId}`, {
        headers: { 'Accept': 'application/json', 'User-Agent': 'Mozilla/5.0' },
        next: { revalidate: 0 },
      });

      if (productRes.ok) {
        const product = await productRes.json();

        // Try to get pricing from buy_box_winner
        const bbw = product?.buy_box_winner;
        const currentPrice = Math.round((bbw?.price ?? 0) * 100);

        // Deal products often have no buy_box_winner in public API (price=0) — fall through to HTML scraping
        if (currentPrice > 0) {
          const originalPrice = bbw?.original_price ? Math.round(bbw.original_price * 100) : null;
          const discountPercent = originalPrice && originalPrice > currentPrice
            ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
            : null;

          // Best image from product pictures
          const pictures = (product?.pictures ?? []) as Array<{ url?: string }>;
          const rawImg = pictures[0]?.url ?? '';
          const imageUrl = rawImg.replace('/p/', '/D_');

          // Canonical URL for the winning item (if available)
          const bbwItemId: string = bbw?.item_id ?? '';
          const productUrl = bbwItemId
            ? `https://www.mercadolivre.com.br/-/_/${bbwItemId}`
            : rawUrl;
          const affiliateLink = await generateMLAffiliateLink(productUrl);

          const offer: NormalizedOffer = {
            externalId: bbwItemId || catalogId,
            marketplace: 'mercadolivre',
            title: product?.name ?? 'Produto sem título',
            currentPrice,
            originalPrice,
            discountPercent,
            imageUrl,
            productUrl,
            affiliateLink: affiliateLink ?? productUrl,
            condition: null,
            installments: null,
            category: product?.domain_id ?? null,
            sales: null,
            couponCode: null,
          };
          return { ok: true, offer, marketplace: 'mercadolivre' };
        }
      }

      // Strategy 3: Scrape the product page HTML directly (fallback when API blocks)
      const pageUrl = rawUrl.split('#')[0]; // strip fragment
      const pageRes = await fetch(pageUrl, { headers: ML_BROWSER_HEADERS, next: { revalidate: 0 } });
      if (!pageRes.ok) {
        return { ok: false, error: `Produto não encontrado no Mercado Livre (${pageRes.status}). Tente copiar o link do item específico ao invés da página de catálogo.` };
      }

      const pageHtml = await pageRes.text();
      const $p = cheerio.load(pageHtml);

      let mlTitle: string | null = null;
      let mlCurrentPrice = 0;
      let mlOriginalPrice: number | null = null;
      let mlImageUrl = '';
      let mlItemId = '';

      // Try JSON-LD first
      $p('script[type="application/ld+json"]').each((_i, el) => {
        try {
          const d = JSON.parse($p(el).html() ?? '');
          if (d?.['@type'] === 'Product') {
            if (!mlTitle && d.name) mlTitle = String(d.name).trim();
            if (!mlImageUrl && d.image) mlImageUrl = Array.isArray(d.image) ? d.image[0] : d.image;
            if (!mlCurrentPrice && d.offers?.price) {
              mlCurrentPrice = Math.round(parseFloat(String(d.offers.price)) * 100);
            }
          }
        } catch { /* ignore */ }
      });

      // Try og tags
      if (!mlTitle) mlTitle = $p('meta[property="og:title"]').attr('content')?.trim() ?? null;
      if (!mlImageUrl) mlImageUrl = $p('meta[property="og:image"]').attr('content') ?? '';
      if (!mlCurrentPrice) {
        const ogPrice = $p('meta[property="og:price:amount"]').attr('content');
        if (ogPrice) mlCurrentPrice = Math.round(parseFloat(ogPrice) * 100);
      }

      // ML deal pages omit og:price:amount but embed the price in og:title (e.g. "Product - R$ 68,99")
      if (!mlCurrentPrice && mlTitle) {
        const priceInTitle = mlTitle.match(/R\$\s*([\d.]+,\d{2})/);
        if (priceInTitle) {
          const raw = priceInTitle[1].replace(/\./g, '').replace(',', '.');
          mlCurrentPrice = Math.round(parseFloat(raw) * 100);
          // Strip the price suffix from the title to keep it clean
          mlTitle = mlTitle.replace(/\s*[-–]\s*R\$.*$/, '').trim() || mlTitle;
        }
      }

      // Try embedded __PRELOADED_STATE__ or window.__INITIAL_STATE__
      if (!mlCurrentPrice || !mlTitle) {
        const stateMatch = pageHtml.match(/window\.__PRELOADED_STATE__\s*=\s*(\{.+?\});\s*<\/script>/);
        if (stateMatch) {
          try {
            const state = JSON.parse(stateMatch[1]);
            const comp = state?.initialState?.components;
            if (!mlTitle) mlTitle = comp?.header?.title ?? null;
          } catch { /* ignore */ }
        }
      }

      // Page title fallback
      if (!mlTitle) mlTitle = $p('title').text().replace(/\s*[-|].*$/, '').trim() || null;

      // "Mercado Livre" alone means the page returned a generic shell (SPA, deal expired, etc.)
      if (!mlTitle || mlTitle.toLowerCase().trim() === 'mercado livre') {
        return { ok: false, error: 'Não foi possível carregar os dados deste produto. Abra o link no navegador, acesse o item específico e copie a URL da página do produto.' };
      }

      const pageProductUrl = $p('link[rel="canonical"]').attr('href') ?? pageUrl;
      // Try to extract item ID from canonical URL
      const canonicalItemMatch = pageProductUrl.match(/(MLB\d+)/i);
      if (canonicalItemMatch) mlItemId = canonicalItemMatch[1];

      const affiliateLinkPage = await generateMLAffiliateLink(pageProductUrl);

      const offerFromPage: NormalizedOffer = {
        externalId: mlItemId || catalogId,
        marketplace: 'mercadolivre',
        title: mlTitle,
        currentPrice: mlCurrentPrice,
        originalPrice: mlOriginalPrice,
        discountPercent: mlOriginalPrice && mlOriginalPrice > mlCurrentPrice
          ? Math.round(((mlOriginalPrice - mlCurrentPrice) / mlOriginalPrice) * 100)
          : null,
        imageUrl: mlImageUrl,
        productUrl: pageProductUrl,
        affiliateLink: affiliateLinkPage ?? pageProductUrl,
        condition: null,
        installments: null,
        category: null,
        sales: null,
        couponCode: null,
      };
      return { ok: true, offer: offerFromPage, marketplace: 'mercadolivre' };
    }

    // ── Direct item URL ──────────────────────────────────────────────────────
    const res = await fetch(`https://api.mercadolibre.com/items/${itemId}`, {
      headers: { 'Accept': 'application/json' },
      next: { revalidate: 0 },
    });

    if (!res.ok) {
      return { ok: false, error: `Produto não encontrado (${res.status}). Verifique se o link está correto e o produto está ativo.` };
    }

    const item = await res.json();

    const currentPrice = Math.round((item.price ?? 0) * 100);
    const originalPrice = item.original_price ? Math.round(item.original_price * 100) : null;
    const discountPercent = originalPrice && originalPrice > currentPrice
      ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
      : null;

    const productUrl = item.permalink ?? rawUrl;
    const affiliateLink = await generateMLAffiliateLink(productUrl);

    const offer: NormalizedOffer = {
      externalId: itemId!,
      marketplace: 'mercadolivre',
      title: item.title ?? 'Produto sem título',
      currentPrice,
      originalPrice,
      discountPercent,
      imageUrl: item.thumbnail ? item.thumbnail.replace('/p/', '/D_') : '',
      productUrl,
      affiliateLink: affiliateLink ?? productUrl,
      condition: item.condition === 'new' ? 'novo' : item.condition ?? null,
      installments: null,
      category: item.category_id ?? null,
      sales: item.sold_quantity ?? null,
      couponCode: null,
    };

    return { ok: true, offer, marketplace: 'mercadolivre' };
  } catch (err) {
    return { ok: false, error: err instanceof Error ? err.message : 'Erro ao buscar produto' };
  }
}

// ─── Send manual dispatch ─────────────────────────────────────────────────────

export async function sendManualDispatch(
  offer: NormalizedOffer,
  groupIds: string[],
  customMessage: string
): Promise<{ ok: boolean; sent: number; errors: string[] }> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { ok: false, sent: 0, errors: ['Não autenticado'] };

  const errors: string[] = [];
  let sent = 0;
  const today = new Date(Date.now() - 3 * 3600000).toISOString().split('T')[0];

  // Upsert offer to DB first
  const { data: savedOffer } = await supabaseAdmin
    .from('offers')
    .upsert({
      user_id: user.id,
      marketplace: offer.marketplace,
      external_id: offer.externalId,
      title: offer.title,
      current_price: offer.currentPrice,
      original_price: offer.originalPrice ?? null,
      discount_percent: offer.discountPercent ?? null,
      image_url: offer.imageUrl ?? null,
      product_url: offer.productUrl,
      affiliate_link: offer.affiliateLink ?? null,
      condition: offer.condition ?? null,
      installments: offer.installments ?? null,
      category: offer.category ?? null,
      fetched_at: new Date().toISOString(),
    }, { onConflict: 'user_id,marketplace,external_id' })
    .select('id')
    .single();

  if (!savedOffer) return { ok: false, sent: 0, errors: ['Erro ao salvar oferta'] };

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
    // WhatsApp unavailable — Telegram may still work
  }

  // Get Telegram client
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

  for (const groupId of groupIds) {
    const { data: group } = await supabaseAdmin
      .from('dispatch_groups')
      .select('*')
      .eq('id', groupId)
      .eq('user_id', user.id)
      .single();

    if (!group) continue;

    const { data: destinations } = await supabaseAdmin
      .from('group_destinations')
      .select('*')
      .eq('group_id', groupId);

    if (!destinations || destinations.length === 0) continue;

    // Use custom message or format from group template
    const message = customMessage.trim() || formatMessage(group.template_text || DEFAULT_TEMPLATE, offer);

    for (const dest of destinations ?? []) {
      const { data: log } = await supabaseAdmin
        .from('dispatch_logs')
        .insert({
          user_id: user.id,
          group_id: groupId,
          offer_id: savedOffer.id,
          channel_type: dest.channel_type,
          dispatched_date: today,
          status: 'pending',
        })
        .select('id')
        .single();

      try {
        if (dest.channel_type === 'whatsapp' && evo) {
          if (offer.imageUrl) {
            try {
              await evo.sendImage(instanceName, dest.target_id, offer.imageUrl, message, waProviderToken);
            } catch {
              await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
            }
          } else {
            await evo.sendText(instanceName, dest.target_id, message, waProviderToken);
          }
        } else if (dest.channel_type === 'telegram' && tg) {
          const tgMsg = formatForTelegram(message);
          if (offer.imageUrl) {
            await tg.sendPhoto(dest.target_id, offer.imageUrl, tgMsg);
          } else {
            await tg.sendMessage(dest.target_id, tgMsg);
          }
        } else {
          continue;
        }

        if (log) {
          await supabaseAdmin.from('dispatch_logs').update({ status: 'sent' }).eq('id', log.id);
        }
        sent++;
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : String(err);
        errors.push(`${group.name} / ${dest.target_name ?? dest.target_id}: ${errMsg}`);
        if (log) {
          await supabaseAdmin.from('dispatch_logs').update({ status: 'failed', error_message: errMsg }).eq('id', log.id);
        }
      }
    }
  }

  return { ok: true, sent, errors };
}

// ─── List active groups for selection ─────────────────────────────────────────

export async function getActiveGroupsForDispatch(): Promise<Array<{
  id: string;
  name: string;
  destinations_count: number;
}>> {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data } = await supabaseAdmin
    .from('dispatch_groups')
    .select('id, name, group_destinations(id)')
    .eq('user_id', user.id)
    .eq('is_active', true)
    .order('name');

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  return (data ?? []).map((g: any) => ({
    id: g.id,
    name: g.name,
    destinations_count: g.group_destinations?.length ?? 0,
  }));
}
