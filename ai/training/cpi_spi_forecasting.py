"""Module 3 — CPI & SPI forecasting.

Predicts where CPI and SPI will END UP at project completion, given the partial
trajectory so far. One MultiOutput gradient-boosted regressor -> two targets.

Run:  python -m ai.training.cpi_spi_forecasting
"""
from __future__ import annotations

import numpy as np
from sklearn.ensemble import GradientBoostingRegressor
from sklearn.multioutput import MultiOutputRegressor
from sklearn.model_selection import train_test_split
from sklearn.metrics import mean_absolute_error, r2_score

from .dataset import build_training_frame, X_of
from ..model_io import save_model


def train():
    df = build_training_frame()
    X = X_of(df)
    y = df[["y_final_cpi", "y_final_spi"]].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0)

    model = MultiOutputRegressor(
        GradientBoostingRegressor(n_estimators=200, max_depth=3, random_state=0)
    )
    model.fit(Xtr, ytr)

    pred = model.predict(Xte)
    print("CPI/SPI forecasting:")
    print(f"  CPI  MAE={mean_absolute_error(yte[:,0], pred[:,0]):.4f}  R2={r2_score(yte[:,0], pred[:,0]):.3f}")
    print(f"  SPI  MAE={mean_absolute_error(yte[:,1], pred[:,1]):.4f}  R2={r2_score(yte[:,1], pred[:,1]):.3f}")
    save_model("cpi_spi_forecasting", model)
    return model


if __name__ == "__main__":
    train()
