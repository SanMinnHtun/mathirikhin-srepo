# CareAI Backend Architecture

**Status:** Inactive in Spark mode
**Version:** 1.1
**Last Updated:** 2026-08-15
**Related:** [System Architecture](./system-architecture.md), [OpenRouter](../06-ai/openrouter.md), [Security](../10-security/security.md)

## Active deployment

The Spark-plan application has no deployed application backend or Cloud Function. Firebase Authentication establishes identity and Cloud Firestore security rules authorize and validate direct browser operations. `firebase.json` intentionally contains no Functions deployment target.

## Retained reference implementation

`backend/` still contains the prior regional HTTPS API, Firebase Admin validation/persistence, OpenRouter normalization, durable idempotency, and retry implementation. It is not imported or called by the frontend and is not eligible for the selected no-billing deployment. Its tests remain useful reference coverage for a future protected server.

The active frontend server also exposes `POST /api/symptoms/analyze-senior`. It validates questionnaire input, requires OpenRouter through server-only credentials for each valid analysis, assigns urgency independently of model output, and returns an error when provider configuration or output is unavailable. This route is not part of static Firebase Hosting.

## Requirement

**CARE-ARCH-001 — P0 / REPLACED FOR SPARK MODE:** Profile and vital persistence use direct authenticated Firestore access with strict owner/shape/limit/deterministic-result rules. Trusted server-side AI and repeated application validation are deferred. A future AI reactivation must use a protected server and must not expose provider secrets in the browser.
