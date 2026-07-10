import { describe, it, expect, beforeAll } from 'vitest';

// Set ENCRYPTION_KEY before any module imports to satisfy env.ts Zod validation
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
});

describe('credentials module', () => {
  it('saveMarketplaceCredentials round-trips marketplace credentials', async () => {
    const {
      saveMarketplaceCredentials,
      loadMarketplaceCredentials,
    } = await import('@/lib/credentials');
    const original = { api_key: 'abc', secret: 'xyz' };
    const stored = saveMarketplaceCredentials(original);
    const recovered = loadMarketplaceCredentials(stored);
    expect(recovered).toEqual(original);
  });

  it('saveChannelConfig round-trips channel config', async () => {
    const {
      saveChannelConfig,
      loadChannelConfig,
    } = await import('@/lib/credentials');
    const original = { token: 't', webhook: 'https://x.com' };
    const stored = saveChannelConfig(original);
    const recovered = loadChannelConfig(stored);
    expect(recovered).toEqual(original);
  });

  it('loadMarketplaceCredentials throws on tampered ciphertext', async () => {
    const {
      saveMarketplaceCredentials,
      loadMarketplaceCredentials,
    } = await import('@/lib/credentials');
    const stored = saveMarketplaceCredentials({ key: 'value' });
    // Tamper with the last character to corrupt the ciphertext
    const tampered = stored.slice(0, -1) + (stored.slice(-1) === 'A' ? 'B' : 'A');
    expect(() => loadMarketplaceCredentials(tampered)).toThrow();
  });

  it('saveMarketplaceCredentials returns a non-empty opaque string', async () => {
    const { saveMarketplaceCredentials } = await import('@/lib/credentials');
    const result = saveMarketplaceCredentials({ api_key: 'test' });
    expect(typeof result).toBe('string');
    expect(result.length).toBeGreaterThan(0);
    // Must be in iv:tag:ciphertext format
    expect(result.split(':').length).toBe(3);
  });

  it('saveChannelConfig accepts wider value types', async () => {
    const { saveChannelConfig, loadChannelConfig } = await import('@/lib/credentials');
    const original = { token: 'tok', count: 42, enabled: true, tags: ['a', 'b'] };
    const stored = saveChannelConfig(original);
    const recovered = loadChannelConfig(stored);
    expect(recovered).toEqual(original);
  });
});
