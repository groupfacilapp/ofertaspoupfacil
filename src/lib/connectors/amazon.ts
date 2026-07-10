// src/lib/connectors/amazon.ts
import * as cheerio from 'cheerio';
import type {
  MarketplaceConnector,
  DecryptedCredentials,
  NormalizedOffer,
  FetchConfig,
  ValidationResult,
} from './types';
import { registerConnector } from './registry';

// --- Filters (exported for unit tests) ---

export const FILTER_DIGITAIS =
  /ebook|kindle|livro|capa comum|capa dura|capa mole|audiolivro|audible|assinatura|prime video|paperback|hardcover|brochura|encadernado/i;

export const FILTER_ISBN = /^(978|85|65)\d{7,}$/i;

const FILTER_SPONSORED = /^Anúncio patrocinado\s?[–\-]\s?/i;

// --- Price utilities (exported for unit tests) ---

export function parsePrice(priceVal: unknown): number {
  if (priceVal === null || priceVal === undefined) return 0;
  if (typeof priceVal === 'number') return priceVal;
  let str = String(priceVal).trim();
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  str = str.replace(/[^\d.]/g, '');
  return parseFloat(str) || 0;
}

// --- Offer filter (exported for unit tests) ---

export function shouldIncludeOffer(o: {
  externalId?: string;
  currentPrice: number;
  originalPrice: number | null;
  title: string;
  category?: string | null;
}): boolean {
  if (o.currentPrice === 0) return false;
  if (FILTER_DIGITAIS.test(o.title)) return false;
  if (FILTER_ISBN.test(o.title)) return false;
  // Amazon books use ISBN-10 as ASIN (e.g. 8538089803, 6555006420).
  // FILTER_ISBN was only checking title — now also checks externalId/ASIN.
  if (o.externalId && FILTER_ISBN.test(o.externalId)) return false;
  // Block by category detected from Amazon JSON (gl/productGroup/binding)
  if (o.category === 'livros') return false;
  // If there's no meaningful discount: currentPrice must be less than originalPrice
  // (with up to 15% margin — if currentPrice >= 85% of originalPrice, not a real deal)
  if (o.originalPrice !== null && o.currentPrice >= o.originalPrice) return false;
  return true;
}

// --- Affiliate link (sync version exported for unit tests) ---

export function generateAmazonAffiliateLinkSync(productUrl: string, tag: string): string {
  const sep = productUrl.includes('?') ? '&' : '?';
  return `${productUrl}${sep}tag=${tag}`;
}

// --- Strategy 1: JSON Widget Parser (exported for unit tests) ---
// Uses the same JSON path as the working n8n workflow:
// jsonData.prefetchedData.entity.rankedPromotions → item.product.entity

function extractWidgetJson(html: string): Record<string, unknown> | null {
  // Try any slot number (slot-14 is common on deals pages)
  const slotMatch = html.match(/assets\.mountWidget\('slot-\d+',\s*/);
  if (!slotMatch || slotMatch.index === undefined) return null;

  const jsonStart = html.indexOf('{', slotMatch.index + slotMatch[0].length);
  if (jsonStart === -1) return null;

  let depth = 0, jsonEnd = -1;
  for (let i = jsonStart; i < html.length; i++) {
    if (html[i] === '{') depth++;
    else if (html[i] === '}') { depth--; if (depth === 0) { jsonEnd = i; break; } }
  }
  if (jsonEnd === -1) return null;

  try {
    return JSON.parse(html.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>;
  } catch {
    return null;
  }
}

export function parseAmazonStrategy1(html: string): NormalizedOffer[] {
  const widgetData = extractWidgetJson(html);
  if (!widgetData) return [];

  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const data = widgetData as any;

  // Path used by n8n (works on /s?i=todays-deals and keyword pages)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const promotions: any[] = data?.prefetchedData?.entity?.rankedPromotions ?? [];

  // Fallback path (older widget structure)
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const legacyDeals = data?.widgetData?.versionedWidgetData?.DEALS_V2;

  if (promotions.length === 0 && !legacyDeals) return [];

  const offers: NormalizedOffer[] = [];

  // --- Primary: prefetchedData.entity.rankedPromotions ---
  if (promotions.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    for (const item of promotions) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const productEntity: any = item.product?.entity;
      if (!productEntity) continue;

      const asin: string = productEntity.asin ?? '';
      if (!asin) continue;

      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const buyingOption: any = productEntity.buyingOptions?.[0];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const priceEntity: any = buyingOption?.price?.entity;

      let currentPriceRaw: number = priceEntity?.priceToPay?.moneyValueOrRange?.value?.amount ?? 0;
      let condition: string | null = null;

      // Check Pix/Boleto price
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const activePromotions: any[] = productEntity?.promotionsUnified?.entity?.displayablePromotions ?? [];
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const pixOffer = activePromotions.find((p: any) => p.combinedSavings?.fixedTargetAmount?.amount != null);
      if (pixOffer) {
        currentPriceRaw = pixOffer.combinedSavings.fixedTargetAmount.amount;
        condition = 'À vista (Pix/Boleto)';
      } else if (item.dealDetails?.entity?.type === 'LIGHTNING_DEAL') {
        condition = 'Oferta Relâmpago';
      }

      const originalPriceRaw: number | null = priceEntity?.basisPrice?.moneyValueOrRange?.value?.amount ?? null;
      const currentPrice = Math.round(parsePrice(currentPriceRaw) * 100);
      const originalPrice = originalPriceRaw != null ? Math.round(parsePrice(originalPriceRaw) * 100) : null;

      // Discount % — use Amazon's own savings.percentage if available
      const amazonDiscount: number | null = priceEntity?.savings?.percentage?.value ?? null;
      const discountPercent = amazonDiscount
        ?? (originalPrice && originalPrice > currentPrice
          ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
          : null);

      // Title
      const rawTitle: string = productEntity?.title?.entity?.displayString ?? '';
      const title = rawTitle.replace(FILTER_SPONSORED, '').trim();
      if (!title || currentPrice === 0) continue;

      // Image — constructed from physicalId (hi-res)
      const imageId: string = productEntity?.productImages?.entity?.images?.[0]?.hiRes?.physicalId ?? '';
      const imageUrl = imageId
        ? `https://m.media-amazon.com/images/I/${imageId}.jpg`
        : (productEntity?.primaryImage?.url ?? '');

      // Product URL
      const partialLink: string = productEntity?.links?.entity?.viewOnAmazon?.url ?? '';
      const productUrl = partialLink
        ? `https://www.amazon.com.br${partialLink}`
        : `https://www.amazon.com.br/dp/${asin}`;

      // Installments
      let installments: string | null = null;
      if (buyingOption?.dealDetails?.entity?.type === 'INSTALLMENTS') {
        installments = 'Parcelamento disponível';
      } else {
        const inst = buyingOption?.installmentOptions?.displayableInstallment;
        if (inst?.numberOfInstallments && inst?.installmentAmount?.amount) {
          installments = `Parcelamento em ${inst.numberOfInstallments}x sem juros`;
        }
      }

      // Detect product category from Amazon JSON fields.
      // Books have gl="book", productGroup="Book", or binding like "Capa Comum"/"Paperback".
      // Populate category so that blocked_keywords can match "livros" even when the title
      // is just the book name without any book-related words.
      const gl: string = productEntity?.gl ?? '';
      const productGroup: string = productEntity?.productGroup ?? '';
      const binding: string = productEntity?.binding ?? '';
      let category: string | null = null;
      if (/\bbook\b|livro|paperback|hardcover|capa (comum|dura)|brochura/i.test(
        `${gl} ${productGroup} ${binding}`
      )) {
        category = 'livros';
      }

      const offer: NormalizedOffer = {
        externalId: asin,
        marketplace: 'amazon',
        title,
        currentPrice,
        originalPrice,
        discountPercent,
        imageUrl,
        productUrl,
        affiliateLink: null,
        condition,
        installments,
        category,
        sales: null,
        couponCode: null,
      };

      if (shouldIncludeOffer({ externalId: asin, currentPrice: offer.currentPrice, originalPrice: offer.originalPrice, title: offer.title, category: offer.category })) {
        offers.push(offer);
      }
    }
    return offers;
  }

  // --- Fallback: widgetData.versionedWidgetData.DEALS_V2 (legacy structure) ---
  const priceMap: Record<string, unknown> = (legacyDeals.priceMap as Record<string, unknown>) ?? {};
  const productMap: Record<string, unknown> = (legacyDeals.productMap as Record<string, unknown>) ?? {};
  const dealMap: Record<string, unknown> = (legacyDeals.dealMap as Record<string, unknown>) ?? {};
  const slotToDeals: Record<string, unknown> = (legacyDeals.slotToDeals as Record<string, unknown>) ?? {};

  const allDealIds: string[] = (Object.values(slotToDeals).flat() as string[]);

  for (const dealId of allDealIds) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const deal = dealMap[dealId] as any;
    if (!deal) continue;
    const asin: string = deal.impressionAsin;
    if (!asin) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const product = productMap[asin] as any;
    if (!product) continue;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const priceInfo = priceMap[asin] as any;

    const rawTitle: string = product.title ?? '';
    const title = rawTitle.replace(FILTER_SPONSORED, '').trim();
    if (!title) continue;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const activePromotions: any[] = product.promotionsUnified?.entity?.displayablePromotions ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const pixOffer = activePromotions.find((p: any) => p.combinedSavings?.fixedTargetAmount?.amount != null);

    let currentPriceRaw = 0;
    let condition: string | null = null;
    if (pixOffer) {
      currentPriceRaw = pixOffer.combinedSavings.fixedTargetAmount.amount;
      condition = 'À vista (Pix/Boleto)';
    } else {
      currentPriceRaw = priceInfo?.priceToPay?.moneyValueOrRange?.value?.amount ?? 0;
      if (deal.dealDetails?.entity?.type === 'LIGHTNING_DEAL') condition = 'Oferta Relâmpago';
    }

    const originalPriceRaw = priceInfo?.basisPrice?.moneyValueOrRange?.value?.amount ?? null;
    const currentPrice = Math.round(parsePrice(currentPriceRaw) * 100);
    const originalPrice = originalPriceRaw != null ? Math.round(parsePrice(originalPriceRaw) * 100) : null;

    const relativeUrl: string = product.detailPageURL ?? `/dp/${asin}`;
    const productUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://www.amazon.com.br${relativeUrl}`;

    const offer: NormalizedOffer = {
      externalId: asin,
      marketplace: 'amazon',
      title,
      currentPrice,
      originalPrice,
      discountPercent: originalPrice && originalPrice > currentPrice
        ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100)
        : null,
      imageUrl: product.primaryImage?.url ?? '',
      productUrl,
      affiliateLink: null,
      condition,
      installments: null,
      category: null,
      sales: null,
      couponCode: null,
    };

    if (shouldIncludeOffer({ currentPrice: offer.currentPrice, originalPrice: offer.originalPrice, title: offer.title })) {
      offers.push(offer);
    }
  }

  return offers;
}

// --- Strategy 2: HTML Cheerio fallback ---
// Title: h2 span (not h2 a span — Amazon deals page doesn't use that structure)
// Original price: .a-offscreen containing "De: R$ " prefix
// (the .a-text-price selector returns unit/per-liter price, not the original price)

function parseAmazonStrategy2(html: string): NormalizedOffer[] {
  const $ = cheerio.load(html);
  const offers: NormalizedOffer[] = [];

  $('[data-component-type="s-search-result"]').each((_i, el) => {
    const $el = $(el);
    const asin = $el.attr('data-asin');
    if (!asin) return;

    // Correct title selector for deals page
    const title = $el.find('h2 span').first().text().trim();
    if (!title || FILTER_DIGITAIS.test(title)) return;

    // Current price from .a-offscreen (first occurrence = current price)
    const currentPriceText = $el.find('.a-price .a-offscreen').first().text().trim();
    const currentPriceCents = currentPriceText ? Math.round(parsePrice(currentPriceText) * 100) : 0;
    if (currentPriceCents === 0) return;

    // Original price: Amazon puts "De: R$ X,XX" in .a-offscreen for comparison price
    // Find ALL .a-offscreen values and look for the one starting with "De:"
    let originalPriceCents: number | null = null;
    $el.find('.a-offscreen').each((_, offEl) => {
      const text = $(offEl).text().trim();
      if (text.startsWith('De:')) {
        const orig = parsePrice(text.replace(/^De:\s*/i, ''));
        if (orig > 0) {
          originalPriceCents = Math.round(orig * 100);
          return false; // break
        }
      }
    });

    // Only trust original price if it's genuinely higher (real discount)
    if (originalPriceCents !== null && originalPriceCents <= currentPriceCents) {
      originalPriceCents = null;
    }

    const discountPercent =
      originalPriceCents && originalPriceCents > currentPriceCents
        ? Math.round(((originalPriceCents - currentPriceCents) / originalPriceCents) * 100)
        : null;

    // Upgrade image to high-res: remove Amazon CDN size suffix (e.g. _AC_UL320_)
    const rawImageUrl = $el.find('img.s-image').first().attr('src') ?? '';
    const imageUrl = rawImageUrl.replace(/\._[A-Z0-9_,]+_\.(jpg|png|webp)/i, '.$1');
    const relUrl = $el.find('h2 a').first().attr('href') ?? `/dp/${asin}`;
    const productUrl = relUrl.startsWith('http')
      ? relUrl
      : `https://www.amazon.com.br${relUrl}`;

    const offer: NormalizedOffer = {
      externalId: asin,
      marketplace: 'amazon',
      title,
      currentPrice: currentPriceCents,
      originalPrice: originalPriceCents,
      discountPercent,
      imageUrl,
      productUrl,
      affiliateLink: null,
      condition: null,
      installments: null,
      category: null,
      sales: null,
      couponCode: null,
    };

    if (shouldIncludeOffer({ externalId: asin, currentPrice: offer.currentPrice, originalPrice: offer.originalPrice, title: offer.title })) {
      offers.push(offer);
    }
  });

  return offers;
}

// --- Amazon fetch headers ---

const AMAZON_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Referer': 'https://www.amazon.com.br/s?i=todays-deals&s=popularity-rank&fs=true',
  'Content-Type': 'text/html;charset=UTF-8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function buildAmazonUrl(keyword: string | null, page: number): string {
  if (keyword) {
    // Keyword search — plain search URL (same as n8n workflow)
    return `https://www.amazon.com.br/s?k=${encodeURIComponent(keyword)}&page=${page}`;
  }
  return `https://www.amazon.com.br/s?i=todays-deals&s=exact-aware-popularity-rank&fs=true&page=${page}`;
}

// --- Cookie normalizer ---
// Accepts either a raw "name=value; name2=value2" string
// or a JSON array exported by the Cookie-Editor extension:
// [{ "name": "session-id", "value": "xxx", ... }, ...]

export function parseCookieString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as { name: string; value: string }[];
      return arr.map((c) => `${c.name}=${c.value}`).join('; ');
    } catch {
      // Not valid JSON — treat as raw string
    }
  }
  return trimmed;
}

// --- AmazonConnector ---

export class AmazonConnector implements MarketplaceConnector {
  readonly marketplace = 'amazon' as const;

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { page, keywords, credentials } = config;
    const keyword = keywords.length > 0 ? keywords[0] : null;
    const url = buildAmazonUrl(keyword, page);

    const response = await fetch(url, { headers: AMAZON_HEADERS });
    if (!response.ok) throw new Error(`Amazon fetch failed: ${response.status}`);
    const html = await response.text();

    // Try Strategy 1 first, fall back to Strategy 2
    let offers = parseAmazonStrategy1(html);
    if (offers.length === 0) {
      offers = parseAmazonStrategy2(html);
    }

    // Generate affiliate links sequentially to avoid Amazon SiteStripe rate limits
    const offersWithLinks: NormalizedOffer[] = [];
    for (const offer of offers) {
      const affiliateLink = await this.generateAffiliateLink(offer.productUrl, credentials);
      offersWithLinks.push({ ...offer, affiliateLink });
      
      // Small delay between requests to avoid HTTP 429 Too Many Requests
      if (offer !== offers[offers.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }

    return offersWithLinks;
  }

  async generateAffiliateLink(
    productUrl: string,
    credentials: DecryptedCredentials
  ): Promise<string> {
    const { tag, cookies } = credentials;
    if (!tag) return productUrl;

    if (!cookies) {
      return generateAmazonAffiliateLinkSync(productUrl, tag);
    }

    // Convert JSON array (Cookie-Editor export) to "name=value; ..." string
    const cookieHeader = parseCookieString(cookies);

    // Try SiteStripe API
    try {
      const apiUrl = new URL(
        'https://www.amazon.com.br/associates/sitestripe/getShortUrl'
      );
      apiUrl.searchParams.set('longUrl', productUrl);

      const response = await fetch(apiUrl.toString(), {
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
          'sec-ch-ua-mobile': '?0',
          'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty',
          'sec-fetch-mode': 'cors',
          'sec-fetch-site': 'same-origin',
          'user-agent': AMAZON_HEADERS['User-Agent'],
          'x-requested-with': 'XMLHttpRequest',
          referer: 'https://www.amazon.com.br/s?i=todays-deals',
          Cookie: cookieHeader,
        },
      });

      const data = (await response.json()) as { shortUrl?: string };
      if (data.shortUrl) return data.shortUrl;
    } catch {
      // SiteStripe failed — fall back to tag append
    }

    return generateAmazonAffiliateLinkSync(productUrl, tag);
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    if (!credentials.tag) {
      return { valid: false, error: 'Tag de afiliado é obrigatória' };
    }

    if (!credentials.cookies) {
      // Tag-append mode always works — no cookies needed to validate
      return { valid: true };
    }

    // Test SiteStripe with a known ASIN
    const testUrl = 'https://www.amazon.com.br/dp/B0CPKWCJH4';
    try {
      const link = await this.generateAffiliateLink(testUrl, credentials);
      const isValid =
        link.includes('amazon') || link.includes('amzn') || link.includes('tag=');
      return isValid
        ? { valid: true }
        : { valid: false, error: 'Cookies inválidos ou expirados' };
    } catch {
      return { valid: false, error: 'Falha ao validar cookies Amazon' };
    }
  }
}

// Auto-register when module is imported
registerConnector(new AmazonConnector());
