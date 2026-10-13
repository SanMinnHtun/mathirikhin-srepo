# CareAI User Flows

**Status:** Active  
**Version:** 1.0  
**Last Updated:** 2026-08-10
**Related:** [Authentication](../03-auth/authentication.md), [User Profile](../04-profile/user-profile.md), [Vital Tracker](../05-vitals/vital-tracker.md)

## Current implementation note

The route sequence below is implemented with Firebase identity and direct Firestore profile access. Firestore rules/provider deployment and browser E2E acceptance remain outstanding.

## New user flow

```mermaid
flowchart TD
  L[Landing] --> LI[Login]
  LI --> G[Google via Firebase]
  G --> A[Authenticated user]
  A --> C{Profile exists?}
  C -->|No| CP[/create-profile]
  CP --> S[Save profile]
  S --> D[/dashboard]
  C -->|Yes| D
```

Current routes are `/`, `/login`, `/create-profile`, and `/dashboard`. Only an owner-readable Firestore profile reporting `profileCompleted: true` bypasses onboarding.

## Existing user flow

```mermaid
flowchart LR
  G[Firebase Google sign-in] --> P{Firestore profile complete?}
  P -->|Exists| D[/dashboard]
```

## Vital flow

```mermaid
flowchart TD
  D[Dashboard] --> V[/add]
  V --> E[Enter five readings]
  E --> FV[Frontend validation]
  FV --> HS[Deterministic Health Score]
  HS --> RV[Firestore rule validation]
  RV --> WR[Save owner-scoped reading]
  WR --> DI[Show deterministic range insight]
  DI --> D
```

Current behavior is `client validate/score → Firestore rules validate owner, fields, limits, and exact score → immutable write → query refresh → deterministic insight`. A transaction and immutable idempotency-key document ID prevent duplicate submissions.

## History flow

```mermaid
flowchart LR
  D[Dashboard] --> H[/history]
  H --> Q[Newest-first readings]
  Q --> R[Expand reading and its deterministic insight]
```

The direct Firestore implementation supports All, 7 Days, and 30 Days filters plus cursor pages of 20 owner-scoped readings.

## Symptom-check flow

```mermaid
flowchart TD
  A[Authenticated app] --> S[/symptoms]
  S --> Q[Complete symptom questionnaire]
  Q --> API[Same-origin server validation]
  API -->|Provider available| AI[Validated informational OpenRouter content]
  API -->|Emergency/provider unavailable| G[Deterministic safe guidance]
  AI --> R[Urgency, summary, red flags, actions, disclaimer]
  G --> R
```

Questionnaire answers remain on the page while the result dialog is open and when the user returns to edit. Only body areas, sensations, severity, and duration may be sent to OpenRouter; urgency remains server-controlled.

## Logout flow

Firebase `signOut()` clears the session and React Query cache before protected routing returns to `/login`. Legacy local profile/vital keys are removed during the one-time cutover and on logout.
