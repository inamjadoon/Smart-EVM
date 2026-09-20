"""Earned Value Management math + the custom Quality Performance Index (QPI).

This is the ground truth the ML models learn from and the GenAI layer explains.
Keep it pure (no I/O) so both the backend and the notebooks can reuse it.

Standard EVM identities:
    PV  = BAC * planned_pct         (Planned Value)
    EV  = BAC * actual_pct          (Earned Value = budgeted cost of work performed)
    AC  = actual cost incurred      (measured, not derived)
    CPI = EV / AC                   (>1 under budget, <1 over budget)
    SPI = EV / PV                   (>1 ahead,        <1 behind)
    CV  = EV - AC ;  SV = EV - PV
    EAC = BAC / CPI                 (forecast final cost, CPI method)
    ETC = EAC - AC ; VAC = BAC - EAC
    TCPI= (BAC - EV) / (BAC - AC)   (efficiency needed to finish on budget)
"""
from __future__ import annotations

from dataclasses import dataclass, asdict


def _safe_div(a: float, b: float, default: float = 0.0) -> float:
    return a / b if b else default


def compute_qpi(code_coverage: float, bug_severity_score: float, tech_debt: float) -> float:
    """Custom Quality Performance Index in [0, 1] (1 = excellent quality).

    code_coverage      : fraction 0..1 (higher better)
    bug_severity_score : 0..1 weighted open-bug severity (higher = worse)
    tech_debt          : 0..1 (higher = worse)
    """
    coverage = min(max(code_coverage, 0.0), 1.0)
    bugs = min(max(bug_severity_score, 0.0), 1.0)
    debt = min(max(tech_debt, 0.0), 1.0)
    qpi = 0.40 * coverage + 0.35 * (1.0 - bugs) + 0.25 * (1.0 - debt)
    return round(min(max(qpi, 0.0), 1.0), 4)


@dataclass
class EVMResult:
    pv: float
    ev: float
    ac: float
    cpi: float
    spi: float
    cv: float
    sv: float
    eac: float
    etc: float
    vac: float
    tcpi: float
    qpi: float
    percent_complete: float

    def as_dict(self) -> dict:
        return {k: round(v, 4) for k, v in asdict(self).items()}


def compute_evm(
    bac: float,
    planned_pct: float,
    actual_pct: float,
    ac: float,
    *,
    code_coverage: float = 0.8,
    bug_severity_score: float = 0.2,
    tech_debt: float = 0.2,
) -> EVMResult:
    """Compute a full EVM snapshot from the raw inputs the backend can supply."""
    pv = bac * planned_pct
    ev = bac * actual_pct
    cpi = _safe_div(ev, ac, default=1.0)
    spi = _safe_div(ev, pv, default=1.0)
    eac = _safe_div(bac, cpi, default=bac)
    tcpi = _safe_div(bac - ev, bac - ac, default=1.0)
    return EVMResult(
        pv=pv,
        ev=ev,
        ac=ac,
        cpi=cpi,
        spi=spi,
        cv=ev - ac,
        sv=ev - pv,
        eac=eac,
        etc=eac - ac,
        vac=bac - eac,
        tcpi=tcpi,
        qpi=compute_qpi(code_coverage, bug_severity_score, tech_debt),
        percent_complete=actual_pct,
    )
