import { describe, it, expect, beforeAll } from 'vitest';

// Set env before any imports
beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
});

// We test the internal utility functions directly.
// The connector module exports them for testing purposes.
describe('parsePrice', () => {
  it('passes through a number unchanged', async () => {
    const { parsePrice } = await import('@/lib/connectors/amazon');
    expect(parsePrice(249.90)).toBe(249.90);
  });
  it('parses BRL string with comma decimal', async () => {
    const { parsePrice } = await import('@/lib/connectors/amazon');
    expect(parsePrice('R$249,90')).toBeCloseTo(249.9);
  });
  it('parses thousand-separated BRL string', async () => {
    const { parsePrice } = await import('@/lib/connectors/amazon');
    expect(parsePrice('1.299,90')).toBeCloseTo(1299.9);
  });
  it('returns 0 for null', async () => {
    const { parsePrice } = await import('@/lib/connectors/amazon');
    expect(parsePrice(null)).toBe(0);
  });
  it('returns 0 for 0', async () => {
    const { parsePrice } = await import('@/lib/connectors/amazon');
    expect(parsePrice(0)).toBe(0);
  });
});

describe('FILTER_DIGITAIS', () => {
  it('matches Kindle products', async () => {
    const { FILTER_DIGITAIS } = await import('@/lib/connectors/amazon');
    expect(FILTER_DIGITAIS.test('Kindle Paperwhite')).toBe(true);
  });
  it('matches Livro products', async () => {
    const { FILTER_DIGITAIS } = await import('@/lib/connectors/amazon');
    expect(FILTER_DIGITAIS.test('Livro de Receitas')).toBe(true);
  });
  it('does not match physical electronics', async () => {
    const { FILTER_DIGITAIS } = await import('@/lib/connectors/amazon');
    expect(FILTER_DIGITAIS.test('Fone de Ouvido Sony')).toBe(false);
  });
});

describe('FILTER_ISBN', () => {
  it('matches 978-prefixed ISBNs', async () => {
    const { FILTER_ISBN } = await import('@/lib/connectors/amazon');
    expect(FILTER_ISBN.test('9788535932843')).toBe(true);
  });
  it('matches 85-prefixed ISBNs', async () => {
    const { FILTER_ISBN } = await import('@/lib/connectors/amazon');
    expect(FILTER_ISBN.test('8535932843')).toBe(true);
  });
  it('does not match Amazon ASINs', async () => {
    const { FILTER_ISBN } = await import('@/lib/connectors/amazon');
    expect(FILTER_ISBN.test('B0CPKWCJH4')).toBe(false);
  });
});

describe('parseAmazonStrategy1', () => {
  it('extracts at least 1 product from fixture HTML', async () => {
    const { readFileSync } = await import('fs');
    const path = await import('path');
    const { parseAmazonStrategy1 } = await import('@/lib/connectors/amazon');
    const fixturePath = path.resolve(
      process.cwd(),
      'src/__tests__/fixtures/amazon-deals-page.html'
    );
    const html = readFileSync(fixturePath, 'utf-8');
    const offers = parseAmazonStrategy1(html);
    expect(offers.length).toBeGreaterThanOrEqual(1);
    expect(offers[0].externalId).toBe('B0CPKWCJH4');
    expect(offers[0].currentPrice).toBe(24990); // 249.90 * 100
    expect(offers[0].originalPrice).toBe(49990); // 499.90 * 100
  });
});

describe('generateAmazonAffiliateLinkSync (tag-append fallback)', () => {
  it('appends ?tag= when URL has no query string', async () => {
    const { generateAmazonAffiliateLinkSync } = await import('@/lib/connectors/amazon');
    const url = 'https://www.amazon.com.br/dp/B0CPKWCJH4';
    expect(generateAmazonAffiliateLinkSync(url, 'mytag')).toBe(
      'https://www.amazon.com.br/dp/B0CPKWCJH4?tag=mytag'
    );
  });
  it('appends &tag= when URL already has query string', async () => {
    const { generateAmazonAffiliateLinkSync } = await import('@/lib/connectors/amazon');
    const url = 'https://www.amazon.com.br/dp/B0CPKWCJH4?ref=deal';
    expect(generateAmazonAffiliateLinkSync(url, 'mytag')).toBe(
      'https://www.amazon.com.br/dp/B0CPKWCJH4?ref=deal&tag=mytag'
    );
  });
});

describe('offer filtering', () => {
  it('filters out offers with price == 0', async () => {
    const { shouldIncludeOffer } = await import('@/lib/connectors/amazon');
    expect(shouldIncludeOffer({ currentPrice: 0, originalPrice: 100, title: 'Product' })).toBe(false);
  });
  it('filters out offers where currentPrice >= originalPrice * 1.15', async () => {
    const { shouldIncludeOffer } = await import('@/lib/connectors/amazon');
    // Same price — not a real discount
    expect(shouldIncludeOffer({ currentPrice: 100, originalPrice: 100, title: 'Product' })).toBe(false);
  });
  it('keeps valid discounted offers', async () => {
    const { shouldIncludeOffer } = await import('@/lib/connectors/amazon');
    expect(shouldIncludeOffer({ currentPrice: 50, originalPrice: 100, title: 'Product' })).toBe(true);
  });
});
