# CareAI API Contracts

**Status:** Active Firestore boundary; optional protected AI route
**Version:** 1.1
**Last Updated:** 2026-08-15
**Related:** [Frontend Architecture](../02-architecture/frontend-architecture.md), [Firestore Rules](../10-security/firestore-rules.md)

## Current state

Firebase Authentication and the modular Firestore SDK provide the active persistence boundary. Vitals, profile, and history do not use a custom REST API base URL. The symptom checker uses `VITE_CAREAI_API_BASE_URL` to reach the Render Node API. This public URL is not a provider secret.

## Active data operations

- **Profile:** owner document get, validated transaction create/replace, validated language update.
- **Vitals:** transaction create at an idempotency-key document ID; duplicate same-input submission returns the existing record; different input with the same key fails.
- **Dashboard:** at most 30 newest owner readings.
- **History:** pages of 20 newest owner readings with optional 7/30-day cutoff and `createdAt`/document-ID cursor.
- **Detail:** one owner vital document by validated ID.

The service never accepts a UID parameter. Firestore rules authorize and validate the resulting requests. The old Functions REST code is inactive reference code and must not be described as deployed.

## Symptom analysis route

- **Route:** `POST /api/symptoms/analyze-senior`
- **Authentication:** Firebase ID token in `Authorization: Bearer <token>`; the Render server verifies the token before handling the request.
- **Request:** closed-choice body areas, pain sensations, severity 1–10, duration, gender choice, optional age 1–120, and optional supported response language (`en` or `my`).
- **Provider context:** only body areas, sensations, severity, and duration are sent to OpenRouter from the server. No identity, gender, or age is sent.
- **Response:** successful responses contain urgency and matching badge color assigned by server rules; a `selected_answers` recap; validated AI summary, possible explanations, red flags, and structured recommendations; `analysis_source: openrouter`; and `analysis_status: openrouter`.
- **Provider status:** successful responses identify validated OpenRouter output. Failures return an HTTP error and a safe `analysis_status` identifying missing server configuration, authentication/quota/model/provider errors, invalid provider output, or network timeout/unavailability. The route never returns raw provider error bodies or credentials.
- **Personalization and language:** the provider is instructed to address every selected answer without inventing symptoms or medical history and to respond in the selected supported language. The interface and recap support English and Burmese. The response-language choice is not identity or profile data.
- **Provider requirement:** every valid analysis requires a successful validated provider response. Missing configuration, provider failure, timeout, or invalid/unsafe output returns an HTTP error without an analysis result. Chest pain or severity 8+ still requires provider analysis; deterministic urgency and emergency instructions remain authoritative and are merged into successful AI output.
- **Authentication:** the Render service verifies the Firebase ID token in the `Authorization: Bearer` header. CORS separately permits only exact origins listed in server-only `CAREAI_ALLOWED_ORIGINS`.
- **Safety:** output is informational and not clinically reviewed; the model cannot assign urgency. The route does not read or write health records.
- **Render runtime:** the Node service in `backend/` binds to `0.0.0.0:$PORT`; the frontend sets `VITE_CAREAI_API_BASE_URL` to the public Render origin.

## Optional AI route

- **Route:** `POST /api/vitals/analyze`
- **Request body:** exactly `systolic`, `diastolic`, `heartRate`, `oxygen`, and `temperature` as numeric values inside documented technical limits.
- **Header:** optional `idempotency-key`, 8 to 128 permitted characters, used for warm-instance response reuse only.
- **Success:** returns deterministic `healthScore`, an analysis object, and `analysisStatus: "completed"` when provider output passes normalization.
- **Fallback:** returns `analysisStatus: "failed"` and `AI_ERROR` with safe unavailable copy when server config is missing, the provider fails, output is malformed/unsafe/oversized, urgency conflicts, or a timeout occurs.
- **Privacy:** the provider request contains only the five validated readings, deterministic score, deterministic application urgency, and optional server-only provider controls such as `reasoning.max_tokens`. Reasoning traces are excluded from responses and are not exposed to the browser.
