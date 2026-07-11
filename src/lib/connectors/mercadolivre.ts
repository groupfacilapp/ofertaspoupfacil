// src/lib/connectors/mercadolivre.ts
import * as cheerio from 'cheerio';
import type {
  MarketplaceConnector,
  DecryptedCredentials,
  NormalizedOffer,
  FetchConfig,
  ValidationResult,
} from './types';
import { registerConnector } from './registry';

// --- Installment formatter (exported for unit tests) ---

const INSTALLMENT_REGEX = /(\d{1,2})x R\$ [\d.,]+ sem juros/;

export function formatInstallment(raw: string): string {
  if (!raw) return raw;
  const match = raw.match(INSTALLMENT_REGEX);
  return match ? `Parcelamento em ${match[1]}x sem juros` : raw;
}

// --- BRL price string parser (used for plain text fallback) ---

function parseMLPrice(raw: string): number {
  // "R$\u00a0249,90" or "R$\u00a01.299,99"
  let str = raw.replace(/R\$[\s\u00a0]*/g, '').trim();
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
}

// --- createLink body builder (exported for unit tests) ---

export function buildCreateLinkBody(url: string, tag: string): string {
  return JSON.stringify({ urls: [url], tag });
}

// --- Strip query params from ML product URL ---

function stripQueryParams(url: string): string {
  try {
    const u = new URL(url);
    return `${u.origin}${u.pathname}`;
  } catch {
    // If URL parsing fails, strip crudely
    const qIdx = url.indexOf('?');
    return qIdx !== -1 ? url.slice(0, qIdx) : url;
  }
}

// --- HTML scraper (exported for unit tests) ---
// Parses per product card to avoid array misalignment when some fields are absent

export function parseMercadoLivreHTML(html: string): Array<{
  titulo: string;
  imagem: string | null;
  link: string;
  preco_atual: string;
  preco_antigo: string | null;
  desconto: string | null;
  parcelamento: string;
}> {
  const $ = cheerio.load(html);
  // /ofertas page wraps items in div.items-with-smart-groups.
  // Keyword search pages (lista.mercadolivre.com.br) don't have this container —
  // fall back to the full document so poly-component__title items are still found.
  const smartGroupsContainer = $('div.items-with-smart-groups');
  const container = smartGroupsContainer.length > 0 ? smartGroupsContainer : $('html');

  const results: Array<{
    titulo: string;
    imagem: string | null;
    link: string;
    preco_atual: string;
    preco_antigo: string | null;
    desconto: string | null;
    parcelamento: string;
  }> = [];

  // Iterate over each title link and walk up the DOM to find its product card.
  // This avoids relying on a specific container class name (which varies by page/experiment).
  container.find('a.poly-component__title').each((_i, titleEl) => {
    const $title = $(titleEl);
    const titulo = $title.text().trim();
    const href = $title.attr('href') ?? '';

    if (!titulo || !href) return;

    // Walk up to the main card container
    let $card = $title.parent();
    while (
      $card.length > 0 &&
      !$card.hasClass('poly-card') &&
      !$card.hasClass('ui-search-result') &&
      !$card.hasClass('andes-card') &&
      !$card.is('body')
    ) {
      $card = $card.parent();
    }

    if (!$card.length || $card.is('body')) {
      $card = $title.parent();
    }

    // Skip sponsored/tracking URL products — they can't be affiliate-linked
    const isTrackingUrl = href.includes('click1.mercadolivre.com.br') ||
      href.includes('/mclics/');
    if (isTrackingUrl) return;

    const link = stripQueryParams(href);

    // Find the image element inside the card container
    const imgEl = $card.find('img').first();
    const imgSrc = imgEl.attr('data-src') || imgEl.attr('src') || null;
    const imagemClean = imgSrc && !imgSrc.startsWith('data:') ? imgSrc : null;

    // Find the price container inside the card container
    const $priceEl = $card
      .find('.andes-money-amount.andes-money-amount--cents-superscript')
      .first();
    
    const pFraction = $priceEl.find('.andes-money-amount__fraction').first().text().replace(/\./g, '').replace(/\D/g, '');
    const pCents = $priceEl.find('.andes-money-amount__cents').first().text().replace(/\D/g, '').slice(0, 2).padEnd(2, '0');
    const preco_atual = pFraction ? `${pFraction}.${pCents}` : '';

    const $oldPriceEl = $card
      .find('.andes-money-amount.andes-money-amount--previous')
      .first();
    const oFraction = $oldPriceEl.find('.andes-money-amount__fraction').first().text().replace(/\./g, '').replace(/\D/g, '');
    const oCents = $oldPriceEl.find('.andes-money-amount__cents').first().text().replace(/\D/g, '').slice(0, 2).padEnd(2, '0');
    const preco_antigo = oFraction ? `${oFraction}.${oCents}` : null;

    const desconto =
      $card
        .find('.andes-money-amount__discount')
        .first()
        .text()
        .trim() || null;

    const parcelamento = formatInstallment(
      $card.find('.poly-price__installments, .ui-search-item__group__element.ui-search-installments').first().text().trim()
    );

    if (!preco_atual) return;

    results.push({ titulo, imagem: imagemClean, link, preco_atual, preco_antigo, desconto, parcelamento });
  });

  return results;
}

// --- ML request headers for scraping ---

const ML_SCRAPE_HEADERS = {
  'User-Agent':
    'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

// --- Cookie normalizer ---
// Accepts either a JSON array (Cookie-Editor export) or a raw "name=value; ..." string

export function normalizeCookieSession(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as Array<{ name: string; value: string }>;
      return arr
        .filter((c) => c.name && c.value)
        .map((c) => `${c.name}=${c.value}`)
        .join('; ');
    } catch {
      // Not valid JSON — fall through and use as-is
    }
  }
  return trimmed;
}

// --- ML createLink headers ---

function buildCreateLinkHeaders(cookieSession: string) {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    origin: 'https://www.mercadolivre.com.br',
    referer: 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
    'sec-ch-ua':
      '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    'user-agent':
      'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    Cookie: normalizeCookieSession(cookieSession),
  };
}

// --- MercadoLivreConnector ---

export class MercadoLivreConnector implements MarketplaceConnector {
  readonly marketplace = 'mercadolivre' as const;

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { page, keywords } = config;
    const keyword = keywords && keywords.length > 0 ? keywords[0] : null;

    let url = `https://www.mercadolivre.com.br/ofertas?page=${page}`;
    if (keyword) {
      // Normalize accents (tenis, not tênis) and replace spaces with hyphens — ML search URLs
      // don't accept accented characters reliably in the path.
      const formattedKeyword = keyword
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-');
      // Mercado Livre pagination parameter for search: _Desde_X where X = 1, 51, 101, etc.
      const offset = (page - 1) * 50 + 1;
      url = `https://lista.mercadolivre.com.br/${formattedKeyword}_Desde_${offset}_NoIndex_True`;
    }

    const response = await fetch(url, { headers: ML_SCRAPE_HEADERS });
    if (!response.ok) throw new Error(`ML fetch failed: ${response.status}`);
    const html = await response.text();

    const rawProducts = parseMercadoLivreHTML(html);

    const offers: NormalizedOffer[] = [];

    for (const p of rawProducts) {
      const currentPriceRaw = parseMLPrice(p.preco_atual);
      const originalPriceRaw = p.preco_antigo ? parseMLPrice(p.preco_antigo) : null;

      if (currentPriceRaw === 0) continue;

      const currentPrice = Math.round(currentPriceRaw * 100);
      const originalPrice = originalPriceRaw
        ? Math.round(originalPriceRaw * 100)
        : null;

      // Parse discount percent from "50% OFF"
      const discountMatch = (p.desconto ?? '').match(/(\d+)%/);
      const discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : null;

      // Extract product ID from URL path for externalId
      // Must be 'MLB' followed by digits (e.g. MLB3208891) — not the literal 'MLB' in tracking URLs
      const pathParts = p.link.split('/');
      const mlbIndex = pathParts.findIndex((part) => /^MLB\d+$/.test(part));
      const externalId =
        mlbIndex !== -1
          ? pathParts[mlbIndex]
          : pathParts[pathParts.length - 1]?.split('?')[0] || p.link;

      offers.push({
        externalId,
        marketplace: 'mercadolivre',
        title: p.titulo,
        currentPrice,
        originalPrice,
        discountPercent,
        imageUrl: p.imagem ?? '',
        productUrl: p.link,
        affiliateLink: null, // DO NOT generate here to avoid performance timeouts. 
        // generateAffiliateLink is called on-demand during dispatch or bulk link generation.
        condition: null,
        installments: p.parcelamento || null,
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
    const { tag_afiliado, cookie_session } = credentials;
    if (!tag_afiliado || !cookie_session) {
      throw new Error('tag_afiliado and cookie_session are required for ML affiliate links');
    }

    // Tracking URLs (click1.mercadolivre.com.br) can't be sent to createLink API
    // Return them as-is — they still redirect to the product page
    if (productUrl.includes('click1.mercadolivre.com.br') || productUrl.includes('/mclics/')) {
      return productUrl;
    }

    const response = await fetch(
      'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
      {
        method: 'POST',
        headers: buildCreateLinkHeaders(cookie_session),
        body: buildCreateLinkBody(productUrl, tag_afiliado),
      }
    );

    const data = (await response.json()) as {
      urls?: Array<{ short_url: string }>;
      error?: string;
    };

    const shortUrl = data.urls?.[0]?.short_url;
    if (!shortUrl) {
      throw new Error(`ML createLink returned no short_url: ${JSON.stringify(data)}`);
    }
    return shortUrl;
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    const { tag_afiliado, cookie_session } = credentials;
    if (!tag_afiliado) {
      return { valid: false, error: 'Tag de afiliado é obrigatória' };
    }
    if (!cookie_session) {
      return { valid: false, error: 'Cookie de sessão é obrigatório' };
    }

    // Product scraping works without credentials, so the connection is always valid when
    // tag + cookie fields are present. We test the cookie to surface a warning, but a
    // 401/403 (expired session) does NOT invalidate the connection — scraping still works
    // and the UI already shows a "stale session" amber warning after 7 days.
    const testUrl = 'https://www.mercadolivre.com.br/smart-tv-profissional-4k-55-lg-uhd-55au801/p/MLB58587883';
    try {
      const cookieHeader = normalizeCookieSession(cookie_session);
      const res = await fetch(
        'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
        {
          method: 'POST',
          headers: buildCreateLinkHeaders(cookieHeader),
          body: buildCreateLinkBody(testUrl, tag_afiliado),
        }
      );

      if (res.status === 401 || res.status === 403) {
        // Cookie expired — mark connection valid so "ERRO DE CONEXÃO" doesn't appear.
        // The UI stale-session warning (7 days) already prompts the user to update.
        return { valid: true };
      }

      // Any 2xx means auth is good
      if (res.ok) {
        return { valid: true };
      }

      // Unexpected non-auth error — still valid (scraping unaffected)
      return { valid: true };
    } catch {
      // Network error during validation — don't penalise the connection
      return { valid: true };
    }
  }
}

// Auto-register when module is imported
registerConnector(new MercadoLivreConnector());
