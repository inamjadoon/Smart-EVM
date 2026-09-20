"""Module 3 — Project success / health classification.

Classifies a project as on_track / at_risk / critical from its mid-flight state,
and exposes calibrated-ish class probabilities for the GenAI layer to explain.
Run:  python -m ai.training.success_classification
"""
from __future__ import annotations

from sklearn.ensemble import GradientBoostingClassifier
from sklearn.model_selection import train_test_split
from sklearn.metrics import classification_report

from .dataset import build_training_frame, X_of
from ..model_io import save_model


def train():
    df = build_training_frame()
    X = X_of(df)
    y = df["y_success_label"].values
    Xtr, Xte, ytr, yte = train_test_split(X, y, test_size=0.2, random_state=0, stratify=y)

    model = GradientBoostingClassifier(n_estimators=200, max_depth=3, random_state=0)
    model.fit(Xtr, ytr)

    print("Success classification:")
    print(classification_report(yte, model.predict(Xte)))
    save_model("success_classification", model, classes=list(model.classes_))
    return model


if __name__ == "__main__":
    train()
