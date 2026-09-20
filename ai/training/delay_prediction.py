"""Module 3 — Schedule-delay prediction.

Predicts extra sprints needed beyond plan to reach 100%.
Run:  python -m ai.training.delay_prediction
"""
from __future__ import annotations

from sklearn.ensemble import GradientBoostingRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

from .dataset import build_training_frame, X_of
from ..model_io import save_model


def train():
    df = build_training_frame()
    X = X_of(df)
    y = df["y_delay_sprints"].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

    model = GradientBoostingRegressor(n_estimators=250, max_depth=3, random_state=0)
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    print("Delay prediction (extra sprints):")
    print(f"  MAE={mean_absolute_error(yte, pred):.4f}  R2={r2_score(yte, pred):.3f}")
    save_model("delay_prediction", model)
    return model


if __name__ == "__main__":
    train()
