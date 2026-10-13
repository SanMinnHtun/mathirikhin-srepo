# CareAI Frontend Architecture

**Status:** Active  
**Version:** 1.1
**Last Updated:** 2026-08-15
**Related:** [System Architecture](./system-architecture.md), [Design System](../11-ui/design-system.md)

## Actual structure

- `src/routes`: file routes for public, onboarding, dashboard, vital entry, profile, and history views.
- `src/lib/auth-context.tsx`: Firebase Authentication session context and one-time legacy local-data cutover.
- `src/lib/firebase-client.ts`: browser-only Auth/Firestore initialization and emulator wiring.
- `src/lib/firestore-service.ts`: authenticated owner-path profile/vital reads and writes, bounded queries, pagination, and Firestore mapping.
- `src/lib/profile-context.tsx`: direct Firestore-backed profile state.
- `src/lib/vitals.ts`: deterministic score/status/range insight; `vitals-store.ts`: immutable submission adapter.
- `src/hooks/use-vitals.ts`: React Query dashboard/history/detail hooks.
- `src/routes/symptoms.tsx` and `src/components/SeniorSymptomChecker.tsx`: protected symptom questionnaire and accessible result dialog.
- `src/lib/symptoms-api-server.ts`: same-origin request validation, required server-only OpenRouter call for valid requests, output validation, and deterministic urgency/emergency guidance.

`__root.tsx` supplies React Query, `AuthProvider`, `ProfileProvider`, and the toast host. `ProtectedRoute` gates authenticated/profile-complete app pages and wraps them in `AppShell`.

## State and data — IMPLEMENTED IN CODE, NOT DEPLOYED

Firebase Auth supplies identity. Profile and vital operations use direct Firestore calls under `users/{currentUid}`. React Query owns dashboard, paginated history, and detail state. Private profile/vital records are not persisted in app localStorage; Firestore's default in-memory web cache is used.

## Boundaries

Components do not construct Firestore paths or accept a caller-selected UID. The service reads the current Firebase user, security rules independently require the same UID, and rules validate every mutable field. OpenRouter and Firebase Admin modules are never imported into browser code. Visual components receive mapped records and clearly label local range-based insights.
