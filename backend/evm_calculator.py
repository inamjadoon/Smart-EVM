

from typing import List, Dict, Optional

STATUS_DONE        = "Done"
STATUS_IN_PROGRESS = "In Progress"
STATUS_TODO        = "To Do"

VALID_STATUSES = {STATUS_DONE, STATUS_IN_PROGRESS, STATUS_TODO}


def _safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Returns numerator/denominator. Returns `default` if denominator is 0 or None."""
    if not denominator:
        return default
    return round(numerator / denominator, 2)



def calculate_project_evm(
    project: Dict,
    sprints: List[Dict],
    tasks: List[Dict],
    metrics: List[Dict],
    budget_per_point: float = 100.0,
) -> Dict:

    project_id    = project.get("project_id")
    total_budget  = float(project.get("total_budget") or 0.0)

    # ── Validate inputs ──────────────────────────────────────────────────────
    if not sprints:
        return _empty_evm_result(project_id, total_budget, reason="No sprints found")

    sprint_ids = {s["sprint_id"] for s in sprints}


    total_pv = sum(
        float(s.get("planned_value") or 0.0)
        for s in sprints
    )


    done_points = sum(
        int(t.get("story_points") or 0)
        for t in tasks
        if t.get("sprint_id") in sprint_ids
        and str(t.get("status", "")).strip() == STATUS_DONE
    )
    total_ev = round(done_points * budget_per_point, 2)


    total_ac = sum(
        float(s.get("planned_value") or 0.0)
        for s in sprints
        if s.get("start_date") is not None       # sprint has started
    )
    # Fallback: if no sprint has a start_date, use full PV as AC proxy
    if total_ac == 0.0 and total_pv > 0:
        total_ac = total_pv

    cpi = _safe_divide(total_ev, total_ac)
    spi = _safe_divide(total_ev, total_pv)

    eac = _safe_divide(total_budget, cpi) if cpi > 0 else total_budget
    vac = round(total_budget - eac, 2)

    task_ids = {t["task_id"] for t in tasks if t.get("sprint_id") in sprint_ids}
    project_metrics = [
        m for m in metrics
        if m.get("task_id") in task_ids
        and m.get("calculated_qpi") is not None
    ]
    if project_metrics:
        avg_qpi = round(
            sum(float(m["calculated_qpi"]) for m in project_metrics) / len(project_metrics),
            2
        )
    else:
        avg_qpi = None   # No metrics yet -- stored as NULL in DB

   
    sprint_summaries = _build_sprint_summaries(sprints, tasks, budget_per_point)

    return {
        "project_id"               : project_id,
        "project_name"             : project.get("project_name"),
        "total_budget"             : total_budget,

        # Core EVM
        "total_pv"                 : round(total_pv, 2),
        "total_ev"                 : round(total_ev, 2),
        "total_ac"                 : round(total_ac, 2),
        "cpi"                      : cpi,
        "spi"                      : spi,
        "qpi"                      : avg_qpi,

        # Forecasts
        "ai_prediction_eac"        : round(eac, 2),
        "ai_variance_at_completion": round(vac, 2),

        # Extra context (not stored in DB, useful for API response)
        "done_story_points"        : done_points,
        "budget_per_point"         : budget_per_point,
        "sprint_count"             : len(sprints),
        "task_count"               : len(tasks),
        "health"                   : _health_label(cpi, spi),
        "sprint_breakdown"         : sprint_summaries,
    }

def _build_sprint_summaries(
    sprints: List[Dict],
    tasks: List[Dict],
    budget_per_point: float,
) -> List[Dict]:
    """
    Returns per-sprint EV vs PV comparison.
    Useful for sprint retrospectives in Scrum.
    """
    summaries = []
    for sprint in sorted(sprints, key=lambda s: s.get("sprint_no", 0)):
        sid = sprint["sprint_id"]
        pv  = float(sprint.get("planned_value") or 0.0)

        sprint_tasks = [t for t in tasks if t.get("sprint_id") == sid]

        total_points = sum(int(t.get("story_points") or 0) for t in sprint_tasks)
        done_points  = sum(
            int(t.get("story_points") or 0)
            for t in sprint_tasks
            if str(t.get("status", "")).strip() == STATUS_DONE
        )
        ev = round(done_points * budget_per_point, 2)

        summaries.append({
            "sprint_id"     : sid,
            "sprint_no"     : sprint.get("sprint_no"),
            "sprint_name"   : sprint.get("sprint_name"),
            "planned_value" : pv,
            "earned_value"  : ev,
            "spi"           : _safe_divide(ev, pv),
            "total_tasks"   : len(sprint_tasks),
            "done_tasks"    : sum(1 for t in sprint_tasks if str(t.get("status","")).strip() == STATUS_DONE),
            "total_points"  : total_points,
            "done_points"   : done_points,
        })
    return summaries


def calculate_qpi(
    critical_bugs: int,
    major_bugs: int,
    minor_bugs: int,
    code_coverage: float,
    tech_debt_hours: float,
) -> float:

    base = 100.0

    # Bug penalties
    base -= (critical_bugs or 0) * 10
    base -= (major_bugs    or 0) * 5
    base -= (minor_bugs    or 0) * 2

    # Code coverage bonus (max +20)
    coverage_bonus = ((code_coverage or 0.0) / 100.0) * 20
    base += coverage_bonus

    # Tech debt penalty (-1 per 5 hours)
    debt_penalty = (tech_debt_hours or 0.0) / 5.0
    base -= debt_penalty

    return round(max(0.0, min(100.0, base)), 2)


def _health_label(cpi: float, spi: float) -> str:
    """Returns a human-readable health status for the project."""
    if cpi >= 1.0 and spi >= 1.0:
        return "Green - On track"
    elif cpi >= 0.8 and spi >= 0.8:
        return "Yellow - At risk"
    else:
        return "Red - Off track"


def _empty_evm_result(project_id, total_budget, reason="") -> Dict:
    return {
        "project_id"               : project_id,
        "total_budget"             : total_budget,
        "total_pv"                 : 0.0,
        "total_ev"                 : 0.0,
        "total_ac"                 : 0.0,
        "cpi"                      : 0.0,
        "spi"                      : 0.0,
        "qpi"                      : None,
        "ai_prediction_eac"        : total_budget,
        "ai_variance_at_completion": 0.0,
        "done_story_points"        : 0,
        "health"                   : "Gray - No data",
        "sprint_breakdown"         : [],
        "reason"                   : reason,
    }
