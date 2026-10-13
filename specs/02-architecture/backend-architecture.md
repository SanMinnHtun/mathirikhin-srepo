# CareAI Backend Architecture

**Status:** Inactive in Spark mode
**Version:** 1.1
**Last Updated:** 2026-08-15
**Related:** [System Architecture](./system-architecture.md), [OpenRouter](../06-ai/openrouter.md), [Security](../10-security/security.md)

## Active deployment

The Spark-plan application has no deployed application backend or Cloud Function. Firebase Authentication establishes identity and Cloud Firestore security rules authorize and validate direct browser operations. `firebase.json` intentionally contains no Functions deployment target.

## Retained reference implementation

`backend/` contains two separate server entry points. The prior Firebase Functions API, Firebase Admin persistence, and retry implementation remain inactive reference code. `src/render-server.ts` is a Node/Express web service for the symptom analyzer and can be deployed to Render; it uses the shared handler in `src/symptoms-api-server.ts`, verifies Firebase ID tokens, reads server-only OpenRouter settings, and applies an exact origin allowlist. It does not activate or deploy the Firebase Functions API.

The frontend sends authenticated symptom requests to `VITE_CAREAI_API_BASE_URL`, which defaults to a local Render-service URL for development and is set to the deployed Render origin in Vercel. The same validation and OpenRouter handler is shared with the frontend's test module.

## Requirement

**CARE-ARCH-001 — P0 / REPLACED FOR SPARK MODE:** Profile and vital persistence use direct authenticated Firestore access with strict owner/shape/limit/deterministic-result rules. Trusted server-side AI and repeated application validation are deferred. A future AI reactivation must use a protected server and must not expose provider secrets in the browser.
