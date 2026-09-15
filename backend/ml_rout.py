
from __future__ import annotations

import os

import random

from datetime import datetime, timedelta, date

from typing import Optional, List, Dict, Any

import numpy as np

import pandas as pd

from fastapi import APIRouter, HTTPException, Query

from pydantic import BaseModel, Field

from sklearn.linear_model import LinearRegression

from sklearn.ensemble import RandomForestClassifier, RandomForestRegressor

from sklearn.model_selection import train_test_split

from db_connection import get_connection

router = APIRouter(prefix="/ml", tags=["ML Predictions"])

DATA_DIR = os.path.join(os.path.dirname(__file__), "ml_data")

os.makedirs(DATA_DIR, exist_ok=True)

_MODELS: dict = {}

def _fetch_project_and_history(project_id: int) -> tuple[Optional[Dict[str, Any]], List[Dict[str, Any]]]:

    """

    Fetches project details and all historical EVM snapshots from PostgreSQL.

    Returns (project_dict, list_of_history_snapshots).

    """

    conn = get_connection()

    if not conn:

        raise HTTPException(status_code=500, detail="Database connection failed")

    try:

        cursor = conn.cursor()

        # 1. Fetch project metadata

        cursor.execute(

            """

            SELECT project_id, project_name, total_budget, start_date, end_date

            FROM Projects

            WHERE project_id = %s

            """,

            [project_id]

        )

        proj_row = cursor.fetchone()

        if not proj_row:

            return None, []

        project = {

            "project_id": proj_row[0],

            "project_name": proj_row[1],

            "total_budget": float(proj_row[2] or 0.0),

            "start_date": proj_row[3],

            "end_date": proj_row[4],

        }

        # 2. Fetch historical snapshots ordered chronologically

        cursor.execute(

            """

            SELECT history_id, snapshot_date, total_pv, total_ev, total_ac,

                   cpi, spi, qpi, ai_prediction_eac, ai_variance_at_completion

            FROM EVM_History

            WHERE project_id = %s

            ORDER BY snapshot_date ASC, history_id ASC

            """,

            [project_id]

        )

        rows = cursor.fetchall()

        history = [

            {

                "history_id": r[0],

                "snapshot_date": r[1],

                "total_pv": float(r[2] or 0.0),

                "total_ev": float(r[3] or 0.0),

                "total_ac": float(r[4] or 0.0),

                "cpi": float(r[5]) if r[5] is not None else None,

                "spi": float(r[6]) if r[6] is not None else None,

                "qpi": float(r[7]) if r[7] is not None else None,

                "ai_prediction_eac": float(r[8]) if r[8] is not None else None,

                "ai_variance_at_completion": float(r[9]) if r[9] is not None else None,

            }

            for r in rows

        ]

        return project, history

    finally:

        cursor.close()

        conn.close()

def _get_live_evm_fallback(project_id: int) -> Dict[str, Any]:

    """

    Computes current EVM metrics directly from active sprints and tasks

    if EVM_History has insufficient snapshots.

    """

    try:

        from evm_service import calculate_and_save_evm

        evm_res = calculate_and_save_evm(project_id, budget_per_point=100.0, save_snapshot=False)

        if "error" not in evm_res:

            return evm_res

    except Exception as e:

        print(f"[ML_router] live EVM fallback error: {e}")

    return {

        "project_id": project_id,

        "total_pv": 0.0,

        "total_ev": 0.0,

        "total_ac": 0.0,

        "cpi": 1.0,

        "spi": 1.0,

        "ai_prediction_eac": 0.0,

    }

class GraphPoint(BaseModel):

    week: int

    label: str

    date: str

    predicted_cpi: float

    predicted_spi: float

    predicted_eac: float

    predicted_delay_days: float

    expected_cost: float

    x: str

    y: float

class HistoricalPoint(BaseModel):

    snapshot_date: Optional[str]

    cpi: Optional[float]

    spi: Optional[float]

    ev: float

    ac: float

    pv: float

    eac: Optional[float]

class EVMPredictionResponse(BaseModel):

    project_id: int

    project_name: str

    total_budget: float

    current_cpi: float

    current_spi: float

    predicted_eac: float

    predicted_delay_days: float

    status_warning: str

    graph_data: List[GraphPoint]

    historical_points: List[HistoricalPoint]

    historical_snapshots_count: int

    model_type: str

    message: str

def compute_evm_forecast(project_id: int) -> Dict[str, Any]:

    """

    Core ML Forecasting Engine:

    1. Fetches historical EVM data (CPI, SPI, EV, AC, PV) from PostgreSQL EVM_History.

    2. Uses scikit-learn LinearRegression to train on historical CPI and SPI trends over time.

    3. Predicts Estimated At Completion (EAC) and project delay in days.

    4. Generates a 4-week future forecast curve (dates vs. expected cost/schedule).

    5. Returns structured JSON with status warnings and fallback handling.

    """

    project, history = _fetch_project_and_history(project_id)

    if not project:

        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    budget = project["total_budget"]

    start_date = project["start_date"]

    end_date = project["end_date"]

    # Calculate planned project duration in days

    if start_date and end_date:

        try:

            s_dt = pd.to_datetime(start_date)

            e_dt = pd.to_datetime(end_date)

            planned_days = max(1.0, float((e_dt - s_dt).days))

        except Exception:

            planned_days = 90.0

    else:

        planned_days = 90.0

    valid_snapshots = [h for h in history if h.get("cpi") is not None and h.get("spi") is not None]

    n_points = len(valid_snapshots)

    historical_points: List[Dict[str, Any]] = []

    for h in history:

        s_date = h["snapshot_date"]

        s_str = s_date.strftime("%Y-%m-%d") if isinstance(s_date, (datetime, date)) else (str(s_date)[:10] if s_date else None)

        historical_points.append({

            "snapshot_date": s_str,

            "cpi": round(h["cpi"], 2) if h["cpi"] is not None else None,

            "spi": round(h["spi"], 2) if h["spi"] is not None else None,

            "ev": round(h["total_ev"], 2),

            "ac": round(h["total_ac"], 2),

            "pv": round(h["total_pv"], 2),

            "eac": round(h["ai_prediction_eac"], 2) if h["ai_prediction_eac"] is not None else None,

        })

    if n_points < 2:

        if n_points == 1:

            latest = valid_snapshots[-1]

            current_cpi = float(latest["cpi"] or 1.0)

            current_spi = float(latest["spi"] or 1.0)

            current_ac = float(latest["total_ac"] or 0.0)

            current_ev = float(latest["total_ev"] or 0.0)

            base_date = latest["snapshot_date"]

        else:

            live = _get_live_evm_fallback(project_id)

            current_cpi = float(live.get("cpi") or 1.0)

            current_spi = float(live.get("spi") or 1.0)

            current_ac = float(live.get("total_ac") or 0.0)

            current_ev = float(live.get("total_ev") or 0.0)

            base_date = datetime.utcnow()

        model_type = "Fallback Calculation (Deterministic EVM)"

        # Standard EVM formulas: EAC = BAC / CPI

        predicted_eac = round(budget / max(current_cpi, 0.1), 2) if budget > 0 else round(current_ac, 2)

        # Delay = (PlannedDays / SPI) - PlannedDays

        predicted_delay_days = max(0.0, round((planned_days / max(current_spi, 0.1)) - planned_days, 1))

        if not isinstance(base_date, (datetime, date)):

            base_date = datetime.utcnow()

        elif isinstance(base_date, date) and not isinstance(base_date, datetime):

            base_date = datetime.combine(base_date, datetime.min.time())

        # Generate 4-week steady projection

        graph_data: List[Dict[str, Any]] = []

        for w in range(1, 5):

            f_date = base_date + timedelta(weeks=w)

            d_str = f_date.strftime("%Y-%m-%d")

            # Cost progresses smoothly towards predicted EAC

            exp_cost = round(current_ac + (predicted_eac - current_ac) * (w / 4.0), 2)

            graph_data.append({

                "week": w,

                "label": f"Week {w} (+{w*7}d)",

                "date": d_str,

                "predicted_cpi": round(current_cpi, 2),

                "predicted_spi": round(current_spi, 2),

                "predicted_eac": predicted_eac,

                "predicted_delay_days": predicted_delay_days,

                "expected_cost": exp_cost,

                "x": d_str,

                "y": predicted_eac,

            })

    else:

        model_type = "LinearRegression (Time-Series Extrapolation)"

        latest = valid_snapshots[-1]

        current_cpi = float(latest["cpi"])

        current_spi = float(latest["spi"])

        current_ac = float(latest["total_ac"])

        current_ev = float(latest["total_ev"])

        base_date = latest["snapshot_date"]

        if not isinstance(base_date, (datetime, date)):

            base_date = datetime.utcnow()

        elif isinstance(base_date, date) and not isinstance(base_date, datetime):

            base_date = datetime.combine(base_date, datetime.min.time())

        # Prepare regression features: step indices 0, 1, ..., N-1

        X = np.arange(n_points).reshape(-1, 1)

        y_cpi = np.array([float(h["cpi"]) for h in valid_snapshots])

        y_spi = np.array([float(h["spi"]) for h in valid_snapshots])

        # Train scikit-learn LinearRegression models

        reg_cpi = LinearRegression().fit(X, y_cpi)

        reg_spi = LinearRegression().fit(X, y_spi)

        graph_data = []

        for w in range(1, 5):

            future_step = np.array([[n_points - 1 + w]])

            raw_cpi = float(reg_cpi.predict(future_step)[0])

            raw_spi = float(reg_spi.predict(future_step)[0])

            # Bound predictions within realistic domain limits (0.1 to 2.5)

            pred_cpi_w = max(0.1, min(2.5, raw_cpi))

            pred_spi_w = max(0.1, min(2.5, raw_spi))

            f_date = base_date + timedelta(weeks=w)

            d_str = f_date.strftime("%Y-%m-%d")

            eac_w = round(budget / pred_cpi_w, 2) if budget > 0 else round(current_ac, 2)

            delay_w = max(0.0, round((planned_days / pred_spi_w) - planned_days, 1))

            exp_cost = round(current_ac + (eac_w - current_ac) * (w / 4.0), 2)

            graph_data.append({

                "week": w,

                "label": f"Week {w} (+{w*7}d)",

                "date": d_str,

                "predicted_cpi": round(pred_cpi_w, 2),

                "predicted_spi": round(pred_spi_w, 2),

                "predicted_eac": eac_w,

                "predicted_delay_days": delay_w,

                "expected_cost": exp_cost,

                "x": d_str,

                "y": eac_w,

            })

        # Terminal prediction (at week 4)

        terminal = graph_data[-1]

        predicted_eac = terminal["predicted_eac"]

        predicted_delay_days = terminal["predicted_delay_days"]

    if current_cpi < 0.80 or current_spi < 0.80 or predicted_delay_days > 30.0:

        status_warning = "Critical Delay"

    elif current_cpi < 0.95 or current_spi < 0.95 or predicted_delay_days > 7.0:

        status_warning = "At Risk"

    else:

        status_warning = "On Track"

    return {

        "project_id": project_id,

        "project_name": project["project_name"],

        "total_budget": budget,

        "current_cpi": round(current_cpi, 2),

        "current_spi": round(current_spi, 2),

        "predicted_eac": predicted_eac,

        "predicted_delay_days": predicted_delay_days,

        "status_warning": status_warning,

        "graph_data": graph_data,

        "historical_points": historical_points,

        "historical_snapshots_count": n_points,

        "model_type": model_type,

        "message": (

            f"Successfully trained {model_type} on {n_points} historical snapshots."

            if n_points >= 2 else

            "Notice: Insufficient historical snapshots (<2). Generated prediction using deterministic EVM fallback."

        ),

    }

@router.get(

    "/predict/{project_id}",

    response_model=EVMPredictionResponse,

    summary="Predict Project Cost Overrun \& Schedule Delay",

    description=(

        "Fetches historical EVM data from PostgreSQL EVM_History table, trains a scikit-learn "

        "LinearRegression model on CPI/SPI trends over time, predicts EAC and delay in days, "

        "and generates a 4-week forecast curve."

    ),

)

def api_predict_project_evm_path(project_id: int):

    return compute_evm_forecast(project_id)

@router.post(

    "/predict/{project_id}",

    response_model=EVMPredictionResponse,

    summary="Predict Project Cost Overrun \& Schedule Delay (POST)",

)

def api_predict_project_evm_post(project_id: int):

    return compute_evm_forecast(project_id)

@router.get(

    "/predict",

    response_model=EVMPredictionResponse,

    summary="Predict Project Cost Overrun (Query Param)",

)

def api_predict_project_evm_query(project_id: int = Query(..., description="Project ID from PostgreSQL")):

    return compute_evm_forecast(project_id)

@router.get("/risk-index", summary="Risk Probability Index")

def get_risk_index(project_id: int = Query(..., description="Project ID")):

    """

    Evaluates project risk based on historical CPI \& SPI breach thresholds.

    High Risk flagged if CPI < 0.85 AND SPI < 0.85 across >= 2 snapshots.

    """

    project, history = _fetch_project_and_history(project_id)

    if not project:

        raise HTTPException(status_code=404, detail=f"Project {project_id} not found")

    breach_count = 0

    for h in history:

        cpi = h.get("cpi")

        spi = h.get("spi")

        if cpi is not None and spi is not None and cpi < 0.85 and spi < 0.85:

            breach_count += 1

    is_high_risk = breach_count >= 2

    return {

        "project_id": project_id,

        "high_risk": is_high_risk,

        "breach_count": breach_count,

        "total_snapshots": len(history),

        "status": "High Risk" if is_high_risk else "Within Tolerance",

    }

@router.get("/anomalies", summary="Anomalous Data Normalizer")

def get_anomalies(project_id: int = Query(..., description="Project ID")):

    """

    Scans project tasks and metrics for irregularities (e.g. Done tasks with 0 points,

    abnormal bug-to-story ratios, negative quality spikes).

    """

    conn = get_connection()

    if not conn:

        raise HTTPException(status_code=500, detail="Database connection failed")

    try:

        cursor = conn.cursor()

        cursor.execute(

            """

            SELECT t.task_id, t.external_id, t.task_description, t.status, t.story_points,

                   m.critical_bugs, m.calculated_qpi

            FROM Tasks t

            JOIN Sprints s ON t.sprint_id = s.sprint_id

            LEFT JOIN Metrics m ON t.task_id = m.task_id

            WHERE s.project_id = %s

            """,

            [project_id]

        )

        rows = cursor.fetchall()

        anomalies = []

        for r in rows:

            tid, ext_id, desc, status, points, crit_bugs, qpi = r

            if status == "Done" and (points or 0) == 0:

                anomalies.append({

                    "task_id": tid,

                    "external_id": ext_id,

                    "type": "Zero-Point Completion",

                    "date": datetime.utcnow().strftime("%Y-%m-%d"),

                    "impact_ev": 0,

                    "severity": "Low",

                })

            if (crit_bugs or 0) >= 2 and status in ("In Progress", "To Do"):

                anomalies.append({

                    "task_id": tid,

                    "external_id": ext_id,

                    "type": "Critical Defect Blocker",

                    "date": datetime.utcnow().strftime("%Y-%m-%d"),

                    "impact_ev": - (points or 0) * 100,

                    "severity": "High",

                })

        return {

            "project_id": project_id,

            "total_anomalies": len(anomalies),

            "anomalies": anomalies,

        }

    finally:

        cursor.close()

        conn.close()

class WhatIfRequest(BaseModel):

    project_id: int

    capacity_pct: float

    base_eac: float

@router.post("/whatif", summary="Monte Carlo What-If Simulation")

def run_what_if(body: WhatIfRequest):

    """

    Simulates changes to project EAC under varying team resource capacity percentages.

    """

    base_eac = body.base_eac

    cap = body.capacity_pct

    factor = 1.0 - (cap / 100.0) * 0.4

    adjusted_eac = round(base_eac * max(0.6, factor), 2)

    delta = round(adjusted_eac - base_eac, 2)

    # Simulation curve from -50% to +50%

    curve = []

    for c in range(-50, 55, 10):

        c_factor = 1.0 - (c / 100.0) * 0.4

        curve.append({

            "capacity_pct": c,

            "eac": round(base_eac * max(0.6, c_factor), 2),

        })

    return {

        "project_id": body.project_id,

        "capacity_pct": cap,

        "base_eac": base_eac,

        "adjusted_eac": adjusted_eac,

        "delta": delta,

        "curve": curve,

    }

def _train_cost_model():

    # NOTE: filename bumped to _v2 so a fresh dataset (with ac/cpi/spi) is
    # always regenerated instead of silently reusing the old cached CSV.
    fp = os.path.join(DATA_DIR, "cost_dataset_v2.csv")

    if not os.path.exists(fp):

        rows = []

        for _ in range(3000):

            budget = random.randint(20000, 150000)

            duration = random.randint(3, 18)

            team_size = random.randint(2, 15)

            complexity = random.randint(1, 5)

            cpi = random.uniform(0.6, 1.3)

            spi = random.uniform(0.6, 1.3)

            ac_so_far = budget * random.uniform(0.2, 0.9)

            risk = random.uniform(0.8, 1.5)

            actual = (
                (budget * risk)
                + (complexity * 4000)
                + (duration * 1500)
                - (team_size * 800)
                + (ac_so_far * (1.0 / cpi - 1.0))
            )

            actual = max(actual, budget * 0.7)

            rows.append([budget, duration, team_size, complexity, ac_so_far, cpi, spi, actual])

        pd.DataFrame(

            rows, columns=["budget", "duration", "team_size", "complexity",
                           "ac_so_far", "cpi", "spi", "actual_cost"]

        ).to_csv(fp, index=False)

    df = pd.read_csv(fp)

    df["cost_per_person"] = df["budget"] / df["team_size"]

    X = df[["budget", "duration", "team_size", "complexity",
            "ac_so_far", "cpi", "spi", "cost_per_person"]]

    y = df["actual_cost"]

    Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, random_state=42)

    m = RandomForestRegressor(

        n_estimators=300, max_depth=10, min_samples_split=5,

        min_samples_leaf=2, random_state=42,

    )

    m.fit(Xtr, ytr)

    return m

class CostOverrunIn(BaseModel):

    budget: float = Field(..., gt=0)

    ac: float = Field(..., ge=0, description="Actual cost so far")

    cpi: float = Field(..., gt=0)

    spi: float = Field(..., gt=0)

    duration: Optional[int] = Field(default=12, ge=1)

    team_size: Optional[int] = Field(default=6, ge=1)

    complexity: Optional[int] = Field(default=3, ge=1, le=5)

@router.post("/cost-overrun")

def predict_cost_overrun(body: CostOverrunIn):

    if "cost" not in _MODELS:

        _MODELS["cost"] = _train_cost_model()

    team_size = body.team_size if body.team_size is not None else 6

    duration = body.duration if body.duration is not None else 12

    complexity = body.complexity if body.complexity is not None else 3

    feat = pd.DataFrame([{

        "budget": body.budget,

        "duration": duration,

        "team_size": team_size,

        "complexity": complexity,

        "ac_so_far": body.ac,

        "cpi": body.cpi,

        "spi": body.spi,

        "cost_per_person": body.budget / max(team_size, 1),

    }])

    predicted_actual_cost = float(_MODELS["cost"].predict(feat)[0])

    overrun_amount = predicted_actual_cost - body.budget

    overrun_pct = (overrun_amount / body.budget) * 100

    cpi_factor = max(0.0, min(1.0, (2.0 - body.cpi) / 2.0))

    predicted_ratio = max(0.0, overrun_amount / body.budget)

    prob_overrun = round(min(1.0, max(0.0, (cpi_factor * 0.6 + min(predicted_ratio, 1.0) * 0.4))), 3)

    if prob_overrun >= 0.65:

        risk_level = "High"

    elif prob_overrun >= 0.40:

        risk_level = "Medium"

    else:

        risk_level = "Low"

    predicted_eac = round(predicted_actual_cost, 2)

    predicted_variance = round(body.budget - predicted_actual_cost, 2)

    individual_preds = [t.predict(feat)[0] for t in _MODELS["cost"].estimators_]

    std_dev = float(np.std(individual_preds))

    confidence = round(max(0.5, min(0.99, 1.0 - std_dev / max(predicted_actual_cost, 1))), 3)

    return {

        "prediction": "Overrun" if overrun_amount > 0 else "On Budget",

        "probability_of_overrun": prob_overrun,

        "risk_level": risk_level,

        "predicted_eac": predicted_eac,

        "predicted_variance": predicted_variance,

        "confidence": confidence,

        "model": "RandomForestRegressor",

        "overrun_amount": round(overrun_amount, 2),

        "overrun_percent": round(overrun_pct, 2),

        "current_cpi": body.cpi,

        "current_spi": body.spi,

    }

def _train_delay_model():

    # NOTE: filename bumped to _v2 so a fresh dataset (with elapsed/remaining
    # days included) is always regenerated instead of reusing the old CSV.
    fp = os.path.join(DATA_DIR, "delay_dataset_v2.csv")

    if not os.path.exists(fp):

        rows = []

        for _ in range(3000):

            planned_days = random.randint(30, 540)

            elapsed_days = random.uniform(0, planned_days)

            team = random.randint(2, 15)

            complexity = random.randint(1, 5)

            bugs = random.randint(0, 50)

            pending = random.randint(0, 40)

            progress = random.randint(20, 100)

            risk = random.uniform(0.5, 1.5)

            remaining_days = max(planned_days - elapsed_days, 0.0)

            time_pressure = (elapsed_days / planned_days) * 100.0

            score = (
                (progress * 0.4) + (team * 2) - (complexity * 5)
                - (bugs * 0.3) - (pending * 0.4) - (time_pressure - progress) * 0.3
            )

            status = "OnTime" if score > 60 else "Risk" if score > 40 else "Delay"

            rows.append([planned_days, elapsed_days, remaining_days, team,
                         complexity, bugs, pending, progress, risk, status])

        pd.DataFrame(rows, columns=[

            "planned_duration_days", "elapsed_days", "remaining_days", "team_size",
            "complexity", "bugs", "pending_tasks", "progress", "risk", "status"

        ]).to_csv(fp, index=False)

    df = pd.read_csv(fp)

    X = df[["planned_duration_days", "elapsed_days", "remaining_days", "team_size",
            "complexity", "bugs", "pending_tasks", "progress", "risk"]]

    y = df["status"]

    Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, random_state=42)

    m = RandomForestClassifier(n_estimators=200, random_state=42)

    m.fit(Xtr, ytr)

    return m

class ScheduleSlipIn(BaseModel):

    planned_duration_days: float = Field(..., gt=0)

    elapsed_days: float = Field(..., ge=0)

    spi: float = Field(..., gt=0)

    completed_pct: float = Field(..., ge=0, le=100)

    team_size: Optional[int] = Field(default=6, ge=1)

    complexity: Optional[int] = Field(default=3, ge=1, le=5)

    bugs: Optional[int] = Field(default=5, ge=0)

    pending_tasks: Optional[int] = Field(default=10, ge=0)

@router.post("/schedule-slip")

def predict_schedule_slip(body: ScheduleSlipIn):

    if "delay" not in _MODELS:

        _MODELS["delay"] = _train_delay_model()

    remaining_days_input = max(body.planned_duration_days - body.elapsed_days, 0.0)

    risk = 1 / max(body.spi, 0.01)

    feat = pd.DataFrame([{

        "planned_duration_days": body.planned_duration_days,

        "elapsed_days": body.elapsed_days,

        "remaining_days": remaining_days_input,

        "team_size": body.team_size,

        "complexity": body.complexity,

        "bugs": body.bugs,

        "pending_tasks": body.pending_tasks,

        "progress": body.completed_pct,

        "risk": risk,

    }])

    pred_label = str(_MODELS["delay"].predict(feat)[0])

    proba = _MODELS["delay"].predict_proba(feat)[0]

    classes = list(_MODELS["delay"].classes_)

    proba_dict = {c: round(float(p), 3) for c, p in zip(classes, proba)}

    delay_prob   = proba_dict.get("Delay", 0.0)

    risk_prob    = proba_dict.get("Risk", 0.0)

    prob_slip = round(delay_prob + risk_prob * 0.5, 3)

    if pred_label == "Delay":

        risk_level = "High"

    elif pred_label == "Risk":

        risk_level = "Medium"

    else:

        risk_level = "Low"

    remaining_pct = max(0.0, 100.0 - body.completed_pct) / 100.0

    remaining_days = body.planned_duration_days * remaining_pct

    if 0 < body.spi < 1.0:

        expected_finish = remaining_days / body.spi

        predicted_finish_delay_days = max(0, int(round(expected_finish - remaining_days)))

    else:

        predicted_finish_delay_days = 0 if pred_label == "OnTime" else int(remaining_days * 0.1)

    confidence = round(float(max(proba)), 3)

    return {

        "prediction": pred_label,

        "probability_of_slip": prob_slip,

        "risk_level": risk_level,

        "predicted_finish_delay_days": predicted_finish_delay_days,

        "confidence": confidence,

        "model": "RandomForestClassifier",

        "probabilities": proba_dict,

        "spi": body.spi,

        "completed_pct": body.completed_pct,

    }

def _train_defects_model():

    # NOTE: filename bumped to _v2 so the rebalanced dataset is regenerated
    # instead of reusing the old, noise-dominated CSV.
    fp = os.path.join(DATA_DIR, "defects_dataset_v2.csv")

    if not os.path.exists(fp):

        rows = []

        for _ in range(2000):

            sp = random.randint(5, 100)

            team = random.randint(2, 15)

            past = random.randint(0, 30)

            qpi = random.uniform(0.5, 1.0)

            # story_points/team_size now carry a comparable weight to
            # past_defects/qpi, and noise is tightened so it no longer
            # swamps the story_points/team_size signal.
            future = max(0, int(
                past * (1.5 - qpi)
                + (sp / max(team, 1)) * 1.2
                + random.gauss(0, 1)
            ))

            rows.append([sp, team, past, qpi, future])

        pd.DataFrame(rows, columns=["story_points", "team_size",

                                     "past_defects", "qpi", "future_defects"]

                     ).to_csv(fp, index=False)

    df = pd.read_csv(fp)

    X = df[["story_points", "team_size", "past_defects", "qpi"]]

    y = df["future_defects"]

    Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, random_state=42)

    m = RandomForestRegressor(n_estimators=200, random_state=42)

    m.fit(Xtr, ytr)

    return m

class DefectsIn(BaseModel):

    story_points: float = Field(..., ge=0)

    team_size: int = Field(..., ge=1)

    past_defects: float = Field(..., ge=0)

    qpi: float = Field(..., ge=0, le=100.0)

@router.post("/defects")

def predict_defects(body: DefectsIn):

    if "defects" not in _MODELS:

        _MODELS["defects"] = _train_defects_model()

    effective_qpi = body.qpi / 100.0 if body.qpi > 1.5 else body.qpi

    feat = pd.DataFrame([{

        "story_points": body.story_points,

        "team_size": body.team_size,

        "past_defects": body.past_defects,

        "qpi": effective_qpi,

    }])

    pred = float(_MODELS["defects"].predict(feat)[0])

    predicted_defects = round(pred, 1)

    qpi_norm = min(1.0, effective_qpi)

    critical_share = round(max(0.0, min(0.5, (1.0 - qpi_norm) * 0.5)), 3)

    critical_count = critical_share * predicted_defects

    recommended_qa_hours = round(predicted_defects * 2.0 + critical_count * 3.0, 1)

    individual_preds = [t.predict(feat)[0] for t in _MODELS["defects"].estimators_]

    std_dev = float(np.std(individual_preds))

    confidence = round(max(0.5, min(0.99, 1.0 - std_dev / max(pred + 1, 1))), 3)

    return {

        "prediction": predicted_defects,

        "predicted_defects_next_sprint": predicted_defects,

        "expected_defects_next_sprint": predicted_defects,

        "critical_share": critical_share,

        "recommended_qa_hours": recommended_qa_hours,

        "confidence": confidence,

        "model": "RandomForestRegressor",

        "inputs": body.dict(),

    }

def _train_health_model():

    # NOTE: filename bumped to _v2 so a dataset that includes qpi/velocity
    # is always regenerated instead of reusing the old cached CSV.
    fp = os.path.join(DATA_DIR, "cpi_spi_dataset_v2.csv")

    if not os.path.exists(fp):

        rows = []

        for _ in range(2000):

            PV = random.randint(10000, 100000)

            EV = random.randint(8000, PV)

            AC = random.randint(9000, 120000)

            t = random.randint(1, 12)

            QPI = random.uniform(0.5, 1.3)

            velocity = random.randint(5, 60)

            CPI = EV / AC

            SPI = EV / PV

            status = ("Healthy" if CPI >= 1 and SPI >= 1 and QPI >= 0.9

                      else "At Risk" if CPI >= 0.8 and SPI >= 0.8 and QPI >= 0.7

                      else "Critical")

            rows.append([PV, EV, AC, t, CPI, SPI, QPI, velocity, status])

        pd.DataFrame(rows, columns=["PV", "EV", "AC", "time", "CPI", "SPI",
                                     "QPI", "velocity", "status"]

                     ).to_csv(fp, index=False)

    df = pd.read_csv(fp)

    X = df[["PV", "EV", "AC", "time", "CPI", "SPI", "QPI", "velocity"]]

    y = df["status"]

    Xtr, _, ytr, _ = train_test_split(X, y, test_size=0.2, random_state=42)

    m = RandomForestClassifier(n_estimators=200, random_state=42)

    m.fit(Xtr, ytr)

    return m

class HealthIn(BaseModel):

    cpi: float = Field(..., gt=0)

    spi: float = Field(..., gt=0)

    qpi: float = Field(..., ge=0)

    team_velocity: float = Field(..., ge=0)

    pv: Optional[float] = Field(default=50000, gt=0)

    ev: Optional[float] = Field(default=45000, gt=0)

    ac: Optional[float] = Field(default=48000, gt=0)

    time: Optional[int] = Field(default=6, ge=1)

@router.post("/health")

def predict_health(body: HealthIn):

    if "health" not in _MODELS:

        _MODELS["health"] = _train_health_model()

    feat = pd.DataFrame([{

        "PV": body.pv, "EV": body.ev, "AC": body.ac,

        "time": body.time, "CPI": body.cpi, "SPI": body.spi,

        "QPI": body.qpi, "velocity": body.team_velocity,

    }])

    pred_internal = str(_MODELS["health"].predict(feat)[0])

    proba = _MODELS["health"].predict_proba(feat)[0]

    classes = list(_MODELS["health"].classes_)

    proba_internal = {c: round(float(p), 3) for c, p in zip(classes, proba)}

    label_map = {"Healthy": "Green", "At Risk": "Yellow", "Critical": "Red"}

    predicted_health = label_map.get(pred_internal, "Yellow")

    probability = {

        "Green":  proba_internal.get("Healthy", 0.0),

        "Yellow": proba_internal.get("At Risk", 0.0),

        "Red":    proba_internal.get("Critical", 0.0),

    }

    confidence = round(float(max(proba)), 3)

    return {

        "prediction": pred_internal,

        "predicted_health": predicted_health,

        "health_color": predicted_health,

        "probability": probability,

        "probabilities": proba_internal,

        "confidence": confidence,

        "model": "RandomForestClassifier",

        "qpi": body.qpi,

        "team_velocity": body.team_velocity,

    }