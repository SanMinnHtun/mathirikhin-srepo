# CareAI OpenRouter Specification

**Status:** Active
**Version:** 1.0  
**Last Updated:** 2026-08-10
**Related:** [AI Analysis](./ai-analysis.md), [AI Output Schema](./ai-output-schema.md), [Security](../10-security/security.md)

## Current state — OPTIONAL PROTECTED SERVER ROUTES

The browser never calls OpenRouter directly and never receives its API key. When hosted on a protected frontend server runtime, `POST /api/vitals/analyze`, `POST /api/care-ai/chat`, and `POST /api/symptoms/analyze-senior` use server-only `OPENROUTER_API_KEY` and `OPENROUTER_MODEL`. Every valid symptom analysis requires provider settings and validated model output; missing settings or invalid/unavailable provider output returns an error without presenting fallback content as an analysis. The route assigns urgency independently of the model and adds deterministic emergency guidance to valid AI output when required. The prior Cloud Functions implementation remains under `backend/` but is absent from `firebase.json` and unused by the app.

The CareAI chat route accepts health and healthcare questions only, while allowing brief greetings, thanks, and polite acknowledgments. The provider prompt handles topic scope and returns exactly `ask only about health ` for unrelated requests. Do not gate health questions on a fixed keyword list; many valid health questions do not contain the word “health.”

## Target provider contract

Provider: OpenRouter. Endpoint: `POST https://openrouter.ai/api/v1/chat/completions`. The protected backend, never the browser, holds and sends `Authorization: Bearer <OPENROUTER_API_KEY>`.

Required server-only configuration: `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`. Optional: `OPENROUTER_REASONING_MAX_TOKENS`, `OPENROUTER_SITE_URL`, `OPENROUTER_APP_NAME`. `OPENROUTER_REASONING_MAX_TOKENS` is sent only from the protected server route as OpenRouter `reasoning.max_tokens`; supported values are `-1` for dynamic model-selected reasoning, `0` to disable reasoning, or `1` through `24576` for a fixed token budget. Reasoning traces are excluded from provider responses and are never rendered or persisted. The browser gate `VITE_CAREAI_AI_ANALYSIS_ENABLED=true` may be public, but it must not contain a provider secret. Do not document, commit, bundle, log, or expose actual secret values.

For local development, put provider values in the active app's ignored `frontend/.env.local`. The Vite config loads only the named server settings into the dev server's `process.env`; it does not define or expose those values in the client bundle. Restart Vite after changing this file. The symptom result reports a safe `analysis_status` so missing configuration, provider authentication/quota/model errors, and invalid output can be distinguished without exposing raw provider responses.

**CARE-AI-001 — P0 / PARTIAL IN SPARK MODE:** Browser code must never receive `OPENROUTER_API_KEY`. OpenRouter may be called only by the protected frontend server route or a future backend. Missing configuration returns the safe unavailable fallback.
