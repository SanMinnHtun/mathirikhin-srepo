# CareAI

CareAI is a health-vitals and symptom guidance web app built with TanStack Start, React, Firebase Authentication, and Cloud Firestore. It provides informational insights only; it does not diagnose or replace professional medical advice.

## Project layout

- `frontend/` — TanStack Start app, UI, Firebase Auth/Firestore client, and optional server routes for vitals/chat.
- `backend/` — Node/Express symptom API for Render, shared symptom validation/provider logic, and an inactive Firebase Cloud Functions reference implementation.
- `specs/` — product and engineering requirements.

The symptom API is `POST /api/symptoms/analyze-senior`, served by `backend/src/render-server.ts`. The frontend sends a Firebase ID token and calls the public URL configured in `VITE_CAREAI_API_BASE_URL`. The Render service verifies the token, validates the request and provider response, and assigns urgency independently of the model.

## Requirements

- Node.js 22.13 or newer
- npm

## Run locally

From the repository root:

```sh
npm ci --prefix frontend
npm ci --prefix backend
```

Create a local environment file from the example, then fill in Firebase web-app settings:

```sh
cp frontend/.env.example frontend/.env.local
```

In `frontend/.env.local`, set the `VITE_FIREBASE_*` values. For the local Firebase emulators, keep `VITE_USE_FIREBASE_EMULATORS=true` and start the configured emulators. To connect to Firebase directly, set it to `false`.

Set `VITE_CAREAI_API_BASE_URL=http://localhost:10000` for the local backend. Copy `backend/.env.example` to `backend/.env`, then configure its OpenRouter key/model, Firebase Admin service-account values, and `CAREAI_ALLOWED_ORIGINS=http://localhost:8080`. Do not commit either `.env` file.

To enable the separate vitals AI feature locally, add this to `frontend/.env.local`:

```dotenv
VITE_CAREAI_AI_ANALYSIS_ENABLED=true
```

For symptom analysis, `OPENROUTER_API_KEY` and `OPENROUTER_MODEL` belong in `backend/.env`. Never rename the key with a `VITE_` prefix, put it in source control, or expose it to browser code. Restart the servers after changing environment variables.

Start the backend and frontend in separate terminals:

```sh
npm start --prefix backend
npm run dev --prefix frontend
```

## Deploy the frontend to Vercel and symptom API to Render

This repository is set up for a Vercel frontend and a separate Render Node API. The Render API is JavaScript/TypeScript; it is not a Python service.

### Render API

1. In Render, choose **New > Web Service**, connect `SanMinnHtun/mathirikhin-srepo`, and select the `main` branch. Choose the **Free** compute plan. Render's Free plan is available for Web Services; it has usage limits and spins down after inactivity. See [Render's free instance details](https://render.com/docs/free).
2. Configure the service:

   | Setting | Value |
   | --- | --- |
   | Runtime | Node |
   | Root Directory | `backend` |
   | Build Command | `npm ci && npm run build` |
   | Start Command | `npm start` |
   | Health Check Path | `/healthz` |

3. Add these environment variables in the service's **Environment** settings:

   | Variable | Value |
   | --- | --- |
   | `OPENROUTER_API_KEY` | OpenRouter key; secret |
   | `OPENROUTER_MODEL` | Model ID available to the OpenRouter account |
   | `OPENROUTER_SITE_URL` | Vercel production URL |
   | `OPENROUTER_APP_NAME` | `CareAI` |
   | `FIREBASE_PROJECT_ID` | Firebase project ID |
   | `FIREBASE_CLIENT_EMAIL` | Firebase service-account email |
   | `FIREBASE_PRIVATE_KEY` | Firebase service-account private key |
   | `CAREAI_ALLOWED_ORIGINS` | Exact Vercel origin, e.g. `https://your-app.vercel.app` |

   Firebase Admin values are used only to verify Firebase ID tokens. Store them in Render; do not commit them. If the private key is pasted as one line, preserve escaped `\\n` line breaks.

4. After deployment, copy the Render service origin, such as `https://careai-symptom-api.onrender.com`.

### Vercel frontend

1. Import `SanMinnHtun/mathirikhin-srepo` from GitHub into Vercel and deploy the `main` branch.
2. Keep **Root Directory** at the repository root (`.`). The root `vercel.json` contains frontend install/build commands. Select the TanStack Start framework preset if Vercel does not detect it. Use Node.js 22 or newer.
3. Add these variables in Vercel **Project Settings → Environment Variables**:

   | Variable | Value |
   | --- | --- |
   | `VITE_CAREAI_API_BASE_URL` | Render service origin from the previous step |
   | `VITE_USE_FIREBASE_EMULATORS` | `false` in production |
   | `VITE_FIREBASE_*` | Firebase web app configuration values |

   `VITE_CAREAI_API_BASE_URL` is public. Do not add `OPENROUTER_API_KEY` to Vercel for the symptom API; the key belongs in Render. `VITE_CAREAI_AI_ANALYSIS_ENABLED=true` and a server-only OpenRouter key on Vercel are optional if you also want the separate vitals AI route.

4. Add the production Vercel domain to Firebase Authentication's authorized domains.
5. Redeploy after setting variables, then test Firebase sign-in and the symptom analyzer. Check the Render health endpoint at `/healthz` and confirm the symptom request returns a validated result.

Create the OpenRouter key in the OpenRouter account dashboard and save it directly in the Render secret field. The plaintext key is shown only once; consider setting a usage limit.

## Checks

Run these from the repository root:

```sh
npm run typecheck --prefix frontend
npm run lint --prefix frontend
npm run test:ai --prefix frontend
npm run build --prefix frontend
```

## Safety and privacy

- OpenRouter requests are made from server code. The provider receives only the validated symptom selections needed for the analysis; identity details are not included.
- The app assigns symptom urgency independently of model output and validates provider output before display.
- Results are informational guidance, not medical diagnosis or treatment. Seek professional care for urgent or worsening symptoms.
- Avoid using real patient data during development and deployment testing.

## Python FastAPI symptom analyzer (Render)

This branch also includes the Python analyzer in `app/`. It is a separate FastAPI service from the Node API described above. The current web frontend still uses the Node API; deploying this Python service alone does not switch the frontend to it.

To deploy the Python analyzer on Render, create a **Web Service** for this repository and select branch `thedeployready`. Leave **Root Directory** blank so Render runs from the repository root. Use:

| Setting | Value |
| --- | --- |
| Runtime | Python 3 |
| Build Command | `pip install -r backend/requirements.txt` |
| Start Command | `uvicorn app.main:app --host 0.0.0.0 --port $PORT` |
| Health Check Path | `/health` |

Add `GEMINI_API_KEY` in the Render service's Environment settings. Keep the key secret; do not commit it or put it in a `VITE_` variable. The API includes `POST /api/symptoms/analyze` and `POST /api/symptoms/analyze-senior`.

For local Python development, install `backend/requirements.txt`, set `GEMINI_API_KEY` in a root `.env` file (or your shell environment), and run `uvicorn app.main:app --reload`. The root `.env` is ignored by Git.
