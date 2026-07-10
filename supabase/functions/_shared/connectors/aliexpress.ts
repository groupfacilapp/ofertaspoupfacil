import { createHmac } from 'node:crypto';
import type { MarketplaceConnector, DecryptedCredentials, NormalizedOffer, FetchConfig, ValidationResult } from './types.ts';
import { registerConnector } from './registry.ts';

const ALIEXPRESS_API_URL = 'https://api-sg.aliexpress.com/sync';

export function buildAliExpressSignature(appSecret: string, params: Record<string, string>): string {
  const sortedKeys = Object.keys(params).sort();
  const signString = sortedKeys.map((k) => `${k}${params[k]}`).join('');
  return createHmac('sha256', appSecret).update(signString).digest('hex').toUpperCase();
}

function cleanAliExpressProductUrl(url: string): string {
  try {
    const match = url.match(/\/item\/(\d+)\.html/);
    if (match) return `https://www.aliexpress.com/item/${match[1]}.html`;
  } catch { /* ignore */ }
  return url;
}

// deno-lint-ignore no-explicit-any
export function normalizeAliExpressProduct(raw: any): NormalizedOffer {
  const currentPrice = Math.round(parseFloat(String(raw.sale_price ?? '0')) * 100);
  const originalPrice = raw.original_price
    ? Math.round(parseFloat(String(raw.original_price)) * 100)
    : null;

  const discountStr = String(raw.discount ?? '').replace('%', '').trim();
  const discountPercent = discountStr ? parseInt(discountStr, 10) || null : null;

  const rawProductUrl = String(raw.product_detail_url ?? raw.productUrl ?? '');
  const productUrl = cleanAliExpressProductUrl(rawProductUrl);

  return {
    externalId: String(raw.product_id ?? raw.productId ?? ''),
    marketplace: 'aliexpress',
    title: String(raw.product_title ?? raw.productTitle ?? ''),
    currentPrice,
    originalPrice,
    discountPercent,
    imageUrl: String(raw.product_main_image_url ?? raw.imageUrl ?? ''),
    productUrl,
    affiliateLink: null,
    condition: null,
    installments: null,
    category: raw.first_level_category_name ?? null,
    sales: raw.lastest_volume ?? raw.sales ?? null,
    couponCode: null,
  };
}

export class AliExpressConnector implements MarketplaceConnector {
  readonly marketplace = 'aliexpress' as const;

  private buildRequest(method: string, params: Record<string, string>, appKey: string, appSecret: string): Record<string, string> {
    const timestamp = new Date().toISOString().replace('T', ' ').slice(0, 19);
    const allParams: Record<string, string> = {
      method, app_key: appKey, timestamp,
      format: 'json', v: '2.0', sign_method: 'hmac-sha256',
      ...params,
    };
    allParams.sign = buildAliExpressSignature(appSecret, allParams);
    return allParams;
  }

  private async callApi(params: Record<string, string>): Promise<unknown> {
    const body = new URLSearchParams(params);
    const response = await fetch(ALIEXPRESS_API_URL, {
      method: 'POST',
      headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
      body: body.toString(),
    });
    if (!response.ok) throw new Error(`AliExpress API error: ${response.status}`);
    return response.json();
  }

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { credentials, page, keywords, minSales } = config;
    const appKey = credentials.api_key;
    const appSecret = credentials.app_secret;
    const trackingId = credentials.tracking_id;

    if (!appKey) throw new Error('AliExpress App Key não configurada');
    if (!appSecret) throw new Error('AliExpress App Secret não configurado');
    if (!trackingId) throw new Error('AliExpress TrackingID não configurado');

    const params: Record<string, string> = {
      tracking_id: trackingId,
      page_no: String(page),
      page_size: '50',
      target_currency: 'BRL',
      target_language: 'PT',
      ship_to_country: 'BR',
      sort: 'LAST_VOLUME_DESC',
      keywords: keywords.length > 0 ? keywords[0] : 'smartphone',
    };

    const requestParams = this.buildRequest('aliexpress.affiliate.product.query', params, appKey, appSecret);
    // deno-lint-ignore no-explicit-any
    const data = await this.callApi(requestParams) as any;
    // deno-lint-ignore no-explicit-any
    const products: any[] = data?.aliexpress_affiliate_product_query_response?.resp_result?.result?.products?.product ?? [];

    const MIN_PRICE_CENTS = 500;
    const offers = products
      .map(normalizeAliExpressProduct)
      .filter((o) =>
        o.currentPrice >= MIN_PRICE_CENTS &&
        (o.sales ?? 0) >= (minSales ?? 0) &&
        !/[\u0400-\u04FF\u3000-\u9FFF\uAC00-\uD7AF]/.test(o.title)
      );

    if (offers.length === 0) return offers;

    const affiliateLinks = await this.generateAffiliateLinksBatch(offers.map((o) => o.productUrl), credentials);
    return offers.map((offer, i) => ({ ...offer, affiliateLink: affiliateLinks[i] ?? offer.productUrl }));
  }

  async generateAffiliateLinksBatch(productUrls: string[], credentials: DecryptedCredentials): Promise<(string | null)[]> {
    const appKey = credentials.api_key;
    const appSecret = credentials.app_secret;
    const trackingId = credentials.tracking_id;

    if (!appKey || !appSecret || !trackingId || productUrls.length === 0) return productUrls.map(() => null);

    const cleanUrls = productUrls.map(cleanAliExpressProductUrl);
    const params: Record<string, string> = {
      tracking_id: trackingId,
      promotion_link_type: '0',
      source_values: cleanUrls.join(','),
    };
    const requestParams = this.buildRequest('aliexpress.affiliate.link.generate', params, appKey, appSecret);

    try {
      // deno-lint-ignore no-explicit-any
      const data = await this.callApi(requestParams) as any;
      // deno-lint-ignore no-explicit-any
      const links: any[] = data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link ?? [];
      const linkMap = new Map<string, string>();
      for (const entry of links) {
        if (entry.source_value && entry.promotion_link) linkMap.set(entry.source_value, entry.promotion_link);
      }
      return cleanUrls.map((url) => linkMap.get(url) ?? null);
    } catch {
      return productUrls.map(() => null);
    }
  }

  async generateAffiliateLink(productUrl: string, credentials: DecryptedCredentials): Promise<string> {
    const appKey = credentials.api_key;
    const appSecret = credentials.app_secret;
    const trackingId = credentials.tracking_id;
    if (!appKey || !appSecret || !trackingId) return productUrl;

    const cleanUrl = cleanAliExpressProductUrl(productUrl);
    const params: Record<string, string> = { tracking_id: trackingId, promotion_link_type: '0', source_values: cleanUrl };
    const requestParams = this.buildRequest('aliexpress.affiliate.link.generate', params, appKey, appSecret);

    try {
      // deno-lint-ignore no-explicit-any
      const data = await this.callApi(requestParams) as any;
      const link = data?.aliexpress_affiliate_link_generate_response?.resp_result?.result?.promotion_links?.promotion_link?.[0]?.promotion_link;
      return link ?? cleanUrl;
    } catch {
      return cleanUrl;
    }
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    const { api_key: appKey, app_secret: appSecret, tracking_id: trackingId } = credentials;
    if (!appKey) return { valid: false, error: 'App Key é obrigatória' };
    if (!appSecret) return { valid: false, error: 'App Secret é obrigatório' };
    if (!trackingId) return { valid: false, error: 'TrackingID é obrigatório' };

    try {
      const params: Record<string, string> = { tracking_id: trackingId, keywords: 'phone', page_no: '1', page_size: '1', target_currency: 'BRL', target_language: 'PT' };
      const requestParams = this.buildRequest('aliexpress.affiliate.product.query', params, appKey, appSecret);
      // deno-lint-ignore no-explicit-any
      const data = await this.callApi(requestParams) as any;

      if ('error_response' in data) {
        const errMsg = data.error_response?.msg ?? data.error_response?.sub_msg ?? 'Credenciais inválidas';
        const errCode = data.error_response?.code ?? '';
        return { valid: false, error: `AliExpress: ${errMsg}${errCode ? ` (${errCode})` : ''}` };
      }

      const hasResponse = 'aliexpress_affiliate_product_query_response' in data;
      if (!hasResponse) return { valid: false, error: 'Resposta inesperada da API AliExpress.' };

      const respCode = data.aliexpress_affiliate_product_query_response?.resp_result?.resp_code;
      if (respCode !== undefined && respCode !== 200 && respCode !== '200') {
        const respMsg = data.aliexpress_affiliate_product_query_response?.resp_result?.resp_msg ?? 'Erro desconhecido';
        return { valid: false, error: `AliExpress: ${respMsg} (código ${respCode})` };
      }

      return { valid: true };
    } catch (e) {
      return { valid: false, error: `Falha ao validar credenciais AliExpress: ${String(e)}` };
    }
  }
}

registerConnector(new AliExpressConnector());
