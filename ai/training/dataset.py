"""Turn the generated CSVs into a supervised table.

For every project we emit one training sample per sprint t (t >= 2), using ONLY
the history up to t as features, labelled with that project's FINAL outcome.
This teaches the models to predict the endgame from a partial, mid-flight view —
exactly what a PM has in real life.
"""
from __future__ import annotations

import pandas as pd

from ..config import SPRINTS_CSV, PROJECTS_CSV
from ..features import build_features, FEATURE_NAMES


def build_training_frame() -> pd.DataFrame:
    if not SPRINTS_CSV.exists():
        raise FileNotFoundError(
            f"{SPRINTS_CSV} not found. Run:  python -m ai.data.generate"
        )
    sprints = pd.read_csv(SPRINTS_CSV)
    projects = pd.read_csv(PROJECTS_CSV).set_index("project_id")

    samples = []
    for pid, grp in sprints.groupby("project_id"):
        grp = grp.sort_values("sprint_number")
        history = grp.to_dict("records")
        outcome = projects.loc[pid]
        for t in range(2, len(history) + 1):        # need >=2 sprints for a slope
            feat = build_features(history[:t])
            feat.update({
                "project_id": pid,
                "y_final_cpi": outcome["final_cpi"],
                "y_final_spi": outcome["final_spi"],
                "y_overrun_ratio": outcome["overrun_ratio"],
                "y_delay_sprints": outcome["delay_sprints"],
                "y_success_label": outcome["success_label"],
            })
            samples.append(feat)
    return pd.DataFrame(samples)


def X_of(df: pd.DataFrame):
    return df[FEATURE_NAMES].values
