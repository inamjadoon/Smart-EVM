"""Chat-with-Project assistant (Module 4).

Structured retrieval (NOT vector RAG — the data is structured): we assemble a
compact, factual context bundle from the project's live EVM state + ML
predictions, then let the LLM answer the user's question grounded in it. This is
faster to build and more accurate for numeric project data than embeddings.

To extend: add tool/function-calling so the LLM can pull specific slices
(e.g. get_tasks_at_risk()) once the backend exposes those queries.
"""
from __future__ import annotations

import json

from ..schemas import ChatResponse, ProjectState
from ..services.predictor import predict_all
from . import llm_client

SYSTEM = (
    "You are SmartEVM's project assistant. Answer the manager's question using "
    "ONLY the project context provided (EVM metrics + ML forecasts). Be concise "
    "and specific, cite the relevant numbers, and say so if the context does not "
    "contain the answer. Use plain text with short lines and '• ' bullets where "
    "helpful; never use markdown symbols like #, *, or **."
)


def _context(project: ProjectState) -> dict:
    bundle = predict_all(project)
    return {
        "project_name": project.name,
        "sprints_completed": project.history[-1].sprint_number,
        "total_sprints": project.history[-1].total_sprints,
        "current_evm": bundle.current_evm,
        "forecast": bundle.forecast.model_dump(),
        "cost_prediction": bundle.cost.model_dump(),
        "delay_prediction": bundle.delay.model_dump(),
        "success": bundle.success.model_dump(),
    }


def answer_question(question: str, project: ProjectState) -> ChatResponse:
    ctx = _context(project)
    try:
        raw = llm_client.chat(
            [{"role": "system", "content": SYSTEM},
             {"role": "user",
              "content": f"CONTEXT:\n{json.dumps(ctx, indent=2)}\n\nQUESTION: {question}"}],
            temperature=0.2, max_tokens=500,
        )
        return ChatResponse(answer=raw.strip(), source="llm")
    except Exception:
        evm = ctx["current_evm"]
        return ChatResponse(
            answer=(
                f"(offline summary) {ctx['project_name']} is '{ctx['success']['label']}'. "
                f"CPI {evm['cpi']:.2f}, SPI {evm['spi']:.2f}, QPI {evm['qpi']:.2f}. "
                f"Forecast EAC ${ctx['cost_prediction']['predicted_eac']:,.0f}, "
                f"predicted delay {ctx['delay_prediction']['predicted_delay_sprints']:.1f} sprints. "
                "Set GROQ_API_KEY for full conversational answers."
            ),
            source="rule_based",
        )


# ---------------------------------------------------------------------------
# Portfolio chat — the GLOBAL assistant / floating chatbot, which is not tied to
# a single project and must reason across ALL projects (e.g. "which project
# needs the most attention?"). The backend passes every project the user can see.
# ---------------------------------------------------------------------------
PORTFOLIO_SYSTEM = (
    "You are SmartEVM's portfolio assistant. Answer the manager's question using "
    "ONLY the portfolio context provided — a list of projects, each with its EVM "
    "metrics and ML forecasts. "
    "Format for readability: open with one short summary line, then ONE block per "
    "project. Put the project name and its status on its own line, then 2-4 short "
    "lines each starting with '• '. Separate blocks with a blank line. "
    "Use plain text only — never markdown symbols like #, *, or **. "
    "Cite the actual numbers, and rank projects by risk when relevant."
)


def _portfolio_context(projects: list[ProjectState]) -> list[dict]:
    return [_context(project) for project in projects]


def answer_portfolio_question(question: str, projects: list[ProjectState]) -> ChatResponse:
    if not projects:
        return ChatResponse(answer="No projects are available to analyze yet.", source="rule_based")
    ctx = _portfolio_context(projects)
    try:
        raw = llm_client.chat(
            [{"role": "system", "content": PORTFOLIO_SYSTEM},
             {"role": "user",
              "content": f"PORTFOLIO CONTEXT ({len(ctx)} projects):\n"
                         f"{json.dumps(ctx, indent=2)}\n\nQUESTION: {question}"}],
            temperature=0.2, max_tokens=700,
        )
        return ChatResponse(answer=raw.strip(), source="llm")
    except Exception:
        lines = [
            f"{c['project_name']}: {c['success']['label']} — CPI {c['current_evm']['cpi']:.2f}, "
            f"SPI {c['current_evm']['spi']:.2f}, EAC ${c['cost_prediction']['predicted_eac']:,.0f}."
            for c in ctx
        ]
        return ChatResponse(answer="(offline summary)\n" + "\n".join(lines), source="rule_based")
