import { describe, it, expect, beforeAll } from 'vitest';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
  // Platform-level AliExpress credentials (env vars, not per-user)
  process.env.ALIEXPRESS_APP_KEY = 'test_app_key';
  process.env.ALIEXPRESS_APP_SECRET = 'test_app_secret';
});

describe('buildAliExpressSignature', () => {
  it('returns a non-empty hex string', async () => {
    const { buildAliExpressSignature } = await import('@/lib/connectors/aliexpress');
    const sig = buildAliExpressSignature('secret123', { method: 'aliexpress.affiliate.hotproduct.query', app_key: 'key1' });
    expect(sig).toMatch(/^[0-9a-fA-F]+$/);
    expect(sig.length).toBeGreaterThan(0);
  });

  it('produces consistent output for the same inputs', async () => {
    const { buildAliExpressSignature } = await import('@/lib/connectors/aliexpress');
    const sig1 = buildAliExpressSignature('secret', { a: '1', b: '2' });
    const sig2 = buildAliExpressSignature('secret', { a: '1', b: '2' });
    expect(sig1).toBe(sig2);
  });

  it('produces different output when params differ', async () => {
    const { buildAliExpressSignature } = await import('@/lib/connectors/aliexpress');
    const sig1 = buildAliExpressSignature('secret', { a: '1' });
    const sig2 = buildAliExpressSignature('secret', { a: '2' });
    expect(sig1).not.toBe(sig2);
  });
});

describe('AliExpressConnector', () => {
  it('has marketplace === "aliexpress"', async () => {
    const { AliExpressConnector } = await import('@/lib/connectors/aliexpress');
    const connector = new AliExpressConnector();
    expect(connector.marketplace).toBe('aliexpress');
  });

  it('validateCredentials fails with missing tracking_id', async () => {
    const { AliExpressConnector } = await import('@/lib/connectors/aliexpress');
    const connector = new AliExpressConnector();
    const result = await connector.validateCredentials({});
    expect(result.valid).toBe(false);
    expect(result.error).toContain('TrackingID');
  });

  it('validateCredentials fails with missing app_key env var', async () => {
    const originalKey = process.env.ALIEXPRESS_APP_KEY;
    delete process.env.ALIEXPRESS_APP_KEY;
    const { AliExpressConnector } = await import('@/lib/connectors/aliexpress');
    const connector = new AliExpressConnector();
    const result = await connector.validateCredentials({ tracking_id: 'testid' });
    expect(result.valid).toBe(false);
    process.env.ALIEXPRESS_APP_KEY = originalKey;
  });
});

describe('normalizeAliExpressProduct', () => {
  it('converts product to NormalizedOffer with cents conversion', async () => {
    const { normalizeAliExpressProduct } = await import('@/lib/connectors/aliexpress');
    const raw = {
      product_id: '123456',
      product_title: 'Test Product',
      sale_price: '49.99',
      original_price: '99.99',
      discount: '50%',
      product_main_image_url: 'https://img.example.com/test.jpg',
      product_detail_url: 'https://www.aliexpress.com/item/123456.html',
      promotion_link: 'https://s.click.aliexpress.com/e/xyz',
      lastest_volume: 500,
    };
    const offer = normalizeAliExpressProduct(raw);
    expect(offer.marketplace).toBe('aliexpress');
    expect(offer.externalId).toBe('123456');
    expect(offer.currentPrice).toBe(4999); // 49.99 * 100
    expect(offer.originalPrice).toBe(9999); // 99.99 * 100
    expect(offer.affiliateLink).toBe('https://s.click.aliexpress.com/e/xyz');
    expect(offer.sales).toBe(500);
  });
});
