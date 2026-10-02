# SmartEVM — Team Setup & Quickstart Guide

Everything a teammate needs to run SmartEVM on their own machine after cloning the repo.

> **Secrets are NOT on GitHub.** The real `.env` files are git-ignored. The repo only contains
> `.env.example` templates. The project owner sends the secret values to you **privately**
> (WhatsApp / Slack DM / password manager — never in a GitHub issue, commit, or public chat).

---

## 0. Prerequisites (install once)

| Tool | Version | Check with |
|---|---|---|
| Git | any recent | `git --version` |
| Python | **3.10 – 3.12** | `python --version` |
| Node.js | **18 or newer** (includes npm) | `node --version` |
| Internet access | — | needed for the Neon cloud database and the Groq AI API |

---

## 1. Clone the repository

```bash
git clone https://github.com/Tusharlalwani1/smartEVM.git
cd smartEVM
```

All commands below are run from this project root folder unless a step says `cd` somewhere.

---

## 2. Create the environment files (`.env`)

You need **two** `.env` files. Copy each template, then fill in the values.

| File to create | Copy from | Required? |
|---|---|---|
| `backend/.env` | `backend/.env.example` | **Yes** |
| `frontend/.env` | `frontend/.env.example` | **Yes** |
| `ai/.env` | `ai/.env.example` | No — the app reads AI settings from `backend/.env` |

**Windows (PowerShell):**
```powershell
copy backend\.env.example backend\.env
copy frontend\.env.example frontend\.env
```
**macOS / Linux:**
```bash
cp backend/.env.example backend/.env
cp frontend/.env.example frontend/.env
```

### `backend/.env` — what to put in it

| Variable | Value | Where it comes from |
|---|---|---|
| `DATABASE_URL` | Neon PostgreSQL connection string | **Sent privately by the project owner** |
| `GROQ_API_KEY` | Groq API key for the AI assistant | **Sent privately by the owner**, or create your own free key at console.groq.com/keys |
| `LLM_MODEL`, `LLM_ROUTER_MODEL`, `LLM_FALLBACK_MODELS` | keep the template defaults | template |
| `JWT_SECRET` | any long random string — **generate your own** | run `python -c "import secrets; print(secrets.token_urlsafe(48))"` and paste the output |
| `JWT_EXPIRE_MINUTES` | `480` | template |
| `ADMIN_EMAIL` | `admin@smartevm.com` | template |
| `ADMIN_PASSWORD` | **leave empty** | the shared database already has the admin account |
| `ADMIN_NAME`, `ALLOW_SIGNUP`, `DB_POOL_SIZE`, `DB_MAX_OVERFLOW` | keep the template defaults | template |

### `frontend/.env` — what to put in it

```
VITE_API_BASE_URL=http://127.0.0.1:8000
```
(Already set in the template — just copy it.)

> ⚠️ Everyone's local app talks to the **same shared Neon database**. Data you create, edit or delete
> is real for the whole team — use clearly named test projects and clean up after yourself.

---

## 3. Backend setup (FastAPI + ML + AI)

### 3.1 Create the virtual environment (once), in the project root
```bash
python -m venv venv
```

### 3.2 Activate it (every time you open a new terminal)

**Windows (PowerShell):**
```powershell
.\venv\Scripts\Activate.ps1
```
*(If you get an "execution policy" error, run `Set-ExecutionPolicy -Scope Process -ExecutionPolicy Bypass` first.)*

**Windows (Command Prompt):** `venv\Scripts\activate.bat`

**macOS / Linux:**
```bash
source venv/bin/activate
```
Your prompt now starts with `(venv)`. **Always activate before installing or running.**

### 3.3 Install the Python packages (once, and again whenever `requirements.txt` changes)
```bash
pip install --upgrade pip
pip install -r requirements-dev.txt
```
(`requirements-dev.txt` = the app's `requirements.txt` + test tools. The server only needs `requirements.txt`.)

### 3.4 Run the backend
```bash
cd backend
uvicorn fastapi_app:app --reload --port 8000
```
Wait for `Application startup complete.` (the first start can take ~30 s while it connects to the
database and loads the ML libraries). Then check:
- Health: **http://127.0.0.1:8000/health** → `{"status":"ok"}`
- API docs (Swagger): **http://127.0.0.1:8000/docs** — click **Authorize** and paste a login token to try protected endpoints

Leave this terminal running.

---

## 4. Frontend setup (React + Vite)

Open a **second terminal** in the project root:
```bash
cd frontend
npm install        # once, and again whenever package.json changes
npm run dev
```
Open **http://localhost:8080** in your browser.

---

## 5. Sign in and check it works

1. Go to **http://localhost:8080** → **Create an account**. New accounts start as **Developer**.
2. Ask the admin to give you the right role (**Manager** / **Admin**) and, for developers, to put you on a
   manager's **Team** (Users & Access page).
3. Sign out and back in (or refresh) to see the pages for your role.
4. Open the **AI Assistant** (bottom-right) and ask "Give me a summary of my projects".

### Daily routine (after the first setup)
```bash
# terminal 1 — backend
.\venv\Scripts\Activate.ps1          # macOS/Linux: source venv/bin/activate
cd backend
uvicorn fastapi_app:app --reload --port 8000

# terminal 2 — frontend
cd frontend
npm run dev
```
After `git pull`, re-run `pip install -r requirements.txt` (with the venv active) and `npm install`
if those files changed.

---

## 6. Troubleshooting

| Problem | Fix |
|---|---|
| `uvicorn: command not found` / `No module named fastapi` | The venv isn't active — activate it (step 3.2), then `pip install -r requirements.txt`. |
| Backend log: `Connection has failed` / pages stuck loading | `DATABASE_URL` in `backend/.env` is wrong or missing, or you're offline. |
| Login page says "Cannot reach the SmartEVM server" | The backend isn't running on port 8000, or `frontend/.env` has the wrong `VITE_API_BASE_URL`. Restart `npm run dev` after editing `.env`. |
| Everyone gets signed out after a restart | `JWT_SECRET` is missing/short in `backend/.env`, so a random one is generated each start. |
| AI chat shows "AI model offline" | `GROQ_API_KEY` is missing or invalid — the banner says why. The built-in analyst still answers from live data. |
| `Port 8000 / 8080 already in use` | Another copy is already running — stop it, or use `--port 8001` (and update `VITE_API_BASE_URL`). |
| CORS error in the browser console | Open the app at `http://localhost:8080` (not another port), or add your URL to `CORS_ORIGINS`. |

Run the backend tests any time: `cd backend` then `python -m pytest -q` (venv active).

---

## ⚠️ Before sharing the project as a .zip

Do **not** include `venv/`, `frontend/node_modules/`, `frontend/dist/`, `.git/`, or any real `.env` file.
Teammates recreate `venv` and `node_modules` with the commands above.

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

Step-by-step free hosting guide (Vercel + Neon + Groq, no card): see [DEPLOYMENT.md](DEPLOYMENT.md).

- [ ] Strong unique `JWT_SECRET` and a new `ADMIN_PASSWORD` set on the server (never commit `.env`).
- [ ] Serve the API and frontend over **HTTPS** only; set `CORS_ORIGINS` to your frontend URL.
- [ ] Set `VITE_API_BASE_URL` to the public API URL, then `npm run build` and host `frontend/dist`.
- [ ] Run the API with several workers, e.g. `uvicorn fastapi_app:app --host 0.0.0.0 --port 8000 --workers 4`.
- [ ] Point the platform's health check at `GET /health/ready` (checks the database) and uptime pings at `GET /health`.
- [ ] Put the Neon database in the region closest to your users/server — every query pays the network round trip.
- [ ] Rotate any database/API keys that were ever committed, zipped, or pasted in chat (the Neon password was committed in early history — reset it in the Neon console).

## How EVM is calculated

All values are in the project's currency, recalculated live from sprints and tasks:

| Metric | Meaning in SmartEVM |
|---|---|
| **BAC** | Project budget (falls back to the sum of sprint budgets) |
| **PV** | Budget planned to be done **by today** — each sprint's budget spread over its start→end dates |
| **EV** | Budget value of work done — each task is worth its share of its sprint's budget by story points; Done = 100 %, In Progress = 50 %, To Do = 0 % |
| **AC** | Money actually spent — **entered by the manager per sprint** (Sprints page → *Actual Cost to date*) |
| **CPI / EAC / VAC** | EV ÷ AC, BAC ÷ CPI, BAC − EAC — shown as "—" until actual cost is entered (never guessed) |
| **SPI** | EV ÷ PV |

*Save snapshot* (EVM Dashboard) records the current figures in `EVM_History`; the chart, ML forecasts and AI use those.
Snapshots taken before this formula (marked `calc_version = 1`) are kept in the database but ignored.

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
