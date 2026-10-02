"""
Agile Earned Value Management (EVM) calculator — pure functions, no database.

All three core values are in the SAME unit (project currency):

  BAC  Budget at Completion   = project total_budget
                                (fallback: sum of sprint budgets, then story points x budget_per_point)
  PV   Planned Value          = budget scheduled to be done BY TODAY. Each sprint's budget is spread
                                evenly over its start..end dates (project dates if the sprint has none).
  EV   Earned Value           = budgeted value of the work actually done. A task is worth its share of
                                its sprint's budget (by story points); Done = 100 %, In Progress = 50 %
                                (the standard 50/50 rule), To Do = 0 %.
  AC   Actual Cost            = money actually spent, entered by the manager per sprint ("actual cost
                                to date"). Not guessed: if nobody entered it, AC and every cost index
                                (CPI, EAC, VAC) are reported as unavailable (None).

  CPI = EV / AC     SPI = EV / PV     EAC = BAC / CPI     VAC = BAC - EAC     ETC = EAC - AC
"""
from datetime import date, datetime
from typing import Dict, List, Optional

STATUS_DONE        = "Done"
STATUS_IN_PROGRESS = "In Progress"
STATUS_TODO        = "To Do"

VALID_STATUSES = {STATUS_DONE, STATUS_IN_PROGRESS, STATUS_TODO}

# Share of a task's value that counts as earned, by status (50/50 rule for work in progress).
COMPLETION = {STATUS_DONE: 1.0, STATUS_IN_PROGRESS: 0.5, STATUS_TODO: 0.0}

# Snapshots written with this formula; older EVM_History rows (version 1) used a broken
# formula (EV in "$100 per point" vs AC = whole sprint budgets) and are ignored by readers.
CALC_VERSION = 2


def _safe_divide(numerator: float, denominator: float, default: float = 0.0) -> float:
    """Returns numerator/denominator rounded to 2 dp, or `default` if the denominator is 0/None."""
    if not denominator:
        return default
    return round(numerator / denominator, 2)


def _ratio(numerator: Optional[float], denominator: Optional[float]) -> Optional[float]:
    """Index that is None (unknown) instead of 0 when it can't be computed."""
    if numerator is None or not denominator:
        return None
    return round(numerator / denominator, 2)


def _to_date(value) -> Optional[date]:
    if value is None or value == "":
        return None
    if isinstance(value, datetime):
        return value.date()
    if isinstance(value, date):
        return value
    try:
        return datetime.strptime(str(value)[:10], "%Y-%m-%d").date()
    except ValueError:
        return None


def _elapsed_fraction(start: Optional[date], end: Optional[date], today: date) -> Optional[float]:
    """Share of the start..end window that has passed (0..1); None if the window is unknown."""
    if not start or not end:
        return None
    if today < start:
        return 0.0
    if today >= end:
        return 1.0
    span = (end - start).days or 1
    return min(1.0, max(0.0, (today - start).days / span))


def _status(task: Dict) -> str:
    return str(task.get("status", "")).strip()


def _sprint_budgets(sprints: List[Dict], points_by_sprint: Dict[int, int], bac: float) -> Dict[int, float]:
    """Each sprint's budget: its planned_value, or a share of the unallocated BAC by story points."""
    given = {s["sprint_id"]: float(s.get("planned_value") or 0.0) for s in sprints}
    missing = [sid for sid, v in given.items() if v <= 0]
    remaining = max(bac - sum(v for v in given.values() if v > 0), 0.0)
    if missing and remaining > 0:
        pts = sum(points_by_sprint.get(sid, 0) for sid in missing)
        for sid in missing:
            share = (points_by_sprint.get(sid, 0) / pts) if pts else 1 / len(missing)
            given[sid] = remaining * share
    return given


def calculate_project_evm(
    project: Dict,
    sprints: List[Dict],
    tasks: List[Dict],
    metrics: List[Dict],
    budget_per_point: float = 100.0,
    today: Optional[date] = None,
) -> Dict:
    today = today or date.today()
    project_id = project.get("project_id")
    total_budget = float(project.get("total_budget") or 0.0)

    if not sprints:
        return _empty_evm_result(project_id, total_budget, reason="No sprints found")

    sprint_ids = {s["sprint_id"] for s in sprints}
    project_tasks = [t for t in tasks if t.get("sprint_id") in sprint_ids]
    points_by_sprint: Dict[int, int] = {}
    for t in project_tasks:
        points_by_sprint[t["sprint_id"]] = points_by_sprint.get(t["sprint_id"], 0) + int(t.get("story_points") or 0)
    total_points = sum(points_by_sprint.values())

    # BAC: project budget, else sprint budgets, else story points x rate
    sprint_pv_sum = sum(float(s.get("planned_value") or 0.0) for s in sprints)
    bac = total_budget or sprint_pv_sum or round(total_points * (budget_per_point or 0.0), 2)
    budgets = _sprint_budgets(sprints, points_by_sprint, bac)

    p_start, p_end = _to_date(project.get("start_date")), _to_date(project.get("end_date"))

    total_pv = 0.0
    total_ev = 0.0
    schedule_known = False
    ac_entered = [float(s["actual_cost"]) for s in sprints if s.get("actual_cost") is not None]
    task_values: List[Dict] = []
    sprint_summaries: List[Dict] = []

    for s in sorted(sprints, key=lambda x: x.get("sprint_no") or 0):
        sid = s["sprint_id"]
        budget = budgets.get(sid, 0.0)
        s_tasks = [t for t in project_tasks if t["sprint_id"] == sid]
        s_points = points_by_sprint.get(sid, 0)

        # PV to date for this sprint
        frac = _elapsed_fraction(_to_date(s.get("start_date")), _to_date(s.get("end_date")), today)
        if frac is None:
            frac = _elapsed_fraction(p_start, p_end, today)
        if frac is not None:
            schedule_known = True
            s_pv = budget * frac
        else:
            s_pv = 0.0

        # EV for this sprint (value of each task = its share of the sprint budget)
        s_ev = 0.0
        for t in s_tasks:
            pts = int(t.get("story_points") or 0)
            value = budget * pts / s_points if s_points else 0.0
            earned = value * COMPLETION.get(_status(t), 0.0)
            s_ev += earned
            task_values.append({"task_id": t["task_id"], "sprint_id": sid, "planned_value": round(value, 2),
                                "earned_value": round(earned, 2)})

        total_pv += s_pv
        total_ev += s_ev
        s_ac = float(s["actual_cost"]) if s.get("actual_cost") is not None else None
        sprint_summaries.append({
            "sprint_id"     : sid,
            "sprint_no"     : s.get("sprint_no"),
            "sprint_name"   : s.get("sprint_name"),
            "planned_value" : round(budget, 2),            # sprint budget
            "pv_to_date"    : round(s_pv, 2),
            "earned_value"  : round(s_ev, 2),
            "actual_cost"   : s_ac,
            "spi"           : _ratio(s_ev, s_pv),
            "cpi"           : _ratio(s_ev, s_ac),
            "total_tasks"   : len(s_tasks),
            "done_tasks"    : sum(1 for t in s_tasks if _status(t) == STATUS_DONE),
            "total_points"  : s_points,
            "done_points"   : sum(int(t.get("story_points") or 0) for t in s_tasks if _status(t) == STATUS_DONE),
        })

    total_ac = round(sum(ac_entered), 2) if ac_entered else None
    # CPI must compare like with like: only the earned value of sprints whose cost was entered.
    # (Otherwise work in sprints with no cost recorded would make the project look under budget.)
    ev_with_ac = sum(s["earned_value"] for s in sprint_summaries if s["actual_cost"] is not None)
    cpi = _ratio(ev_with_ac, total_ac)
    spi = _ratio(total_ev, total_pv) if schedule_known else None
    eac = round(bac / cpi, 2) if cpi else None
    vac = round(bac - eac, 2) if eac is not None else None

    # Quality: average QPI of the project's task metrics
    task_ids = {t["task_id"] for t in project_tasks}
    qpis = [float(m["calculated_qpi"]) for m in metrics
            if m.get("task_id") in task_ids and m.get("calculated_qpi") is not None]
    avg_qpi = round(sum(qpis) / len(qpis), 2) if qpis else None

    done_points = sum(int(t.get("story_points") or 0) for t in project_tasks if _status(t) == STATUS_DONE)
    return {
        "project_id"               : project_id,
        "project_name"             : project.get("project_name"),
        "total_budget"             : round(bac, 2),

        # Core EVM (same currency)
        "total_pv"                 : round(total_pv, 2),
        "total_ev"                 : round(total_ev, 2),
        "total_ac"                 : total_ac,
        "cpi"                      : cpi,
        "spi"                      : spi,
        "qpi"                      : avg_qpi,

        # Forecasts (None until actual cost is entered)
        "ai_prediction_eac"        : eac,
        "ai_variance_at_completion": vac,
        "etc"                      : round(eac - total_ac, 2) if eac is not None and total_ac is not None else None,
        "percent_complete"         : round(100 * total_ev / bac, 1) if bac else 0.0,

        # Data quality flags so the UI/AI can explain gaps honestly
        "ac_entered"               : total_ac is not None,
        "ac_sprints_entered"       : len(ac_entered),
        "schedule_known"           : schedule_known,
        "calc_version"             : CALC_VERSION,

        # Extra context
        "done_story_points"        : done_points,
        "budget_per_point"         : budget_per_point,
        "sprint_count"             : len(sprints),
        "task_count"               : len(project_tasks),
        "health"                   : _health_label(cpi, spi),
        "sprint_breakdown"         : sprint_summaries,
        "task_values"              : task_values,
    }


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


def _health_label(cpi: Optional[float], spi: Optional[float]) -> str:
    """Human-readable health from whichever indices are known."""
    known = [v for v in (cpi, spi) if v is not None]
    if not known:
        return "Gray - No data"
    worst = min(known)
    if worst >= 1.0:
        return "Green - On track"
    if worst >= 0.8:
        return "Yellow - At risk"
    return "Red - Off track"


def _empty_evm_result(project_id, total_budget, reason="") -> Dict:
    return {
        "project_id"               : project_id,
        "total_budget"             : total_budget,
        "total_pv"                 : 0.0,
        "total_ev"                 : 0.0,
        "total_ac"                 : None,
        "cpi"                      : None,
        "spi"                      : None,
        "qpi"                      : None,
        "ai_prediction_eac"        : None,
        "ai_variance_at_completion": None,
        "etc"                      : None,
        "percent_complete"         : 0.0,
        "ac_entered"               : False,
        "ac_sprints_entered"       : 0,
        "schedule_known"           : False,
        "calc_version"             : CALC_VERSION,
        "done_story_points"        : 0,
        "health"                   : "Gray - No data",
        "sprint_breakdown"         : [],
        "task_values"              : [],
        "reason"                   : reason,
    }
