// src/lib/connectors/shein.ts
// Scrapes br.shein.com for promotional products using __NEXT_DATA__ JSON parsing.
// Affiliate links generated via CJ Affiliate deep link format.
// Credentials: cj_publisher_id + cj_website_id (from CJ Affiliate account approved for Shein).
// Optional: cj_merchant_id to override Shein's default CJ merchant ID.

import * as cheerio from 'cheerio';
import type {
  MarketplaceConnector,
  DecryptedCredentials,
  NormalizedOffer,
  FetchConfig,
  ValidationResult,
} from './types';
import { registerConnector } from './registry';

// Shein's default merchant ID on CJ Affiliate network
// Can be overridden per-user via cj_merchant_id credential field
const SHEIN_DEFAULT_CJ_MERCHANT_ID = '44161';

// --- Scraping headers ---

const SHEIN_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,image/webp,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
  Referer: 'https://br.shein.com/',
};

// --- URL builder ---

const SHEIN_CATEGORY_PAGES = [
  'https://br.shein.com/flash-sale.html',
  'https://br.shein.com/New-Arrivals-Deals.html',
  'https://br.shein.com/Women.html?sort=7',
  'https://br.shein.com/Men.html?sort=7',
  'https://br.shein.com/Home.html?sort=7',
  'https://br.shein.com/Kids.html?sort=7',
  'https://br.shein.com/Beauty.html?sort=7',
];

function buildSheinUrl(keyword: string | null, page: number): string {
  if (keyword) {
    const slug = encodeURIComponent(keyword.trim().replace(/\s+/g, '-'));
    return `https://br.shein.com/pdsearch/${slug}/?page=${page}&sort=7`;
  }
  return SHEIN_CATEGORY_PAGES[(page - 1) % SHEIN_CATEGORY_PAGES.length];
}

// --- __NEXT_DATA__ parser ---
// Shein stores product data as arrays of goods objects with goods_id field.

interface SheinGoodsRaw {
  goods_id?: string | number;
  goods_name?: string;
  goods_img?: string;
  goods_image?: string;
  // Price — Shein uses objects with amount + amountWithSymbol
  retailPrice?: { amount?: string | number };
  salePrice?: { amount?: string | number };
  // Discount — typically an integer like 50 (meaning 50% off)
  unit_discount?: number | string;
  discount?: number | string;
  // URL slug
  goods_url_name?: string;
  productRelUrl?: string;
}

function findSheinGoodsArrays(obj: unknown, depth = 0): SheinGoodsRaw[][] {
  if (depth > 12 || obj === null || typeof obj !== 'object') return [];

  const found: SheinGoodsRaw[][] = [];

  if (Array.isArray(obj)) {
    const looksLikeGoods = obj.some(
      (item) =>
        item !== null &&
        typeof item === 'object' &&
        !Array.isArray(item) &&
        'goods_id' in item
    );
    if (looksLikeGoods && obj.length > 0) {
      found.push(obj as SheinGoodsRaw[]);
    }
    for (const item of obj) {
      found.push(...findSheinGoodsArrays(item, depth + 1));
    }
  } else {
    for (const val of Object.values(obj as Record<string, unknown>)) {
      found.push(...findSheinGoodsArrays(val, depth + 1));
    }
  }

  return found;
}

export function parseSheinNextData(html: string): SheinGoodsRaw[] {
  const $ = cheerio.load(html);
  const scriptText = $('script#__NEXT_DATA__').html();
  if (!scriptText) return [];

  try {
    const data = JSON.parse(scriptText) as unknown;
    const arrays = findSheinGoodsArrays(data);
    if (arrays.length === 0) return [];
    const best = arrays.reduce((a, b) => (a.length >= b.length ? a : b), []);
    // Deduplicate by goods_id
    const seen = new Set<string>();
    return best.filter((g) => {
      const id = String(g.goods_id ?? '');
      if (!id || seen.has(id)) return false;
      seen.add(id);
      return true;
    });
  } catch {
    return [];
  }
}

// --- Price helper ---

function parseSheinPrice(raw: { amount?: string | number } | undefined): number {
  if (!raw?.amount) return 0;
  const n = parseFloat(String(raw.amount).replace(/[^\d.]/g, ''));
  return isNaN(n) ? 0 : n;
}

// --- Affiliate link generator (exported for tests) ---

export function generateSheinAffiliateLink(
  productUrl: string,
  publisherId: string,
  websiteId: string,
  merchantId: string = SHEIN_DEFAULT_CJ_MERCHANT_ID
): string {
  const encoded = encodeURIComponent(productUrl);
  // CJ Affiliate deep link format
  return `https://click.linksynergy.com/deeplink?id=${publisherId}&mid=${merchantId}&u1=${websiteId}&murl=${encoded}`;
}

// --- SheinConnector ---

export class SheinConnector implements MarketplaceConnector {
  readonly marketplace = 'shein' as const;

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { credentials, page, keywords, maxPrice, minDiscount } = config;
    const { cj_publisher_id, cj_website_id } = credentials;

    if (!cj_publisher_id) throw new Error('Shein: cj_publisher_id é obrigatório');
    if (!cj_website_id) throw new Error('Shein: cj_website_id é obrigatório');

    const keyword = keywords.length > 0 ? keywords[0] : null;
    const url = buildSheinUrl(keyword, page);

    const response = await fetch(url, { headers: SHEIN_HEADERS });
    if (!response.ok) throw new Error(`Shein fetch failed: ${response.status}`);
    const html = await response.text();

    const rawGoods = parseSheinNextData(html);
    const offers: NormalizedOffer[] = [];
    const merchantId = credentials.cj_merchant_id ?? SHEIN_DEFAULT_CJ_MERCHANT_ID;

    for (const g of rawGoods) {
      const goodsId = String(g.goods_id ?? '').trim();
      if (!goodsId) continue;

      const title = String(g.goods_name ?? '').trim();
      if (!title) continue;

      const currentPriceDecimal = parseSheinPrice(g.salePrice);
      if (currentPriceDecimal <= 0) continue;

      const originalPriceDecimal = parseSheinPrice(g.retailPrice);

      const currentPrice = Math.round(currentPriceDecimal * 100);
      const originalPrice =
        originalPriceDecimal > currentPriceDecimal
          ? Math.round(originalPriceDecimal * 100)
          : null;

      if (maxPrice != null && currentPrice > maxPrice) continue;

      // Discount percent
      const rawDiscount = g.unit_discount ?? g.discount;
      let discountPercent: number | null = null;
      if (rawDiscount !== undefined && rawDiscount !== null) {
        const d = parseInt(String(rawDiscount), 10);
        if (!isNaN(d) && d > 0) discountPercent = d;
      }
      if (discountPercent === null && originalPrice && originalPrice > currentPrice) {
        discountPercent = Math.round(
          ((originalPrice - currentPrice) / originalPrice) * 100
        );
      }

      if (minDiscount > 0 && (discountPercent ?? 0) < minDiscount) continue;

      const imageUrl = String(g.goods_img ?? g.goods_image ?? '');

      // Product URL from goods_url_name or fallback to product ID path
      const rawSlug = String(g.goods_url_name ?? g.productRelUrl ?? '').trim();
      let productUrl: string;
      if (rawSlug.startsWith('http')) {
        productUrl = rawSlug.split('?')[0];
      } else if (rawSlug) {
        const cleanSlug = rawSlug.replace(/^\/+/, '').replace(/\.html$/, '');
        productUrl = `https://br.shein.com/${cleanSlug}.html`;
      } else {
        productUrl = `https://br.shein.com/product-p-${goodsId}.html`;
      }

      const affiliateLink = generateSheinAffiliateLink(
        productUrl,
        cj_publisher_id,
        cj_website_id,
        merchantId
      );

      offers.push({
        externalId: goodsId,
        marketplace: 'shein',
        title,
        currentPrice,
        originalPrice,
        discountPercent,
        imageUrl,
        productUrl,
        affiliateLink,
        condition: 'Novo',
        installments: null,
        category: null,
        sales: null,
        couponCode: null,
      });
    }

    return offers;
  }

  async generateAffiliateLink(
    productUrl: string,
    credentials: DecryptedCredentials
  ): Promise<string> {
    const { cj_publisher_id, cj_website_id } = credentials;
    if (!cj_publisher_id || !cj_website_id) return productUrl;
    const merchantId = credentials.cj_merchant_id ?? SHEIN_DEFAULT_CJ_MERCHANT_ID;
    return generateSheinAffiliateLink(productUrl, cj_publisher_id, cj_website_id, merchantId);
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    const { cj_publisher_id, cj_website_id } = credentials;

    if (!cj_publisher_id) {
      return { valid: false, error: 'Publisher ID do CJ Affiliate é obrigatório' };
    }
    if (!cj_website_id) {
      return { valid: false, error: 'Website ID do CJ Affiliate é obrigatório' };
    }

    // CJ credentials cannot be verified via API without server-side OAuth.
    // We validate format only and mark as valid — the real test happens on first product fetch.
    // The user must be approved in the Shein program inside CJ Affiliate for links to work.
    return { valid: true };
  }
}

// Auto-register when module is imported
registerConnector(new SheinConnector());
