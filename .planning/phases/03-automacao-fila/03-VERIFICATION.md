---
phase: 03-automacao-fila
verified: 2026-03-17T00:00:00Z
status: gaps_found
score: 13/16 must-haves verified
gaps:
  - truth: "produtos/page.tsx queries product data via getProductQueue helper from src/lib/queries/products.ts"
    status: partial
    reason: "page.tsx queries supabaseAdmin directly for offers and dispatch_logs instead of calling getProductQueue. The key_link declared in Plan 03 (getProductQueue import) is absent. The query module exists and is correct but is orphaned."
    artifacts:
      - path: "src/app/(dashboard)/produtos/page.tsx"
        issue: "Does not import or call getProductQueue from @/lib/queries/products"
      - path: "src/lib/queries/products.ts"
        issue: "Exists and is correct but not consumed by the produtos page"
    missing:
      - "Import and call getProductQueue in produtos/page.tsx OR document that direct queries are intentionally preferred over the helper layer"
  - truth: "Dashboard page uses getDashboardStats / getLast7DaysDispatches / getProductsPerMarketplace helpers"
    status: partial
    reason: "dashboard/page.tsx re-implements all three query helpers inline with supabaseAdmin calls. None of the three helpers from src/lib/queries/dashboard-stats.ts are imported or called anywhere."
    artifacts:
      - path: "src/app/(dashboard)/page.tsx"
        issue: "Duplicates logic from getDashboardStats, getLast7DaysDispatches, and getProductsPerMarketplace without importing the helpers"
      - path: "src/lib/queries/dashboard-stats.ts"
        issue: "All three exports are fully implemented but entirely orphaned — zero callers in the codebase"
    missing:
      - "Either import helpers in dashboard page.tsx or explicitly deprecate the helper layer and remove it to avoid confusion"
  - truth: "Query helper layer (src/lib/queries/*) is used by pages and actions that depend on it"
    status: failed
    reason: "All three query modules (products.ts, automation.ts, dashboard-stats.ts) were created as a shared helper layer in Plan 01 but no page, action, or task actually imports the query functions. Only the AutomationRule type from automation.ts is imported (type-only import in automacoes/page.tsx). The helper layer is a dead code layer."
    artifacts:
      - path: "src/lib/queries/products.ts"
        issue: "getProductQueue, getProductStats, markProductsSent, clearSentProducts — zero callers"
      - path: "src/lib/queries/automation.ts"
        issue: "getAutomationRules, upsertAutomationRule, toggleAutomationRule — zero callers (only the type AutomationRule is imported)"
      - path: "src/lib/queries/dashboard-stats.ts"
        issue: "getDashboardStats, getLast7DaysDispatches, getProductsPerMarketplace — zero callers"
    missing:
      - "Wire pages to the helpers OR remove the helpers and keep the inline queries — the current state creates a maintenance risk (two diverging implementations)"
human_verification:
  - test: "Navigate to /automacoes, toggle a fetch rule on/off, verify it persists after reload"
    expected: "Toggle state reflects in automation_rules table and UI shows correct state on reload"
    why_human: "DB upsert wiring is correct but requires live Supabase to verify persistence"
  - test: "Navigate to /produtos, click Enviar agora on a pending product"
    expected: "Product dispatches via Evolution API, dispatch_log is created, toast shows success"
    why_human: "Requires live Evolution API connection and WhatsApp instance to verify end-to-end"
  - test: "Verify /api/cron/automation triggers Trigger.dev tasks correctly"
    expected: "Cron endpoint returns ok:true with fetchTriggered/dispatchTriggered counts matching active rules"
    why_human: "Requires Trigger.dev project connection and active automation rules to test"
---

# Phase 3: Automacao Fila Verification Report

**Phase Goal:** Users can see all collected products in a queue, configure automatic fetch and dispatch rules per marketplace with time windows, and view a rich dashboard with 7-day activity charts and per-marketplace stats.
**Verified:** 2026-03-17
**Status:** gaps_found — functional goal achieved but query helper layer is orphaned
**Re-verification:** No — initial verification

---

## Goal Achievement

### Observable Truths

| #  | Truth                                                                                          | Status      | Evidence                                                                                            |
|----|-----------------------------------------------------------------------------------------------|-------------|-----------------------------------------------------------------------------------------------------|
| 1  | User sees all collected products in a queue with filters, images, prices, status chips         | VERIFIED    | ProdutosClient.tsx: full product grid, status filters, marketplace tabs, search — 390 lines          |
| 2  | User can filter products by marketplace, status, and search                                    | VERIFIED    | ProdutosClient.tsx lines 62-79: useMemo filtering by marketplace, status, title.toLowerCase         |
| 3  | User can send an individual product via "Enviar agora" button                                  | VERIFIED    | actions.ts:sendProduct — queries groups, builds NormalizedOffer, calls evo.sendText/sendImage        |
| 4  | User can clear sent products via "Limpar enviados"                                             | VERIFIED    | actions.ts:clearSentProducts — deletes offers with sent dispatch_logs today, revalidatePath          |
| 5  | Automacoes page shows per-marketplace fetch + dispatch config cards                            | VERIFIED    | AutomacoesClient.tsx: FetchCard + DispatchCard per marketplace, 515 lines                           |
| 6  | User can toggle fetch auto-busca on/off with interval selector                                 | VERIFIED    | FetchCard: toggle+interval select, calls saveAutomationRule on change                               |
| 7  | User can toggle dispatch auto-disparo with interval, time window, group selector               | VERIFIED    | DispatchCard: interval + start_hour/end_hour selects + compatibleGroups selector                    |
| 8  | Toggles persist to automation_rules table via server actions                                   | VERIFIED    | automacoes/actions.ts:saveAutomationRule upserts with onConflict:'user_id,marketplace,rule_type'    |
| 9  | Stats row shows pendentes, buscados hoje, ultimo disparo                                       | VERIFIED    | AutomacoesClient.tsx lines 484-497: grid-cols-3 stats cards                                         |
| 10 | "Como funciona" section exists and explains each rule type                                     | VERIFIED    | AutomacoesClient.tsx line 434: details/summary element with explanatory text                        |
| 11 | Dashboard 7-day bar chart rendered with CSS bars (no recharts)                                 | VERIFIED    | page.tsx: chartDays array + inline style={{ height }} — no recharts import found                    |
| 12 | Dashboard 5 stats cards (Total Produtos, Enviados, Pendentes, Sucesso, Falhas)                 | VERIFIED    | page.tsx lines 192-259: grid-cols-5 with all 5 cards                                               |
| 13 | Dashboard products per marketplace with colored horizontal progress bars                       | VERIFIED    | page.tsx lines 319-356: MARKETPLACE_BAR_COLORS + percentage bars                                    |
| 14 | Dashboard WhatsApp instance status card                                                        | VERIFIED    | page.tsx lines 359-412: queries whatsapp_instances, renders connected/disconnected states           |
| 15 | Trigger.dev auto-fetch task reads active fetch rules, fetches pages 1-3, upserts offers        | VERIFIED    | trigger/auto-fetch.ts: 141 lines, interval check, getConnector, upsert to offers                   |
| 16 | Trigger.dev auto-dispatch checks interval + BRT time window + calls dispatchGroup              | VERIFIED    | trigger/auto-dispatch.ts: brtHour check lines 59-60, dispatchGroup import + call line 96           |
| 17 | Cron endpoint /api/cron/automation triggers both tasks with CRON_SECRET auth                   | VERIFIED    | route.ts: CRON_SECRET check, tasks.trigger for both auto-fetch and auto-dispatch                    |
| 18 | Query helper layer consumed by pages (Plan 01 key link)                                        | FAILED      | All three query modules have zero functional callers; pages query supabaseAdmin inline               |
| 19 | produtos/page.tsx wired to getProductQueue helper                                              | FAILED      | No import of getProductQueue in page.tsx; direct supabaseAdmin queries used instead                  |

**Score:** 13/16 truths verified (17 verifiable truths, 3 failed or partial — noting overlap between #18 and #19)

---

## Required Artifacts

| Artifact                                                             | Expected                                                  | Status      | Details                                                                         |
|----------------------------------------------------------------------|-----------------------------------------------------------|-------------|---------------------------------------------------------------------------------|
| `supabase/migrations/20260318000000_automation_rules.sql`            | automation_rules table + RLS + indexes                    | VERIFIED    | CREATE TABLE, ENABLE ROW LEVEL SECURITY, UNIQUE (user_id,marketplace,rule_type) |
| `src/lib/queries/products.ts`                                        | Product queue queries (getProductQueue, etc.)             | ORPHANED    | 188 lines, all 4 exports implemented correctly, zero functional callers          |
| `src/lib/queries/automation.ts`                                      | Automation rule CRUD queries                              | ORPHANED    | 112 lines, all 3 functions implemented, only the AutomationRule type is used    |
| `src/lib/queries/dashboard-stats.ts`                                 | Dashboard aggregation queries                             | ORPHANED    | 116 lines, all 3 functions implemented, zero callers                            |
| `src/components/layout/sidebar.tsx`                                  | Updated sidebar with Produtos and Automacoes nav items    | VERIFIED    | Lines 27-28: Package/SlidersHorizontal icons, /produtos and /automacoes routes  |
| `src/app/(dashboard)/produtos/page.tsx`                              | Server page fetching product queue data                   | VERIFIED    | 71 lines, queries offers + dispatch_logs, passes to ProdutosClient              |
| `src/app/(dashboard)/produtos/components/ProdutosClient.tsx`         | Client component with product grid, filters, actions      | VERIFIED    | 390 lines, all required UI elements present                                     |
| `src/app/(dashboard)/produtos/actions.ts`                            | Server actions: sendProduct, clearSentProducts            | VERIFIED    | 191 lines, both actions implemented, revalidatePath called                      |
| `src/app/(dashboard)/automacoes/page.tsx`                            | Server page loading automation rules                      | VERIFIED    | 101 lines, queries automation_rules + dispatch_groups + marketplace_connections |
| `src/app/(dashboard)/automacoes/components/AutomacoesClient.tsx`     | Client component with marketplace automation cards        | VERIFIED    | 515 lines, FetchCard + DispatchCard + MarketplaceSection components             |
| `src/app/(dashboard)/automacoes/actions.ts`                          | Server actions: saveAutomationRule, toggleRule            | VERIFIED    | 94 lines, both exports present, upserts to automation_rules                     |
| `src/app/(dashboard)/page.tsx`                                       | Dashboard with 7-day chart, stats, marketplace bars, WA   | VERIFIED    | 460 lines, all sections rendered, pure CSS bars                                 |
| `trigger/auto-fetch.ts`                                              | Trigger.dev task for automatic product fetching           | VERIFIED    | 141 lines, autoFetchTask with id 'auto-fetch', maxDuration: 600                 |
| `trigger/auto-dispatch.ts`                                           | Trigger.dev task for automatic dispatching                | VERIFIED    | 111 lines, autoDispatchTask with id 'auto-dispatch', dispatchGroup call         |
| `src/app/api/cron/automation/route.ts`                               | Vercel cron endpoint triggering both tasks                | VERIFIED    | 84 lines, GET export, CRON_SECRET auth, tasks.trigger for both task types       |

---

## Key Link Verification

| From                                     | To                          | Via                              | Status      | Details                                                                      |
|------------------------------------------|-----------------------------|----------------------------------|-------------|------------------------------------------------------------------------------|
| `produtos/page.tsx`                      | `lib/queries/products.ts`   | getProductQueue import           | NOT_WIRED   | No import; page queries supabaseAdmin directly — Plan 03 key link missing    |
| `produtos/actions.ts`                    | `src/lib/dispatch.ts`       | dispatchGroup call               | NOT_WIRED   | actions.ts does not import dispatchGroup; reimplements dispatch inline       |
| `automacoes/actions.ts`                  | `automation_rules table`    | supabaseAdmin upsert/update      | WIRED       | Line 31: supabaseAdmin.from('automation_rules').upsert(...)                  |
| `automacoes/page.tsx`                    | `automation_rules table`    | supabaseAdmin select             | WIRED       | Lines 18-27: supabaseAdmin.from('automation_rules').select(...)              |
| `trigger/auto-fetch.ts`                  | `automation_rules table`    | supabaseAdmin query is_active    | WIRED       | Lines 34-39: supabaseAdmin.from('automation_rules').select(...)              |
| `trigger/auto-dispatch.ts`               | `src/lib/dispatch.ts`       | dispatchGroup function call      | WIRED       | Line 6 import, line 96 call: dispatchGroup(group, destinations)              |
| `src/app/api/cron/automation/route.ts`   | `trigger/auto-fetch.ts`     | tasks.trigger('auto-fetch')      | WIRED       | Line 40: tasks.trigger<typeof autoFetchTask>('auto-fetch', ...)              |
| `dashboard/page.tsx`                     | `dispatch_logs table`       | dispatched_date aggregation      | WIRED       | Line 78-82: gte('dispatched_date', sevenDaysAgoStr)                          |
| `dashboard/page.tsx`                     | `offers table`              | supabaseAdmin count queries      | WIRED       | Line 96-97: .from('offers').select('marketplace')                            |
| `dashboard/page.tsx`                     | `whatsapp_instances table`  | supabaseAdmin select status      | WIRED       | Lines 98-102: .from('whatsapp_instances').select('status')                   |

**Note on produtos/actions.ts dispatch pattern:** Plan 03 required `dispatchGroup` import from `src/lib/dispatch`. Instead, actions.ts reimplements the dispatch loop inline (getEvolutionClient + evo.sendText/sendImage + dispatch_log insertion). The behavior is equivalent but the key link is not wired as specified.

---

## Requirements Coverage

| Requirement | Source Plan | Description                                                                           | Status           | Evidence                                                                               |
|-------------|------------|----------------------------------------------------------------------------------------|------------------|----------------------------------------------------------------------------------------|
| PROD-01     | 03-03      | /produtos lista todos os produtos com status                                           | SATISFIED        | page.tsx fetches all offers + dispatch_logs, renders ProdutosClient with status map    |
| PROD-02     | 03-03      | Filtro por marketplace, status e busca por nome                                        | SATISFIED        | ProdutosClient.tsx: statusFilter, marketplaceFilter, search state + useMemo filtering |
| PROD-03     | 03-03      | Cada produto: imagem, nome, preço, desconto%, badge marketplace, status, link afiliado | SATISFIED        | ProductCard component: img, title, price, discount badge, status chip, ExternalLink   |
| PROD-04     | 03-03      | Usuário envia produto individual via "Enviar agora"                                    | SATISFIED        | sendProduct action: queries groups, builds NormalizedOffer, sends via Evolution API    |
| PROD-05     | 03-01      | Status pending/sent/failed per produto with dispatch timestamp                         | SATISFIED        | statusMap built from dispatch_logs in page.tsx; ProductItem.status typed               |
| PROD-06     | 03-03      | "Limpar enviados" remove produtos enviados da fila                                     | SATISFIED        | clearSentProducts: deletes offers with sent dispatch_logs today                        |
| AUTO-01     | 03-04      | /automacoes mostra regras busca automática e disparo por marketplace                   | SATISFIED        | AutomacoesClient: MARKETPLACES.map -> MarketplaceSection with FetchCard + DispatchCard |
| AUTO-02     | 03-04      | Intervalo de busca (2h/4h/6h/12h/24h), ativo/inativo                                  | SATISFIED        | FETCH_INTERVALS constant, FetchCard toggle + select                                    |
| AUTO-03     | 03-04      | Disparo: intervalo (5-30min), janela horária, grupos destino, ativo/inativo            | SATISFIED        | DISPATCH_INTERVALS, start_hour/end_hour selects, compatibleGroups selector            |
| AUTO-04     | 03-05      | Toggle salvo no banco, respeitado por Trigger.dev tasks                                | SATISFIED        | saveAutomationRule upserts; auto-dispatch checks is_active + time window               |
| AUTO-05     | 03-04      | Stats: pendentes, buscados hoje, último disparo                                        | SATISFIED        | AutomacoesClient stats row: pending, fetchedToday, lastDispatchAt                     |
| AUTO-06     | 03-04      | "Como funciona" inline per regra                                                       | SATISFIED        | details/summary in MarketplaceSection with explanatory text for both rule types        |
| DASH-01     | 03-02      | Gráfico barras "Últimos 7 dias" disparos por dia                                       | SATISFIED        | chartDays + pure CSS height % bars, "Ultimos 7 dias" heading present                  |
| DASH-02     | 03-02      | Produtos por marketplace com barra de progresso proporcional                           | SATISFIED        | marketplaceCounts + MARKETPLACE_BAR_COLORS horizontal bars                             |
| DASH-03     | 03-02      | Card "Instância WhatsApp" status de conexão                                            | SATISFIED        | whatsapp_instances query + connected/disconnected rendering with MessageCircle icon    |
| DASH-04     | 03-02      | Stats gerais: Total, Enviados, Pendentes, Sucesso, Falhas                              | SATISFIED        | 5 stat cards in grid-cols-5: totalOffers, todaySent, pendingCount, todaySent, todayFailed |

All 16 requirement IDs from Plans 01-05 are satisfied at the feature level.

---

## Anti-Patterns Found

| File                                         | Issue                                                                                          | Severity | Impact                                                                                      |
|----------------------------------------------|-----------------------------------------------------------------------------------------------|----------|---------------------------------------------------------------------------------------------|
| `src/lib/queries/products.ts`                | Module fully implemented but zero functional callers — dead code                              | WARNING  | Maintenance risk: two diverging query implementations if pages change their inline queries  |
| `src/lib/queries/automation.ts`              | Functions unused; only the type is imported — dead code except type                           | WARNING  | Same risk as above                                                                          |
| `src/lib/queries/dashboard-stats.ts`         | Module fully implemented but zero callers — dead code                                         | WARNING  | Same risk as above                                                                          |
| `src/app/(dashboard)/produtos/actions.ts`    | sendProduct reimplements dispatch loop inline instead of using dispatchGroup from lib/dispatch | WARNING  | Logic duplication: changes to dispatch.ts will not be reflected in sendProduct              |
| `src/app/(dashboard)/automacoes/actions.ts`  | toggleRule is exported but never called (AutomacoesClient only uses saveAutomationRule)       | INFO     | Dead export — minor; no functional impact                                                   |

No blocker-severity anti-patterns found. The goal is functionally achieved despite the orphaned helper layer.

---

## Human Verification Required

### 1. Automation toggle persistence

**Test:** Navigate to /automacoes, toggle "Busca Automatica" on for Amazon, reload the page.
**Expected:** Toggle remains on; automation_rules row for user/amazon/fetch has is_active=true.
**Why human:** Requires live Supabase connection with populated automation_rules table.

### 2. Individual product dispatch

**Test:** Navigate to /produtos with at least one pending product and an active dispatch group. Click "Enviar agora".
**Expected:** Toast shows "Produto enviado para N destino(s)!", dispatch_log created with status='sent', product status chip changes to "Enviado" after revalidation.
**Why human:** Requires live Evolution API, active WhatsApp instance, and connected marketplace.

### 3. Cron automation trigger

**Test:** Call GET /api/cron/automation with correct Authorization: Bearer {CRON_SECRET} header.
**Expected:** Response body: { ok: true, hour: N, fetchTriggered: N, dispatchTriggered: N } where N > 0 when active rules exist in correct time window.
**Why human:** Requires Trigger.dev project wired and active automation rules in DB.

### 4. Auto-fetch task execution

**Test:** Trigger autoFetchTask via Trigger.dev dashboard with a valid ruleId for an active fetch rule.
**Expected:** Task fetches pages 1-3 from marketplace connector, upserts offers to DB, updates products_found_today in automation_rules.
**Why human:** Requires Trigger.dev project, valid marketplace credentials, and connector implementations.

---

## Gaps Summary

The phase goal is **functionally achieved** — all 16 requirements are satisfied and the user-facing behavior described in the phase goal is implemented. However, there is a structural gap: the query helper layer introduced in Plan 01 (`src/lib/queries/products.ts`, `automation.ts`, `dashboard-stats.ts`) was intended as the shared data access layer but was bypassed in the implementation. All pages and actions query Supabase directly via `supabaseAdmin`.

This creates three related issues:

1. **Dead code risk:** Three modules (328 lines combined) implement correct query logic that no production code calls. Any future changes to query patterns would need to be made in two places.

2. **Key link gap for produtos/page.tsx:** Plan 03 declared that `page.tsx` would import `getProductQueue`. The page instead duplicates the join logic inline. The behavior is identical but the declared interface contract is not honored.

3. **Dispatch reimplementation in sendProduct:** Plan 03 required `dispatchGroup` from `lib/dispatch` to be used. Instead, `actions.ts` reimplements the evolution API sending loop inline. This means dispatch behavior changes in `lib/dispatch` will not automatically apply to manual sends from the produtos page.

None of these gaps block the user goal, but they create technical debt that should be resolved (either wire the helpers or remove them and document the inline approach as intentional).

---

_Verified: 2026-03-17_
_Verifier: Claude (gsd-verifier)_
