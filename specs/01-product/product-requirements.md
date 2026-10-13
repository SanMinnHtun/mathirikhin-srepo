# CareAI Product Requirements

**Status:** Active  
**Version:** 1.0  
**Last Updated:** 2026-08-10
**Related:** [User Flows](./user-flows.md), [Acceptance Criteria](./acceptance-criteria.md), [AI Safety](../06-ai/ai-safety.md)

## Purpose, users, and problem

CareAI helps an adult user record common vital measurements, review simple trends, and receive informational—not diagnostic—context. It is for people who want a lightweight personal log, not a clinical record system, emergency service, or medical-device replacement.

## Scope and non-goals

The MVP covers identity, a lightweight profile, vital entry, deterministic score, informational insight, dashboard, history, and responsive UI. It does not diagnose disease, prescribe treatment, support clinician workflows, replace emergency care, ingest medical records, or guarantee medical safety.

## Requirements

### CARE-PROD-001 — Record five vital inputs

**Priority:** P0  
**Status:** IMPLEMENTED  
**Acceptance:** [AC-VITAL-001](./acceptance-criteria.md#ac-vital-001)

The user can enter systolic, diastolic, heart rate, oxygen saturation, and temperature, with units and client-side technical validation.

### CARE-PROD-002 — Deterministic health score

**Priority:** P0  
**Status:** IMPLEMENTED  
**Acceptance:** [AC-SCORE-001](./acceptance-criteria.md#ac-score-001)

The same five valid inputs must produce the same score and status. The current deterministic implementation is documented in [Health Score](../05-vitals/health-score.md).

### CARE-PROD-003 — Google/Firebase sign-in

**Priority:** P0  
**Status:** IMPLEMENTED IN CODE; NOT DEPLOYED / E2E VERIFIED
**Acceptance:** [AC-AUTH-001](./acceptance-criteria.md#ac-auth-001)

Firebase Authentication observes session state and uses Google popup sign-in with a blocked-popup redirect fallback. Live project/provider setup and E2E acceptance remain outstanding.

### CARE-PROD-004 — New-user profile onboarding

**Priority:** P0  
**Status:** IMPLEMENTED IN CODE; NOT DEPLOYED / E2E VERIFIED
**Acceptance:** [AC-PROFILE-001](./acceptance-criteria.md#ac-profile-001)

The frontend writes profiles directly under the authenticated UID with server timestamps and `profileCompleted: true`; Firestore rules repeat the field/type/range checks and only completed profiles unlock protected routes.

### CARE-PROD-005 — Persist private user data

**Priority:** P0  
**Status:** IMPLEMENTED IN CODE; NOT DEPLOYED / E2E VERIFIED
**Acceptance:** [AC-SEC-001](./acceptance-criteria.md#ac-sec-001)

Owner-scoped Firestore paths and authenticated direct writes are implemented. Strict Firestore rules validate permitted fields and deterministic results. Browser localStorage no longer stores private profile/vital records; rules deployment and ownership acceptance remain outstanding.

### CARE-PROD-006 — Informational AI insight

**Priority:** P0  
**Status:** PARTIAL IN SPARK MODE
**Acceptance:** [AC-AI-001](./acceptance-criteria.md#ac-ai-001)

OpenRouter analysis is optional in the active Spark-compatible architecture. Firestore remains the persistence and authorization boundary, while the browser may call the protected frontend server route `POST /api/vitals/analyze` only when `VITE_CAREAI_AI_ANALYSIS_ENABLED=true` is set. That server route may call OpenRouter with server-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`; browser-only/static hosting falls back to clearly labeled deterministic range-based insights. The inactive Cloud Functions backend remains available for a future billing-enabled deployment.

### CARE-PROD-007 — Dashboard and recent trends

**Priority:** P1  
**Status:** IMPLEMENTED IN CODE; NOT DEPLOYED / E2E VERIFIED
**Acceptance:** [AC-DASH-001](./acceptance-criteria.md#ac-dash-001)

The dashboard uses a bounded owner-scoped Firestore query with distinct loading, empty, query-failure, and deterministic-insight states.

### CARE-PROD-008 — Health history

**Priority:** P1  
**Status:** IMPLEMENTED IN CODE; NOT DEPLOYED / E2E VERIFIED
**Acceptance:** [AC-HISTORY-001](./acceptance-criteria.md#ac-history-001)

History uses direct newest-first Firestore queries, 7/30-day filters, owner-scoped detail lookup, and timestamp/document-ID cursor pagination.

### CARE-PROD-009 — Responsive, accessible interaction

**Priority:** P0  
**Status:** IMPLEMENTED  
**Acceptance:** [AC-UI-001](./acceptance-criteria.md#ac-ui-001)

The project uses responsive Tailwind classes, labels, focus states, live status, and reduced-motion CSS. Formal accessibility testing remains [NOT VERIFIED](../11-ui/accessibility.md).

### CARE-PROD-010 — Public marketing page uses demo-only data

**Priority:** P1  
**Status:** IMPLEMENTED  
**Acceptance:** [AC-UI-002](./acceptance-criteria.md#ac-ui-002)

The landing page’s previews are static demo content and must never load an authenticated user’s health data.

### CARE-PROD-011 — Senior-friendly symptom checker

**Priority:** P1  
**Status:** IMPLEMENTED IN CODE; PROVIDER / PRIVACY / CLINICAL REVIEW PENDING  
**Acceptance:** [AC-SYMPTOM-001](./acceptance-criteria.md#ac-symptom-001)

An authenticated user can complete an accessible symptom questionnaire and receive a structured informational summary. Every valid analysis requires a successful OpenRouter response through the protected same-origin server route. Missing provider configuration, provider errors, and invalid or unsafe output return an error and do not present general guidance as AI analysis. Server-side urgency and emergency guidance remain independent of model output. This feature is not a diagnosis or emergency service and is not production-ready pending clinical and privacy review.

## Non-functional requirements

- Protect identifiers, profile data, vital readings, and AI outputs from other users.
- Never expose OpenRouter or Firebase Admin secrets to browser bundles.
- Keep UI useful at documented mobile, tablet, and desktop breakpoints.
- Use ordinary, cautious medical-information language and present the disclaimer wherever insights are shown.
