"""Train every model in one shot (generates data first if missing).

Run:  python -m ai.training.train_all
"""
from __future__ import annotations

from ..config import SPRINTS_CSV
from ..data.generate import generate
from . import cpi_spi_forecasting, cost_prediction, delay_prediction, success_classification


def main():
    if not SPRINTS_CSV.exists():
        print("No dataset found -> generating synthetic data...")
        generate()
    print("\n=== Training all models ===\n")
    cpi_spi_forecasting.train()
    cost_prediction.train()
    delay_prediction.train()
    success_classification.train()
    print("\nAll models trained and saved to ai/models/.")


if __name__ == "__main__":
    main()
