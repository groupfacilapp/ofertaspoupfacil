# DisparaZap — Roadmap

## Milestone 1: MVP

### Phase 1: Foundation ✓
**Goal:** Authentication, database schema with tenant isolation, credential encryption, and Trigger.dev worker running.
**Status:** PASSED (2026-03-16)
**Requirements:** AUTH-01, AUTH-02, AUTH-03, AUTH-04

### Phase 2: Marketplace Connectors ✓
**Goal:** The system can fetch deals from all 4 marketplaces and generate per-user affiliate links using stored credentials.
**Status:** PASSED (2026-03-16)
**Requirements:** MKT-01, MKT-02, MKT-03, MKT-04, MKT-05, FETCH-01 through FETCH-11

### Phase 3: Automacao & Fila de Produtos
**Goal:** Users can see all collected products in a queue, configure automatic fetch and dispatch rules per marketplace with time windows, and view a rich dashboard with 7-day activity charts and per-marketplace stats.
**Status:** Planning
**Requirements:** PROD-01, PROD-02, PROD-03, PROD-04, PROD-05, PROD-06, AUTO-01, AUTO-02, AUTO-03, AUTO-04, AUTO-05, AUTO-06, DASH-01, DASH-02, DASH-03, DASH-04
**Plans:** 5/5 plans complete

Plans:
- [ ] 03-01-PLAN.md — DB migration (automation_rules), query helpers, sidebar nav update
- [ ] 03-02-PLAN.md — Dashboard enhancements: 7-day chart, stats cards, marketplace bars, WA status
- [ ] 03-03-PLAN.md — Produtos page: product queue grid with filters, send, and clear actions
- [ ] 03-04-PLAN.md — Automacoes page: per-marketplace fetch/dispatch rule configuration
- [ ] 03-05-PLAN.md — Auto-fetch and auto-dispatch Trigger.dev tasks with cron orchestration

### Phase 4: Cupons & Engajamento
**Goal:** Users can fetch and dispatch ML affiliate coupons automatically. "Reaja e Receba" sends coupon DMs to group members who react to messages, with AI-generated coupon images and 24h cooldown.
**Status:** Future
**Requirements:** TBD
