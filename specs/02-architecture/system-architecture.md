# CareAI System Architecture

**Status:** Active  
**Version:** 1.1
**Last Updated:** 2026-08-15
**Related:** [Frontend](./frontend-architecture.md), [Backend](./backend-architecture.md), [Security](../10-security/security.md)

## Current Spark architecture — FIRESTORE DEPLOYED, FRONTEND E2E PENDING

The active application uses Firebase Authentication and direct Cloud Firestore access from the React frontend. Every private path is rooted under the current Firebase user's UID. Security rules enforce owner access, exact profile/vital fields, technical vital limits, immutable readings, server timestamps, and the deterministic score/status/emergency result. A one-time cutover clears legacy mock localStorage data without importing it.

```mermaid
flowchart LR
  UI[React / TanStack Start] --> AUTH[Firebase Authentication]
  UI --> SCORE[Deterministic score and range insight]
  UI --> DB[Cloud Firestore]
  AUTH --> RULES[Firestore Security Rules]
  SCORE --> RULES
  RULES --> DB
```

This architecture remains compatible with the Firebase Spark plan because it does not deploy Firebase Cloud Functions. The frontend never contains or calls OpenRouter with a secret. Optional OpenRouter analysis requires hosting the frontend with a protected server runtime that owns `OPENROUTER_API_KEY`; otherwise the UI labels its local result as rule-based.

The symptom-check page sends Firebase-authenticated requests to the standalone Node/Express Render service using the public `VITE_CAREAI_API_BASE_URL`. The service verifies the ID token, applies an exact CORS allowlist, and requires OpenRouter with server-only credentials for every valid analysis. When provider settings or output are unavailable, it returns an error without an analysis result; server-side emergency escalation remains authoritative.

## Inactive backend

`backend/` retains the Firebase Functions/Admin/OpenRouter path as inactive reference code and adds a separate Render HTTP server for the symptom API. The Firebase Functions path remains absent from `firebase.json` and is not called by the active frontend.

## Remaining gap

Firestore rules/indexes are deployed to the default database in `care-ai-4eb8d`, and the focused rules-emulator suite passes. Auth Google-provider/browser setup, frontend deployment of this branch, and end-to-end verification remain outstanding. Direct writes make deployed rule integrity a release-critical control.
