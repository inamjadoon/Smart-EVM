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
