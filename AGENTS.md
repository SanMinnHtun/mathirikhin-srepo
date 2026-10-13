<!-- LOVABLE:BEGIN -->
> [!IMPORTANT]
> This project is connected to [Lovable](https://lovable.dev). Avoid rewriting
> published git history — force pushing, or rebasing/amending/squashing commits
> that are already pushed — as it rewrites history on Lovable's side and the
> user will likely lose their project history.
>
> Commits you push to the connected branch sync back to Lovable and show up in
> the editor, so keep the branch in a working state.
<!-- LOVABLE:END -->

# CareAI Agent Guide

## Required Workflow

1. Read `specs/README.md`, then every feature, architecture, security, data, API,
   testing, and development spec related to the requested change.
2. Inspect the current implementation and `git status` before editing. The
   worktree may contain user or Lovable changes; never revert or commit them.
3. Work on a feature branch and make small, path-scoped commits that leave the
   branch usable.
4. Preserve the deterministic score algorithm and documented technical vital
   limits unless a spec change is explicitly approved.
5. Run narrow tests first, followed by lint and build with the supported
   runtime. Update affected requirement statuses without overstating incomplete
   Firebase or persistence work.

## Repository Layout

- `frontend/`: TanStack Start/React application and the currently runnable API
  route.
- `backend/`: active Render symptom API plus inactive Firebase Cloud Functions
  reference implementation.
- `specs/`: authoritative product and engineering requirements.

The current app still uses mock localStorage identity/profile/vital persistence.
Firebase Authentication, verified ID tokens, owner-scoped Firestore writes, and
deployed Firestore rules are not implemented. Do not describe the app as
production-ready or treat the mock user as an authorization boundary.

## AI Analysis Boundary

- `POST /api/vitals/analyze` is registered in `frontend/src/server.ts` and
  implemented by `frontend/src/lib/vitals-api-server.ts`.
- `POST /api/symptoms/analyze-senior` uses the shared handler in
  `backend/src/symptoms-api-server.ts` and is served by the standalone Render
  server in `backend/src/render-server.ts`. The client sends a Firebase ID token.
- OpenRouter calls must remain server-only. Never import the server AI module
  from a browser component or put `OPENROUTER_API_KEY` in `VITE_*`, source,
  logs, tests, screenshots, specs, or commits.
- Server configuration uses `OPENROUTER_API_KEY`, `OPENROUTER_MODEL`, and the
  optional `OPENROUTER_SITE_URL` / `OPENROUTER_APP_NAME`. Real values belong in
  ignored `frontend/.env.local` for local work and the deployment secret store
  in hosted environments.
- The provider receives only the five validated readings, deterministic health
  score, and deterministic application urgency. Never send names, email, UID,
  avatar, tokens, full profile data, prompts containing identity, or raw errors.
- Deterministic score, status, emergency state, and urgency are authoritative.
  Model output may provide prose and lists only; it must not override them.
- AI output must pass the exact normalized schema and safety checks. Invalid,
  unsafe, oversized, or conflicting output becomes the standard unavailable
  fallback and is never rendered raw.
- Provider failure returns the reading with `analysisStatus: "failed"` and
  `AI_ERROR`; the client saves it locally and shows the unavailable state.
  In-memory idempotency only covers a warm server instance. Durable deduplication,
  authenticated writes, separate analysis documents, and retry jobs still
  require Firebase implementation.
- For Render, keep `OPENROUTER_API_KEY` in Render's server environment, use
  `CAREAI_ALLOWED_ORIGINS` for exact frontend origins, and never put the key in
  `VITE_*` variables.

## Commands And Runtime

Use Node.js 22.13 or newer; current TanStack Start packages do not support Node
18. From `frontend/` run:

```sh
npm run test:ai
npm run lint
npm run build
```

`test:ai` pins its transient `tsx` runner. The repository currently contains
both npm and Bun lockfiles; do not regenerate or mix them incidentally, and do
not include unrelated lockfile changes in a feature commit.

## Completion Checks

- Search tracked files and the built client output for secret patterns before
  committing or deploying.
- Exercise provider success, missing configuration, malformed output, timeout,
  4xx, 5xx retry, conflicting urgency, and duplicate submission behavior.
- Confirm every insight view includes the informational-not-medical disclaimer
  and failure copy states that the reading was saved.
- Keep public landing data static and separate from private/local records.
