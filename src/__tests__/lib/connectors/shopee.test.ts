import { describe, it, expect, beforeAll } from 'vitest';
import { createHash } from 'crypto';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
});

describe('buildShopeeSignature', () => {
  it('returns a non-empty hex string', async () => {
    const { buildShopeeSignature } = await import('@/lib/connectors/shopee');
    const sig = buildShopeeSignature('appId123', 1700000000, '{"query":"test"}', 'secretXYZ');
    expect(sig).toMatch(/^[0-9a-f]+$/i);
    expect(sig.length).toBeGreaterThan(0);
  });

  it('produces different output when timestamp changes', async () => {
    const { buildShopeeSignature } = await import('@/lib/connectors/shopee');
    const sig1 = buildShopeeSignature('app', 1700000000, 'payload', 'secret');
    const sig2 = buildShopeeSignature('app', 1700000001, 'payload', 'secret');
    expect(sig1).not.toBe(sig2);
  });

  it('uses plain SHA256 (NOT HMAC) -- matches manual computation', async () => {
    const { buildShopeeSignature } = await import('@/lib/connectors/shopee');
    const appId = 'testApp';
    const timestamp = 1700000000;
    const payload = '{"query":"{ productOfferV2 }"}';
    const secret = 'testSecret';

    // Manual computation: SHA256(appId + timestamp + payload + secret)
    const expected = createHash('sha256')
      .update(appId + timestamp + payload + secret)
      .digest('hex');

    const result = buildShopeeSignature(appId, timestamp, payload, secret);
    expect(result).toBe(expected);
  });
});

describe('buildShopeeQuery', () => {
  it('builds query without productCatId when not provided', async () => {
    const { buildShopeeQuery } = await import('@/lib/connectors/shopee');
    const query = buildShopeeQuery({ listType: 0, sortType: 2, keyword: '', limit: 40, page: 1 });
    expect(query).not.toContain('productCatId');
    expect(query).toContain('productOfferV2');
    expect(query).toContain('listType:0');
    expect(query).toContain('limit:40');
  });

  it('includes productCatId when provided', async () => {
    const { buildShopeeQuery } = await import('@/lib/connectors/shopee');
    const query = buildShopeeQuery({
      listType: 0,
      sortType: 2,
      keyword: '',
      limit: 40,
      page: 1,
      productCatId: 12345,
    });
    expect(query).toContain('productCatId:12345');
  });
});

describe('normalizeShopeeProduct', () => {
  it('maps offerLink directly to affiliateLink (FETCH-07)', async () => {
    const { normalizeShopeeProduct } = await import('@/lib/connectors/shopee');
    const raw = {
      productName: 'Test Product',
      imageUrl: 'https://cf.shopee.com.br/file/test.jpg',
      productLink: 'https://shopee.com.br/product/123',
      offerLink: 'https://s.shopee.com.br/affiliate-link-xyz',
      price: 49.99,
      priceMin: 39.99,
      sales: 500,
      commission: 5.5,
    };
    const offer = normalizeShopeeProduct(raw);
    expect(offer.marketplace).toBe('shopee');
    expect(offer.affiliateLink).toBe('https://s.shopee.com.br/affiliate-link-xyz');
    expect(offer.currentPrice).toBe(3999); // priceMin 39.99 * 100 (lower than price 49.99)
    expect(offer.sales).toBe(500);
  });

  it('uses priceMin when lower than price', async () => {
    const { normalizeShopeeProduct } = await import('@/lib/connectors/shopee');
    const raw = {
      productName: 'Range Product',
      imageUrl: 'https://img.test.com/pic.jpg',
      productLink: 'https://shopee.com.br/product/456',
      offerLink: 'https://s.shopee.com.br/link',
      price: 99.99,
      priceMin: 49.99,
      sales: 200,
      commission: 3.0,
    };
    const offer = normalizeShopeeProduct(raw);
    // priceMin is the actual lowest price in a variant range
    expect(offer.currentPrice).toBe(4999); // priceMin * 100
  });
});

describe('ShopeeConnector', () => {
  it('has marketplace === "shopee"', async () => {
    const { ShopeeConnector } = await import('@/lib/connectors/shopee');
    expect(new ShopeeConnector().marketplace).toBe('shopee');
  });

  it('validateCredentials fails with missing app_id', async () => {
    const { ShopeeConnector } = await import('@/lib/connectors/shopee');
    const result = await new ShopeeConnector().validateCredentials({ secret: 'mysecret' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('validateCredentials fails with missing secret', async () => {
    const { ShopeeConnector } = await import('@/lib/connectors/shopee');
    const result = await new ShopeeConnector().validateCredentials({ app_id: 'myappid' });
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
