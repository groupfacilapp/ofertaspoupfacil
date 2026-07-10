# Phase 2: Marketplace Connectors - Research

**Researched:** 2026-03-16
**Domain:** Web scraping, REST APIs, GraphQL, credential management UI, Trigger.dev v3 tasks
**Confidence:** HIGH (based on direct analysis of existing n8n workflow JSON files + verified project codebase)

---

<phase_requirements>
## Phase Requirements

| ID | Description | Research Support |
|----|-------------|-----------------|
| MKT-01 | User can connect Amazon BR (affiliate tag + cookies for SiteStripe) | Credential form with `tag` + `cookies` fields; saveMarketplaceCredentials() encrypts before storage |
| MKT-02 | User can connect Mercado Livre (tag + cookies for createLink API) | Credential form with `tag_afiliado` + `cookie_session` fields; same encryption pattern |
| MKT-03 | User can connect Shopee (AppID + Secret for GraphQL API) | Credential form with `app_id` + `secret` fields; SHA256 HMAC auth pattern documented |
| MKT-04 | User can connect AliExpress (TrackingID for official API) | Credential form with `tracking_id` field + OAuth `api_key` credential |
| MKT-05 | Platform validates credentials on save and shows status (valid/invalid) | Server Action calls validateCredentials(); updates marketplace_connections.is_valid |
| FETCH-01 | System fetches Amazon BR deals (dual-strategy: JSON widget + HTML regex fallback) | Full parsing logic extracted from n8n workflow; both strategies documented |
| FETCH-02 | System fetches Mercado Livre deals (CSS scraping) | Exact CSS selectors extracted from n8n workflow; cheerio implementation documented |
| FETCH-03 | System fetches Shopee deals (GraphQL API with SHA256 auth) | Full auth signature pattern + GraphQL query extracted from n8n workflow |
| FETCH-04 | System fetches AliExpress deals (REST API with TrackingID) | Official AliExpress API parameters documented from n8n node configuration |
| FETCH-05 | System generates Amazon affiliate link: SiteStripe API (with cookies) or ?tag=TAG (fallback) | Exact header set for SiteStripe API extracted from n8n; fallback is URL append |
| FETCH-06 | System generates Mercado Livre affiliate link via createLink API with cookies + tag | POST endpoint + request body + cookie header pattern extracted from n8n |
| FETCH-07 | System uses Shopee affiliate link already embedded in offerLink API field | No extra call needed — offerLink is returned directly in GraphQL response |
| FETCH-08 | System generates AliExpress affiliate link via generateLink API with TrackingID | Official API generateLink call pattern documented |
| FETCH-09 | System filters digital products, books, ebooks, subscriptions (Amazon) | Exact regex pattern from n8n: `/ebook\|kindle\|livro\|capa comum\|capa dura\|audiolivro\|audible\|assinatura\|prime video/i` + ISBN regex |
| FETCH-10 | System extracts and displays Pix/boleto price when available (Amazon) | Logic extracted from n8n: `combinedSavings.fixedTargetAmount.amount` from promotionsUnified |
| FETCH-11 | System extracts and formats installments (e.g. "12x de R$ 29,90 sem juros") | Amazon: parcelamento field from buying options; ML: `span.poly-price__installments` selector |
</phase_requirements>

---

## Summary

Phase 2 builds the core data-fetching layer of DisparaZap. It has two distinct sub-domains: (1) the credential management UI — React forms for saving/encrypting/validating per-marketplace credentials — and (2) the marketplace connector implementations running in Trigger.dev v3 tasks. The connectors translate existing n8n workflows into TypeScript modules with a common interface.

The good news: the n8n workflows have been directly analyzed and provide the exact implementation details for every marketplace. The scraping patterns, API call signatures, header sets, filter regexes, and affiliate link generation flows are all known. The translation from n8n JSON to TypeScript is the primary work of this phase.

The strategic decision from STATE.md (Trigger.dev v3 instead of pg-boss) is already locked. The project already has `@trigger.dev/sdk@4.4.3` installed and `src/lib/crypto.ts` + `src/lib/credentials.ts` built. The encryption layer is ready to use. This phase builds on it.

**Primary recommendation:** Build connectors as pure TypeScript classes implementing a common `MarketplaceConnector` interface in `src/lib/connectors/`, independently testable with vitest. Trigger.dev tasks live in `src/trigger/` and call connector methods. The UI uses Next.js Server Actions with zod validation to save/validate credentials.

---

## Standard Stack

### Core (already installed)
| Library | Version | Purpose | Why Standard |
|---------|---------|---------|--------------|
| `@trigger.dev/sdk` | 4.4.3 | Background task runner for fetching deals | Already installed; managed infra, no Redis needed |
| `@supabase/supabase-js` | 2.99.2 | DB reads/writes for credentials and offers | Already installed; used throughout project |
| `zod` | 4.3.6 | Input validation for credential forms and API params | Already installed |
| Node.js `crypto` | built-in | SHA256 for Shopee auth signature | Built-in; already used in src/lib/crypto.ts |
| Node.js `fetch` | built-in (Node 18+) | HTTP requests for scraping and API calls | No extra dep needed |

### To Install
| Library | Version | Purpose | When to Use |
|---------|---------|---------|-------------|
| `cheerio` | 1.0.0 | HTML parsing with CSS selectors for Amazon + ML scraping | Required for FETCH-01, FETCH-02 |

**Note:** `p-retry` and `p-queue` from STACK.md are recommended for robustness but are optional for the initial implementation. Add them if scraping flakiness becomes a problem during development.

**Version verification (2026-03-16):**
- `cheerio`: 1.0.0 (latest stable, major rewrite from 0.x)
- `p-retry`: 7.1.1
- `p-queue`: 9.1.0

**Installation:**
```bash
npm install cheerio
```

### Alternatives Considered
| Instead of | Could Use | Tradeoff |
|------------|-----------|----------|
| Native fetch | axios | axios adds bundle size; native fetch is sufficient for all marketplace calls |
| cheerio | jsdom | jsdom is 10x heavier; cheerio CSS selectors are sufficient for Amazon/ML |
| Trigger.dev tasks | pg-boss jobs | pg-boss needs a separate worker process; Trigger.dev runs on managed infra |

---

## Architecture Patterns

### Recommended Project Structure

```
src/
├── lib/
│   ├── connectors/
│   │   ├── types.ts              # MarketplaceConnector interface + NormalizedOffer type
│   │   ├── registry.ts           # getConnector(marketplace) factory
│   │   ├── amazon.ts             # AmazonConnector
│   │   ├── mercadolivre.ts       # MercadoLivreConnector
│   │   ├── shopee.ts             # ShopeeConnector
│   │   └── aliexpress.ts         # AliExpressConnector
│   ├── crypto.ts                 # ALREADY EXISTS — encrypt()/decrypt()
│   └── credentials.ts            # ALREADY EXISTS — saveMarketplaceCredentials()/loadMarketplaceCredentials()
├── trigger/
│   ├── fetch-amazon.ts           # Trigger.dev task: fetches Amazon deals for a user
│   ├── fetch-mercadolivre.ts     # Trigger.dev task: fetches ML deals for a user
│   ├── fetch-shopee.ts           # Trigger.dev task: fetches Shopee deals for a user
│   └── fetch-aliexpress.ts       # Trigger.dev task: fetches AliExpress deals for a user
└── app/
    ├── (dashboard)/
    │   └── marketplaces/
    │       ├── page.tsx           # Marketplace connections listing
    │       └── [marketplace]/
    │           └── page.tsx       # Credential form for specific marketplace
    └── api/
        └── marketplaces/
            └── validate/
                └── route.ts       # POST: trigger credential validation
```

### Pattern 1: MarketplaceConnector Interface

Every marketplace implements this interface. The planner should use it verbatim.

```typescript
// src/lib/connectors/types.ts

export interface DecryptedCredentials {
  // Amazon
  tag?: string;
  cookies?: string;
  // Mercado Livre
  tag_afiliado?: string;
  cookie_session?: string;
  // Shopee
  app_id?: string;
  secret?: string;
  // AliExpress
  tracking_id?: string;
  api_key?: string;
}

export interface NormalizedOffer {
  externalId: string;       // ASIN, ML item ID, Shopee productId, AliExpress productId
  marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress';
  title: string;
  currentPrice: number;     // BRL cents (integer)
  originalPrice: number | null;
  discountPercent: number | null;
  imageUrl: string;
  productUrl: string;       // original URL before affiliate link
  affiliateLink: string | null;  // generated during fetch phase
  condition: string | null; // "À vista (Pix/Boleto)" | "Oferta Relâmpago" | "Preço Amazon" | null
  installments: string | null;  // "Parcelamento em 12x sem juros" | null
  category: string | null;
  sales: number | null;     // for Shopee/AliExpress filtering
}

export interface FetchConfig {
  keywords: string[];
  categories: string[];
  minDiscount: number;      // percent, e.g. 10 = 10%
  maxPrice: number | null;  // BRL cents or null for no limit
  minSales: number;         // for Shopee/AliExpress
  page: number;
  credentials: DecryptedCredentials;
}

export interface ValidationResult {
  valid: boolean;
  error?: string;
}

export interface MarketplaceConnector {
  readonly marketplace: 'amazon' | 'mercadolivre' | 'shopee' | 'aliexpress';
  fetchOffers(config: FetchConfig): Promise<NormalizedOffer[]>;
  generateAffiliateLink(productUrl: string, credentials: DecryptedCredentials): Promise<string>;
  validateCredentials(credentials: DecryptedCredentials): Promise<ValidationResult>;
}
```

### Pattern 2: Trigger.dev Task Structure

Each marketplace gets its own Trigger.dev task. Tasks are thin — they load credentials, call the connector, and upsert offers to Supabase.

```typescript
// src/trigger/fetch-amazon.ts
import { task } from '@trigger.dev/sdk/v3';
import { getConnector } from '@/lib/connectors/registry';
import { loadMarketplaceCredentials } from '@/lib/credentials';
import { supabaseAdmin } from '@/lib/supabase/admin';

export const fetchAmazonTask = task({
  id: 'fetch-amazon',
  retry: { maxAttempts: 3, factor: 2, minTimeoutInMs: 5000, maxTimeoutInMs: 30000 },
  run: async (payload: { userId: string; connectionId: string; config: FetchConfig }) => {
    const { userId, connectionId, config } = payload;

    // 1. Load + decrypt credentials
    const { data: conn } = await supabaseAdmin
      .from('marketplace_connections')
      .select('encrypted_credentials')
      .eq('id', connectionId)
      .single();

    const credentials = loadMarketplaceCredentials(conn!.encrypted_credentials);

    // 2. Fetch offers
    const connector = getConnector('amazon');
    const offers = await connector.fetchOffers({ ...config, credentials });

    // 3. Upsert to DB
    if (offers.length > 0) {
      await supabaseAdmin.from('offers').upsert(
        offers.map(o => ({
          user_id: userId,
          marketplace: 'amazon',
          external_id: o.externalId,
          title: o.title,
          current_price: o.currentPrice,
          original_price: o.originalPrice,
          discount_percent: o.discountPercent,
          image_url: o.imageUrl,
          product_url: o.productUrl,
          affiliate_link: o.affiliateLink,
          condition: o.condition,
          installments: o.installments,
          fetched_at: new Date().toISOString(),
          expires_at: new Date(Date.now() + 48 * 60 * 60 * 1000).toISOString(),
        })),
        { onConflict: 'user_id,marketplace,external_id' }
      );
    }

    return { fetched: offers.length };
  },
});
```

### Pattern 3: Server Action for Credential Save + Validate

```typescript
// app/(dashboard)/marketplaces/actions.ts
'use server';
import { createClient } from '@/lib/supabase/server';
import { saveMarketplaceCredentials } from '@/lib/credentials';
import { getConnector } from '@/lib/connectors/registry';
import { decrypt } from '@/lib/crypto';

export async function saveAndValidateCredentials(
  marketplace: string,
  rawCredentials: Record<string, string>
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) throw new Error('Unauthorized');

  // Encrypt credentials
  const encrypted = saveMarketplaceCredentials(rawCredentials);

  // Validate before saving
  const connector = getConnector(marketplace);
  const validation = await connector.validateCredentials(rawCredentials as DecryptedCredentials);

  // Upsert to DB (even if invalid — user can fix later)
  const { error } = await supabase.from('marketplace_connections').upsert({
    user_id: user.id,
    marketplace,
    encrypted_credentials: encrypted,
    is_valid: validation.valid,
    last_validated_at: new Date().toISOString(),
    validation_error: validation.error ?? null,
  }, { onConflict: 'user_id,marketplace' });

  if (error) throw error;
  return { valid: validation.valid, error: validation.error };
}
```

### Anti-Patterns to Avoid

- **Running scraping in API routes / Server Actions:** Scraping Amazon/ML can take 5-15 seconds. This is only acceptable during credential validation (one-time check). Bulk fetching must go through Trigger.dev tasks.
- **Caching decrypted credentials in module scope:** Decrypt on demand per request. `loadMarketplaceCredentials()` is fast (<1ms) and already built.
- **String price math:** Amazon returns prices as floats (e.g., 249.90). Always convert to integer cents (`Math.round(price * 100)`) before storing in the DB.
- **Skipping the `null` → `0` guard for prices:** The Amazon parser uses `parsePrice()` with a guard. Reproduce this guard to avoid NaN in the offers table.

---

## Don't Hand-Roll

| Problem | Don't Build | Use Instead | Why |
|---------|-------------|-------------|-----|
| HTML CSS selector parsing | Custom regex HTML parser | `cheerio` | Regex breaks on nested HTML; cheerio handles it correctly |
| SHA256 HMAC for Shopee auth | Manual crypto assembly | `crypto.createHmac('sha256', secret)` or `createHash('sha256')` | The Shopee workflow concatenates AppID+Timestamp+Payload+Secret and SHA256-hashes the string (not HMAC) |
| Price string parsing | Ad-hoc `replace()` chains | Dedicated `parsePrice()` function from the Amazon parser (documented below) | Amazon returns prices in multiple formats; the n8n workflow already has a battle-tested parser |
| Installment string formatting | Manual regex | Reuse ML workflow's installment regex: `/(\\d{1,2})x R\\$ [\\d.,]+ sem juros/` | Already tested against real ML data |
| Retry logic for scraping | Manual try/catch loops | Trigger.dev's built-in `retry` config | Trigger.dev handles retries with exponential backoff automatically |

---

## Common Pitfalls

### Pitfall 1: Amazon Widget JSON — Slot Name Changes

**What goes wrong:** The Amazon deals page embeds product data in `assets.mountWidget('slot-14', ...)`. The slot name `slot-14` could change on Amazon's side.
**Why it happens:** Amazon A/B tests page layouts. The slot number has been stable but is not guaranteed.
**How to avoid:** Search for `mountWidget('slot-` (any number) with a regex instead of hardcoding `slot-14`. Fallback to HTML regex parsing is mandatory.
**Warning signs:** `products.length === 0` from Strategy 1 + successful HTML request = slot name changed.

### Pitfall 2: Amazon SiteStripe Cookie Expiry

**What goes wrong:** SiteStripe API returns a non-JSON error or 401 when the affiliate's cookies expire.
**Why it happens:** Amazon session cookies expire in 1-3 months. Users must re-enter cookies.
**How to avoid:** Detect SiteStripe failures by checking if the response body contains `shortUrl`. If not, fall back to `productUrl + '?tag=' + tag` immediately. Log the failure to trigger a credential health alert (Phase 5).
**Warning signs:** `generateAffiliateLink()` for Amazon returns the raw product URL without a short.

### Pitfall 3: Mercado Livre Cookie Scope

**What goes wrong:** The ML `createLink` API returns 401 or a session error.
**Why it happens:** The ML cookie must come from a logged-in affiliate session. The cookie must include `orgnickp` (the affiliate tag) and `nsa_rotok` (session token). A generic ML session cookie without the affiliate role does not work.
**How to avoid:** Validation should call `createLink` with a known test URL (e.g., any ML product URL) and check that `urls[0].short_url` is present in the response.
**Warning signs:** Response body has `error` key or `short_url` is missing.

### Pitfall 4: Shopee SHA256 Signature — String Concatenation Order

**What goes wrong:** Authentication fails with a 403 even with correct AppID and Secret.
**Why it happens:** The SHA256 is computed on the RAW string `AppID + Timestamp + Payload + Secret` — NOT using HMAC. It is a simple SHA256 hash of the concatenated string. The Timestamp must be a Unix timestamp in seconds (not milliseconds). The Payload must be the exact JSON string being sent as the request body.
**How to avoid:** Use `crypto.createHash('sha256').update(appId + timestamp + payloadStr + secret).digest('hex')`. Timestamp must be `Math.floor(Date.now() / 1000).toString()`.
**Warning signs:** 403 response from Shopee GraphQL endpoint.

### Pitfall 5: AliExpress OAuth vs TrackingID Confusion

**What goes wrong:** Developer confuses the API OAuth key with the affiliate TrackingID.
**Why it happens:** AliExpress has two separate identifiers: an OAuth API key (for authentication) and a TrackingID (for affiliate attribution). The n8n node uses the TrackingID as the primary credential but the underlying API call requires OAuth auth.
**How to avoid:** For Phase 2, use the AliExpress Affiliate API which accepts `tracking_id` directly. The `getHotProducts` and `generateLink` endpoints work with the TrackingID + app credentials. Validate by calling `getHotProducts` with `page_size=1` and checking for a result.
**Warning signs:** Products returned but affiliate links contain the wrong tracking ID.

### Pitfall 6: ML Offer Image URLs Contain Session Tokens

**What goes wrong:** ML product images scraped today may return 403 tomorrow when dispatched.
**Why it happens:** ML CDN URLs sometimes include session-specific parameters that expire.
**How to avoid:** Store the image URL as-is and test freshness when dispatching. Consider fetching the image at dispatch time rather than relying on cached URL.
**Warning signs:** WhatsApp/Telegram receives 403 on image URL.

### Pitfall 7: Price in BRL cents vs floats

**What goes wrong:** `current_price INT` column receives a float like `249.9` which rounds incorrectly.
**Why it happens:** Amazon Strategy 1 returns prices as floats from the JSON widget (e.g., `249.90`). Strategy 2 returns strings like `"R$249,90"`.
**How to avoid:** Always `Math.round(parsedPrice * 100)` to convert to integer cents before saving. Use the `parsePrice()` function from the Amazon n8n workflow as a utility.

---

## Code Examples

Verified patterns from the n8n workflow JSON files (primary source):

### Amazon: Full Dual-Strategy Fetch Logic

This is the exact parsing logic from the n8n workflow, adapted to TypeScript/cheerio:

```typescript
// Source: Ofertas Amazon.json — "Formatar Ofertas com Keyword" node (lines 40-140)

const FILTER_DIGITAIS = /ebook|kindle|livro|capa comum|capa dura|audiolivro|audible|assinatura|prime video/i;
const FILTER_ISBN = /^(85|65|978)\d{7}[\dX]$/i;
const FILTER_SPONSORED = /^Anúncio patrocinado\s?[–-]\s?/i;

function parsePrice(priceVal: unknown): number {
  if (priceVal === null || priceVal === undefined) return 0;
  if (typeof priceVal === 'number') return priceVal;
  let str = String(priceVal).trim();
  if (str.includes(',')) {
    str = str.replace(/\./g, '').replace(',', '.');
  }
  str = str.replace(/[^\d.]/g, '');
  return parseFloat(str) || 0;
}

// Strategy 1: JSON Widget
const START_MARKER = "assets.mountWidget('slot-14',";
// OR use: const match = html.match(/assets\.mountWidget\('slot-\d+',/);
// Strategy 2: HTML regex on data-component-type="s-search-result" blocks
```

### Amazon: SiteStripe Affiliate Link Generation

```typescript
// Source: Ofertas Amazon.json — "Encurtar Link" node

async function generateAmazonAffiliateLink(
  productUrl: string,
  tag: string,
  cookies: string
): Promise<string> {
  if (!cookies) {
    // Fallback: append tag directly
    const sep = productUrl.includes('?') ? '&' : '?';
    return `${productUrl}${sep}tag=${tag}`;
  }

  const url = new URL('https://www.amazon.com.br/associates/sitestripe/getShortUrl');
  url.searchParams.set('longUrl', productUrl);

  const response = await fetch(url.toString(), {
    headers: {
      'accept': 'application/json, text/javascript, */*; q=0.01',
      'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
      'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
      'sec-ch-ua-mobile': '?0',
      'sec-ch-ua-platform': '"macOS"',
      'sec-fetch-dest': 'empty',
      'sec-fetch-mode': 'cors',
      'sec-fetch-site': 'same-origin',
      'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
      'x-requested-with': 'XMLHttpRequest',
      'referer': 'https://www.amazon.com.br/s?i=todays-deals',
      'Cookie': cookies,
    }
  });

  const data = await response.json() as { shortUrl?: string };
  if (!data.shortUrl) {
    // SiteStripe failed — fall back to tag append
    const sep = productUrl.includes('?') ? '&' : '?';
    return `${productUrl}${sep}tag=${tag}`;
  }
  return data.shortUrl;
}
```

### Amazon: Fetch Page URL

```typescript
// Source: Ofertas Amazon.json — "Ofertas com Keyword" node parameters

function buildAmazonUrl(keyword: string | null, page: number): string {
  if (keyword) {
    return `https://www.amazon.com.br/s?k=${encodeURIComponent(keyword)}&page=${page}`;
  }
  return `https://www.amazon.com.br/s?i=todays-deals&s=exact-aware-popularity-rank&fs=true&page=${page}`;
}

const AMAZON_SCRAPE_HEADERS = {
  'User-Agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
  'Referer': 'https://www.amazon.com.br/s?i=todays-deals&s=popularity-rank&fs=true',
  'Content-Type': 'text/html;charset=UTF-8',
};
```

### Amazon: Pix/Boleto Price Extraction (FETCH-10)

```typescript
// Source: Ofertas Amazon.json — Strategy 1 JSON parsing, ~line 60-75
// The promotionsUnified field contains Pix/Boleto price

const activePromotions = productEntity?.promotionsUnified?.entity?.displayablePromotions || [];
const pixOffer = activePromotions.find(
  (p: any) => p.combinedSavings?.fixedTargetAmount?.amount
);

if (pixOffer) {
  precoFinal = pixOffer.combinedSavings.fixedTargetAmount.amount;
  tipoPagamento = 'À vista (Pix/Boleto)';
} else if (item.dealDetails?.entity?.type === 'LIGHTNING_DEAL') {
  tipoPagamento = 'Oferta Relâmpago';
}
```

### Mercado Livre: CSS Selectors for Scraping (FETCH-02, FETCH-11)

```typescript
// Source: Ofertas do Dia ML.json — "Extrair Produtos" node

// Fetch URL: https://www.mercadolivre.com.br/ofertas?page={N}
// No special headers needed (ML doesn't aggressively block scrapers for offers page)

import * as cheerio from 'cheerio';

function parseMercadoLivreHTML(html: string) {
  const $ = cheerio.load(html);
  const container = $('div.items-with-smart-groups');

  const titles: string[] = [];
  const images: string[] = [];
  const links: string[] = [];
  const pricesAntes: string[] = [];
  const pricesAtuais: string[] = [];
  const descontos: string[] = [];
  const parcelamentos: string[] = [];

  container.find('a.poly-component__title').each((i, el) => {
    titles.push($(el).text().trim());
    links.push($(el).attr('href') ?? '');
  });
  container.find('img.poly-component__picture').each((i, el) => {
    images.push($(el).attr('src') ?? '');
  });
  container.find('s.andes-money-amount.andes-money-amount--previous.andes-money-amount--cents-comma').each((i, el) => {
    pricesAntes.push($(el).text().trim());
  });
  container.find('span.andes-money-amount.andes-money-amount--cents-superscript').each((i, el) => {
    pricesAtuais.push($(el).text().trim());
  });
  container.find('span.andes-money-amount__discount').each((i, el) => {
    descontos.push($(el).text().trim());
  });
  container.find('span.poly-price__installments').each((i, el) => {
    parcelamentos.push($(el).text().trim());
  });

  // Format installments: "6x R$ 29,90 sem juros" -> "Parcelamento em 6x sem juros"
  const INSTALLMENT_REGEX = /(\d{1,2})x R\$ [\d.,]+ sem juros/;

  return titles.map((titulo, i) => ({
    titulo,
    imagem: images[i] ?? null,
    link: links[i] ?? null,
    preco_antes: pricesAntes[i] ?? null,
    preco_atual: pricesAtuais[i] ?? null,
    desconto: descontos[i] ?? null,
    parcelamento: (() => {
      const raw = parcelamentos[i] ?? '';
      const match = raw.match(INSTALLMENT_REGEX);
      return match ? `Parcelamento em ${match[1]}x sem juros` : raw;
    })(),
  })).filter(p => p.titulo && p.link && p.preco_atual);
}
```

### Mercado Livre: Affiliate Link Generation (FETCH-06)

```typescript
// Source: Gerar Link Mercado Livre.json — "Encurtar link mercado livre" node

async function generateMercadoLivreAffiliateLink(
  productUrl: string,
  tagAfiliado: string,
  cookieSession: string
): Promise<string> {
  const response = await fetch(
    'https://www.mercadolivre.com.br/affiliate-program/api/v2/affiliates/createLink',
    {
      method: 'POST',
      headers: {
        'accept': 'application/json, text/plain, */*',
        'accept-language': 'pt-BR,pt;q=0.9,en-US;q=0.8,en;q=0.7',
        'content-type': 'application/json',
        'origin': 'https://www.mercadolivre.com.br',
        'referer': 'https://www.mercadolivre.com.br/afiliados/linkbuilder',
        'sec-ch-ua': '"Google Chrome";v="143", "Chromium";v="143", "Not A(Brand";v="24"',
        'user-agent': 'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/143.0.0.0 Safari/537.36',
        'Cookie': cookieSession,
      },
      body: JSON.stringify({ urls: [productUrl], tag: tagAfiliado }),
    }
  );

  const data = await response.json() as { urls?: Array<{ short_url: string }> };
  const shortUrl = data.urls?.[0]?.short_url;
  if (!shortUrl) throw new Error('ML createLink returned no short_url');
  return shortUrl;
}
```

### Shopee: GraphQL with SHA256 Auth (FETCH-03, FETCH-07)

```typescript
// Source: Envio de Promos Shopee.json — "Gerar Hash", "Lista de Produtos", "Com Categoria"/"Sem Categoria" nodes

import { createHash } from 'crypto';

interface ShopeeConfig {
  appId: string;
  secret: string;
  listType?: number;    // 0 = hot products
  sortType?: number;    // 2 = by sales
  productCatId?: number;
  keyword?: string;
  limit?: number;       // max 50
  page?: number;
}

async function fetchShopeeOffers(config: ShopeeConfig) {
  const timestamp = Math.floor(Date.now() / 1000).toString();

  const query = config.productCatId
    ? `{ productOfferV2(listType:${config.listType ?? 0}, productCatId:${config.productCatId}, sortType:${config.sortType ?? 2}, keyword:"${config.keyword ?? ''}", limit:${config.limit ?? 40}, page:${config.page ?? 1}) { nodes { productName imageUrl productLink offerLink price sales commission priceMin } } }`
    : `{ productOfferV2(listType:${config.listType ?? 0}, sortType:${config.sortType ?? 2}, keyword:"${config.keyword ?? ''}", limit:${config.limit ?? 40}, page:${config.page ?? 1}) { nodes { productName imageUrl productLink offerLink price sales commission priceMin } } }`;

  const payload = JSON.stringify({ query });

  // SHA256(AppID + Timestamp + Payload + Secret) -- NOT HMAC, plain hash
  const signature = createHash('sha256')
    .update(config.appId + timestamp + payload + config.secret)
    .digest('hex');

  const response = await fetch('https://open-api.affiliate.shopee.com.br/graphql', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      'Authorization': `SHA256 Credential=${config.appId}, Timestamp=${timestamp}, Signature=${signature}`,
    },
    body: payload,
  });

  const data = await response.json() as {
    data: { productOfferV2: { nodes: ShopeeProduct[] } }
  };
  return data.data.productOfferV2.nodes;
}

interface ShopeeProduct {
  productName: string;
  imageUrl: string;
  productLink: string;
  offerLink: string;  // already the affiliate link — FETCH-07: no extra call needed
  price: number;
  sales: number;
  commission: number;
  priceMin: number;
}
```

### AliExpress: Official API (FETCH-04, FETCH-08)

```typescript
// Source: Envio de Promos Aliexpress.json — "Setar dados" node + n8n AliExpress node config

// AliExpress uses the official Affiliate API
// getHotProducts endpoint params (from n8n node "getHotProducts" operation):
interface AliExpressConfig {
  trackingId: string;
  categoryIds?: string;    // comma-separated category IDs
  pageNo?: number;
  pageSize?: number;       // max 50
  targetCurrency?: string; // 'BRL'
  targetLanguage?: string; // 'PT'
  keywords?: string;
  sort?: string;           // 'LAST_VOLUME_DESC'
  maxSalePrice?: number;   // BRL cents * 100 (API uses fractional cents)
  minSalePrice?: number;
}

// For affiliate link generation (FETCH-08):
// generateLink: { promotionLinkType: 2, sourceValues: productUrl, trackingId }
// Returns: { result: { promotionLinks: [{ promotionLink: string }] } }

// The n8n node uses the n8n built-in AliExpress node. For TypeScript, use AliExpress's
// official REST API directly. The base URL and auth method needs verification against
// current AliExpress Open Platform docs (see Open Questions below).
```

### Credential Validation Patterns

```typescript
// Amazon validation: call SiteStripe with a known ASIN
async function validateAmazon(creds: DecryptedCredentials): Promise<ValidationResult> {
  if (!creds.tag) return { valid: false, error: 'Tag de afiliado é obrigatória' };

  if (!creds.cookies) {
    // Without cookies, we can only verify that tag is non-empty
    return { valid: true }; // Tag-append mode always works
  }

  // Test SiteStripe with a well-known Amazon BR product
  const testUrl = 'https://www.amazon.com.br/dp/B0CPKWCJH4';
  try {
    const shortUrl = await generateAmazonAffiliateLink(testUrl, creds.tag, creds.cookies!);
    return shortUrl.includes('amazon') || shortUrl.includes('amzn')
      ? { valid: true }
      : { valid: false, error: 'Cookies inválidos ou expirados' };
  } catch {
    return { valid: false, error: 'Falha ao validar cookies Amazon' };
  }
}

// ML validation: call createLink with a known ML product URL
async function validateMercadoLivre(creds: DecryptedCredentials): Promise<ValidationResult> {
  if (!creds.tag_afiliado || !creds.cookie_session) {
    return { valid: false, error: 'Tag e cookie de sessão são obrigatórios' };
  }
  const testUrl = 'https://www.mercadolivre.com.br/p/MLB33208891';
  try {
    const link = await generateMercadoLivreAffiliateLink(testUrl, creds.tag_afiliado, creds.cookie_session);
    return { valid: !!link };
  } catch (e) {
    return { valid: false, error: 'Cookie de sessão inválido ou expirado' };
  }
}

// Shopee validation: call GraphQL with limit=1
async function validateShopee(creds: DecryptedCredentials): Promise<ValidationResult> {
  if (!creds.app_id || !creds.secret) {
    return { valid: false, error: 'AppID e Secret são obrigatórios' };
  }
  try {
    const products = await fetchShopeeOffers({ appId: creds.app_id, secret: creds.secret, limit: 1 });
    return { valid: products.length >= 0 }; // empty array is OK, just means no products
  } catch {
    return { valid: false, error: 'AppID ou Secret inválidos' };
  }
}

// AliExpress validation: call getHotProducts with pageSize=1
async function validateAliExpress(creds: DecryptedCredentials): Promise<ValidationResult> {
  if (!creds.tracking_id) {
    return { valid: false, error: 'TrackingID é obrigatório' };
  }
  // Call getHotProducts with pageSize=1 and check response
  // Exact API call depends on AliExpress SDK — see Open Questions
  return { valid: true }; // Optimistic until AliExpress API is verified
}
```

### UI: Credential Card per Marketplace

```typescript
// Each marketplace card shows:
// - Status badge: green (valid), yellow (not validated), red (invalid/expired)
// - Form fields specific to the marketplace
// - "Testar Conexão" button that calls saveAndValidateCredentials()

// Amazon fields: tag (text), cookies (textarea, optional, labeled "Cookies do SiteStripe")
// ML fields: tag_afiliado (text), cookie_session (textarea, labeled "Cookie de Sessão")
// Shopee fields: app_id (text), secret (password)
// AliExpress fields: tracking_id (text)

// Status logic:
// - is_valid: true, last_validated_at recent -> green
// - is_valid: false -> red, show validation_error
// - last_validated_at null -> yellow (never validated)
// - last_validated_at > 7 days ago -> yellow (stale)
```

---

## State of the Art

| Old Approach | Current Approach | When Changed | Impact |
|--------------|------------------|--------------|--------|
| pg-boss for background jobs | Trigger.dev v3 | Phase 1 decision | No separate worker process needed; managed infra |
| Prisma ORM | Supabase client SDK + raw SQL | Phase 1 decision | No ORM conflicts with RLS |
| `NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY` env var | `NEXT_PUBLIC_SUPABASE_ANON_KEY` in env.ts | Implemented in 01-01 | env.ts uses ANON_KEY not PUBLISHABLE_KEY |
| `user_profiles` table name | `users` table (extends auth.users) | Implemented in 01-01 | Table is `public.users`, not `user_profiles` |

**Implemented in Phase 1 that matters for Phase 2:**
- `src/lib/crypto.ts`: `encrypt(plaintext): string` and `decrypt(stored): string` — use these directly
- `src/lib/credentials.ts`: `saveMarketplaceCredentials(data)` and `loadMarketplaceCredentials(stored)` — the correct API
- `src/lib/supabase/admin.ts`: exports `supabaseAdmin` — use this in Trigger.dev tasks
- Table name is `marketplace_connections` with `encrypted_credentials TEXT` column — matches the architecture

---

## Open Questions

1. **AliExpress API authentication mechanism**
   - What we know: n8n uses the built-in "AliExpress" node which handles OAuth internally. The user credential is a `tracking_id` (string).
   - What's unclear: The TypeScript REST API call to AliExpress Open Platform requires an app key + secret + HMAC signature. These may be platform-level credentials (one set for all DisparaZap users) rather than per-user credentials.
   - Recommendation: During plan 02-02 (AliExpress connector), check the AliExpress Open Platform docs at `https://developers.aliexpress.com/doc.htm?spm=a2o9m.11193494.0.0.2b5c46e5jBjYt4`. If it requires platform-level OAuth, the connector uses the DisparaZap app credentials + user's tracking_id. Only `tracking_id` is stored per user; the platform API key goes in `.env`.
   - Confidence: LOW on auth mechanism — needs verification.

2. **Trigger.dev v3 task file location convention**
   - What we know: `@trigger.dev/sdk@4.4.3` is installed. The SDK v3 expects task files in a specific location.
   - What's unclear: Whether to put tasks in `src/trigger/` or `trigger/` and whether a `trigger.config.ts` is required.
   - Recommendation: Check `npx trigger.dev@latest init` output and verify against Trigger.dev v3 docs before plan 02-01. The SDK version 4.x may have a different convention than 3.x.
   - Confidence: MEDIUM — SDK is installed but config not yet initialized.

3. **Amazon slot number durability**
   - What we know: The widget is at `assets.mountWidget('slot-14', ...)` in the current workflow.
   - What's unclear: Whether the slot number will be different in the live environment at implementation time.
   - Recommendation: Use a dynamic regex to find any `mountWidget('slot-` match. The HTML fallback strategy (Strategy 2) must be reliable as a backup.

---

## Validation Architecture

### Test Framework
| Property | Value |
|----------|-------|
| Framework | vitest 4.1.0 |
| Config file | `vitest.config.ts` (exists) |
| Quick run command | `npx vitest run src/__tests__/` |
| Full suite command | `npx vitest run` |

### Phase Requirements → Test Map

| Req ID | Behavior | Test Type | Automated Command | File Exists? |
|--------|----------|-----------|-------------------|-------------|
| MKT-01 | Amazon credential encryption/decryption round-trip | unit | `npx vitest run src/__tests__/lib/connectors/amazon.test.ts` | ❌ Wave 0 |
| MKT-02 | ML credential encryption round-trip | unit | `npx vitest run src/__tests__/lib/connectors/mercadolivre.test.ts` | ❌ Wave 0 |
| MKT-03 | Shopee credential encryption round-trip | unit | `npx vitest run src/__tests__/lib/connectors/shopee.test.ts` | ❌ Wave 0 |
| MKT-04 | AliExpress credential encryption round-trip | unit | `npx vitest run src/__tests__/lib/connectors/aliexpress.test.ts` | ❌ Wave 0 |
| MKT-05 | Validation result stored correctly in DB | manual | manual — requires live Supabase | N/A |
| FETCH-01 | Amazon dual-strategy parser returns NormalizedOffer[] from fixture HTML | unit | `npx vitest run src/__tests__/lib/connectors/amazon.test.ts` | ❌ Wave 0 |
| FETCH-02 | ML CSS scraper returns products from fixture HTML | unit | `npx vitest run src/__tests__/lib/connectors/mercadolivre.test.ts` | ❌ Wave 0 |
| FETCH-03 | Shopee SHA256 signature generation is correct | unit | `npx vitest run src/__tests__/lib/connectors/shopee.test.ts` | ❌ Wave 0 |
| FETCH-04 | AliExpress config correctly passes params | unit | `npx vitest run src/__tests__/lib/connectors/aliexpress.test.ts` | ❌ Wave 0 |
| FETCH-05 | Amazon affiliate link generation with/without cookies | unit | `npx vitest run src/__tests__/lib/connectors/amazon.test.ts` | ❌ Wave 0 |
| FETCH-06 | ML createLink POST body is correctly formed | unit | `npx vitest run src/__tests__/lib/connectors/mercadolivre.test.ts` | ❌ Wave 0 |
| FETCH-07 | Shopee offerLink passes through as affiliateLink | unit | `npx vitest run src/__tests__/lib/connectors/shopee.test.ts` | ❌ Wave 0 |
| FETCH-08 | AliExpress generateLink is called with correct params | unit | `npx vitest run src/__tests__/lib/connectors/aliexpress.test.ts` | ❌ Wave 0 |
| FETCH-09 | Amazon filter correctly rejects ebooks/livros/ISBNs | unit | `npx vitest run src/__tests__/lib/connectors/amazon.test.ts` | ❌ Wave 0 |
| FETCH-10 | Pix/Boleto price extraction from promotionsUnified JSON | unit | `npx vitest run src/__tests__/lib/connectors/amazon.test.ts` | ❌ Wave 0 |
| FETCH-11 | Installment string formatting (ML + Amazon) | unit | `npx vitest run src/__tests__/lib/connectors/amazon.test.ts` | ❌ Wave 0 |

### Sampling Rate
- **Per task commit:** `npx vitest run src/__tests__/lib/connectors/`
- **Per wave merge:** `npx vitest run`
- **Phase gate:** Full suite green before `/gsd:verify-work`

### Wave 0 Gaps
- [ ] `src/__tests__/lib/connectors/amazon.test.ts` — covers FETCH-01, FETCH-05, FETCH-09, FETCH-10, FETCH-11
- [ ] `src/__tests__/lib/connectors/mercadolivre.test.ts` — covers FETCH-02, FETCH-06
- [ ] `src/__tests__/lib/connectors/shopee.test.ts` — covers FETCH-03, FETCH-07
- [ ] `src/__tests__/lib/connectors/aliexpress.test.ts` — covers FETCH-04, FETCH-08
- [ ] `src/__tests__/fixtures/amazon-deals-page.html` — fixture HTML for Amazon parser tests
- [ ] `src/__tests__/fixtures/ml-ofertas-page.html` — fixture HTML for ML scraper tests

**Existing test infrastructure:** `vitest.config.ts` exists. `src/__tests__/setup.ts` and `src/__tests__/credentials.test.ts` already exist. No new framework installation needed.

---

## Sources

### Primary (HIGH confidence)
- `/Users/renangalhardo/Documents/Projetos/disparazap/Arquivos_n8n/Ofertas Amazon.json` — Amazon scraping + SiteStripe + filter logic
- `/Users/renangalhardo/Documents/Projetos/disparazap/Arquivos_n8n/Envio de Promos Shopee.json` — Shopee GraphQL + SHA256 auth
- `/Users/renangalhardo/Documents/Projetos/disparazap/Arquivos_n8n/Gerar Link Mercado Livre.json` — ML createLink API
- `/Users/renangalhardo/Documents/Projetos/disparazap/Arquivos_n8n/Ofertas do Dia ML.json` — ML CSS selectors
- `/Users/renangalhardo/Documents/Projetos/disparazap/Arquivos_n8n/Envio de Promos Aliexpress.json` — AliExpress config params
- `src/lib/crypto.ts` — confirmed AES-256-GCM encrypt/decrypt implementation
- `src/lib/credentials.ts` — confirmed saveMarketplaceCredentials/loadMarketplaceCredentials API

### Secondary (MEDIUM confidence)
- `.planning/research/ARCHITECTURE.md` — MarketplaceConnector interface design
- `.planning/research/STACK.md` — library choices (cheerio, p-retry, p-queue)
- `package.json` — confirmed installed packages and versions

### Tertiary (LOW confidence)
- AliExpress Open Platform API authentication mechanism — not directly verifiable from existing n8n files; needs verification at implementation time

---

## Metadata

**Confidence breakdown:**
- Standard stack: HIGH — packages confirmed from package.json + npm registry
- Amazon connector implementation: HIGH — direct extraction from n8n JSON workflow
- ML connector implementation: HIGH — direct extraction from n8n JSON workflows
- Shopee connector implementation: HIGH — direct extraction from n8n JSON workflow
- AliExpress connector implementation: MEDIUM — config params known, auth mechanism needs verification
- Architecture patterns: HIGH — consistent with existing code in src/lib/

**Research date:** 2026-03-16
**Valid until:** 2026-04-16 (Amazon/ML scraping patterns can change with page updates; Shopee/AliExpress APIs are stable)
