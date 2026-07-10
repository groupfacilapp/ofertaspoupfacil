---
phase: 03-automacao-fila
plan: 02
subsystem: ui
tags: [dashboard, next.js, supabase, tailwind, lucide-react, dark-theme]

# Dependency graph
requires:
  - phase: 03-automacao-fila
    provides: dispatch_logs table with dispatched_date column for 7-day chart
  - phase: 02-marketplace-connectors
    provides: offers table with marketplace column for product distribution
  - phase: 01-foundation
    provides: whatsapp_instances table and supabaseAdmin client

provides:
  - Enhanced dashboard page with 7-day CSS bar chart
  - 5-card stats row (Total Produtos, Enviados hoje, Pendentes, Sucesso, Falhas)
  - Products-per-marketplace horizontal progress bars
  - WhatsApp instance connection status card with quick stats

affects: [future-reporting, analytics, user-onboarding]

# Tech tracking
tech-stack:
  added: []
  patterns:
    - Pure CSS bar charts via inline style height percentage (no recharts)
    - Promise.all parallel data fetching in server components
    - JS-side date bucketing for 7-day aggregation from raw dispatch_logs rows

key-files:
  created: []
  modified:
    - src/app/(dashboard)/page.tsx

key-decisions:
  - "Used JS-side bucketing for 7-day chart instead of SQL GROUP BY — simpler and avoids dialect issues with Supabase PostgREST"
  - "Pending count estimated as (totalOffers - sentToday) — pragmatic approximation, no per-offer join needed"
  - "Bar chart uses h-32 flex items-end container with percentage height on inner div for pure CSS bars"

patterns-established:
  - "Bar chart pattern: flex items-end container + style={{ height: pct% }} on colored div"
  - "Stats card pattern: rounded-xl border border-zinc-800/60 bg-zinc-900/60 p-4 with icon pill top-right"
  - "Section pattern: overflow-hidden card with px-5 py-4 border-b header + p-5 body"

requirements-completed: [DASH-01, DASH-02, DASH-03, DASH-04]

# Metrics
duration: 15min
completed: 2026-03-17
---

# Phase 3 Plan 02: Dashboard Rebuild Summary

**Server component dashboard rebuilt with 7-day CSS bar chart, 5-stat cards, per-marketplace product progress bars, and WhatsApp connection status — no external chart libraries**

## Performance

- **Duration:** ~15 min
- **Started:** 2026-03-17T00:00:00Z
- **Completed:** 2026-03-17T00:15:00Z
- **Tasks:** 1/1
- **Files modified:** 1

## Accomplishments

- 7-day dispatch bar chart using pure CSS height percentages, bucketed in JS from raw dispatch_logs rows
- 5-card stats grid: Total Produtos (offers count), Enviados hoje, Pendentes, Sucesso, Falhas — all via parallel Promise.all queries
- Products per Marketplace section with colored horizontal bars (orange/yellow/red/rose per marketplace)
- WhatsApp Instance card showing connected/disconnected state with animated pulse dot and quick stats (groups + marketplaces)
- Kept existing "Proximos passos" setup wizard for users who haven't completed onboarding

## Task Commits

1. **Task 1: Rewrite dashboard with 7-day chart, rich stats, marketplace bars, and WA status** - `b8d61fc` (feat)

**Plan metadata:** (docs commit — see below)

## Files Created/Modified

- `src/app/(dashboard)/page.tsx` — Full rewrite: 460 lines, server component with 7 parallel supabaseAdmin queries and rich dark-theme UI

## Decisions Made

- Used JS-side date bucketing for the 7-day chart: fetch all matching rows, then fill a 7-slot array. Avoids needing SQL GROUP BY through PostgREST.
- Pending count approximated as `max(0, totalOffers - sentToday)` — good enough for dashboard overview without a complex anti-join.
- Chart bars: `flex items-end` parent + `style={{ height: \`${pct}%\` }}` on inner colored div. Zero-count days show a 4px stub for visual presence.
- WhatsApp status reads the `status` field from `whatsapp_instances` — connected when `status === 'connected'`.

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered

None.

## User Setup Required

None - no external service configuration required.

## Next Phase Readiness

- Dashboard is now a rich operational overview ready for real dispatch data
- Chart will populate automatically as dispatch_logs are created by automation tasks
- WhatsApp status card will update live once instances are connected via /canais

---
*Phase: 03-automacao-fila*
*Completed: 2026-03-17*
