---
gsd_state_version: 1.0
milestone: v1.0
milestone_name: milestone
current_phase: 4
current_plan: Not started
status: unknown
last_updated: "2026-03-17T23:47:48.394Z"
progress:
  total_phases: 4
  completed_phases: 3
  total_plans: 9
  completed_plans: 9
---

# DisparaZap — Project State

**Last Updated:** 2026-03-17
**Current Phase:** 4
**Current Plan:** Not started
**Milestone:** MVP
**Last Session:** 2026-03-17T23:39:49.897Z

## Completed Phases

| Phase | Name | Status | Date |
|-------|------|--------|------|
| 1 | Foundation | ✓ PASSED | 2026-03-16 |
| 2 | Marketplace Connectors | ✓ PASSED | 2026-03-16 |
| 3 | Automacao Fila | ✓ PASSED | 2026-03-17 |

## Key Decisions

- **Stack:** Next.js 15 App Router, Supabase (auth + DB + RLS), Trigger.dev (background jobs), Tailwind CSS
- **Auth:** Supabase Auth with server-side session management via middleware
- **DB:** PostgreSQL with RLS — every table scoped to `auth.uid()`
- **Encryption:** AES-256-GCM for all marketplace credentials and channel config
- **Connectors:** Registry pattern — getConnector(marketplace) factory, 4 connectors (Amazon, ML, Shopee, AliExpress)
- **Admin:** Separate (admin) route group, `app_metadata.is_admin` for auth
- **Plans:** `user_plans` table with free/pro tiers, `PLAN_LIMITS` constants
- **Dispatch:** `dispatch_groups` table with template variants (---separator), `dispatch_logs` for history
- **Dashboard:** Pure CSS bar charts via inline style height % (no recharts); JS-side date bucketing for 7-day aggregation; pending count approximated as totalOffers - sentToday
- **Query helpers:** Status computed in memory from separate offers + dispatch_logs queries (not SQL JOIN); one module per domain in src/lib/queries/
- **automation_rules:** rule_type column ('fetch'|'dispatch') separates fetch vs dispatch automation in one table; UNIQUE (user_id, marketplace, rule_type)
- **AutomacoesClient:** Inline FetchCard and DispatchCard sub-components for isolated state per marketplace per rule type; saveAutomationRule handles create+update via upsert onConflict
- **Produtos page dispatch:** sendProduct builds NormalizedOffer from DB row to reuse formatMessage for consistent manual+auto dispatch message formatting
- **Produtos page status:** Status computed server-side via statusMap from dispatch_logs, pre-annotated products array passed to ProdutosClient
- **Automation engine:** auto-fetch and auto-dispatch Trigger.dev tasks; cron at /api/cron/automation triggers both; interval+BRT-time-window checks in both cron and task layers; relative import for trigger/ (outside src/ tsconfig @/* alias)

## Tech Stack

- **Frontend:** Next.js 15, React 19, Tailwind CSS, Lucide React, Sonner (toasts)
- **Backend:** Next.js Server Actions, Trigger.dev tasks
- **DB:** Supabase (PostgreSQL + RLS + realtime)
- **Auth:** Supabase Auth
- **Testing:** Vitest (46 tests passing)
- **Deployment:** Vercel (Next.js) + Supabase hosted

## Current DB Tables

- `marketplace_connections` — per-user marketplace credentials (encrypted)
- `whatsapp_channels` — per-user WhatsApp instance config (encrypted)
- `dispatch_groups` — groups config with template, marketplace, filters
- `group_destinations` — WA group JID targets per dispatch group
- `dispatch_logs` — history of every sent message
- `offers` — upserted offers from marketplace connectors (NormalizedOffer)
- `user_plans` — plan tier per user (free/pro)
- `planos_sistema` — plan definitions for pricing page
- `automation_rules` — per-user per-marketplace automation config (fetch + dispatch rules)

## Supabase Project

- Project ID: see `.env.local`
- Migrations in: `supabase/migrations/`
