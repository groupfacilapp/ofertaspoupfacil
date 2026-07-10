---
phase: 02-marketplace-connectors
plan: 01
subsystem: marketplace-connectors
tags: [connectors, credentials, ui, cheerio, supabase]
dependency_graph:
  requires: []
  provides:
    - MarketplaceConnector interface (src/lib/connectors/types.ts)
    - getConnector() factory (src/lib/connectors/registry.ts)
    - Marketplace connections page (src/app/(dashboard)/marketplaces/)
    - saveAndValidateCredentials Server Action
  affects:
    - Wave 2 connector implementations (02-02, 02-03)
tech_stack:
  added:
    - cheerio ^1.2.0 (runtime dependency for HTML parsing in Wave 2)
    - shadcn badge, sheet, textarea components
  patterns:
    - Server Component + Server Action pattern for credential management
    - Registry pattern with stub connectors (plug-in for Wave 2)
    - AES-256-GCM encryption via saveMarketplaceCredentials() before DB storage
key_files:
  created:
    - src/lib/connectors/types.ts
    - src/lib/connectors/registry.ts
    - src/app/(dashboard)/marketplaces/page.tsx
    - src/app/(dashboard)/marketplaces/actions.ts
    - src/app/(dashboard)/marketplaces/components/MarketplaceCard.tsx
    - src/app/(dashboard)/marketplaces/components/CredentialSheet.tsx
    - src/components/ui/badge.tsx
    - src/components/ui/sheet.tsx
    - src/components/ui/textarea.tsx
  modified:
    - package.json (cheerio added to dependencies)
decisions:
  - Registry pattern with StubConnector fallback allows Wave 2 connectors to register independently without modifying core files
  - Server Action upserts credentials regardless of validation result so users can save and revisit invalid credentials
  - Badge, sheet, textarea added as shadcn components using base-nova style (consistent with existing button/card/input)
metrics:
  duration: 170s
  completed_date: 2026-03-17
  tasks_completed: 2
  files_created: 9
---

# Phase 02 Plan 01: Marketplace Connector Foundation Summary

Cheerio installed, shared connector types defined, stub registry created, and full credential management UI built — allowing users to configure and save AES-256-GCM encrypted credentials for all 4 marketplaces before Wave 2 connectors implement real validation.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Install cheerio + define connector types + registry stub | 9b1bffd | types.ts, registry.ts, badge/sheet/textarea |
| 2 | Marketplace connections page + Server Action + UI components | b529b3b | page.tsx, actions.ts, MarketplaceCard.tsx, CredentialSheet.tsx |

## What Was Built

### Connector Foundation (src/lib/connectors/)

**types.ts** exports 5 interfaces:
- `DecryptedCredentials` — per-marketplace credential fields (tag, cookies, app_id, secret, etc.)
- `NormalizedOffer` — canonical deal shape used across all connectors (prices in BRL cents)
- `FetchConfig` — fetch parameters (keywords, categories, minDiscount, maxPrice, minSales, page)
- `ValidationResult` — `{ valid: boolean; error?: string }`
- `MarketplaceConnector` — interface with fetchOffers(), generateAffiliateLink(), validateCredentials()

**registry.ts** exports:
- `getConnector(marketplace)` — returns registered connector or falls back to StubConnector
- `registerConnector(connector)` — Wave 2 connectors call this to plug in real implementations
- `StubConnector` (internal) — validateCredentials returns `valid: false` with clear message

### Marketplace Connections UI (src/app/(dashboard)/marketplaces/)

**page.tsx** (Server Component):
- Loads all connections from `marketplace_connections` table via Supabase server client
- Renders 2-column grid of MarketplaceCard components with live DB status

**actions.ts** (Server Action, `'use server'`):
- `saveAndValidateCredentials(marketplace, rawCredentials)` — authenticates user, encrypts credentials via `saveMarketplaceCredentials()`, calls `getConnector().validateCredentials()`, upserts to `marketplace_connections` table

**MarketplaceCard.tsx** (Client Component):
- Status badge logic: Conectado (green), Verificacao pendente (yellow, > 7 days stale), Nao configurado (yellow, never), Erro de conexao (red destructive)
- Opens CredentialSheet on "Configurar credenciais" click

**CredentialSheet.tsx** (Client Component):
- Per-marketplace form fields: Amazon (tag + cookies textarea), Mercado Livre (tag_afiliado + cookie_session textarea), Shopee (app_id + secret), AliExpress (tracking_id)
- Calls Server Action on submit, shows success/error feedback inline
- Uses `useTransition` for pending state

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 3 - Blocking] Missing shadcn UI components (badge, sheet, textarea)**
- **Found during:** Task 2 pre-flight check
- **Issue:** Components required by MarketplaceCard and CredentialSheet were not in src/components/ui/
- **Fix:** Ran `npx shadcn@latest add sheet badge textarea --yes` to add them via the project's configured base-nova registry
- **Files modified:** src/components/ui/badge.tsx, src/components/ui/sheet.tsx, src/components/ui/textarea.tsx
- **Commit:** 9b1bffd

## Verification Results

```
cheerio load test: "ok" (HTML parse round-trip)
export interface count in types.ts: 5
getConnector export: present
actions.ts first line: 'use server';
marketplace_connections upsert: present
TypeScript errors in new files: 0 (one pre-existing error in .next/types/validator.ts for deleted src/app/page.tsx — out of scope)
```

## Self-Check: PASSED
