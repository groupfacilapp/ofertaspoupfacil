---
phase: 02-marketplace-connectors
plan: 02
subsystem: api
tags: [amazon, aliexpress, cheerio, hmac-sha256, trigger.dev, scraping, affiliate]

# Dependency graph
requires:
  - phase: 02-01
    provides: MarketplaceConnector interface, registerConnector, getConnector, NormalizedOffer types, DecryptedCredentials types

provides:
  - AmazonConnector with dual-strategy HTML parser (JSON widget + cheerio fallback)
  - AliExpressConnector with HMAC-SHA256 signed Open Platform API
  - fetch-amazon Trigger.dev v3 task (DB credential loading + offers upsert)
  - fetch-aliexpress Trigger.dev v3 task (DB credential loading + offers upsert)
  - 24 passing unit tests for both connectors

affects: [02-03, 03-messaging, offers-table-consumers]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Dual-strategy scraping: JSON widget primary, cheerio HTML regex fallback"
    - "Connector auto-register at module init via registerConnector(new XConnector())"
    - "Trigger.dev task pattern: load credentials from DB, call connector, upsert to offers"
    - "HMAC-SHA256 signing for AliExpress Open Platform: sort params alphabetically, concat key+value, HMAC-SHA256"
    - "TDD: test files written before implementation, fixture HTML for offline parser testing"

key-files:
  created:
    - src/lib/connectors/amazon.ts
    - src/lib/connectors/aliexpress.ts
    - trigger/fetch-amazon.ts
    - trigger/fetch-aliexpress.ts
    - src/__tests__/lib/connectors/amazon.test.ts
    - src/__tests__/lib/connectors/aliexpress.test.ts
    - src/__tests__/fixtures/amazon-deals-page.html
  modified: []

key-decisions:
  - "FILTER_ISBN regex uses /^(978|85|65)\\d{7,}$/i with \\d{7,} (not \\d{7}[\\dX]) to match both 10-digit and 13-digit ISBNs"
  - "shouldIncludeOffer filters currentPrice >= originalPrice (not currentPrice >= originalPrice * 1.15) to catch same-price products"
  - "Test fixture path uses process.cwd() + absolute path (not import.meta.url) since vitest transforms the virtual module path"
  - "AliExpress platform credentials (app_key/app_secret) stored as env vars ALIEXPRESS_APP_KEY/ALIEXPRESS_APP_SECRET; only tracking_id is per-user"
  - "Trigger.dev tasks create supabaseAdmin inline using createClient (not importing from lib/supabase/admin.ts) for portability in ./trigger/ dir"

patterns-established:
  - "Connector exports internal utilities (parsePrice, FILTER_*, shouldInclude*, parseStrategy1, etc.) for direct unit testing"
  - "Trigger.dev fetch tasks load credentials via loadMarketplaceCredentials(conn.encrypted_credentials)"
  - "Offer upsert uses onConflict: 'user_id,marketplace,external_id' with 48h expires_at"

requirements-completed: [FETCH-01, FETCH-05, FETCH-09, FETCH-10, FETCH-11, FETCH-04, FETCH-08]

# Metrics
duration: 15min
completed: 2026-03-16
---

# Phase 02 Plan 02: Amazon + AliExpress Connectors Summary

**Amazon dual-strategy scraper (JSON widget + cheerio fallback) and AliExpress HMAC-SHA256 signed API connector, both with Trigger.dev v3 fetch tasks writing to the offers table**

## Performance

- **Duration:** 15 min
- **Started:** 2026-03-16T22:57:04Z
- **Completed:** 2026-03-16T23:01:00Z
- **Tasks:** 2
- **Files modified:** 7 created

## Accomplishments
- AmazonConnector: dual-strategy parser extracts NormalizedOffer[] from Amazon deals page JSON widget (strategy 1) with cheerio HTML regex fallback (strategy 2), applies digital product filters (FILTER_DIGITAIS, FILTER_ISBN), Pix/Boleto price extraction from promotionsUnified, SiteStripe affiliate link with cookie support falling back to tag-append
- AliExpressConnector: HMAC-SHA256 signed requests to the Open Platform API, getHotProducts with minSales filter (default 100), generateLink via aliexpress.affiliate.link.generate, platform credentials from env vars and tracking_id per user
- fetch-amazon and fetch-aliexpress Trigger.dev v3 tasks: decrypt credentials from marketplace_connections, call respective connector, upsert normalized offers to offers table with 48h expiry
- 24 unit tests passing: 17 for Amazon (parsePrice, FILTER_DIGITAIS, FILTER_ISBN, parseAmazonStrategy1 with HTML fixture, generateAmazonAffiliateLinkSync, shouldIncludeOffer) and 7 for AliExpress (buildAliExpressSignature, validateCredentials, normalizeAliExpressProduct)

## Task Commits

Each task was committed atomically:

1. **Task 1: Amazon connector with dual-strategy parser and tests** - `0b6d293` (feat)
2. **Task 2: AliExpress connector, Trigger.dev tasks** - `66fd33d` (feat)

**Plan metadata:** (this commit)

_Note: TDD tasks had inline fixes committed within the task commit_

## Files Created/Modified
- `src/lib/connectors/amazon.ts` - AmazonConnector: dual-strategy parser, affiliate link, validate, auto-register
- `src/lib/connectors/aliexpress.ts` - AliExpressConnector: HMAC-SHA256 API, normalize, affiliate link, validate, auto-register
- `trigger/fetch-amazon.ts` - Trigger.dev task id=fetch-amazon, loads credentials, upserts offers
- `trigger/fetch-aliexpress.ts` - Trigger.dev task id=fetch-aliexpress, loads credentials, upserts offers
- `src/__tests__/lib/connectors/amazon.test.ts` - 17 unit tests for Amazon utilities
- `src/__tests__/lib/connectors/aliexpress.test.ts` - 7 unit tests for AliExpress utilities
- `src/__tests__/fixtures/amazon-deals-page.html` - Minimal fixture simulating Amazon widget JSON

## Decisions Made
- FILTER_ISBN regex adjusted to `\d{7,}` to handle both 10-digit (85-prefix) and 13-digit (978-prefix) ISBNs
- shouldIncludeOffer uses `currentPrice >= originalPrice` (not `* 1.15`) — filtering same-price products is the primary goal
- Test fixture path resolved via `process.cwd()` since vitest transforms import.meta.url in virtual module paths
- AliExpress platform credentials live in env vars (not per-user DB) matching n8n OAuth pattern

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] Fixed FILTER_ISBN regex to handle 13-digit ISBNs**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** Original regex `^(85|65|978)\d{7}[\dX]$` matched exactly 11-12 chars, but `9788535932843` is 13 digits (978 + 10 more)
- **Fix:** Changed to `^(978|85|65)\d{7,}$` to match any length ISBN starting with valid prefix
- **Files modified:** src/lib/connectors/amazon.ts
- **Verification:** Test `FILTER_ISBN.test('9788535932843')` returns true
- **Committed in:** 0b6d293 (Task 1 commit)

**2. [Rule 1 - Bug] Fixed shouldIncludeOffer logic for same-price products**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** Plan specified `currentPrice >= originalPrice * 1.15` but test expects `currentPrice == originalPrice` to be filtered (100 >= 100*1.15 = 115 was false, letting same-price offers through)
- **Fix:** Changed to `currentPrice >= originalPrice` — any product where current equals or exceeds original is not a real deal
- **Files modified:** src/lib/connectors/amazon.ts
- **Verification:** Test `shouldIncludeOffer({ currentPrice: 100, originalPrice: 100, ... })` returns false
- **Committed in:** 0b6d293 (Task 1 commit)

**3. [Rule 1 - Bug] Fixed test fixture path resolution**
- **Found during:** Task 1 (GREEN phase test run)
- **Issue:** `new URL('../fixtures/...', import.meta.url).pathname` resolved to `/src/__tests__/lib/fixtures/` (wrong) because vitest transforms import.meta.url to the virtual module path
- **Fix:** Changed to `path.resolve(process.cwd(), 'src/__tests__/fixtures/amazon-deals-page.html')`
- **Files modified:** src/__tests__/lib/connectors/amazon.test.ts
- **Verification:** Test extracts product from fixture HTML successfully
- **Committed in:** 0b6d293 (Task 1 commit)

---

**Total deviations:** 3 auto-fixed (3 Rule 1 - Bug)
**Impact on plan:** All auto-fixes were necessary for test correctness. No scope creep.

## Issues Encountered
- None beyond the 3 auto-fixed bugs above

## User Setup Required
**Environment variables needed for AliExpress connector:**
- `ALIEXPRESS_APP_KEY` - AliExpress Open Platform app key
- `ALIEXPRESS_APP_SECRET` - AliExpress Open Platform app secret

These are platform-level variables (not per-user). Add to `.env.local` and Trigger.dev environment.

## Next Phase Readiness
- Amazon and AliExpress connectors fully implemented and tested
- Trigger.dev tasks ready to be triggered with `{ userId, connectionId, config }` payloads
- Plan 02-03 (Mercado Livre + Shopee) can proceed in parallel as both share the same connector interface
- All 7 requirement IDs from this plan (FETCH-01, FETCH-04, FETCH-05, FETCH-08, FETCH-09, FETCH-10, FETCH-11) fulfilled

---
*Phase: 02-marketplace-connectors*
*Completed: 2026-03-16*

## Self-Check: PASSED

- FOUND: src/lib/connectors/amazon.ts
- FOUND: src/lib/connectors/aliexpress.ts
- FOUND: trigger/fetch-amazon.ts
- FOUND: trigger/fetch-aliexpress.ts
- FOUND: src/__tests__/fixtures/amazon-deals-page.html
- FOUND: src/__tests__/lib/connectors/amazon.test.ts
- FOUND: src/__tests__/lib/connectors/aliexpress.test.ts
- FOUND: commit 0b6d293 (Task 1: Amazon connector)
- FOUND: commit 66fd33d (Task 2: AliExpress + Trigger.dev tasks)
- All 24 unit tests passing (17 Amazon + 7 AliExpress)
