"""
GenAI router — plain-language insights + chat ON TOP OF THE BACKEND'S OWN EVM/ML.

Design (agreed): the backend already computes EVM (evm_calculator) and ML
forecasts (ml_rout.compute_evm_forecast). This router does NOT re-run any of the
`ai/` package's EVM or ML — it takes the BACKEND'S numbers and only uses the AI
module's LLM client (ai.genai.llm_client) to explain them. So the numbers in the
insights/chat are identical to what /ml/predict and /evm return.

WHERE THIS GOES:  backend/genai_rout.py
WIRE IT in backend/fastapi_app.py (one line, next to the other routers):
    from genai_rout import router as genai_router
    app.include_router(genai_router)

NEEDS on the backend host:
  * `GROQ_API_KEY` (in ai/.env or the environment) for real LLM answers; without
    it the endpoints return a transparent rule-based fallback.
  * The `ai/` package present at the repo root (already merged into main).
"""
from __future__ import annotations

import os
import sys
import json
from typing import Optional, List, Dict, Any

from fastapi import APIRouter, HTTPException
from pydantic import BaseModel

# Make the repo-root `ai` package importable — ONLY for the LLM client wrapper.
_REPO_ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
if _REPO_ROOT not in sys.path:
    sys.path.insert(0, _REPO_ROOT)
from ai.genai import llm_client                       # noqa: E402  (LLM API wrapper only)

# The backend's OWN ML + DB layer.
from ml_rout import compute_evm_forecast
from db_connection import get_connection

router = APIRouter(prefix="/genai", tags=["GenAI Insights & Chat"])

INSIGHT_SYSTEM = (
    "You are SmartEVM's project analyst. Using ONLY the numbers provided, explain "
    "in plain language whether the project is on track or slipping and what to do. "
    "Respond ONLY as compact JSON with keys: summary (2-3 sentences), risks (array "
    "of short strings), recommendations (array of short actionable strings). "
    "Cite the actual numbers; never invent data."
)

CHAT_SYSTEM = (
    "You are SmartEVM's assistant. Answer the manager's question using ONLY the "
    "project facts provided (EVM metrics + the backend's ML forecast). Be concise, "
    "cite the numbers, name specific projects, and say so if the facts do not "
    "contain the answer. Plain text with short lines and '• ' bullets; no markdown "
    "symbols like #, *, or **."
)


# ---------------------------------------------------------------------------
# Pull the BACKEND'S computed numbers for a project
# ---------------------------------------------------------------------------
def _facts(project_id: int) -> Dict[str, Any]:
    try:
        f = compute_evm_forecast(project_id)          # backend's ML
    except Exception as e:
        raise HTTPException(status_code=400,
                            detail=f"Backend forecast failed for project {project_id}: {e}")
    if not f:
        raise HTTPException(status_code=404,
                            detail=f"Project {project_id} not found or has no EVM history")
    return {
        "project_id": f.get("project_id"),
        "project_name": f.get("project_name"),
        "total_budget": f.get("total_budget"),
        "current_cpi": f.get("current_cpi"),
        "current_spi": f.get("current_spi"),
        "predicted_eac": f.get("predicted_eac"),
        "predicted_delay_days": f.get("predicted_delay_days"),
        "status_warning": f.get("status_warning"),
        "history_points": f.get("historical_snapshots_count"),
    }


def _all_project_ids() -> List[int]:
    conn = get_connection()
    if not conn:
        raise HTTPException(status_code=500, detail="Database connection failed")
    try:
        cur = conn.cursor()
        cur.execute("SELECT project_id FROM Projects ORDER BY project_id")
        return [r[0] for r in cur.fetchall()]
    finally:
        conn.close()


def _rule_based_insight(f: Dict[str, Any]) -> Dict[str, Any]:
    cpi = f.get("current_cpi") or 1.0
    spi = f.get("current_spi") or 1.0
    eac = f.get("predicted_eac") or 0.0
    delay = f.get("predicted_delay_days") or 0.0
    risks, recs = [], []
    if cpi < 0.95:
        risks.append(f"Over budget: CPI {cpi:.2f}; forecast cost ${eac:,.0f}.")
        recs.append("Re-baseline the budget or cut low-value scope.")
    if spi < 0.95:
        risks.append(f"Behind schedule: SPI {spi:.2f}; ~{delay:.0f} days late.")
        recs.append("Reallocate capacity to the critical path.")
    if not risks:
        risks.append("No major cost or schedule risk detected.")
        recs.append("Maintain current cadence; keep monitoring CPI/SPI.")
    summary = (f"{f.get('project_name')}: CPI {cpi:.2f}, SPI {spi:.2f}; "
               f"forecast EAC ${eac:,.0f}, ~{delay:.0f} days delay.")
    return {"summary": summary, "risks": risks, "recommendations": recs, "source": "rule_based"}


# ---------------------------------------------------------------------------
# Endpoints
# ---------------------------------------------------------------------------
@router.get("/health", summary="GenAI availability")
def genai_health():
    return {"status": "ok", "llm_configured": llm_client.is_configured()}


@router.get("/insights/{project_id}", summary="Plain-language insights over the backend's ML")
def project_insights(project_id: int):
    f = _facts(project_id)
    try:
        raw = llm_client.chat(
            [{"role": "system", "content": INSIGHT_SYSTEM},
             {"role": "user", "content": json.dumps(f)}],
            temperature=0.3, response_json=True,
        )
        data = json.loads(raw)
        return {
            "summary": data.get("summary", ""),
            "risks": data.get("risks", []),
            "recommendations": data.get("recommendations", []),
            "source": "llm",
        }
    except Exception as e:
        import traceback
        print(f"[GenAI Insights] LLM failed: {e}")
        traceback.print_exc()
        return _rule_based_insight(f)


class ChatIn(BaseModel):
    message: str
    project_id: Optional[int] = None   # omit for a portfolio-wide question


@router.post("/chat", summary="Chat about one project, or the whole portfolio")
def genai_chat(body: ChatIn):
    if body.project_id is not None:
        facts: Any = _facts(body.project_id)
    else:
        # Detect if a specific project ID is mentioned in the query (e.g., "project 1")
        import re
        m = re.search(r"project\s*#?(\d+)", body.message, re.IGNORECASE)
        if m:
            try:
                facts = _facts(int(m.group(1)))
            except Exception:
                pids = _all_project_ids()[:6]
                facts = []
                for pid in pids:
                    try:
                        facts.append(_facts(pid))
                    except Exception:
                        pass
        else:
            pids = _all_project_ids()[:6]
            facts = []
            for pid in pids:
                try:
                    facts.append(_facts(pid))
                except Exception:
                    pass
    try:
        raw = llm_client.chat(
            [{"role": "system", "content": CHAT_SYSTEM},
             {"role": "user",
              "content": f"FACTS:\n{json.dumps(facts, indent=2)}\n\nQUESTION: {body.message}"}],
            temperature=0.2, max_tokens=700,
        )
        return {"reply": raw.strip(), "source": "llm"}
    except Exception as e:
        import traceback
        print(f"[GenAI Chat] LLM failed: {e}")
        traceback.print_exc()
        items = facts if isinstance(facts, list) else [facts]
        lines = [
            f"{x.get('project_name')}: CPI {x.get('current_cpi')}, SPI {x.get('current_spi')}, "
            f"EAC ${(x.get('predicted_eac') or 0):,.0f}, ~{(x.get('predicted_delay_days') or 0):.0f}d delay"
            for x in items
        ]
        return {"reply": "(offline summary)\n" + "\n".join(lines), "source": "rule_based"}
