---
phase: 03-automacao-fila
plan: "04"
subsystem: automacoes-page
tags: [automation, server-actions, client-components, marketplace, ui]
dependency_graph:
  requires: [03-01]
  provides: [automacoes-page, automation-ui, save-automation-rule-action]
  affects: [dispatch-workers, fetch-workers]
tech_stack:
  added: []
  patterns: [server-actions, use-transition, sonner-toasts, supabase-upsert-on-conflict]
key_files:
  created:
    - src/app/(dashboard)/automacoes/page.tsx
    - src/app/(dashboard)/automacoes/actions.ts
    - src/app/(dashboard)/automacoes/components/AutomacoesClient.tsx
  modified: []
decisions:
  - "Used inline FetchCard and DispatchCard sub-components to keep state isolated per marketplace per rule type"
  - "saveAutomationRule server action handles both create and update via upsert with onConflict"
  - "Group compatibility filter: groups with empty marketplaces array shown for all, otherwise filtered by marketplace key"
metrics:
  duration_seconds: 1888
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 3
  files_modified: 0
---

# Phase 03 Plan 04: Automacoes Page Summary

Per-marketplace automation config UI with fetch and dispatch rules, toggles, intervals, time windows, and group selectors backed by server actions that upsert to automation_rules.

## Tasks Completed

| Task | Name | Commit | Files |
|------|------|--------|-------|
| 1 | Create Automacoes server page and server actions | 8b5677f | actions.ts, page.tsx |
| 2 | Create AutomacoesClient component with marketplace automation cards | bc38b47 | AutomacoesClient.tsx |

## What Was Built

### Server Layer (page.tsx + actions.ts)

- `page.tsx`: Server component that fetches automation_rules (with group name joined), active dispatch_groups, connected marketplaces via marketplace_connections, and computes stats (pending products, fetched today, last dispatch timestamp). Passes all to AutomacoesClient.

- `actions.ts`: Two server actions:
  - `saveAutomationRule`: Upserts to automation_rules with `onConflict: 'user_id,marketplace,rule_type'`. Handles fetch and dispatch rules. Calls revalidatePath.
  - `toggleRule`: Updates is_active for a specific rule ID (user-scoped). Calls revalidatePath.

### Client Layer (AutomacoesClient.tsx)

- Header with title and subtitle
- Stats row (3 cards): Pendentes (amber), Buscados hoje (emerald), Ultimo disparo (indigo)
- 4 marketplace sections: Amazon BR, Mercado Livre, Shopee, AliExpress
  - Disconnected marketplace: shows "Nao conectado" with link to /marketplaces
  - Connected marketplace: shows FetchCard + DispatchCard in lg:grid-cols-2
  - FetchCard: toggle switch + interval select (2h/4h/6h/12h/24h) + last run + products found today
  - DispatchCard: toggle switch + interval select (5/10/15/20/30 min) + time window selects + group selector
  - "Como funciona?" collapsible details/summary section
- Toggle buttons: role="switch" aria-checked, bg-indigo-600/bg-zinc-700 colors
- All selects styled: bg-zinc-800 border-zinc-700 rounded-lg text-zinc-200
- useTransition for non-blocking save + sonner toast feedback

## Deviations from Plan

None - plan executed exactly as written.

## Self-Check: PASSED

- src/app/(dashboard)/automacoes/page.tsx — FOUND
- src/app/(dashboard)/automacoes/actions.ts — FOUND
- src/app/(dashboard)/automacoes/components/AutomacoesClient.tsx — FOUND
- Commit 8b5677f — FOUND
- Commit bc38b47 — FOUND
