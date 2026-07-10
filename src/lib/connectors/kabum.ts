// src/lib/connectors/kabum.ts
// Scrapes kabum.com.br using JSON-LD structured data + cheerio for product URLs.
// Affiliate links generated via Awin tracking URL (no cookies required — just publisher_id).

import * as cheerio from 'cheerio';
import type {
  MarketplaceConnector,
  DecryptedCredentials,
  NormalizedOffer,
  FetchConfig,
  ValidationResult,
} from './types';
import { registerConnector } from './registry';

// --- Popular KaBuM categories (rotated per fetch cycle) ---

const KABUM_CATEGORIES = [
  '/computadores/notebooks',
  '/smartphones-e-telefonia/smartphones',
  '/tvs-e-projetores/smart-tvs',
  '/computadores/placas-de-video',
  '/games/consoles',
  '/audio/headsets-gamer',
  '/perifericos/teclados',
  '/perifericos/mouses',
  '/computadores/ssd-e-hd',
  '/tablets-e-e-readers/tablets',
  '/ar-livre/smartwatches-e-acessorios',
  '/computadores/processadores',
  '/computadores/memorias-ram',
  '/cameras-e-drones/cameras',
  '/computadores/fontes',
];

const KABUM_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

// --- URL builder ---

function buildKabumUrl(keyword: string | null, page: number): string {
  if (keyword) {
    return `https://www.kabum.com.br/busca/${encodeURIComponent(keyword)}?page_number=${page}&page_size=20&sort=more_discount`;
  }
  // Rotate through categories when no keyword
  const category = KABUM_CATEGORIES[(page - 1) % KABUM_CATEGORIES.length];
  return `https://www.kabum.com.br${category}?page_number=1&page_size=20&sort=more_discount`;
}

// --- Affiliate link generator ---

export function generateKabumAffiliateLink(productUrl: string, publisherId: string): string {
  const clean = productUrl.split('?')[0];
  return `https://www.awin1.com/cread.php?awinmid=17729&awinaffid=${publisherId}&ued=${encodeURIComponent(clean)}`;
}

// --- JSON-LD parser (exported for tests) ---

interface KabumJsonLdProduct {
  sku: string;
  name: string;
  price: number;
  image: string;
}

export function parseKabumJsonLd(html: string): KabumJsonLdProduct[] {
  const $ = cheerio.load(html);
  const products: KabumJsonLdProduct[] = [];

  $('script[type="application/ld+json"]').each((_, el) => {
    try {
      const text = $(el).html() || '';
      const data = JSON.parse(text);
      const items: unknown[] = Array.isArray(data) ? data : [data];

      for (const item of items) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        const p = item as any;
        if (p?.['@type'] !== 'Product' || !p?.sku) continue;

        const price = parseFloat(p.offers?.price ?? '0');
        if (!price || !p.name) continue;

        const image = Array.isArray(p.image) ? p.image[0] : (p.image || '');

        products.push({ sku: String(p.sku), name: String(p.name).trim(), price, image });
      }
    } catch {
      // skip invalid JSON-LD blocks
    }
  });

  return products;
}

// --- Product URL extractor (exported for tests) ---
// Builds sku → canonical URL map from anchor tags

export function parseKabumProductLinks(html: string): Map<string, string> {
  const $ = cheerio.load(html);
  const links = new Map<string, string>();

  $('a[href*="/produto/"]').each((_, el) => {
    const href = $(el).attr('href') || '';
    const match = href.match(/\/produto\/(\d+)\//);
    if (match) {
      const sku = match[1];
      if (!links.has(sku)) {
        const url = href.startsWith('http') ? href : `https://www.kabum.com.br${href}`;
        links.set(sku, url.split('?')[0]);
      }
    }
  });

  return links;
}

// --- KabumConnector ---

export class KabumConnector implements MarketplaceConnector {
  readonly marketplace = 'kabum' as const;

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { credentials, page, keywords, maxPrice } = config;
    const { publisher_id } = credentials;

    if (!publisher_id) throw new Error('KaBuM: publisher_id (Awin) é obrigatório');

    const keyword = keywords.length > 0 ? keywords[0] : null;
    const url = buildKabumUrl(keyword, page);

    const response = await fetch(url, { headers: KABUM_HEADERS });
    if (!response.ok) throw new Error(`KaBuM fetch failed: ${response.status}`);
    const html = await response.text();

    const jsonLdProducts = parseKabumJsonLd(html);
    const productLinks = parseKabumProductLinks(html);

    const offers: NormalizedOffer[] = [];

    for (const p of jsonLdProducts) {
      const currentPrice = Math.round(p.price * 100);
      if (currentPrice === 0) continue;
      if (maxPrice != null && currentPrice > maxPrice) continue;

      const productUrl =
        productLinks.get(p.sku) ?? `https://www.kabum.com.br/produto/${p.sku}/x`;

      const affiliateLink = generateKabumAffiliateLink(productUrl, publisher_id);

      offers.push({
        externalId: p.sku,
        marketplace: 'kabum',
        title: p.name,
        currentPrice,
        originalPrice: null,
        discountPercent: null,
        imageUrl: p.image || '',
        productUrl,
        affiliateLink,
        condition: null,
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
    const { publisher_id } = credentials;
    if (!publisher_id) return productUrl;
    return generateKabumAffiliateLink(productUrl, publisher_id);
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    const { publisher_id } = credentials;
    if (!publisher_id) {
      return { valid: false, error: 'Publisher ID Awin é obrigatório' };
    }

    // Validate by fetching one category and checking we get JSON-LD products back
    try {
      const url = 'https://www.kabum.com.br/computadores/notebooks?page_number=1&page_size=10';
      const response = await fetch(url, { headers: KABUM_HEADERS });
      if (!response.ok) throw new Error(`Status ${response.status}`);
      const html = await response.text();
      const products = parseKabumJsonLd(html);
      return products.length > 0
        ? { valid: true }
        : { valid: false, error: 'Nenhum produto encontrado. Tente novamente mais tarde.' };
    } catch (e) {
      return {
        valid: false,
        error: `Erro de validação: ${e instanceof Error ? e.message : String(e)}`,
      };
    }
  }
}

// Auto-register when module is imported
registerConnector(new KabumConnector());
