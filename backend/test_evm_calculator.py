"""
Unit tests for evm_calculator.py (no database). Run: python -m pytest test_evm_calculator.py -v
"""
import os
import sys
from datetime import date

import pytest

sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from evm_calculator import (  # noqa: E402
    STATUS_DONE, STATUS_IN_PROGRESS, STATUS_TODO,
    _health_label, _safe_divide, calculate_project_evm, calculate_qpi,
)

PROJECT = {"project_id": 1, "project_name": "Test Project", "total_budget": 10000.0}

SPRINTS = [
    {"sprint_id": 1, "sprint_no": 1, "sprint_name": "S1", "start_date": "2025-01-01", "end_date": "2025-01-14", "planned_value": 2000.0},
    {"sprint_id": 2, "sprint_no": 2, "sprint_name": "S2", "start_date": "2025-01-15", "end_date": "2025-01-28", "planned_value": 3000.0},
    {"sprint_id": 3, "sprint_no": 3, "sprint_name": "S3", "start_date": None, "end_date": None, "planned_value": 5000.0},
]

TASKS = [
    {"task_id": 1, "sprint_id": 1, "status": STATUS_DONE,        "story_points": 5},
    {"task_id": 2, "sprint_id": 1, "status": STATUS_DONE,        "story_points": 3},
    {"task_id": 3, "sprint_id": 1, "status": STATUS_IN_PROGRESS, "story_points": 2},
    {"task_id": 4, "sprint_id": 2, "status": STATUS_DONE,        "story_points": 8},
    {"task_id": 5, "sprint_id": 2, "status": STATUS_TODO,        "story_points": 4},
    {"task_id": 6, "sprint_id": 3, "status": STATUS_TODO,        "story_points": 6},
]

METRICS = [{"task_id": 1, "calculated_qpi": 86.0}, {"task_id": 2, "calculated_qpi": 93.0},
           {"task_id": 4, "calculated_qpi": 68.0}]

TODAY = date(2025, 1, 21)          # sprint 1 finished, sprint 2 is 6 of 13 days in


def _with_costs(s1, s2):
    out = [dict(s) for s in SPRINTS]
    out[0]["actual_cost"], out[1]["actual_cost"] = s1, s2
    return out


def test_ev_is_in_budget_dollars():
    r = calculate_project_evm(PROJECT, SPRINTS, TASKS, METRICS, today=TODAY)
    # S1 budget 2000 over 10 pts: 1000 + 600 done + 400 x 50% in progress = 1800
    # S2 budget 3000 over 12 pts: 8 pts done = 2000 ; S3: nothing done
    assert r["total_ev"] == 3800.0
    s1 = next(s for s in r["sprint_breakdown"] if s["sprint_no"] == 1)
    assert s1["earned_value"] == 1800.0 and s1["done_points"] == 8


def test_pv_is_time_phased_to_today():
    r = calculate_project_evm(PROJECT, SPRINTS, TASKS, METRICS, today=TODAY)
    # S1 fully elapsed (2000) + S2 6/13 elapsed (1384.62) ; S3 has no dates -> not scheduled yet
    assert r["total_pv"] == pytest.approx(3384.62, abs=0.01)
    assert r["spi"] == 1.12 and r["schedule_known"] is True


def test_no_actual_cost_means_no_cost_indices():
    r = calculate_project_evm(PROJECT, SPRINTS, TASKS, METRICS, today=TODAY)
    assert r["total_ac"] is None and r["ac_entered"] is False
    assert r["cpi"] is None and r["ai_prediction_eac"] is None and r["ai_variance_at_completion"] is None
    assert r["health"].startswith("Green")      # judged on SPI alone


def test_cost_indices_from_entered_actual_cost():
    r = calculate_project_evm(PROJECT, _with_costs(2000.0, 1500.0), TASKS, METRICS, today=TODAY)
    assert r["total_ac"] == 3500.0
    assert r["cpi"] == 1.09                          # 3800 / 3500
    assert r["ai_prediction_eac"] == pytest.approx(10000 / 1.09, abs=0.01)
    assert r["ai_variance_at_completion"] == pytest.approx(10000 - 10000 / 1.09, abs=0.01)
    assert r["etc"] == pytest.approx(10000 / 1.09 - 3500, abs=0.01)


def test_partial_cost_entry_compares_like_with_like():
    """Only sprint 1 has a cost: CPI = sprint 1 EV / sprint 1 AC, not total EV / partial AC."""
    sprints = [dict(s) for s in SPRINTS]
    sprints[0]["actual_cost"] = 2400.0               # sprint 1 earned 1800 but cost 2400
    r = calculate_project_evm(PROJECT, sprints, TASKS, METRICS, today=TODAY)
    assert r["total_ac"] == 2400.0 and r["ac_sprints_entered"] == 1
    assert r["cpi"] == 0.75                          # 1800 / 2400 — an overrun, not 3800 / 2400 = 1.58


def test_overrun_is_detected():
    r = calculate_project_evm(PROJECT, _with_costs(4000.0, 4000.0), TASKS, METRICS, today=TODAY)
    assert r["cpi"] == 0.47 and r["ai_variance_at_completion"] < 0 and r["health"].startswith("Red")


def test_on_plan_project_is_not_reported_as_overrun():
    """Regression: the old formula gave CPI 0.16 for an on-plan sprint (EV in $100/point vs AC = sprint budget)."""
    project = {"project_id": 9, "total_budget": 10000.0, "start_date": "2026-09-01", "end_date": "2026-12-31"}
    sprints = [{"sprint_id": 1, "sprint_no": 1, "start_date": "2026-09-01", "end_date": "2026-09-30",
                "planned_value": 5000.0, "actual_cost": 3000.0}]
    tasks = [{"task_id": 1, "sprint_id": 1, "status": STATUS_DONE, "story_points": 8},
             {"task_id": 2, "sprint_id": 1, "status": STATUS_TODO, "story_points": 5}]
    r = calculate_project_evm(project, sprints, tasks, [], today=date(2026, 10, 2))
    assert r["total_ev"] == pytest.approx(5000 * 8 / 13, abs=0.01)
    assert r["cpi"] == 1.03                          # 3076.92 / 3000 — not 0.16


def test_budget_fallbacks():
    sprints = [{"sprint_id": 1, "sprint_no": 1, "start_date": None, "end_date": None, "planned_value": 0}]
    tasks = [{"task_id": 1, "sprint_id": 1, "status": STATUS_DONE, "story_points": 4}]
    r = calculate_project_evm({"project_id": 1, "total_budget": 0}, sprints, tasks, [], budget_per_point=250, today=TODAY)
    assert r["total_budget"] == 1000.0 and r["total_ev"] == 1000.0      # 4 pts x 250
    assert r["spi"] is None and r["schedule_known"] is False


def test_unbudgeted_sprint_gets_share_of_remaining_budget():
    sprints = [dict(SPRINTS[0]), {**SPRINTS[1], "planned_value": 0}]
    r = calculate_project_evm(PROJECT, sprints, TASKS[:5], [], today=TODAY)
    s2 = next(s for s in r["sprint_breakdown"] if s["sprint_no"] == 2)
    assert s2["planned_value"] == 8000.0             # 10000 BAC - 2000 already allocated


def test_qpi_average_and_empty_cases():
    r = calculate_project_evm(PROJECT, SPRINTS, TASKS, METRICS, today=TODAY)
    assert r["qpi"] == round((86 + 93 + 68) / 3, 2)
    empty = calculate_project_evm(PROJECT, [], [], [])
    assert empty["reason"] and empty["cpi"] is None and empty["health"].startswith("Gray")
    no_tasks = calculate_project_evm(PROJECT, SPRINTS, [], [], today=TODAY)
    assert no_tasks["total_ev"] == 0.0 and no_tasks["qpi"] is None


def test_helpers():
    assert _safe_divide(10, 4) == 2.5 and _safe_divide(1, 0) == 0.0 and _safe_divide(1, None, 1.0) == 1.0
    assert calculate_qpi(0, 0, 0, 100, 0) == 100.0
    assert calculate_qpi(2, 1, 3, 50, 10) == 77.0       # 100 - 20 - 5 - 6 + 10 - 2
    assert calculate_qpi(20, 0, 0, 0, 0) == 0.0
    assert _health_label(1.1, 1.0).startswith("Green")
    assert _health_label(0.9, 1.2).startswith("Yellow")
    assert _health_label(0.7, None).startswith("Red")
    assert _health_label(None, None).startswith("Gray")
