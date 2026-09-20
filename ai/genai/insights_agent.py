"""Automated EVM Insights Agent (Module 4).

Takes the real EVM numbers + ML predictions and turns them into a plain-language
summary, risks, and recommendations. GROUNDED: the LLM only ever sees the actual
computed numbers, so it explains rather than invents. Falls back to a rule-based
writer when the LLM is unavailable (no key / rate-limited) — demo stays alive.
"""
from __future__ import annotations

import json

from ..schemas import ProjectState, PredictionBundle, InsightResponse
from ..services.predictor import predict_all
from . import llm_client

SYSTEM = (
    "You are a senior project-management analyst specialising in Earned Value "
    "Management. You explain cost/schedule/quality performance to non-technical "
    "stakeholders in clear, specific language. Only use the numbers provided; "
    "never invent data. Respond ONLY as compact JSON with keys: "
    '"summary" (2-3 sentences), "risks" (array of short strings), '
    '"recommendations" (array of short actionable strings).'
)


def _prompt(project: ProjectState, bundle: PredictionBundle) -> str:
    return (
        f"Project: {project.name}\n"
        f"Current EVM: {json.dumps(bundle.current_evm)}\n"
        f"Forecast (final): {bundle.forecast.model_dump()}\n"
        f"Cost prediction: {bundle.cost.model_dump()}\n"
        f"Delay prediction: {bundle.delay.model_dump()}\n"
        f"Success: {bundle.success.model_dump()}\n"
        "Explain why the project is on track or slipping and what to do."
    )


def _rule_based(bundle: PredictionBundle) -> InsightResponse:
    evm, cost, delay = bundle.current_evm, bundle.cost, bundle.delay
    cpi, spi, qpi = evm["cpi"], evm["spi"], evm["qpi"]
    risks, recs = [], []
    if cpi < 0.95:
        risks.append(f"Over budget: CPI {cpi:.2f}; projected overrun {cost.overrun_pct:.0f}%.")
        recs.append("Re-baseline the budget or cut scope on low-value tasks.")
    if spi < 0.95:
        risks.append(f"Behind schedule: SPI {spi:.2f}; ~{delay.predicted_delay_sprints:.1f} extra sprints.")
        recs.append("Reallocate capacity to critical-path tasks or extend the timeline.")
    if qpi < 0.7:
        risks.append(f"Quality risk: QPI {qpi:.2f} (coverage/bugs/tech-debt).")
        recs.append("Add test coverage and burn down high-severity bugs before new work.")
    if not risks:
        risks.append("No major cost, schedule, or quality risks detected.")
        recs.append("Maintain current cadence; keep monitoring CPI/SPI trends.")
    summary = (
        f"The project is classified '{bundle.success.label}'. "
        f"CPI {cpi:.2f} (cost) and SPI {spi:.2f} (schedule); "
        f"estimate at completion ${cost.predicted_eac:,.0f}."
    )
    return InsightResponse(summary=summary, risks=risks, recommendations=recs, source="rule_based")


def generate_insights(project: ProjectState) -> InsightResponse:
    bundle = predict_all(project)
    try:
        raw = llm_client.chat(
            [{"role": "system", "content": SYSTEM},
             {"role": "user", "content": _prompt(project, bundle)}],
            temperature=0.3, response_json=True,
        )
        data = json.loads(raw)
        return InsightResponse(
            summary=data.get("summary", ""),
            risks=data.get("risks", []),
            recommendations=data.get("recommendations", []),
            source="llm",
        )
    except Exception:
        return _rule_based(bundle)
