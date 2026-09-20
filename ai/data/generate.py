"""Synthetic EVM dataset generator.

Why this exists: a brand-new platform has no historical EVM data, so the ML
models have nothing to learn from. This simulates many realistic projects
evolving sprint-by-sprint (healthy, cost-overrun, schedule-slip, troubled) and
writes two tables:

  sprints.csv  -> one row per (project, sprint): time-series + point-in-time EVM
  projects.csv -> one row per project: final outcomes (labels for the models)

Run:  python -m ai.data.generate --projects 800
"""
from __future__ import annotations

import argparse
import numpy as np
import pandas as pd

from ..config import SPRINTS_CSV, PROJECTS_CSV
from ..evm import compute_evm

PROFILES = {
    # profile: (cpi_center, spi_center, quality_center)  -- "true" efficiency the sim drifts around
    "healthy":       (1.02, 1.02, 0.85),
    "cost_overrun":  (0.82, 0.98, 0.75),
    "schedule_slip": (0.99, 0.80, 0.70),
    "troubled":      (0.78, 0.80, 0.55),
}
PROFILE_WEIGHTS = [0.40, 0.22, 0.22, 0.16]


def _clip(x, lo, hi):
    return float(np.clip(x, lo, hi))


def simulate_project(rng: np.random.Generator, pid: int) -> tuple[list[dict], dict]:
    profile = rng.choice(list(PROFILES.keys()), p=PROFILE_WEIGHTS)
    cpi_c, spi_c, qual_c = PROFILES[profile]

    total_sprints = int(rng.integers(6, 21))
    bac = float(rng.integers(50, 500)) * 1000.0     # $50k .. $500k

    rows: list[dict] = []
    ac_cum = 0.0
    prev_actual = 0.0
    for t in range(1, total_sprints + 1):
        planned_pct = t / total_sprints
        # schedule efficiency this sprint -> earned progress
        spi_t = _clip(rng.normal(spi_c, 0.06), 0.4, 1.25)
        target_actual = _clip(planned_pct * spi_t, 0.0, 1.05)
        actual_pct = max(prev_actual, target_actual)     # progress is monotonic
        earned_this = max(actual_pct - prev_actual, 0.0)
        prev_actual = actual_pct

        # cost efficiency this sprint -> cost of the work earned this sprint
        cpi_t = _clip(rng.normal(cpi_c, 0.07), 0.5, 1.4)
        ac_cum += (earned_this * bac) / max(cpi_t, 0.3)

        # quality signals (Jira-derived in production)
        code_coverage = _clip(rng.normal(qual_c, 0.05), 0.3, 0.97)
        bug_severity_score = _clip(rng.normal(1 - qual_c, 0.08), 0.0, 1.0)
        tech_debt = _clip(rng.normal(1 - qual_c, 0.08), 0.0, 1.0)

        evm = compute_evm(bac, planned_pct, actual_pct, ac_cum,
                          code_coverage=code_coverage,
                          bug_severity_score=bug_severity_score,
                          tech_debt=tech_debt)
        rows.append({
            "project_id": f"P{pid:04d}",
            "profile": profile,
            "sprint_number": t,
            "total_sprints": total_sprints,
            "bac": round(bac, 2),
            "planned_pct": round(planned_pct, 4),
            "actual_pct": round(actual_pct, 4),
            "ac": round(ac_cum, 2),
            "code_coverage": round(code_coverage, 4),
            "bug_severity_score": round(bug_severity_score, 4),
            "tech_debt": round(tech_debt, 4),
            "cpi": round(evm.cpi, 4),
            "spi": round(evm.spi, 4),
            "qpi": round(evm.qpi, 4),
        })

    # ---- project-level outcomes (labels) from the final sprint ----
    last = rows[-1]
    final_cpi, final_spi = last["cpi"], last["spi"]
    overrun_ratio = last["ac"] / (bac * last["actual_pct"]) if last["actual_pct"] else last["ac"] / bac
    # extra sprints needed to reach 100% at the achieved velocity
    velocity = last["actual_pct"] / total_sprints
    remaining = max(0.0, 1.0 - last["actual_pct"])
    delay_sprints = remaining / velocity if velocity > 0 else 0.0

    if final_cpi >= 0.95 and final_spi >= 0.95:
        label = "on_track"
    elif final_cpi >= 0.85 and final_spi >= 0.85:
        label = "at_risk"
    else:
        label = "critical"

    outcome = {
        "project_id": f"P{pid:04d}",
        "profile": profile,
        "total_sprints": total_sprints,
        "bac": round(bac, 2),
        "final_cpi": final_cpi,
        "final_spi": final_spi,
        "overrun_ratio": round(overrun_ratio, 4),
        "delay_sprints": round(delay_sprints, 3),
        "delay_ratio": round(delay_sprints / total_sprints, 4),
        "success_label": label,
    }
    return rows, outcome


def generate(n_projects: int = 800, seed: int = 42) -> tuple[pd.DataFrame, pd.DataFrame]:
    rng = np.random.default_rng(seed)
    all_rows, outcomes = [], []
    for pid in range(1, n_projects + 1):
        rows, outcome = simulate_project(rng, pid)
        all_rows.extend(rows)
        outcomes.append(outcome)
    sprints = pd.DataFrame(all_rows)
    projects = pd.DataFrame(outcomes)
    sprints.to_csv(SPRINTS_CSV, index=False)
    projects.to_csv(PROJECTS_CSV, index=False)
    return sprints, projects


if __name__ == "__main__":
    ap = argparse.ArgumentParser()
    ap.add_argument("--projects", type=int, default=800)
    ap.add_argument("--seed", type=int, default=42)
    args = ap.parse_args()
    s, p = generate(args.projects, args.seed)
    print(f"Wrote {len(s)} sprint rows -> {SPRINTS_CSV}")
    print(f"Wrote {len(p)} project rows -> {PROJECTS_CSV}")
    print("\nSuccess label distribution:")
    print(p["success_label"].value_counts())
