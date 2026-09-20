"""End-to-end smoke test / demo without a server.

Run:  python -m ai.demo
Builds a slipping project, runs all ML predictions + GenAI insights + a chat Q,
and prints the results. Great for a quick judge-facing walkthrough.
"""
from __future__ import annotations

import json

from .schemas import ProjectState, SprintSnapshot
from .services.predictor import predict_all
from .genai.insights_agent import generate_insights
from .genai.chat_service import answer_question


def sample_project() -> ProjectState:
    # A 12-sprint project, 6 sprints in, drifting over budget AND behind schedule.
    history = []
    bac = 240_000.0
    total = 12
    for t in range(1, 7):
        planned = t / total
        actual = planned * (0.88 - 0.01 * t)          # slipping schedule
        ac = bac * actual / (0.9 - 0.015 * t)          # creeping over budget
        history.append(SprintSnapshot(
            sprint_number=t, total_sprints=total, bac=bac,
            planned_pct=round(planned, 4), actual_pct=round(actual, 4), ac=round(ac, 2),
            code_coverage=0.68, bug_severity_score=0.35, tech_debt=0.4,
        ))
    return ProjectState(project_id="P0001", name="Mobile App Revamp", history=history)


def main():
    project = sample_project()

    print("=" * 60, "\nML PREDICTIONS\n" + "=" * 60)
    bundle = predict_all(project)
    print(json.dumps(bundle.model_dump(), indent=2))

    print("\n" + "=" * 60, "\nGENAI INSIGHTS\n" + "=" * 60)
    print(json.dumps(generate_insights(project).model_dump(), indent=2))

    print("\n" + "=" * 60, "\nCHAT\n" + "=" * 60)
    q = "Which is the bigger problem here — cost or schedule — and what should I do this week?"
    print("Q:", q)
    print("A:", answer_question(q, project).answer)


if __name__ == "__main__":
    main()
