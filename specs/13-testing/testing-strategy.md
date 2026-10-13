# CareAI Testing Strategy

**Status:** Planned  
**Version:** 1.0  
**Last Updated:** 2026-08-10
**Related:** [QA Checklist](./qa-checklist.md), [Health Score](../05-vitals/health-score.md)

## Current state

**PARTIAL.** Frontend AI contract tests and backend suites cover the inactive protected implementation for regression/reference safety. The active Firestore rules suite covers owner/cross-owner access, validated profile writes, exact deterministic vital results, immutable records, invalid limits, forged scores, mismatched IDs, and emergency results. Direct Firestore browser integration, components, E2E, and manual release checks remain outstanding.

## Target priorities

Unit-test score boundaries/determinism, vital validation, cursor/date filters, and mapping. Integration-test Firebase auth redirects, Firestore ownership/validation rules, profile writes, vital submission, immutable duplicate prevention, and Spark-mode insight behavior. Component-test errors, loading/empty states, accessible selectors, and charts. End-to-end-test Google auth (test environment), onboarding, dashboard, history, logout, and failure cases. Run manual viewport, keyboard, screen-reader, reduced-motion, and console checks for each release.

The symptom route is covered for validated OpenRouter output, minimal provider context, provider use during emergency escalation, clear errors for missing configuration and provider failures, unsafe-output rejection, and invalid/cross-origin input. Browser accessibility, live-provider behavior, clinical escalation review, privacy review, and E2E checks remain outstanding.
