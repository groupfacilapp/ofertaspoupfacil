import * as cheerio from 'npm:cheerio';
import type { MarketplaceConnector, DecryptedCredentials, NormalizedOffer, FetchConfig, ValidationResult } from './types.ts';
import { registerConnector } from './registry.ts';

export const FILTER_DIGITAIS = /ebook|kindle|livro|capa comum|capa dura|capa mole|audiolivro|audible|assinatura|prime video|paperback|hardcover|brochura|encadernado/i;
export const FILTER_ISBN = /^(978|85|65)\d{7,}$/i;
const FILTER_SPONSORED = /^Anúncio patrocinado\s?[–\-]\s?/i;

export function parsePrice(priceVal: unknown): number {
  if (priceVal === null || priceVal === undefined) return 0;
  if (typeof priceVal === 'number') return priceVal;
  let str = String(priceVal).trim();
  if (str.includes(',')) { str = str.replace(/\./g, '').replace(',', '.'); }
  str = str.replace(/[^\d.]/g, '');
  return parseFloat(str) || 0;
}

export function shouldIncludeOffer(o: { externalId?: string; currentPrice: number; originalPrice: number | null; title: string; category?: string | null }): boolean {
  if (o.currentPrice === 0) return false;
  if (FILTER_DIGITAIS.test(o.title)) return false;
  if (FILTER_ISBN.test(o.title)) return false;
  if (o.externalId && FILTER_ISBN.test(o.externalId)) return false;
  if (o.category === 'livros') return false;
  if (o.originalPrice !== null && o.currentPrice >= o.originalPrice) return false;
  return true;
}

export function generateAmazonAffiliateLinkSync(productUrl: string, tag: string): string {
  const sep = productUrl.includes('?') ? '&' : '?';
  return `${productUrl}${sep}tag=${tag}`;
}

function extractWidgetJson(html: string): Record<string, unknown> | null {
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
  try { return JSON.parse(html.slice(jsonStart, jsonEnd + 1)) as Record<string, unknown>; } catch { return null; }
}

export function parseAmazonStrategy1(html: string): NormalizedOffer[] {
  const widgetData = extractWidgetJson(html);
  if (!widgetData) return [];
  // deno-lint-ignore no-explicit-any
  const data = widgetData as any;
  // deno-lint-ignore no-explicit-any
  const promotions: any[] = data?.prefetchedData?.entity?.rankedPromotions ?? [];
  const legacyDeals = data?.widgetData?.versionedWidgetData?.DEALS_V2;
  if (promotions.length === 0 && !legacyDeals) return [];

  const offers: NormalizedOffer[] = [];

  if (promotions.length > 0) {
    // deno-lint-ignore no-explicit-any
    for (const item of promotions) {
      // deno-lint-ignore no-explicit-any
      const productEntity: any = item.product?.entity;
      if (!productEntity) continue;
      const asin: string = productEntity.asin ?? '';
      if (!asin) continue;
      // deno-lint-ignore no-explicit-any
      const buyingOption: any = productEntity.buyingOptions?.[0];
      // deno-lint-ignore no-explicit-any
      const priceEntity: any = buyingOption?.price?.entity;

      let currentPriceRaw: number = priceEntity?.priceToPay?.moneyValueOrRange?.value?.amount ?? 0;
      let condition: string | null = null;
      // deno-lint-ignore no-explicit-any
      const activePromotions: any[] = productEntity?.promotionsUnified?.entity?.displayablePromotions ?? [];
      // deno-lint-ignore no-explicit-any
      const pixOffer = activePromotions.find((p: any) => p.combinedSavings?.fixedTargetAmount?.amount != null);
      if (pixOffer) { currentPriceRaw = pixOffer.combinedSavings.fixedTargetAmount.amount; condition = 'À vista (Pix/Boleto)'; }
      else if (item.dealDetails?.entity?.type === 'LIGHTNING_DEAL') { condition = 'Oferta Relâmpago'; }

      const originalPriceRaw: number | null = priceEntity?.basisPrice?.moneyValueOrRange?.value?.amount ?? null;
      const currentPrice = Math.round(parsePrice(currentPriceRaw) * 100);
      const originalPrice = originalPriceRaw != null ? Math.round(parsePrice(originalPriceRaw) * 100) : null;
      const amazonDiscount: number | null = priceEntity?.savings?.percentage?.value ?? null;
      const discountPercent = amazonDiscount ?? (originalPrice && originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : null);

      const rawTitle: string = productEntity?.title?.entity?.displayString ?? '';
      const title = rawTitle.replace(FILTER_SPONSORED, '').trim();
      if (!title || currentPrice === 0) continue;

      const imageId: string = productEntity?.productImages?.entity?.images?.[0]?.hiRes?.physicalId ?? '';
      const imageUrl = imageId ? `https://m.media-amazon.com/images/I/${imageId}.jpg` : (productEntity?.primaryImage?.url ?? '');
      const partialLink: string = productEntity?.links?.entity?.viewOnAmazon?.url ?? '';
      const productUrl = partialLink ? `https://www.amazon.com.br${partialLink}` : `https://www.amazon.com.br/dp/${asin}`;

      let installments: string | null = null;
      if (buyingOption?.dealDetails?.entity?.type === 'INSTALLMENTS') { installments = 'Parcelamento disponível'; }
      else {
        const inst = buyingOption?.installmentOptions?.displayableInstallment;
        if (inst?.numberOfInstallments && inst?.installmentAmount?.amount) {
          installments = `Parcelamento em ${inst.numberOfInstallments}x sem juros`;
        }
      }

      const gl: string = productEntity?.gl ?? '';
      const productGroup: string = productEntity?.productGroup ?? '';
      const binding: string = productEntity?.binding ?? '';
      let category: string | null = null;
      if (/\bbook\b|livro|paperback|hardcover|capa (comum|dura)|brochura/i.test(`${gl} ${productGroup} ${binding}`)) {
        category = 'livros';
      }

      const offer: NormalizedOffer = { externalId: asin, marketplace: 'amazon', title, currentPrice, originalPrice, discountPercent, imageUrl, productUrl, affiliateLink: null, condition, installments, category, sales: null, couponCode: null };
      if (shouldIncludeOffer({ externalId: asin, currentPrice: offer.currentPrice, originalPrice: offer.originalPrice, title: offer.title, category: offer.category })) {
        offers.push(offer);
      }
    }
    return offers;
  }

  const priceMap: Record<string, unknown> = (legacyDeals.priceMap as Record<string, unknown>) ?? {};
  const productMap: Record<string, unknown> = (legacyDeals.productMap as Record<string, unknown>) ?? {};
  const dealMap: Record<string, unknown> = (legacyDeals.dealMap as Record<string, unknown>) ?? {};
  const slotToDeals: Record<string, unknown> = (legacyDeals.slotToDeals as Record<string, unknown>) ?? {};
  const allDealIds: string[] = (Object.values(slotToDeals).flat() as string[]);

  for (const dealId of allDealIds) {
    // deno-lint-ignore no-explicit-any
    const deal = dealMap[dealId] as any;
    if (!deal) continue;
    const asin: string = deal.impressionAsin;
    if (!asin) continue;
    // deno-lint-ignore no-explicit-any
    const product = productMap[asin] as any;
    if (!product) continue;
    // deno-lint-ignore no-explicit-any
    const priceInfo = priceMap[asin] as any;

    const rawTitle: string = product.title ?? '';
    const title = rawTitle.replace(FILTER_SPONSORED, '').trim();
    if (!title) continue;

    // deno-lint-ignore no-explicit-any
    const activePromotions: any[] = product.promotionsUnified?.entity?.displayablePromotions ?? [];
    // deno-lint-ignore no-explicit-any
    const pixOffer = activePromotions.find((p: any) => p.combinedSavings?.fixedTargetAmount?.amount != null);
    let currentPriceRaw = 0, condition: string | null = null;
    if (pixOffer) { currentPriceRaw = pixOffer.combinedSavings.fixedTargetAmount.amount; condition = 'À vista (Pix/Boleto)'; }
    else { currentPriceRaw = priceInfo?.priceToPay?.moneyValueOrRange?.value?.amount ?? 0; if (deal.dealDetails?.entity?.type === 'LIGHTNING_DEAL') condition = 'Oferta Relâmpago'; }

    const originalPriceRaw = priceInfo?.basisPrice?.moneyValueOrRange?.value?.amount ?? null;
    const currentPrice = Math.round(parsePrice(currentPriceRaw) * 100);
    const originalPrice = originalPriceRaw != null ? Math.round(parsePrice(originalPriceRaw) * 100) : null;
    const relativeUrl: string = product.detailPageURL ?? `/dp/${asin}`;
    const productUrl = relativeUrl.startsWith('http') ? relativeUrl : `https://www.amazon.com.br${relativeUrl}`;

    const offer: NormalizedOffer = { externalId: asin, marketplace: 'amazon', title, currentPrice, originalPrice, discountPercent: originalPrice && originalPrice > currentPrice ? Math.round(((originalPrice - currentPrice) / originalPrice) * 100) : null, imageUrl: product.primaryImage?.url ?? '', productUrl, affiliateLink: null, condition, installments: null, category: null, sales: null, couponCode: null };
    if (shouldIncludeOffer({ currentPrice: offer.currentPrice, originalPrice: offer.originalPrice, title: offer.title })) {
      offers.push(offer);
    }
  }
  return offers;
}

const AMAZON_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Referer': 'https://www.amazon.com.br/s?i=todays-deals&s=popularity-rank&fs=true',
  'Content-Type': 'text/html;charset=UTF-8',
  'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

function buildAmazonUrl(keyword: string | null, page: number): string {
  if (keyword) return `https://www.amazon.com.br/s?k=${encodeURIComponent(keyword)}&page=${page}`;
  return `https://www.amazon.com.br/s?i=todays-deals&s=exact-aware-popularity-rank&fs=true&page=${page}`;
}

export function parseCookieString(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as { name: string; value: string }[];
      return arr.map((c) => `${c.name}=${c.value}`).join('; ');
    } catch { /* Not valid JSON */ }
  }
  return trimmed;
}

function parseAmazonStrategy2(html: string): NormalizedOffer[] {
  const $ = cheerio.load(html);
  const offers: NormalizedOffer[] = [];

  $('[data-component-type="s-search-result"]').each((_i, el) => {
    const $el = $(el);
    const asin = $el.attr('data-asin');
    if (!asin) return;
    const title = $el.find('h2 span').first().text().trim();
    if (!title || FILTER_DIGITAIS.test(title)) return;
    const currentPriceText = $el.find('.a-price .a-offscreen').first().text().trim();
    const currentPriceCents = currentPriceText ? Math.round(parsePrice(currentPriceText) * 100) : 0;
    if (currentPriceCents === 0) return;
    let originalPriceCents: number | null = null;
    $el.find('.a-offscreen').each((_, offEl) => {
      const text = $(offEl).text().trim();
      if (text.startsWith('De:')) {
        const orig = parsePrice(text.replace(/^De:\s*/i, ''));
        if (orig > 0) { originalPriceCents = Math.round(orig * 100); return false; }
      }
    });
    if (originalPriceCents !== null && originalPriceCents <= currentPriceCents) originalPriceCents = null;
    const discountPercent = originalPriceCents && originalPriceCents > currentPriceCents
      ? Math.round(((originalPriceCents - currentPriceCents) / originalPriceCents) * 100) : null;
    const rawImageUrl = $el.find('img.s-image').first().attr('src') ?? '';
    const imageUrl = rawImageUrl.replace(/\._[A-Z0-9_,]+_\.(jpg|png|webp)/i, '.$1');
    const relUrl = $el.find('h2 a').first().attr('href') ?? `/dp/${asin}`;
    const productUrl = relUrl.startsWith('http') ? relUrl : `https://www.amazon.com.br${relUrl}`;
    const offer: NormalizedOffer = { externalId: asin, marketplace: 'amazon', title, currentPrice: currentPriceCents, originalPrice: originalPriceCents, discountPercent, imageUrl, productUrl, affiliateLink: null, condition: null, installments: null, category: null, sales: null, couponCode: null };
    if (shouldIncludeOffer({ externalId: asin, currentPrice: offer.currentPrice, originalPrice: offer.originalPrice, title: offer.title })) {
      offers.push(offer);
    }
  });
  return offers;
}

export class AmazonConnector implements MarketplaceConnector {
  readonly marketplace = 'amazon' as const;

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { page, keywords, credentials } = config;
    const keyword = keywords.length > 0 ? keywords[0] : null;
    const url = buildAmazonUrl(keyword, page);
    const response = await fetch(url, { headers: AMAZON_HEADERS });
    if (!response.ok) throw new Error(`Amazon fetch failed: ${response.status}`);
    const html = await response.text();
    let offers = parseAmazonStrategy1(html);
    if (offers.length === 0) offers = parseAmazonStrategy2(html);
    const offersWithLinks: NormalizedOffer[] = [];
    for (const offer of offers) {
      const affiliateLink = await this.generateAffiliateLink(offer.productUrl, credentials);
      offersWithLinks.push({ ...offer, affiliateLink });
      if (offer !== offers[offers.length - 1]) {
        await new Promise((resolve) => setTimeout(resolve, 800));
      }
    }
    return offersWithLinks;
  }

  async generateAffiliateLink(productUrl: string, credentials: DecryptedCredentials): Promise<string> {
    const { tag, cookies } = credentials;
    if (!tag) return productUrl;
    if (!cookies) return generateAmazonAffiliateLinkSync(productUrl, tag);

    const cookieHeader = parseCookieString(cookies);
    try {
      const apiUrl = new URL('https://www.amazon.com.br/associates/sitestripe/getShortUrl');
      apiUrl.searchParams.set('longUrl', productUrl);
      const response = await fetch(apiUrl.toString(), {
        headers: {
          accept: 'application/json, text/javascript, */*; q=0.01',
          'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
          'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
          'sec-ch-ua-mobile': '?0', 'sec-ch-ua-platform': '"macOS"',
          'sec-fetch-dest': 'empty', 'sec-fetch-mode': 'cors', 'sec-fetch-site': 'same-origin',
          'user-agent': AMAZON_HEADERS['User-Agent'],
          'x-requested-with': 'XMLHttpRequest',
          referer: 'https://www.amazon.com.br/s?i=todays-deals',
          Cookie: cookieHeader,
        },
      });
      const data = (await response.json()) as { shortUrl?: string };
      if (data.shortUrl) return data.shortUrl;
    } catch { /* SiteStripe failed */ }
    return generateAmazonAffiliateLinkSync(productUrl, tag);
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    if (!credentials.tag) return { valid: false, error: 'Tag de afiliado é obrigatória' };
    if (!credentials.cookies) return { valid: true };
    const testUrl = 'https://www.amazon.com.br/dp/B0CPKWCJH4';
    try {
      const link = await this.generateAffiliateLink(testUrl, credentials);
      const isValid = link.includes('amazon') || link.includes('amzn') || link.includes('tag=');
      return isValid ? { valid: true } : { valid: false, error: 'Cookies inválidos ou expirados' };
    } catch {
      return { valid: false, error: 'Falha ao validar cookies Amazon' };
    }
  }
}

registerConnector(new AmazonConnector());
