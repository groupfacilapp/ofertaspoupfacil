import { describe, it, expect, beforeAll } from 'vitest';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import path from 'path';

beforeAll(() => {
  process.env.ENCRYPTION_KEY = 'a'.repeat(64);
  process.env.NEXT_PUBLIC_SUPABASE_URL = 'https://example.supabase.co';
  process.env.NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY = 'sb_publishable_test';
  process.env.SUPABASE_SERVICE_ROLE_KEY = 'service_role_test_key';
  process.env.NEXT_PUBLIC_SITE_URL = 'http://localhost:3000';
});

const fixtureDir = path.resolve(
  path.dirname(fileURLToPath(import.meta.url)),
  '../../fixtures'
);

describe('parseMercadoLivreHTML', () => {
  it('returns at least 2 products from fixture HTML', async () => {
    const { parseMercadoLivreHTML } = await import('@/lib/connectors/mercadolivre');
    const html = readFileSync(path.join(fixtureDir, 'ml-ofertas-page.html'), 'utf-8');
    const products = parseMercadoLivreHTML(html);
    expect(products.length).toBeGreaterThanOrEqual(2);
  });

  it('first product has correct title', async () => {
    const { parseMercadoLivreHTML } = await import('@/lib/connectors/mercadolivre');
    const html = readFileSync(path.join(fixtureDir, 'ml-ofertas-page.html'), 'utf-8');
    const products = parseMercadoLivreHTML(html);
    expect(products[0].titulo).toContain('Sony');
  });

  it('product link has query params stripped', async () => {
    const { parseMercadoLivreHTML } = await import('@/lib/connectors/mercadolivre');
    const html = readFileSync(path.join(fixtureDir, 'ml-ofertas-page.html'), 'utf-8');
    const products = parseMercadoLivreHTML(html);
    // URL should NOT contain query params (they are stripped before affiliate link generation)
    expect(products[0].link).not.toContain('?');
    expect(products[0].link).toContain('mercadolivre.com.br');
  });

  it('correctly parses preco_atual as truthy', async () => {
    const { parseMercadoLivreHTML } = await import('@/lib/connectors/mercadolivre');
    const html = readFileSync(path.join(fixtureDir, 'ml-ofertas-page.html'), 'utf-8');
    const products = parseMercadoLivreHTML(html);
    // preco_atual raw string from fixture is "R$\u00a0249,90"
    expect(products[0].preco_atual).toBeTruthy();
  });
});

describe('formatInstallment', () => {
  it('formats "6x R$ 29,90 sem juros"', async () => {
    const { formatInstallment } = await import('@/lib/connectors/mercadolivre');
    expect(formatInstallment('6x R$ 29,90 sem juros')).toBe('Parcelamento em 6x sem juros');
  });

  it('formats "12x R$ 100,00 sem juros"', async () => {
    const { formatInstallment } = await import('@/lib/connectors/mercadolivre');
    expect(formatInstallment('12x R$ 100,00 sem juros')).toBe('Parcelamento em 12x sem juros');
  });

  it('returns empty string for empty input', async () => {
    const { formatInstallment } = await import('@/lib/connectors/mercadolivre');
    expect(formatInstallment('')).toBe('');
  });

  it('passes through strings without "sem juros" pattern', async () => {
    const { formatInstallment } = await import('@/lib/connectors/mercadolivre');
    expect(formatInstallment('3x R$ 50,00 com juros')).toBe('3x R$ 50,00 com juros');
  });
});

describe('buildCreateLinkBody', () => {
  it('returns correct JSON structure', async () => {
    const { buildCreateLinkBody } = await import('@/lib/connectors/mercadolivre');
    const body = buildCreateLinkBody('https://www.mercadolivre.com.br/p/MLB123', 'mytag');
    const parsed = JSON.parse(body);
    expect(parsed.urls).toEqual(['https://www.mercadolivre.com.br/p/MLB123']);
    expect(parsed.tag).toBe('mytag');
  });
});

describe('MercadoLivreConnector', () => {
  it('has marketplace === "mercadolivre"', async () => {
    const { MercadoLivreConnector } = await import('@/lib/connectors/mercadolivre');
    expect(new MercadoLivreConnector().marketplace).toBe('mercadolivre');
  });

  it('validateCredentials fails with missing tag_afiliado', async () => {
    const { MercadoLivreConnector } = await import('@/lib/connectors/mercadolivre');
    const result = await new MercadoLivreConnector().validateCredentials({
      cookie_session: 'some-cookie',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });

  it('validateCredentials fails with missing cookie_session', async () => {
    const { MercadoLivreConnector } = await import('@/lib/connectors/mercadolivre');
    const result = await new MercadoLivreConnector().validateCredentials({
      tag_afiliado: 'mytag',
    });
    expect(result.valid).toBe(false);
    expect(result.error).toBeTruthy();
  });
});
