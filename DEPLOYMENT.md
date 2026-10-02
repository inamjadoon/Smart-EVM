# Deploying SmartEVM for free (no credit card)

**Stack:** **Vercel Hobby** (API + website) · **Neon** (PostgreSQL, already in use) · **Groq** (LLM, already in use).
All three are free and need no card.

```
 Browser ──► https://smartevm.vercel.app        (Vercel project #1: frontend/, static React build)
                 │  fetch + JWT
                 ▼
            https://smartevm-api.vercel.app     (Vercel project #2: repo root → index.py → backend/fastapi_app.py)
                 │                    │
                 ▼                    ▼
        Neon Postgres (us-east-2)   Groq API (LLM agents)
```

## What gets deployed (and what doesn't)

| Folder | Deployed? | How |
|---|---|---|
| `frontend/` | Yes | Static Vite build on Vercel project #1 |
| `backend/` | Yes | FastAPI as one Vercel Python function. `index.py` at the repo root imports `backend/fastapi_app.py`. |
| `ai/genai`, `ai/config.py` | Yes, as part of the API | Used by the AI assistant |
| `backend/ml_data/*_v2.csv` | Yes, as part of the API | The ML endpoints train small models from these files on first use |
| `ML/`, `ai/training`, `ai/models`, `ai/data` | No (`.vercelignore`) | Offline research and training scripts. The live app doesn't use them. |
| `venv/`, `node_modules/`, `.env` files | Never | Secrets go into Vercel's **Environment Variables** screen instead |

## Why Vercel and not the others (checked Sep 2026)

| Option | Problem for this project |
|---|---|
| Render, Koyeb, Railway, Fly.io, GCP/AWS/Azure/Oracle | Ask for a card, or offer a trial only |
| Hugging Face Spaces | Docker and Gradio Spaces need a PRO plan. Free Static Spaces can't run Python/FastAPI. |
| PythonAnywhere (free) | No ASGI support, so FastAPI doesn't run |
| Back4App / SnapDeploy | Too little RAM (256 MB), or only 100 hours/month |
| Netlify / Cloudflare / GitHub Pages | Fine for the frontend, but can't run this Python backend (pandas/scikit-learn) |
| **Vercel Hobby** | No card. Native FastAPI support, 2 GB RAM, 500 MB Python bundle (we use about 310 MB). A US-East region next to the Neon database. |

**Hobby limits:** non-commercial use only, the API "sleeps" when idle (see [Free-tier caveats](#free-tier-caveats)), and a fair-use bandwidth/compute quota.

---

## Step 0 — Before you start (one time)

1. **Rotate the Neon password.** The old one appears in the early git history.
   1. Open the Neon console → your project → **Branches** → `main` → **Roles & Databases**.
   2. On the role (e.g. `neondb_owner`), choose **Reset password**.
   3. Copy the new **pooled** connection string: **Connect** → toggle **Connection pooling** ON. The host contains `-pooler`, and the string ends with `?sslmode=require`.
   4. Put it in your local `backend/.env` as `DATABASE_URL=...`, and share it privately with teammates.
2. **Generate a production JWT secret.** It must be different from your local one.
   ```bash
   python -c "import secrets; print(secrets.token_urlsafe(48))"
   ```
3. **Make sure your Groq key works:** https://console.groq.com/keys.
4. **Create a Vercel account:** https://vercel.com/signup → **Continue with GitHub** → plan **Hobby**. No card is asked for.

## Step 1 — Push the code to GitHub

Vercel deploys from GitHub. From the repo root:

```bash
git add -A
```
```bash
git status
```
Check that **no `.env` file** is listed. Only `.env.example` files may appear.
```bash
git commit -m "Make the project deployable on Vercel"
```
```bash
git push origin <your-branch>
```
Merge the branch into `main`, because Vercel deploys `main` as "production".

> `git status` now also shows `frontend/src/lib/utils.ts` and `evm.ts`. The old `.gitignore` rule `lib/` was hiding them, so a fresh clone couldn't build. Commit them.

## Step 2 — Deploy the API (Vercel project #1)

1. Vercel dashboard → **Add New… → Project** → **Import** your GitHub repo. If it isn't listed, choose *Adjust GitHub App Permissions* and allow the repo.
2. **Project Name:** `smartevm-api`. This becomes `https://smartevm-api.vercel.app`; add a suffix if the name is taken.
3. **Framework Preset:** `FastAPI`. It is auto-detected from `index.py`; if not, pick it.
   **Root Directory:** leave `./` (the repo root).
4. Open **Environment Variables** and add these. Copy the values from your `backend/.env`, except where the table says otherwise.

   | Name | Value |
   |---|---|
   | `DATABASE_URL` | The **new pooled** Neon string from Step 0 |
   | `GROQ_API_KEY` | Your Groq key |
   | `LLM_MODEL` | `openai/gpt-oss-20b` |
   | `LLM_ROUTER_MODEL` | `qwen/qwen3.8-27b` |
   | `LLM_FALLBACK_MODELS` | `openai/gpt-oss-120b,qwen/qwen3.8-27b` |
   | `JWT_SECRET` | The new secret from Step 0 |
   | `JWT_EXPIRE_MINUTES` | `480` |
   | `ADMIN_EMAIL` | `admin@smartevm.com` (or your admin's email) |
   | `ADMIN_PASSWORD` | *leave empty*. The admin already exists in Neon. |
   | `ALLOW_SIGNUP` | `true` lets visitors register; `false` means only the admin creates users |
   | `DB_POOL_SIZE` | `2`. Each serverless instance keeps a small pool. |
   | `DB_MAX_OVERFLOW` | `3` |
   | `CORS_ORIGINS` | Leave for now; it gets filled in at Step 4 |

5. Click **Deploy** and wait 1–3 minutes.
6. **Test it in the browser:**
   - `https://smartevm-api.vercel.app/health/ready` → `{"status":"ok","database":"ok"}`
   - `https://smartevm-api.vercel.app/docs` → the Swagger page

   The first request after idle takes a few seconds; that's a cold start.
7. **Check the region:** project → **Settings → Functions → Function Region** should say **Cleveland, USA (East) – cle1**. `vercel.json` sets it, and it sits next to Neon's us-east-2.

## Step 3 — Deploy the frontend (Vercel project #2)

1. **Add New… → Project** → import the **same** repo again.
2. **Project Name:** `smartevm`, which gives `https://smartevm.vercel.app`.
3. **Root Directory:** click **Edit** → choose `frontend`.
   **Framework Preset:** `Vite`. The defaults are fine: build `npm run build`, output `dist`.
4. **Environment Variables:**

   | Name | Value |
   |---|---|
   | `VITE_API_BASE_URL` | `https://smartevm-api.vercel.app` (your API URL, **no trailing slash**) |

5. Click **Deploy**.
   `frontend/vercel.json` sends every path to `index.html`, so refreshing on `/dashboard` or `/projects` works.

> `VITE_*` values are baked in at **build** time. If you change one, redeploy the frontend: **Deployments** → ⋯ → **Redeploy**.

## Step 4 — Connect the two (CORS)

The API only accepts browser calls from origins it knows.

1. API project (`smartevm-api`) → **Settings → Environment Variables** → add:
   `CORS_ORIGINS` = `https://smartevm.vercel.app` (your exact frontend URL, no trailing slash; separate several with commas).
2. API project → **Deployments** → latest → ⋯ → **Redeploy**. Environment changes only apply to new deployments.

## Step 5 — Smoke test the live site

Open `https://smartevm.vercel.app` and check:

- [ ] Sign in as the admin → the Dashboard loads its projects. Data comes from Neon.
- [ ] **Admin → Users:** the users list shows; create a manager and a developer.
- [ ] **Manager:** create a project and sprint (with an actual cost), then a task assigned to the developer.
- [ ] **Developer:** **My Tasks** shows only that task; changing its status works.
- [ ] **EVM Dashboard:** figures show; **Save snapshot** works.
- [ ] **ML Predictions** load. The first call is slower because the small models train from `ml_data`.
- [ ] The **AI Assistant** answers "summarize this page" with headings.
- [ ] Refresh the browser on `/projects`; it must not show a 404.

If anything fails, see [Troubleshooting](#troubleshooting).

## Step 6 — Optional polish

- **Faster cold starts:** after the first successful deploy, the database tables are migrated. Add `SKIP_STARTUP_MIGRATIONS=1` to the API project and redeploy. This skips the startup schema checks.
- **Nicer URL:** **Settings → Domains** lets you pick another free `*.vercel.app` name, or attach your own domain. After that, update `CORS_ORIGINS` and `VITE_API_BASE_URL` and redeploy both.
- **Deployment Protection:** Settings → Deployment Protection. Production URLs are public by default, which is what you want. Preview deployments (other branches) need your Vercel login.

## Updating the live app

Every `git push` to `main` redeploys **both** projects automatically. Pushes to other branches create *preview* URLs.

Preview frontends call the production API, which blocks them by CORS unless you add their URL to `CORS_ORIGINS`. That's expected; test locally instead.

---

## Free-tier caveats

| Thing | What to expect |
|---|---|
| **Cold start** | After about 5–15 min idle, the first request takes about 3–8 s. Python loads pandas/scikit-learn, and Neon wakes from scale-to-zero. Later requests are fast. |
| **Vercel Hobby** | Personal, non-commercial projects only. If this becomes a paid product, move to Pro or another host. |
| **Neon free** | 0.5 GB storage and about 100 compute-hours/month per project, which is plenty for a demo. Usage is under Neon → Billing/Usage. |
| **Groq free** | Rate limits per minute and per day. The app already fails over between models. Heavy chat use can still hit limits; the assistant then shows a "try again" message. |
| **Read-only disk** | Serverless functions can't write files (only `/tmp`). The code now tolerates this. Nothing user-facing is stored on disk; everything is in Neon. |

## Troubleshooting

| Symptom | Fix |
|---|---|
| Build log: `No FastAPI entrypoint found` | API project's Root Directory must be `./` (repo root, where `index.py` is) |
| `/health/ready` → `database: error` / 500 | `DATABASE_URL` is wrong or uses the old password. Use the **pooled** string with `?sslmode=require`, then redeploy. |
| Site loads but login says *Network error* / console shows **CORS** | `CORS_ORIGINS` doesn't exactly match the frontend URL (`https`, no trailing `/`). Fix it and redeploy the **API**. |
| Frontend calls `localhost:8000` | `VITE_API_BASE_URL` is missing on the frontend project. Add it and redeploy the **frontend**. |
| Frontend build fails: `Cannot find module '@/lib/utils'` | `frontend/src/lib/` wasn't pushed. Commit it (see Step 1). |
| 404 when refreshing a page | `frontend/vercel.json` is missing from the push |
| AI says the assistant is unavailable | `GROQ_API_KEY` is missing or invalid. Check **API project → Logs**. |
| Logs show `too many connections` | Use the `-pooler` Neon host, and keep `DB_POOL_SIZE=2`, `DB_MAX_OVERFLOW=3` |
| Anything else | API project → **Logs** (runtime errors) or **Deployments → Build Logs** |

## Files added for deployment (reference)

| File | Purpose |
|---|---|
| `index.py` | Vercel entrypoint. Puts `backend/` on the import path and exposes `app`. |
| `vercel.json` | Runs the API in `cle1` (Cleveland), close to Neon us-east-2 |
| `.python-version` | Python 3.12, the same as local |
| `.vercelignore` | Keeps `frontend/`, `ML/`, training data, tests and `venv` out of the API bundle |
| `frontend/vercel.json` | SPA rewrites, so deep links work |
| `frontend/.vercelignore` | The frontend project's own ignore file, so it doesn't inherit the root one |
| `requirements.txt` / `requirements-dev.txt` | Lean runtime dependencies for the server, plus test tools for developers |

Running locally hasn't changed: `cd backend && uvicorn fastapi_app:app --reload` and `cd frontend && npm run dev` (see [README_SETUP.md](README_SETUP.md)).
