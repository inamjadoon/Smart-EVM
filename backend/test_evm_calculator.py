

import sys
import os
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

from evm_calculator import (
    calculate_project_evm,
    calculate_qpi,
    _safe_divide,
    _health_label,
    STATUS_DONE,
    STATUS_IN_PROGRESS,
    STATUS_TODO,
)



SAMPLE_PROJECT = {
    "project_id"  : 1,
    "project_name": "Test Project",
    "total_budget": 10000.0,
    "manager_id"  : 1,
}

SAMPLE_SPRINTS = [
    {
        "sprint_id"    : 1, "project_id": 1, "sprint_no": 1,
        "sprint_name"  : "Sprint 1 - UI",
        "start_date"   : "2025-01-01",      # has started
        "end_date"     : "2025-01-14",
        "planned_value": 2000.0,
    },
    {
        "sprint_id"    : 2, "project_id": 1, "sprint_no": 2,
        "sprint_name"  : "Sprint 2 - Backend",
        "start_date"   : "2025-01-15",      # has started
        "end_date"     : "2025-01-28",
        "planned_value": 3000.0,
    },
    {
        "sprint_id"    : 3, "project_id": 1, "sprint_no": 3,
        "sprint_name"  : "Sprint 3 - Testing",
        "start_date"   : None,              # NOT started yet
        "end_date"     : None,
        "planned_value": 5000.0,
    },
]

SAMPLE_TASKS = [
    # Sprint 1 tasks
    {"task_id": 1, "sprint_id": 1, "status": STATUS_DONE,        "story_points": 5, "assigned_to": 1},
    {"task_id": 2, "sprint_id": 1, "status": STATUS_DONE,        "story_points": 3, "assigned_to": 1},
    {"task_id": 3, "sprint_id": 1, "status": STATUS_IN_PROGRESS, "story_points": 2, "assigned_to": 2},
    # Sprint 2 tasks
    {"task_id": 4, "sprint_id": 2, "status": STATUS_DONE,        "story_points": 8, "assigned_to": 2},
    {"task_id": 5, "sprint_id": 2, "status": STATUS_TODO,        "story_points": 4, "assigned_to": 1},
    # Sprint 3 tasks (not started)
    {"task_id": 6, "sprint_id": 3, "status": STATUS_TODO,        "story_points": 6, "assigned_to": 1},
]

SAMPLE_METRICS = [
    {
        "metric_id": 1, "task_id": 1, "tester_id": 3,
        "critical_bugs": 0, "major_bugs": 1, "minor_bugs": 2,
        "bug_count": 3, "code_coverage": 85.0, "tech_debt_hours": 2.0,
        "calculated_qpi": 86.0,
    },
    {
        "metric_id": 2, "task_id": 2, "tester_id": 3,
        "critical_bugs": 0, "major_bugs": 0, "minor_bugs": 1,
        "bug_count": 1, "code_coverage": 90.0, "tech_debt_hours": 1.0,
        "calculated_qpi": 93.0,
    },
    {
        "metric_id": 3, "task_id": 4, "tester_id": 3,
        "critical_bugs": 1, "major_bugs": 2, "minor_bugs": 0,
        "bug_count": 3, "code_coverage": 70.0, "tech_debt_hours": 5.0,
        "calculated_qpi": 68.0,
    },
]



PASSED = 0
FAILED = 0

def check(test_name: str, condition: bool, detail: str = ""):
    global PASSED, FAILED
    if condition:
        print(f"  PASS  {test_name}")
        PASSED += 1
    else:
        print(f"  FAIL  {test_name}{' — ' + detail if detail else ''}")
        FAILED += 1




def test_safe_divide():
    print("\n[safe_divide]")
    check("normal division",          _safe_divide(10, 2)    == 5.0)
    check("divide by zero returns 0", _safe_divide(10, 0)    == 0.0)
    check("divide by None returns 0", _safe_divide(10, None) == 0.0)
    check("custom default",           _safe_divide(10, 0, default=-1) == -1)
    check("rounds to 2 decimals",     _safe_divide(1, 3)     == 0.33)



def test_qpi():
    print("\n[calculate_qpi]")

    # Perfect: no bugs, 100% coverage, no debt
    qpi = calculate_qpi(0, 0, 0, 100.0, 0.0)
    check("perfect QPI = 100", qpi == 100.0, f"got {qpi}")

    # 1 critical bug (-10), 100% coverage (+20) = 110 → clamped to 100
    qpi = calculate_qpi(1, 0, 0, 100.0, 0.0)
    check("1 critical, full coverage = 100 (clamped up)", qpi == 100.0, f"got {qpi}")

    # 2 critical bugs = -20, 0 coverage = 0 bonus → 80
    qpi = calculate_qpi(2, 0, 0, 0.0, 0.0)
    check("2 critical, 0 coverage = 80", qpi == 80.0, f"got {qpi}")

    # Clamp at 0: many critical bugs
    qpi = calculate_qpi(15, 0, 0, 0.0, 0.0)
    check("many bugs → clamped at 0", qpi == 0.0, f"got {qpi}")

    # Tech debt: 10 hours → -2 points
    qpi = calculate_qpi(0, 0, 0, 0.0, 10.0)
    check("10 tech debt hours = 98", qpi == 98.0, f"got {qpi}")

    # Mixed
    qpi = calculate_qpi(
        critical_bugs=0, major_bugs=1, minor_bugs=2,
        code_coverage=85.0, tech_debt_hours=2.0
    )
    # base=100, -5(major), -4(minor), +17(85% of 20), -0.4(2/5)
    # = 100 - 5 - 4 + 17 - 0.4 = 107.6 → clamped to 100? No, 107.6 → 100
    check("mixed QPI clamped at 100", qpi == 100.0, f"got {qpi}")



def test_health_label():
    print("\n[_health_label]")
    check("green: cpi=1, spi=1",    _health_label(1.0, 1.0).startswith("Green"))
    check("green: cpi=1.2, spi=1.1",_health_label(1.2, 1.1).startswith("Green"))
    check("yellow: cpi=0.9, spi=0.9",_health_label(0.9, 0.9).startswith("Yellow"))
    check("red: cpi=0.5, spi=0.5",  _health_label(0.5, 0.5).startswith("Red"))
    check("red: cpi=0.7, spi=1.0",  _health_label(0.7, 1.0).startswith("Red"))




def test_evm_calculation():
    print("\n[calculate_project_evm]")

    result = calculate_project_evm(
        project          = SAMPLE_PROJECT,
        sprints          = SAMPLE_SPRINTS,
        tasks            = SAMPLE_TASKS,
        metrics          = SAMPLE_METRICS,
        budget_per_point = 100.0,
    )

    # PV = sum of ALL sprint planned_values = 2000 + 3000 + 5000 = 10000
    check("total_pv = 10000", result["total_pv"] == 10000.0, f"got {result['total_pv']}")

    # Done tasks: task1(5pts) + task2(3pts) + task4(8pts) = 16 points
    # EV = 16 × 100 = 1600
    check("done_story_points = 16", result["done_story_points"] == 16, f"got {result['done_story_points']}")
    check("total_ev = 1600",        result["total_ev"] == 1600.0,      f"got {result['total_ev']}")

    # AC = sprints with start_date: sprint1(2000) + sprint2(3000) = 5000
    check("total_ac = 5000", result["total_ac"] == 5000.0, f"got {result['total_ac']}")

    # CPI = EV / AC = 1600 / 5000 = 0.32
    check("cpi = 0.32", result["cpi"] == 0.32, f"got {result['cpi']}")

    # SPI = EV / PV = 1600 / 10000 = 0.16
    check("spi = 0.16", result["spi"] == 0.16, f"got {result['spi']}")

    # EAC = budget / cpi = 10000 / 0.32 = 31250
    check("ai_prediction_eac = 31250", result["ai_prediction_eac"] == 31250.0, f"got {result['ai_prediction_eac']}")

    # VAC = budget - EAC = 10000 - 31250 = -21250  (way over budget)
    check("ai_variance_at_completion = -21250", result["ai_variance_at_completion"] == -21250.0, f"got {result['ai_variance_at_completion']}")

    # QPI = avg of (86, 93, 68) = 247 / 3 = 82.33
    expected_qpi = round((86.0 + 93.0 + 68.0) / 3, 2)
    check(f"qpi = {expected_qpi}", result["qpi"] == expected_qpi, f"got {result['qpi']}")

    # Health: cpi=0.32 and spi=0.16 → both < 0.8 → Red
    check("health = Red", result["health"].startswith("Red"), f"got {result['health']}")

    # Sprint breakdown count
    check("sprint_breakdown has 3 items", len(result["sprint_breakdown"]) == 3,
          f"got {len(result['sprint_breakdown'])}")

    # Sprint 1 EV: task1(5) + task2(3) done = 8pts × 100 = 800
    s1 = next(s for s in result["sprint_breakdown"] if s["sprint_no"] == 1)
    check("sprint 1 earned_value = 800",  s1["earned_value"] == 800.0,  f"got {s1['earned_value']}")
    check("sprint 1 done_points  = 8",    s1["done_points"]  == 8,      f"got {s1['done_points']}")

    # Sprint 3: not started, no done tasks → ev = 0
    s3 = next(s for s in result["sprint_breakdown"] if s["sprint_no"] == 3)
    check("sprint 3 earned_value = 0", s3["earned_value"] == 0.0, f"got {s3['earned_value']}")


def test_empty_project():
    print("\n[empty/edge cases]")

    # No sprints
    result = calculate_project_evm(SAMPLE_PROJECT, [], [], [], 100.0)
    check("no sprints → returns error-like result", "reason" in result)

    # Sprints but no tasks
    result = calculate_project_evm(SAMPLE_PROJECT, SAMPLE_SPRINTS, [], [], 100.0)
    check("no tasks → ev = 0",   result["total_ev"] == 0.0)
    check("no tasks → qpi = None", result["qpi"] is None)

    # budget_per_point = 0 should not crash
    result = calculate_project_evm(SAMPLE_PROJECT, SAMPLE_SPRINTS, SAMPLE_TASKS, [], 0.0)
    check("budget_per_point=0 → ev = 0", result["total_ev"] == 0.0)


if __name__ == "__main__":
    print("=" * 55)
    print("  Smart EVM Calculator — Unit Tests")
    print("  (No database connection required)")
    print("=" * 55)

    test_safe_divide()
    test_qpi()
    test_health_label()
    test_evm_calculation()
    test_empty_project()

    print("\n" + "=" * 55)
    print(f"  Results: {PASSED} passed, {FAILED} failed")
    print("=" * 55)

    if FAILED > 0:
        sys.exit(1)
