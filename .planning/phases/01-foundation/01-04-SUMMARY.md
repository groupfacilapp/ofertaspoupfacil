---
phase: 01-foundation
plan: "04"
subsystem: auth
tags: [encryption, aes-256-gcm, credentials, trigger-dev, env-validation, zod]

# Dependency graph
requires:
  - phase: 01-foundation
    provides: "crypto.ts AES-256-GCM encrypt/decrypt and env.ts Zod validation"
provides:
  - "credentials service layer (saveMarketplaceCredentials, loadMarketplaceCredentials, saveChannelConfig, loadChannelConfig) wiring encrypt/decrypt to DB column write/read paths"
  - "trigger.config.ts reading project ID from TRIGGER_PROJECT_ID env var — no literal placeholder"
  - "TRIGGER_PROJECT_ID entry in .env.example for developer onboarding"
affects:
  - server-actions
  - marketplace-connections
  - channel-connections
  - trigger-worker

# Tech tracking
tech-stack:
  added: []
  patterns:
    - "Side-effect import of env.ts enforces Zod validation at module load time"
    - "Thin serialize-then-encrypt / decrypt-then-deserialize service layer for DB credential columns"
    - "TDD: write failing test → implement → verify green before committing"

key-files:
  created:
    - src/lib/credentials.ts
    - src/__tests__/credentials.test.ts
  modified:
    - trigger.config.ts
    - .env.example

key-decisions:
  - "Used side-effect import (`import '@/lib/env'`) rather than named import — env value not needed at runtime, only validation side-effect is required"
  - "Used `?? ''` fallback for TRIGGER_PROJECT_ID — SDK validates at connection time, not import time, giving a clearer error than a JS crash on undefined"
  - "Kept credentials.ts as pure utility with no Supabase client — actual DB writes belong in server actions (future plans)"
  - ".env.local is gitignored so only trigger.config.ts and .env.example committed; .env.local updated locally"

patterns-established:
  - "Credential write path: JSON.stringify -> encrypt() -> store in TEXT column"
  - "Credential read path: fetch TEXT column -> decrypt() -> JSON.parse"

requirements-completed: [AUTH-03, AUTH-04]

# Metrics
duration: 5min
completed: 2026-03-16
---

# Phase 1 Plan 04: Credentials Service and Trigger Config Gap Closure Summary

**AES-256-GCM credential service wiring crypto.ts into DB column write/read paths, plus Trigger.dev project ID moved from hardcoded placeholder to TRIGGER_PROJECT_ID env var**

## Performance

- **Duration:** ~5 min
- **Started:** 2026-03-16T21:49:00Z
- **Completed:** 2026-03-16T21:51:40Z
- **Tasks:** 2 (Task 1 via TDD: 3 commits; Task 2: 1 commit)
- **Files modified:** 4 (src/lib/credentials.ts created, src/__tests__/credentials.test.ts created, trigger.config.ts modified, .env.example modified)

## Accomplishments
- Created `src/lib/credentials.ts` exporting four functions that serialize-encrypt / decrypt-deserialize credential objects for both `marketplace_connections.encrypted_credentials` and `channel_connections.encrypted_config` columns
- Wired `env.ts` import as side-effect so ENCRYPTION_KEY Zod validation fires at module load time — AUTH-03 satisfied
- Replaced `'<TRIGGER_PROJECT_REF>'` literal in trigger.config.ts with `process.env.TRIGGER_PROJECT_ID ?? ''` — AUTH-04 satisfied
- Added TRIGGER_PROJECT_ID to .env.example (with dashboard link comment) and .env.local for developer onboarding
- All 5 credential tests pass (two round-trips, tamper detection, type-width, format checks)

## Task Commits

Each task was committed atomically:

1. **Task 1 RED — failing tests for credentials service** - `423926e` (test)
2. **Task 1 GREEN — credentials service implementation** - `555aef2` (feat)
3. **Task 2 — trigger.config.ts placeholder and env files** - `2d6f5d7` (fix)

_Note: TDD task produced two commits (test → feat). No refactor step needed — implementation was already clean._

## Files Created/Modified
- `src/lib/credentials.ts` - Credential service: saveMarketplaceCredentials, loadMarketplaceCredentials, saveChannelConfig, loadChannelConfig; imports env.ts (side-effect) and crypto.ts
- `src/__tests__/credentials.test.ts` - 5 Vitest tests covering round-trips, tamper detection, type width, and output format
- `trigger.config.ts` - project field changed from `'<TRIGGER_PROJECT_REF>'` to `process.env.TRIGGER_PROJECT_ID ?? ''`
- `.env.example` - Added TRIGGER_PROJECT_ID entry with dashboard comment

## Decisions Made
- Used side-effect import of env.ts (`import '@/lib/env'`) rather than `import { env }` — the env object is not needed in the module body, only the Zod parse side-effect is. This is explicit about intent.
- Used `?? ''` fallback for TRIGGER_PROJECT_ID in trigger.config.ts — the Trigger.dev SDK validates this when it attempts to connect, not at config parse time. An empty string produces a clear SDK error rather than a cryptic `undefined` JavaScript crash.
- Credentials module is intentionally Supabase-free — it is a pure utility. DB writes happen in server actions (future plans).

## Deviations from Plan

None - plan executed exactly as written.

## Issues Encountered
- `.env.local` is gitignored (correct behavior for secrets files) — only trigger.config.ts and .env.example were committed. The .env.local file was updated locally and its content is correct for the developer environment.

## User Setup Required
Set `TRIGGER_PROJECT_ID` in your `.env.local`:
```
TRIGGER_PROJECT_ID=your_actual_project_slug
```
Find the value in: Trigger.dev dashboard -> Project Settings.

## Next Phase Readiness
- AUTH-03 and AUTH-04 are now addressable by the verifier
- `src/lib/credentials.ts` is ready to be called from server actions when implementing marketplace and channel connection write/read flows
- crypto.ts is no longer an orphaned module — it has a production caller
- env.ts is no longer an orphaned module — it is enforced at credentials module load time

---
*Phase: 01-foundation*
*Completed: 2026-03-16*

## Self-Check: PASSED

- src/lib/credentials.ts: FOUND
- src/__tests__/credentials.test.ts: FOUND
- .planning/phases/01-foundation/01-04-SUMMARY.md: FOUND
- commit 423926e: FOUND
- commit 555aef2: FOUND
- commit 2d6f5d7: FOUND
