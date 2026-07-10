---
phase: 03-automacao-fila
plan: "05"
subsystem: automation-engine
tags: [trigger.dev, cron, automation, fetch, dispatch, brt-timezone]
dependency_graph:
  requires: ["03-01", "03-03", "03-04"]
  provides: ["auto-fetch-task", "auto-dispatch-task", "cron-automation-endpoint"]
  affects: ["automation_rules", "offers", "dispatch_logs"]
tech_stack:
  added: []
  patterns:
    - "Trigger.dev task with maxDuration 600 and retry config for long-running automation"
    - "BRT timezone enforcement via (UTC - 3 + 24) % 24"
    - "Interval gate: compare last_run_at to interval_minutes before triggering"
    - "Type-only imports for Trigger.dev task typing in cron route"
    - "Relative import path for trigger/ files (outside src/ tsconfig @/* alias scope)"
key_files:
  created:
    - trigger/auto-fetch.ts
    - trigger/auto-dispatch.ts
    - src/app/api/cron/automation/route.ts
  modified:
    - src/app/api/cron/dispatch/route.ts
decisions:
  - "Used relative import (../../../../../trigger/) instead of @/trigger/ because tsconfig @/* maps to src/* only"
  - "Interval and time-window checks duplicated in both cron route (fast filter) and Trigger.dev task (authoritative check) for defense-in-depth"
  - "dispatch.ts imported directly in auto-dispatch — env vars available in Trigger.dev context"
  - "products_found_today reset logic: compare products_found_reset_at date to today, reset counter if new day"
metrics:
  duration: "~3 minutes"
  completed_date: "2026-03-17"
  tasks_completed: 2
  files_created: 3
  files_modified: 1
---

# Phase 03 Plan 05: Automation Engine (auto-fetch + auto-dispatch tasks) Summary

Automation engine tasks for background product fetching and dispatching via Trigger.dev, orchestrated by a Vercel cron endpoint.

## What Was Built

Two Trigger.dev background tasks and a cron API route that form the core automation loop:

- **trigger/auto-fetch.ts** — `autoFetchTask` (id: `auto-fetch`): loads an automation_rule, verifies it is active and a fetch rule, checks interval elapsed since `last_run_at`, fetches offers from marketplace connector (pages 1-3), upserts to `offers` table, updates `last_run_at` and `products_found_today` (with daily reset logic).

- **trigger/auto-dispatch.ts** — `autoDispatchTask` (id: `auto-dispatch`): loads an automation_rule, verifies it is active and a dispatch rule, checks interval elapsed, enforces BRT time window (`brtHour < start_hour || brtHour >= end_hour`), loads dispatch_group and group_destinations, calls `dispatchGroup()` from `@/lib/dispatch`, updates `last_run_at`.

- **src/app/api/cron/automation/route.ts** — `GET /api/cron/automation`: protected by `CRON_SECRET` bearer token, computes current BRT hour, queries all active fetch/dispatch rules, applies interval and time-window filters in-process (fast pre-filter), triggers eligible rules as Trigger.dev background tasks, returns `{ ok, hour, fetchTriggered, dispatchTriggered }`.

- **src/app/api/cron/dispatch/route.ts** — Legacy cron updated with comment noting this is the schedule_hours-based approach, preserved for backward compatibility.

## Deviations from Plan

### Auto-fixed Issues

**1. [Rule 1 - Bug] FetchConfig.page is required field**
- **Found during:** TypeScript verification after Task 1
- **Issue:** `FetchConfig` interface has `page: number` as a required field, but the initial config object in `auto-fetch.ts` omitted it
- **Fix:** Added `page: 1` to the base fetchConfig object (the loop overrides it with `{ ...fetchConfig, page }`)
- **Files modified:** trigger/auto-fetch.ts
- **Commit:** cb4846a

**2. [Rule 3 - Blocking] @/trigger/ path alias does not resolve**
- **Found during:** Task 2 TypeScript check
- **Issue:** tsconfig `@/*` paths maps to `./src/*` only, but `trigger/` directory is at project root (outside `src/`). Type imports `from '@/trigger/auto-fetch'` failed with TS2307.
- **Fix:** Changed type-only imports in cron route to use relative path `../../../../../trigger/auto-fetch`
- **Files modified:** src/app/api/cron/automation/route.ts
- **Commit:** cb4846a

## Self-Check: PASSED

All files exist and commits are verified:
- trigger/auto-fetch.ts: FOUND
- trigger/auto-dispatch.ts: FOUND
- src/app/api/cron/automation/route.ts: FOUND
- Commit 5cda9a5 (Task 1): FOUND
- Commit cb4846a (Task 2): FOUND
