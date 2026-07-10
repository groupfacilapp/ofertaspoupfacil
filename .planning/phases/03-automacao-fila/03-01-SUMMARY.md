---
phase: 03-automacao-fila
plan: 01
subsystem: database
tags: [supabase, postgresql, rls, queries, sidebar, lucide-react]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: Supabase client setup, RLS pattern, dispatch_groups table
  - phase: 02-marketplace-connectors
    provides: offers table, dispatch_logs table, NormalizedOffer type
provides:
  - automation_rules table with RLS and unique constraint per user/marketplace/rule_type
  - getProductQueue, getProductStats, markProductsSent, clearSentProducts query helpers
  - getAutomationRules, upsertAutomationRule, toggleAutomationRule query helpers
  - getDashboardStats, getLast7DaysDispatches, getProductsPerMarketplace query helpers
  - Sidebar updated with Produtos (/produtos) and Automacoes (/automacoes) nav items
affects:
  - 03-automacao-fila (all subsequent plans depend on these query helpers)

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Query helpers: all use supabaseAdmin (service role), take userId as first param, throw on error"
    - "Status computation: cross-reference offers with today's dispatch_logs in memory (not SQL JOIN)"
    - "automation_rules upsert: onConflict user_id,marketplace,rule_type for idempotent configuration"

key-files:
  created:
    - supabase/migrations/20260318000000_automation_rules.sql
    - src/lib/queries/products.ts
    - src/lib/queries/automation.ts
    - src/lib/queries/dashboard-stats.ts
  modified:
    - src/components/layout/sidebar.tsx

key-decisions:
  - "Status computed in memory: fetch offers + today's dispatch_logs separately, build Set of dispatched IDs — avoids complex LEFT JOIN in Supabase query builder"
  - "getLast7DaysDispatches initializes all 7 days with 0 before filling — ensures gapless chart data"
  - "automation_rules uses rule_type ('fetch' | 'dispatch') to separate concerns within one table"

patterns-established:
  - "Query module pattern: one file per domain (products, automation, dashboard-stats), all server-side only"
  - "clearSentProducts deduplicates offer IDs via Set before DELETE — avoids redundant DB calls"

requirements-completed: [PROD-05]

# Metrics
duration: 15min
completed: 2026-03-17
---

# Phase 3 Plan 01: Foundation Layer — DB Schema, Query Helpers, Navigation

**automation_rules table with RLS + three query helper modules (products/automation/dashboard) + Produtos and Automacoes sidebar nav items**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-17T20:46:05Z
- **Completed:** 2026-03-17T20:58:00Z
- **Tasks:** 2
- **Files modified:** 5

## Accomplishments

- Created `automation_rules` migration with per-user per-marketplace per-rule_type uniqueness, RLS policies, and indexes
- Built three query helper modules covering product queue status, automation rule CRUD, and dashboard aggregations
- Extended sidebar with Produtos and Automacoes nav items using Package and SlidersHorizontal icons

## Task Commits

Each task was committed atomically:

1. **Task 1: automation_rules migration and query helpers** - `3fe09ef` (feat)
2. **Task 2: Add Produtos and Automacoes to sidebar navigation** - `c45234a` (feat)

**Plan metadata:** (docs commit below)

## Files Created/Modified

- `supabase/migrations/20260318000000_automation_rules.sql` - automation_rules table, RLS, UNIQUE (user_id, marketplace, rule_type), indexes
- `src/lib/queries/products.ts` - getProductQueue, getProductStats, markProductsSent, clearSentProducts
- `src/lib/queries/automation.ts` - getAutomationRules, upsertAutomationRule, toggleAutomationRule
- `src/lib/queries/dashboard-stats.ts` - getDashboardStats, getLast7DaysDispatches, getProductsPerMarketplace
- `src/components/layout/sidebar.tsx` - Added Package, SlidersHorizontal imports + two new navItems

## Decisions Made

- Status computation for product queue done in memory (fetch offers + fetch today's dispatch_logs separately, build Set of dispatched IDs) rather than a LEFT JOIN — Supabase query builder makes cross-table computed columns awkward; this is cleaner and performant for the 100-row limit.
- `getLast7DaysDispatches` initializes all 7 days with 0 count before filling from DB results — guarantees gapless array for chart rendering downstream.
- `automation_rules` uses a `rule_type` column (`fetch` | `dispatch`) instead of separate tables — keeps configuration centralized with one upsert path.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None — TypeScript compilation passed cleanly with no errors.

## User Setup Required

Run the migration against the Supabase project to create the `automation_rules` table:

```bash
supabase db push
```

Or apply via the Supabase dashboard SQL editor.

## Next Phase Readiness

- All query helpers are ready for consumption by Phase 3 UI plans (produtos page, automacoes page)
- Sidebar navigation already shows the new routes — pages can be built independently
- `automation_rules` table ready for Trigger.dev job integration in later plans

---
*Phase: 03-automacao-fila*
*Completed: 2026-03-17*
