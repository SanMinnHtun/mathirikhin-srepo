# CareAI QA Checklist

**Status:** Active  
**Version:** 1.0  
**Last Updated:** 2026-08-08  
**Related:** [Testing Strategy](./testing-strategy.md), [Definition of Done](../14-development/definition-of-done.md)

## Auth and profile

- [ ] Google login, cancellation, logout, and session refresh
- [ ] New-user and existing-user redirects
- [ ] Profile validation, save failure, and refresh behavior

## Vitals, dashboard, history

- [ ] Valid/invalid vital submission and duplicate click
- [ ] Deterministic score boundary cases
- [ ] Reading saves with deterministic insight and an accurate Spark-mode AI-disabled notice
- [ ] Latest reading, score, trends, insight, history ordering, pagination

## Security and UX

- [ ] User A cannot read/write User B data
- [ ] OpenRouter/Admin secrets and API-base configuration absent from browser bundle/logs
- [ ] Firestore/Storage rules deployed and tested
- [ ] Requested responsive viewport matrix, keyboard, focus, contrast, reduced motion
- [ ] Loading, empty, permission, network, and AI-error states; no console errors
- [ ] Symptom questionnaire validation, AI result and provider-error dialog, emergency guidance, disclaimer, keyboard operation, and narrow viewport
- [ ] Render symptom API health check, allowed/blocked CORS origins, Vercel base URL, and server-only OpenRouter settings
