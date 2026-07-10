---
phase: 02-marketplace-connectors
verified: 2026-03-16T23:07:00Z
status: passed
score: 17/17 must-haves verified
re_verification: false
human_verification:
  - test: "Credential validation UI — save and test connection for each marketplace"
    expected: "Sheet shows 'Conexão validada com sucesso!' or error message inline after clicking 'Testar e Salvar'"
    why_human: "Requires live Supabase DB and real or mock credentials; cannot verify server action round-trip programmatically"
  - test: "Status badge updates after credential save"
    expected: "Marketplace page refreshes and badge changes from 'Não configurado' to 'Conectado' or 'Erro de conexão'"
    why_human: "Requires browser interaction and live DB to verify Next.js Server Component revalidation"
---

# Phase 2: Marketplace Connectors Verification Report

**Phase Goal:** The system can fetch deals from all 4 marketplaces and generate per-user affiliate links using stored credentials
**Verified:** 2026-03-16T23:07:00Z
**Status:** PASSED
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth | Status | Evidence |
|----|-------|--------|----------|
| 1  | Types foundation: 5 interfaces exported from types.ts | VERIFIED | File exists, 5 `export interface` declarations confirmed |
| 2  | Registry factory returns connector for all 4 marketplaces | VERIFIED | `getConnector()` exported; falls back to StubConnector; all 4 connectors auto-register at module init |
| 3  | Amazon connector fetches deals using dual-strategy (JSON widget + cheerio fallback) | VERIFIED | `parseAmazonStrategy1()` JSON widget + `parseAmazonStrategy2()` cheerio HTML fallback both present and wired in `fetchOffers()` |
| 4  | Amazon connector filters digital products and price-invalid offers | VERIFIED | `FILTER_DIGITAIS`, `FILTER_ISBN`, `shouldIncludeOffer()` exported and applied in parser |
| 5  | Amazon connector extracts Pix/Boleto price from promotionsUnified | VERIFIED | `promotionsUnified.entity.displayablePromotions` scan with `combinedSavings.fixedTargetAmount.amount` present |
| 6  | Amazon connector generates affiliate links via SiteStripe (cookies) or ?tag= fallback | VERIFIED | `generateAffiliateLink()` tries SiteStripe API first, falls back to `generateAmazonAffiliateLinkSync()` |
| 7  | AliExpress connector calls getHotProducts API with HMAC-SHA256 signed request | VERIFIED | `buildAliExpressSignature()` uses `createHmac('sha256', appSecret)`, called in `buildRequest()` for `aliexpress.affiliate.hotproduct.query` |
| 8  | AliExpress connector generates affiliate links via generateLink API | VERIFIED | `generateAffiliateLink()` calls `aliexpress.affiliate.link.generate` method |
| 9  | Mercado Livre connector scrapes /ofertas page with cheerio CSS selectors | VERIFIED | `parseMercadoLivreHTML()` uses exact CSS selectors from spec (`poly-component__title`, `andes-money-amount--cents-superscript`, etc.) |
| 10 | Mercado Livre connector generates affiliate links via POST createLink API | VERIFIED | `generateAffiliateLink()` POSTs to `createLink` URL with Cookie header + JSON body containing `{urls, tag}` |
| 11 | Mercado Livre connector formats installments as "Parcelamento em Nx sem juros" | VERIFIED | `formatInstallment()` exported and applied; test confirms `"6x R$ 29,90 sem juros"` → `"Parcelamento em 6x sem juros"` |
| 12 | Shopee connector calls GraphQL API with plain SHA256 (NOT HMAC) signature | VERIFIED | `buildShopeeSignature()` uses `createHash('sha256')` (not createHmac), test explicitly validates this |
| 13 | Shopee connector uses offerLink directly as affiliateLink | VERIFIED | `normalizeShopeeProduct()` maps `raw.offerLink` to `affiliateLink`; `generateAffiliateLink()` throws if called separately |
| 14 | All 4 Trigger.dev tasks upsert NormalizedOffer[] to offers table | VERIFIED | All 4 tasks: import connector for auto-registration, call `getConnector().fetchOffers()`, upsert to `supabaseAdmin.from('offers')` |
| 15 | Credentials UI: page lists all 4 marketplaces with status badges from DB | VERIFIED | `page.tsx` queries `marketplace_connections`, maps to `MarketplaceStatus[]`, renders 4 `MarketplaceCard` components |
| 16 | Credentials UI: sheet calls Server Action, encrypts and upserts to DB | VERIFIED | `CredentialSheet` calls `saveAndValidateCredentials()`; action encrypts via `saveMarketplaceCredentials()`, upserts to `marketplace_connections` |
| 17 | All 46 unit tests pass | VERIFIED | `vitest run`: 4 test files, 46 tests, 0 failures |

**Score:** 17/17 truths verified

---

### Required Artifacts

| Artifact | Status | Details |
|----------|--------|---------|
| `src/lib/connectors/types.ts` | VERIFIED | 5 interfaces: `DecryptedCredentials`, `NormalizedOffer`, `FetchConfig`, `ValidationResult`, `MarketplaceConnector` — all fields match spec |
| `src/lib/connectors/registry.ts` | VERIFIED | Exports `getConnector`, `registerConnector`; StubConnector fallback for unregistered marketplaces |
| `src/lib/connectors/amazon.ts` | VERIFIED | Exports `AmazonConnector`; 366 lines of substantive implementation; auto-registers on import |
| `src/lib/connectors/aliexpress.ts` | VERIFIED | Exports `AliExpressConnector`; HMAC-SHA256 signing; auto-registers on import |
| `src/lib/connectors/mercadolivre.ts` | VERIFIED | Exports `MercadoLivreConnector`, `parseMercadoLivreHTML`, `formatInstallment`; cheerio scraping; auto-registers on import |
| `src/lib/connectors/shopee.ts` | VERIFIED | Exports `ShopeeConnector`, `buildShopeeSignature`, `buildShopeeQuery`; plain SHA256; auto-registers on import |
| `src/app/(dashboard)/marketplaces/page.tsx` | VERIFIED | Server Component (no `'use client'`); queries `marketplace_connections`; renders 4 `MarketplaceCard` components |
| `src/app/(dashboard)/marketplaces/actions.ts` | VERIFIED | `'use server'` directive; `saveAndValidateCredentials()` exported; encrypts credentials; upserts to `marketplace_connections` |
| `trigger/fetch-amazon.ts` | VERIFIED | Task id=`fetch-amazon`; imports connector for auto-registration; fetches offers; upserts to `offers` table |
| `trigger/fetch-aliexpress.ts` | VERIFIED | Task id=`fetch-aliexpress`; imports connector for auto-registration; fetches offers; upserts to `offers` table |
| `trigger/fetch-mercadolivre.ts` | VERIFIED | Task id=`fetch-mercadolivre`; imports connector for auto-registration; fetches offers; upserts to `offers` table |
| `trigger/fetch-shopee.ts` | VERIFIED | Task id=`fetch-shopee`; imports connector for auto-registration; fetches offers; upserts to `offers` table |
| `src/__tests__/lib/connectors/amazon.test.ts` | VERIFIED | 15 tests covering price parsing, digital product filters, strategy1 parser, affiliate link generation, offer filtering — all passing |
| `src/__tests__/lib/connectors/aliexpress.test.ts` | VERIFIED | 7 tests covering HMAC-SHA256 signature, normalizer, credential validation — all passing |
| `src/__tests__/lib/connectors/mercadolivre.test.ts` | VERIFIED | 13 tests covering HTML parsing, installment formatting, createLink body, credential validation — all passing |
| `src/__tests__/lib/connectors/shopee.test.ts` | VERIFIED | 11 tests covering SHA256 signature (with HMAC-negative assertion), query builder, normalizer, credential validation — all passing |
| `src/__tests__/fixtures/amazon-deals-page.html` | VERIFIED | Exists; used by `parseAmazonStrategy1` test |
| `src/__tests__/fixtures/ml-ofertas-page.html` | VERIFIED | Exists; used by `parseMercadoLivreHTML` test |

---

### Key Link Verification

| From | To | Via | Status | Details |
|------|----|-----|--------|---------|
| `CredentialSheet.tsx` | `actions.ts` | `saveAndValidateCredentials()` on form submit | WIRED | `import { saveAndValidateCredentials } from '../actions'`; called in `handleSubmit` inside `startTransition` |
| `actions.ts` | `registry.ts` | `getConnector(marketplace).validateCredentials()` | WIRED | `import { getConnector } from '@/lib/connectors/registry'`; called directly in action body |
| `actions.ts` | `marketplace_connections` table | `supabase.from('marketplace_connections').upsert()` | WIRED | Upsert present with `onConflict: 'user_id,marketplace'` |
| `trigger/fetch-amazon.ts` | `amazon.ts` | `import '@/lib/connectors/amazon'` then `getConnector('amazon').fetchOffers()` | WIRED | Side-effect import triggers auto-registration; `getConnector` returns the registered instance |
| `trigger/fetch-aliexpress.ts` | `aliexpress.ts` | `import '@/lib/connectors/aliexpress'` then `getConnector('aliexpress').fetchOffers()` | WIRED | Same auto-registration pattern |
| `trigger/fetch-mercadolivre.ts` | `mercadolivre.ts` | `import '@/lib/connectors/mercadolivre'` then `getConnector('mercadolivre').fetchOffers()` | WIRED | Same auto-registration pattern |
| `trigger/fetch-shopee.ts` | `shopee.ts` | `import '@/lib/connectors/shopee'` then `getConnector('shopee').fetchOffers()` | WIRED | Same auto-registration pattern |
| All 4 trigger tasks | `offers` table | `supabaseAdmin.from('offers').upsert()` | WIRED | All 4 tasks upsert with `onConflict: 'user_id,marketplace,external_id'` |
| `amazon.ts` | `registry.ts` | `registerConnector(new AmazonConnector())` at module init | WIRED | Line 365 |
| `aliexpress.ts` | `registry.ts` | `registerConnector(new AliExpressConnector())` at module init | WIRED | Line 225 |
| `mercadolivre.ts` | `registry.ts` | `registerConnector(new MercadoLivreConnector())` at module init | WIRED | Line 269 |
| `shopee.ts` | `registry.ts` | `registerConnector(new ShopeeConnector())` at module init | WIRED | Line 194 |

---

### Requirements Coverage

| Requirement | Source Plan | Description | Status | Evidence |
|-------------|------------|-------------|--------|----------|
| MKT-01 | 02-01 | Marketplace connection management UI | SATISFIED | `page.tsx` + `MarketplaceCard.tsx` + `CredentialSheet.tsx` + `actions.ts` |
| MKT-02 | 02-01, 02-03 | Credential encryption before storage | SATISFIED | `saveMarketplaceCredentials()` (AES-256-GCM wrapper) called in `actions.ts` before upsert |
| MKT-03 | 02-01, 02-03 | Connection status badges (green/yellow/red) | SATISFIED | `statusBadge()` in `MarketplaceCard.tsx` with three states based on `is_valid` + `last_validated_at` |
| MKT-04 | 02-01 | 4 marketplace types enforced | SATISFIED | DB constraint and TypeScript union type enforce `'amazon' \| 'mercadolivre' \| 'shopee' \| 'aliexpress'` |
| MKT-05 | 02-01 | cheerio runtime dependency | SATISFIED | `"cheerio": "^1.2.0"` in `package.json` `dependencies` (not devDependencies) |
| FETCH-01 | 02-02 | Amazon dual-strategy fetch (JSON widget + HTML fallback) | SATISFIED | `parseAmazonStrategy1()` + `parseAmazonStrategy2()` in `amazon.ts`; strategy1 tried first |
| FETCH-02 | 02-03 | Mercado Livre cheerio scraping | SATISFIED | `parseMercadoLivreHTML()` uses exact spec CSS selectors |
| FETCH-03 | 02-03 | Shopee GraphQL API fetch | SATISFIED | `callGraphQL()` POSTs to `https://open-api.affiliate.shopee.com.br/graphql` |
| FETCH-04 | 02-02 | AliExpress getHotProducts API fetch | SATISFIED | `fetchOffers()` calls `aliexpress.affiliate.hotproduct.query` |
| FETCH-05 | 02-02 | Amazon digital product filtering | SATISFIED | `FILTER_DIGITAIS`, `FILTER_ISBN`, `shouldIncludeOffer()` applied |
| FETCH-06 | 02-03 | Mercado Livre affiliate link via createLink API | SATISFIED | `generateAffiliateLink()` POSTs to `createLink` with Cookie + tag body |
| FETCH-07 | 02-03 | Shopee offerLink passthrough (no extra API call) | SATISFIED | `normalizeShopeeProduct()` maps `raw.offerLink` directly; `generateAffiliateLink()` throws to prevent misuse |
| FETCH-08 | 02-02 | AliExpress affiliate link via generateLink API | SATISFIED | `generateAffiliateLink()` calls `aliexpress.affiliate.link.generate` |
| FETCH-09 | 02-02 | Amazon Pix/Boleto price extraction from promotionsUnified | SATISFIED | `pixOffer` detection from `promotionsUnified.entity.displayablePromotions` |
| FETCH-10 | 02-02 | Amazon SiteStripe affiliate link (cookies) or ?tag= fallback | SATISFIED | `generateAffiliateLink()` tries SiteStripe API, falls back to tag-append |
| FETCH-11 | 02-02, 02-03 | All connectors upsert to offers table via Trigger.dev tasks | SATISFIED | All 4 trigger tasks upsert `NormalizedOffer[]` mapped to `offers` table columns |

---

### Anti-Patterns Found

None detected.

Scanned connectors, trigger tasks, and UI files for TODO/FIXME/placeholder comments, empty implementations, stub returns, and console.log-only handlers. The `return []` occurrences in `amazon.ts` are legitimate early-exit guards in the parsing function (not stubs).

Note: `aliexpress.ts` uses `HMAC-SHA256` for signing (per the AliExpress Open Platform spec), which differs from Shopee which explicitly uses plain SHA256. The plan spec for AliExpress calls for HMAC-SHA256 — this is correct per the AliExpress API contract. The unit test validates the signature is consistent.

---

### Human Verification Required

#### 1. Credential save and validate round-trip

**Test:** Navigate to `/marketplaces`, click "Configurar credenciais" on Amazon, enter a valid affiliate tag, click "Testar e Salvar".
**Expected:** Inline feedback shows "Conexão validada com sucesso!" and the badge updates to "Conectado" on page refresh.
**Why human:** Requires live Supabase connection; tests only cover the server action and connector logic in isolation.

#### 2. Status badge staleness (7-day rule)

**Test:** Insert a `marketplace_connections` row with `last_validated_at` older than 7 days and `is_valid = true`. Load the page.
**Expected:** Badge shows "Verificação pendente" (yellow), not "Conectado" (green).
**Why human:** Badge logic is in a Client Component and depends on real timestamps; can only be verified in a browser.

---

### Summary

Phase 2 goal is fully achieved. All 4 marketplace connectors are implemented with real fetch logic, affiliate link generation, and credential validation. All 4 Trigger.dev tasks wire the connectors to the `offers` table via the registry pattern. The credential management UI is complete with encryption, DB persistence, and per-marketplace form fields. 46/46 unit tests pass covering all critical parsing, filtering, and cryptographic behavior. No stubs or orphaned artifacts were found.

---

_Verified: 2026-03-16T23:07:00Z_
_Verifier: Claude (gsd-verifier)_
