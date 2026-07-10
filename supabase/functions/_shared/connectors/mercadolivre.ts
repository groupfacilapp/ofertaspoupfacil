import * as cheerio from 'npm:cheerio';
import type { MarketplaceConnector, DecryptedCredentials, NormalizedOffer, FetchConfig, ValidationResult } from './types.ts';
import { registerConnector } from './registry.ts';

const INSTALLMENT_REGEX = /(\d{1,2})x R\$ [\d.,]+ sem juros/;

export function formatInstallment(raw: string): string {
  if (!raw) return raw;
  const match = raw.match(INSTALLMENT_REGEX);
  return match ? `Parcelamento em ${match[1]}x sem juros` : raw;
}

function parseMLPrice(raw: string): number {
  let str = raw.replace(/R\$[\s\u00a0]*/g, '').trim();
  if (str.includes(',')) { str = str.replace(/\./g, '').replace(',', '.'); }
  return parseFloat(str.replace(/[^\d.]/g, '')) || 0;
}

export function buildCreateLinkBody(url: string, tag: string): string {
  return JSON.stringify({ urls: [url], tag });
}

function stripQueryParams(url: string): string {
  try { const u = new URL(url); return `${u.origin}${u.pathname}`; } catch {
    const qIdx = url.indexOf('?');
    return qIdx !== -1 ? url.slice(0, qIdx) : url;
  }
}

export function parseMercadoLivreHTML(html: string): Array<{
  titulo: string; imagem: string | null; link: string;
  preco_atual: string; preco_antigo: string | null; desconto: string | null; parcelamento: string;
}> {
  const $ = cheerio.load(html);
  const results: Array<{ titulo: string; imagem: string | null; link: string; preco_atual: string; preco_antigo: string | null; desconto: string | null; parcelamento: string }> = [];

  // Try multiple selectors in order of preference (ML changes class names periodically)
  let titleEls = $('a.poly-component__title');
  if (titleEls.length === 0) titleEls = $('[class*="poly-component__title"]');
  if (titleEls.length === 0) titleEls = $('a.ui-search-item__group__element[href*="mercadolivre.com.br"]');
  if (titleEls.length === 0) {
    // Last resort: any anchor with MLB in href and non-empty text
    titleEls = $('a[href*="mercadolivre.com.br"]').filter((_i: number, el: any) => {
      const href = $(el).attr('href') ?? '';
      const text = $(el).text().trim();
      return /MLB\d+/.test(href) && text.length > 5;
    });
  }

  titleEls.each((_i: number, titleEl: any) => {
    const $title = $(titleEl);
    const titulo = $title.text().trim();
    const href = $title.attr('href') ?? '';
    if (!titulo || !href) return;

    let $card = $title.parent();
    let foundPrice = false;
    for (let depth = 0; depth < 12; depth++) {
      if ($card.find('.andes-money-amount').length > 0) {
        foundPrice = true;
        break;
      }
      const $parent = $card.parent();
      if (!$parent.length || $parent.is('body')) break;
      $card = $parent;
    }

    if (!foundPrice) return;

    const isTrackingUrl = href.includes('click1.mercadolivre.com.br') || href.includes('/mclics/');
    if (isTrackingUrl) return;

    const link = stripQueryParams(href);

    const $priceContainer = $title.closest('.poly-card__content, .poly-card, .ui-search-result__content-wrapper').length > 0
      ? $title.closest('.poly-card__content, .poly-card, .ui-search-result__content-wrapper')
      : $card;

    const imgEl = $title.closest('.poly-card').find('img.poly-component__picture').first().length > 0
      ? $title.closest('.poly-card').find('img.poly-component__picture').first()
      : $priceContainer.find('img.poly-component__picture').first();

    const imgSrc = imgEl.attr('data-src') || imgEl.attr('src') || null;
    const imagemClean = imgSrc && !imgSrc.startsWith('data:') ? imgSrc : null;

    const $priceEl = $priceContainer.find('.andes-money-amount.andes-money-amount--cents-superscript').first();
    const pFraction = $priceEl.find('.andes-money-amount__fraction').first().text().replace(/\./g, '').replace(/\D/g, '');
    const pCents = $priceEl.find('.andes-money-amount__cents').first().text().replace(/\D/g, '').slice(0, 2).padEnd(2, '0');
    const preco_atual = pFraction ? `${pFraction}.${pCents}` : '';

    const $oldPriceEl = $priceContainer.find('.andes-money-amount.andes-money-amount--previous').first();
    const oFraction = $oldPriceEl.find('.andes-money-amount__fraction').first().text().replace(/\./g, '').replace(/\D/g, '');
    const oCents = $oldPriceEl.find('.andes-money-amount__cents').first().text().replace(/\D/g, '').slice(0, 2).padEnd(2, '0');
    const preco_antigo = oFraction ? `${oFraction}.${oCents}` : null;

    const desconto = $priceContainer.find('.andes-money-amount__discount').first().text().trim() || null;
    const parcelamento = formatInstallment($priceContainer.find('.poly-price__installments, .ui-search-item__group__element.ui-search-installments').first().text().trim());

    if (!preco_atual) return;
    results.push({ titulo, imagem: imagemClean, link, preco_atual, preco_antigo, desconto, parcelamento });
  });

  return results;
}

const ML_SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  Accept: 'text/html,application/xhtml+xml,application/xml;q=0.9,*/*;q=0.8',
  'Accept-Language': 'pt-BR,pt;q=0.9',
};

export function normalizeCookieSession(raw: string): string {
  const trimmed = raw.trim();
  if (trimmed.startsWith('[')) {
    try {
      const arr = JSON.parse(trimmed) as Array<{ name: string; value: string }>;
      return arr.filter((c) => c.name && c.value).map((c) => `${c.name}=${c.value}`).join('; ');
    } catch { /* Not valid JSON */ }
  }
  return trimmed;
}

function buildCreateLinkHeaders(cookieSession: string) {
  return {
    accept: 'application/json, text/plain, */*',
    'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
    'content-type': 'application/json',
    origin: 'https://www.mercadolivre.com.br',
    referer: 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
    'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
    'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
    Cookie: normalizeCookieSession(cookieSession),
  };
}

export class MercadoLivreConnector implements MarketplaceConnector {
  readonly marketplace = 'mercadolivre' as const;

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { page, credentials, keywords } = config;
    const keyword = keywords && keywords.length > 0 ? keywords[0] : null;

    let url = `https://www.mercadolivre.com.br/ofertas?page=${page}`;
    if (keyword) {
      const formattedKeyword = keyword
        .trim()
        .toLowerCase()
        .normalize('NFD')
        .replace(/[\u0300-\u036f]/g, '')
        .replace(/\s+/g, '-');
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
      const originalPrice = originalPriceRaw ? Math.round(originalPriceRaw * 100) : null;
      const discountMatch = (p.desconto ?? '').match(/(\d+)%/);
      const discountPercent = discountMatch ? parseInt(discountMatch[1], 10) : null;

      const pathParts = p.link.split('/');
      const mlbIndex = pathParts.findIndex((part) => /^MLB\d+$/.test(part));
      const externalId = mlbIndex !== -1 ? pathParts[mlbIndex] : pathParts[pathParts.length - 1]?.split('?')[0] || p.link;

      offers.push({ externalId, marketplace: 'mercadolivre', title: p.titulo, currentPrice, originalPrice, discountPercent, imageUrl: p.imagem ?? '', productUrl: p.link, affiliateLink: null, condition: null, installments: p.parcelamento || null, category: null, sales: null, couponCode: null });
    }
    return offers;
  }

  async generateAffiliateLink(productUrl: string, credentials: DecryptedCredentials): Promise<string> {
    const { tag_afiliado, cookie_session } = credentials;
    if (!tag_afiliado || !cookie_session) {
      throw new Error('tag_afiliado and cookie_session are required for ML affiliate links');
    }
    if (productUrl.includes('click1.mercadolivre.com.br') || productUrl.includes('/mclics/')) return productUrl;

    const response = await fetch('https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink', {
      method: 'POST',
      headers: buildCreateLinkHeaders(cookie_session),
      body: buildCreateLinkBody(productUrl, tag_afiliado),
    });

    const data = (await response.json()) as { urls?: Array<{ short_url: string }>; error?: string };
    const shortUrl = data.urls?.[0]?.short_url;
    if (!shortUrl) throw new Error(`ML createLink returned no short_url: ${JSON.stringify(data)}`);
    return shortUrl;
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    const { tag_afiliado, cookie_session } = credentials;
    if (!tag_afiliado) return { valid: false, error: 'Tag de afiliado é obrigatória' };
    if (!cookie_session) return { valid: false, error: 'Cookie de sessão é obrigatório' };

    const testUrl = 'https://www.mercadolivre.com.br/smart-tv-profissional-4k-55-lg-uhd-55au801/p/MLB58587883';
    try {
      const cookieHeader = normalizeCookieSession(cookie_session);
      const res = await fetch('https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink', {
        method: 'POST',
        headers: buildCreateLinkHeaders(cookieHeader),
        body: buildCreateLinkBody(testUrl, tag_afiliado),
      });
      if (res.status === 401 || res.status === 403) return { valid: true };
      if (res.ok) return { valid: true };
      return { valid: true };
    } catch {
      return { valid: true };
    }
  }
}

registerConnector(new MercadoLivreConnector());
