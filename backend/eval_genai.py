"""
Benchmark the SmartEVM multi-agent assistant against the LIVE database + LLM.

Measures, per question and overall:
  * routing accuracy   — did the router pick the expected specialist(s)?
  * LLM success rate   — answered by the LLM vs. the rule-based fallback
  * latency            — p50 / p95 / max end-to-end
  * grounding          — share of numbers in an LLM answer that appear in the data the
                         agents actually fetched (catches invented figures)
  * tool usage         — which tools each agent called

Usage (from backend/):
    python eval_genai.py                       # as the first active Admin
    python eval_genai.py --role Developer      # see what a developer gets
    python eval_genai.py --json results.json   # also save raw results
"""
from __future__ import annotations

import argparse
import json
import re
import statistics
import sys
import time

import genai_agents as ga
from ai.genai import llm_client

# (question, expected specialists — any order; a subset match counts)
CASES = [
    ("What does SPI mean and how is it calculated?",            {"tutor"}),
    ("Give me an executive summary of the whole portfolio.",    {"portfolio"}),
    ("Which project is most over budget and by how much?",      {"portfolio"}),
    ("How is project 1 performing? Will it finish on time?",    {"portfolio"}),
    ("Which tasks are overdue right now?",                       {"delivery"}),
    ("What is the sprint progress for project 1?",              {"delivery"}),
    ("Show my open tasks.",                                      {"delivery"}),
    ("Who on the team is overloaded and who has capacity?",     {"team"}),
    ("Which projects are at risk and which late tasks are causing it?", {"portfolio", "delivery"}),
    ("Explain EAC and tell me the EAC for project 2.",          {"tutor", "portfolio"}),
]

_NUM = re.compile(r"-?\$?\d[\d,]*\.?\d*%?")


def _numbers(text: str) -> set:
    out = set()
    for tok in _NUM.findall(text):
        t = tok.replace("$", "").replace(",", "").rstrip("%").rstrip(".")
        try:
            v = float(t)
        except ValueError:
            continue
        if abs(v) < 10 and v == int(v):      # skip list numbering / small counts like "1", "3"
            continue
        out.add(round(v, 2))
    return out


def grounding(reply: str, evidence: str) -> float | None:
    claimed = _numbers(reply)
    if not claimed:
        return None
    known = _numbers(evidence)
    # allow rounding: 125000.0 in data vs "$125,000"; 0.8 vs "0.80"; 41.67 vs "42%"
    ok = sum(1 for c in claimed if any(abs(c - k) <= max(0.011, abs(k) * 0.01) for k in known))
    return ok / len(claimed)


def pick_user(role: str):
    from auth import _user_progress
    for u in _user_progress(include_inactive=False):
        if u["role"] == role:
            return {"user_id": u["user_id"], "full_name": u["full_name"], "role": u["role"]}
    raise SystemExit(f"No active {role} user found")


def main():
    sys.stdout.reconfigure(encoding="utf-8", errors="replace")   # Windows consoles default to cp1252
    ap = argparse.ArgumentParser()
    ap.add_argument("--role", default="Admin", choices=["Admin", "Manager", "Developer", "Viewer"])
    ap.add_argument("--json", help="write raw results to this file")
    args = ap.parse_args()

    user = pick_user(args.role)
    health = llm_client.health(ttl=0)
    print(f"LLM: {'AVAILABLE' if health.get('available') else 'UNAVAILABLE'} "
          f"(model {health.get('model')}{', ' + str(health.get('latency_ms')) + 'ms ping' if health.get('latency_ms') else ''})")
    if not health.get("available"):
        print(f"  reason: {health.get('reason')}\n  -> measuring the rule-based fallback path\n")
    print(f"User: {user['full_name']} ({user['role']})\n")

    rows, raw = [], []
    for q, expected in CASES:
        allowed = {a for a, s in ga.AGENTS.items() if user["role"] in s["roles"]}
        expected = expected & allowed or {"portfolio"}
        t = time.time()
        try:
            out = ga.ask(q, user)
        except Exception as e:
            print(f"ERROR  {q}\n       {e}")
            continue
        secs = time.time() - t
        results = getattr(ga._last_results, "value", [])
        evidence = "\n".join(e for r in results for e in r.evidence)
        routed = set(out["route"]["agents"])
        route_ok = expected <= routed
        g = grounding(out["reply"], evidence) if out["source"] == "llm" and evidence else None
        tools = sorted({t for a in out["agents"] for t in a["tools"]})
        rows.append({"q": q, "route_ok": route_ok, "source": out["source"], "secs": secs, "grounding": g})
        raw.append({**out, "question": q, "expected": sorted(expected), "seconds": round(secs, 2), "grounding": g})
        print(f"{'OK ' if route_ok else 'MIS'} {secs:5.1f}s {out['source']:<10} "
              f"agents={','.join(out['route']['agents']):<20} tools={','.join(tools) or '-'}")
        print(f"    Q: {q}")
        print("    A: " + out["reply"].replace("\n", "\n       ")[:600] + "\n")

    if not rows:
        return
    lat = sorted(r["secs"] for r in rows)
    grounded = [r["grounding"] for r in rows if r["grounding"] is not None]
    print("=" * 72)
    print(f"Questions            : {len(rows)}")
    print(f"Routing accuracy     : {sum(r['route_ok'] for r in rows)}/{len(rows)}")
    print(f"Answered by LLM      : {sum(r['source'] == 'llm' for r in rows)}/{len(rows)}"
          f"  (rest = rule-based fallback)")
    print(f"Latency p50/p95/max  : {statistics.median(lat):.1f}s / {lat[int(0.95 * (len(lat) - 1))]:.1f}s / {lat[-1]:.1f}s")
    if grounded:
        print(f"Grounding (LLM only) : {100 * statistics.mean(grounded):.0f}% of cited numbers found in fetched data")
    if args.json:
        with open(args.json, "w", encoding="utf-8") as fh:
            json.dump(raw, fh, indent=2, default=str)
        print(f"Raw results          : {args.json}")


if __name__ == "__main__":
    main()
