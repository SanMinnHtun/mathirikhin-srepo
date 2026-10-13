# CareAI Implementation Plan

**Status:** Active  
**Version:** 1.1
**Last Updated:** 2026-08-15
**Related:** [System Architecture](../02-architecture/system-architecture.md), [Testing Strategy](../13-testing/testing-strategy.md)

## P0 — Spark-mode MVP blockers

### TASK-AUTH-001

**Status:** IMPLEMENTED, NOT E2E VERIFIED. Firebase Google Auth, session observation, logout, loading behavior, direct Firestore identity scoping, and emulator support replace mock identity. Google-provider/live-browser verification remains. **Acceptance:** AC-AUTH-001.

### TASK-DB-001

**Status:** FIRESTORE DEPLOYED, BROWSER E2E PENDING. Direct owner-scoped profile/vital reads and writes, strict field/range/deterministic-result rules, immutable idempotent readings, bounded queries, deny-by-default Storage rules, and legacy-local-data cutover are implemented. Firestore rules/indexes are deployed and focused emulator tests pass; authenticated browser and Storage deployment acceptance remain. **Acceptance:** AC-SEC-001.

### TASK-AI-003

**Status:** PARTIAL IN SPARK MODE. OpenRouter remains disabled for browser-only/static Firebase Hosting because that cannot protect its secret. Optional vitals analysis can run through the protected frontend server route when `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and `VITE_CAREAI_AI_ANALYSIS_ENABLED=true` are configured; Firestore still stores deterministic readings only. The symptom analyzer uses the standalone authenticated Render API and server-only OpenRouter config. The inactive Firebase Functions backend remains separate. **Acceptance:** AC-AI-001 partial.

## P1 — Important improvements

- **TASK-DASH-001 / IMPLEMENTED, NOT E2E VERIFIED:** UID-scoped bounded direct Firestore dashboard/history queries and cursor pagination replace API calls.
- **TASK-TEST-001 / PARTIAL:** Deterministic-score and expanded Firestore rule suites exist. Direct SDK integration, Auth/browser E2E, components, and manual QA remain.

## P2 — Post-MVP

- **TASK-AI-SERVER-001 / DEFERRED:** Restore normalized AI only through a protected server with explicit hosting/billing approval.
- **TASK-STORAGE-001 / PLANNED:** Optional validated profile-avatar upload with Storage rules.
- **TASK-OBS-001 / PLANNED:** Privacy-safe monitoring and retention after security review.
