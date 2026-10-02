# SmartEVM — Team Setup & Quickstart Guide

This guide contains everything your team needs to run SmartEVM locally on their machines.

---

## ⚠️ Important Note Before Zipping the Project

When creating a `.zip` to share with teammates, **DO NOT include**:
- `venv/` or `.venv/` (Python virtual environments are machine-specific)
- `node_modules/` in `frontend/` (hundreds of MBs and platform-dependent binaries)
- `dist/` in `frontend/`
- `.git/` (if present)

Teammates will generate their own `venv` and `node_modules` in 2 simple commands as shown below.

---

## Prerequisites

1. **Python 3.10+** installed ([python.org](https://www.python.org/downloads/))
2. **Node.js 18+** & npm installed ([nodejs.org](https://nodejs.org/))
3. **Internet connection** (to install packages & access cloud database)

---

## Step 1: Backend Setup (FastAPI + ML + AI)

Open a terminal in the root folder (`smartEVM-main/`):

### 1. Create and Activate Virtual Environment
**Windows (PowerShell):**
```powershell
python -m venv venv
.\venv\Scripts\Activate.ps1
```
*(If PowerShell shows an execution policy error, run: `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass`)*

**macOS / Linux:**
```bash
python3 -m venv venv
source venv/bin/activate
```

### 2. Install All Python Requirements
```bash
pip install --upgrade pip
pip install -r requirements.txt
```

### 3. Environment Variables
Make sure `backend/.env` exists. If not, copy from `backend/.env.example`:
```powershell
# Windows
copy backend\.env.example backend\.env

# macOS / Linux
cp backend/.env.example backend/.env
```

Then set the **authentication** values in `backend/.env`:

| Variable | Purpose |
|---|---|
| `JWT_SECRET` | Signs login tokens. Use a long random value: `python -c "import secrets; print(secrets.token_urlsafe(48))"`. Changing it signs everyone out. |
| `ADMIN_EMAIL` / `ADMIN_PASSWORD` | The bootstrap **Admin** account, created (or re-activated) on every server start. Change the password from the **Account** page after the first sign-in. |
| `JWT_EXPIRE_MINUTES` | Session length (default 480 = 8 hours). |
| `ALLOW_SIGNUP` | `true` lets anyone register (as Developer). `false` = only admins create accounts. |
| `CORS_ORIGINS` | Production only: comma-separated frontend URLs, e.g. `https://app.example.com`. |
| `DB_POOL_SIZE` | Warm DB connections kept open (default 10). Use `0` on serverless hosts. |

### 4. Run the Backend Server
```bash
cd backend
uvicorn fastapi_app:app --reload --port 8000
```
- API Docs (Swagger): **http://127.0.0.1:8000/docs**
- Backend Health Check: **http://127.0.0.1:8000/**

---

## Step 2: Frontend Setup (React + Vite + Tailwind)

Open a **second terminal** and navigate to the `frontend/` directory:

```bash
cd frontend
npm install
npm run dev
```

The frontend app will launch at:
- **http://localhost:8080** (or `http://localhost:5173` depending on port availability)

---

## Step 3: Verify the System

1. Open **http://localhost:8080** in your browser.
2. Go to **Dashboard** / **EVM Dashboard** — select any project to view EVM stats.
3. Go to **Tasks** — you can add/edit tasks with user dropdowns and sprint filtering.
4. Go to **Intelligence** — view predictive EAC, anomaly detection, and Monte Carlo simulation.

---

## Accounts, Roles & Access Control

Every page and every API endpoint (except `/`, `/health`, `/auth/login`, `/auth/register`) requires a signed-in user.
Roles are enforced **on the server** — hiding a button in the UI is only a convenience.

| Capability | Admin | Manager | Developer | Viewer |
|---|:-:|:-:|:-:|:-:|
| Which projects they see | all | **only projects they manage** | only projects where they have tasks | all |
| Which tasks they see | all | all tasks in their projects | **only tasks assigned to them** | all |
| Change task status (To Do / In Progress / Done) | ✅ | ✅ own projects | ✅ **own tasks only** | — |
| Create / edit / delete tasks, quality metrics | ✅ | ✅ own projects | — | — |
| Assign tasks to | anyone active | themselves + **developers on their team** | — | — |
| Mark a project Completed / Reopen it | ✅ | ✅ own projects | — | — |
| Put developers on a manager's team | ✅ | — | — | — |
| Create projects (creator becomes the manager) | ✅ | ✅ | — | — |
| Edit projects & sprints, Jira import, save EVM snapshots | ✅ | ✅ own projects | — | — |
| Assign a project to another manager, delete projects | ✅ | — | — | — |
| ML Predictions | ✅ | ✅ own projects | — | — |
| Intelligence page | ✅ | — | — | — |
| Team progress | ✅ everyone | ✅ their team, counted on their projects | — | — |
| Users & Access (roles, activation, password resets) + **activity log** | ✅ | — | — | — |
| AI assistant | everything | own projects + team | own tasks + their projects | read-only data |

**Teams.** An Admin decides who works for whom: on *Users & Access*, set each developer's **Team** to a manager.
A manager can only assign work to their own team, and their *Team* page and AI answers cover only that team.
New sign-ups have no team until an Admin assigns one (the notifications bell reminds Admins).

**Completed projects.** A manager (or Admin) marks a project *Completed* from the Projects page. It becomes read-only
— no task, sprint, metric, Jira or EVM-snapshot changes — and stops counting as a risk. *Reopen* makes it editable again.

Out-of-scope reads answer **404** (the API never confirms that something exists) and forbidden writes answer **403**.
The AI assistant's tools apply exactly the same scope, so a developer can't ask the chatbot about other people's work.
Every change (task status, edits, deletions, role changes, sign-ins and failed sign-ins) is written to the `Audit_Log`
table and shown to Admins on the Users & Access page.

- **Sign up** (`/register`) always creates a **Developer**. An Admin promotes people from **Users & Access**.
- **Forgot password**: an Admin resets it from **Users & Access**; the user then changes it under **Account**.
- Changing a password, an admin reset, or deactivation immediately signs that user out everywhere.
- 5 wrong passwords for one account lock sign-in for 15 minutes.
- The workspace always keeps at least one active Admin, and admins cannot demote or deactivate themselves.

Run all backend tests with: `cd backend && python -m pytest -q`

## Deploying to Production (checklist)

- [ ] Strong unique `JWT_SECRET` and a new `ADMIN_PASSWORD` set on the server (never commit `.env`).
- [ ] Serve the API and frontend over **HTTPS** only; set `CORS_ORIGINS` to your frontend URL.
- [ ] Set `VITE_API_BASE_URL` to the public API URL, then `npm run build` and host `frontend/dist`.
- [ ] Run the API with several workers, e.g. `uvicorn fastapi_app:app --host 0.0.0.0 --port 8000 --workers 4`.
- [ ] Put the Neon database in the region closest to your users/server — every query pays the network round trip.
- [ ] Rotate any database/API keys that were ever shared in zip files or chat.

## AI Assistant (multi-agent)

The chat assistant (floating **AI Assistant** button, `POST /genai/chat`) is a team of agents:

| Agent | Answers | Live data it can query |
|---|---|---|
| Router | Picks the 1–3 specialists a question needs and which projects it means (also for follow-ups) | — |
| Portfolio & EVM Analyst | Cost/schedule health, CPI, SPI, EAC, VAC, risk ranking, ML forecast | portfolio overview, project forecast, EVM trend |
| Delivery & Tasks | Late tasks, sprint progress, "my tasks" | task summary, overdue tasks, sprint progress, my tasks |
| Team & Workload *(Admin/Manager only)* | Who is overloaded or has capacity | team workload, overdue tasks by person |
| EVM Tutor | Explains metrics and formulas | — |

Answers from several agents are merged by a synthesizer. If the LLM is unreachable (bad key, rate limit, network),
every agent still answers from the same live data with a built-in analyst, and the chat shows why the AI is offline.

**Config** (`backend/.env`): `GROQ_API_KEY`, `LLM_MODEL` (agents), `LLM_ROUTER_MODEL` (small fast model),
`LLM_FALLBACK_MODELS` (tried when a model is rate-limited — Groq limits are per model). Check status at `GET /genai/health`.

**Measure it**: `cd backend && python eval_genai.py --role Manager` prints routing accuracy, LLM success rate,
latency p50/p95 and grounding (share of numbers in answers that exist in the data). Unit tests: `python -m pytest test_genai_agents.py`.

> Groq's free tier allows ~8,000 tokens/minute per model (about 2–4 questions/minute each). For real users,
> upgrade to Groq's Dev tier or point `LLM_BASE_URL`/`LLM_MODEL` at another OpenAI-compatible provider.
