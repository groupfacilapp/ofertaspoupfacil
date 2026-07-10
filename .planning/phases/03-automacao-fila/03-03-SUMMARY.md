---
phase: 03-automacao-fila
plan: "03"
subsystem: ui
tags: [next.js, react, supabase, tailwind, server-actions, sonner, lucide-react]

# Dependency graph
requires:
  - phase: 03-automacao-fila/03-01
    provides: getProductQueue, clearSentProducts query helpers, offers table schema, dispatch_logs with dispatched_date

provides:
  - /produtos page: filterable product grid with send/clear actions
  - ProdutosClient component: filter tabs, search, stats row, product cards with marketplace badges
  - sendProduct server action: validates ownership, finds active groups, dispatches via Evolution API
  - clearSentProducts server action: deletes today's sent offers from queue

affects: [04-integracao, dispatch-flow, product-queue]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Server page fetches offers + dispatch_logs separately; status computed in memory via statusMap"
    - "Client component receives pre-computed status array; no additional fetches needed"
    - "sendProduct builds NormalizedOffer from DB row to reuse formatMessage from dispatch.ts"
    - "Marketplace-color mapping via MARKETPLACE_COLOR record for badge styling"
    - "Disabled send button shows contextual text: 'Enviado' | 'Configure um grupo primeiro' | 'Enviar agora'"

key-files:
  created:
    - src/app/(dashboard)/produtos/page.tsx
    - src/app/(dashboard)/produtos/actions.ts
    - src/app/(dashboard)/produtos/components/ProdutosClient.tsx

key-decisions:
  - "sendProduct builds NormalizedOffer from DB row, reusing formatMessage for message formatting consistency"
  - "Status computed server-side in page.tsx (not in client) to avoid double-fetching"
  - "hasGroups flag passed as prop to toggle send button state without extra client-side query"
  - "clearSentProducts in actions.ts delegates to supabaseAdmin directly (mirrors query helper logic)"

patterns-established:
  - "Product status: computed from dispatch_logs statusMap in server page, passed as pre-annotated array"
  - "Send action: validates ownership -> finds groups -> builds NormalizedOffer -> dispatch via Evolution API"

requirements-completed: [PROD-01, PROD-02, PROD-03, PROD-04, PROD-06]

# Metrics
duration: 32min
completed: 2026-03-17
---

# Phase 3 Plan 03: Produtos Page Summary

**Filterable product queue page with per-card send/clear actions dispatching via Evolution API to active groups**

## Performance

- **Duration:** 32 min
- **Started:** 2026-03-17T22:53:11Z
- **Completed:** 2026-03-17T23:24:46Z
- **Tasks:** 2
- **Files modified:** 3

## Accomplishments

- Server page fetches up to 200 offers + today's dispatch_logs, computes per-offer status (pending/sent/failed) and passes annotated product array to client
- ProdutosClient renders responsive product grid (1/2/3-col) with filter tabs (status + marketplace), search input, stats row, and marketplace-colored badges
- sendProduct server action validates ownership, finds active groups matching the offer's marketplace, builds NormalizedOffer from DB row, sends via Evolution API with image fallback to text, logs dispatch_logs
- clearSentProducts deletes sent offers from queue using today's dispatch_logs, cascades to clean dispatch_logs

## Task Commits

Each task was committed atomically:

1. **Task 1: Create Produtos server page and server actions** - `0cf0f15` (feat)
2. **Task 2: Create ProdutosClient component with product grid, filters, and actions** - `b4570bd` (feat)

## Files Created/Modified

- `src/app/(dashboard)/produtos/page.tsx` - Server component; fetches offers + dispatch_logs, computes status, renders ProdutosClient
- `src/app/(dashboard)/produtos/actions.ts` - sendProduct (validate, find groups, Evolution dispatch) + clearSentProducts (delete sent offers)
- `src/app/(dashboard)/produtos/components/ProdutosClient.tsx` - Client component with filter tabs, search, stats row, product grid, send/clear action handlers with sonner toasts

## Decisions Made

- sendProduct builds NormalizedOffer from DB row to reuse formatMessage from dispatch.ts for consistent message formatting across manual and automated dispatches
- Status computed server-side in page.tsx via statusMap (offer_id -> 'sent'|'failed'), not in client component, to avoid extra client-side DB queries
- hasGroups flag passed as prop to disable/relabel send button without requiring client-side query
- clearSentProducts action mirrors query helper pattern directly via supabaseAdmin for simplicity

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None - TypeScript check passed cleanly with no errors.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- /produtos page fully functional for PROD-01 through PROD-04 and PROD-06 requirements
- Manual send flow (sendProduct) tested via TypeScript; requires live Evolution API to test end-to-end dispatch
- Foundation ready for phase 04 integration work

---
*Phase: 03-automacao-fila*
*Completed: 2026-03-17*
