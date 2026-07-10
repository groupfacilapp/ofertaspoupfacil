import { createHash } from 'node:crypto';
import type { MarketplaceConnector, DecryptedCredentials, NormalizedOffer, FetchConfig, ValidationResult } from './types.ts';
import { registerConnector } from './registry.ts';

export function buildShopeeSignature(appId: string, timestamp: number, payloadString: string, secret: string): string {
  return createHash('sha256')
    .update(appId + timestamp + payloadString + secret)
    .digest('hex');
}

interface ShopeeQueryConfig {
  listType: number;
  sortType: number;
  keyword: string;
  limit: number;
  page: number;
  productCatId?: number;
}

export function buildShopeeQuery(config: ShopeeQueryConfig): string {
  const { listType, sortType, keyword, limit, page, productCatId } = config;
  const catPart = productCatId != null ? `, productCatId:${productCatId}` : '';
  return `{ productOfferV2(listType:${listType}${catPart}, sortType:${sortType}, keyword:"${keyword}", limit:${limit}, page:${page}) { nodes { productName imageUrl productLink offerLink price sales commission priceMin } } }`;
}

interface ShopeeProduct {
  productName: string;
  imageUrl: string;
  productLink: string;
  offerLink: string;
  price: number;
  priceMin: number;
  sales: number;
  commission: number;
}

export function normalizeShopeeProduct(raw: ShopeeProduct): NormalizedOffer {
  const hasDiscount = raw.priceMin > 0 && raw.priceMin < raw.price;
  const currentPrice = Math.round((hasDiscount ? raw.priceMin : raw.price) * 100);
  const originalPrice = hasDiscount ? Math.round(raw.price * 100) : null;
  const discountPercent = hasDiscount ? Math.round((1 - raw.priceMin / raw.price) * 100) : null;

  const pathParts = raw.productLink.split('/').filter(Boolean);
  const lastPart = (pathParts[pathParts.length - 1] || raw.productLink).split('?')[0];
  const shopeeIdMatch = lastPart.match(/i\.(\d+\.\d+)/);
  const externalId = shopeeIdMatch ? shopeeIdMatch[1] : lastPart;

  return {
    externalId,
    marketplace: 'shopee',
    title: raw.productName,
    currentPrice,
    originalPrice,
    discountPercent,
    imageUrl: raw.imageUrl,
    productUrl: raw.productLink,
    affiliateLink: raw.offerLink || null,
    condition: null,
    installments: null,
    category: null,
    sales: raw.sales,
    couponCode: null,
  };
}

export class ShopeeConnector implements MarketplaceConnector {
  readonly marketplace = 'shopee' as const;

  private async callGraphQL(appId: string, secret: string, query: string): Promise<unknown> {
    const timestamp = Math.floor(Date.now() / 1000);
    const payload = JSON.stringify({ query });
    const signature = buildShopeeSignature(appId, timestamp, payload, secret);

    const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `SHA256 Credential=${appId}, Timestamp=${timestamp}, Signature=${signature}`,
      },
      body: payload,
    });

    if (!response.ok) {
      throw new Error(`Shopee API error: ${response.status} ${await response.text()}`);
    }

    const json = await response.json() as { data?: unknown; errors?: { message: string }[] };
    if (json.errors?.length) {
      throw new Error(`Shopee GraphQL error: ${json.errors.map((e) => e.message).join('; ')}`);
    }
    return json;
  }

  async fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]> {
    const { credentials, page, keywords, minSales, categories } = config;
    const { app_id, secret } = credentials;

    if (!app_id || !secret) throw new Error('Shopee app_id and secret credentials required');

    const productCatId = categories.length > 0 && /^\d+$/.test(categories[0])
      ? parseInt(categories[0], 10)
      : undefined;

    const queryConfig: ShopeeQueryConfig = {
      listType: 0, sortType: 2,
      keyword: keywords.length > 0 ? keywords[0] : '',
      limit: 40, page, productCatId,
    };

    const query = buildShopeeQuery(queryConfig);
    const data = await this.callGraphQL(app_id, secret, query);

    const typedData = data as { data?: { productOfferV2?: { nodes?: ShopeeProduct[] } } };
    const nodes: ShopeeProduct[] = typedData?.data?.productOfferV2?.nodes ?? [];
    const minSalesThreshold = minSales ?? 100;

    return nodes
      .filter((node) => node.sales >= minSalesThreshold)
      .map(normalizeShopeeProduct)
      .filter((o) => o.currentPrice > 0);
  }

  async generateAffiliateLink(_productUrl: string, _credentials: DecryptedCredentials): Promise<string> {
    throw new Error('Shopee affiliate links are embedded in the fetchOffers response (offerLink field).');
  }

  async validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult> {
    const { app_id, secret } = credentials;
    if (!app_id) return { valid: false, error: 'AppID e obrigatorio' };
    if (!secret) return { valid: false, error: 'Secret e obrigatorio' };

    try {
      const query = buildShopeeQuery({ listType: 0, sortType: 2, keyword: '', limit: 1, page: 1 });
      const data = await this.callGraphQL(app_id, secret, query);
      const typedData = data as { data?: { productOfferV2?: { nodes?: ShopeeProduct[] } } };
      const nodes = typedData?.data?.productOfferV2?.nodes;
      return Array.isArray(nodes)
        ? { valid: true }
        : { valid: false, error: 'Resposta inesperada da API Shopee' };
    } catch (e) {
      return { valid: false, error: `AppID ou Secret invalidos: ${String(e)}` };
    }
  }
}

registerConnector(new ShopeeConnector());
