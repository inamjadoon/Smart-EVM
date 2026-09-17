# smartEVM — AI Module (`ai/`)

Module 3 (ML predictive analytics) + Module 4 (GenAI insights & chat) for the
smartEVM platform. Ships as a **FastAPI router** the backend mounts, plus offline
training scripts. **CPU-only** — no GPU/Colab needed.

## Quickstart (in your Anaconda venv)

```bash
pip install -r ai/requirements.txt          # run from the repo root

python -m ai.data.generate --projects 800   # 1. synthesize training data
python -m ai.training.train_all              # 2. train + save all 4 models
python -m ai.demo                            # 3. end-to-end test (no server)

# optional: real GenAI (else it uses rule-based fallbacks)
cp ai/.env.example ai/.env                   # add your free GROQ_API_KEY

uvicorn ai.main:app --reload --port 8010     # 4. run the API -> http://127.0.0.1:8010/docs
```

> Run everything as a module (`python -m ai.xxx`) from the **repo root** so the
> package imports resolve.

## What's inside

```
ai/
├── evm.py            EVM math (CPI/SPI/EAC/…) + custom QPI  ← ground truth
├── schemas.py        Pydantic CONTRACT with backend/frontend  ← agree this first
├── features.py       shared feature engineering (train == serve)
├── data/generate.py  synthetic EVM dataset generator
├── training/         cpi_spi_forecasting / cost / delay / success + train_all
├── model_io.py       load/save model artifacts (.joblib)
├── services/predictor.py   inference wrappers (+ heuristic fallbacks)
├── genai/            llm_client (Groq) · insights_agent · chat_service
├── routers.py        FastAPI endpoints  ← the integration surface
├── main.py           standalone app for solo dev/demo
└── demo.py           no-server smoke test
```

## API (POST JSON = a `ProjectState`, see `sample_project.json`)

| Endpoint | Returns |
|---|---|
| `GET  /ai/health` | status + whether LLM key is set |
| `POST /ai/predict` | everything: EVM + forecast + cost + delay + success |
| `POST /ai/forecast` | predicted final CPI/SPI + forward series |
| `POST /ai/predict/cost` | EAC + overrun % |
| `POST /ai/predict/delay` | predicted delay (sprints) |
| `POST /ai/predict/success` | on_track / at_risk / critical + probabilities |
| `POST /ai/insights` | plain-language summary, risks, recommendations |
| `POST /ai/chat` | `{question, project}` → grounded answer |

```bash
curl -X POST http://127.0.0.1:8010/ai/predict \
  -H "Content-Type: application/json" -d @ai/sample_project.json
```

## Integration (how your teammates plug this in)

**Backend owner** — mount the router in the main FastAPI app:
```python
from ai.routers import router as ai_router
app.include_router(ai_router)
```
**Data contract** — the backend maps its SQL rows into `ProjectState` /
`SprintSnapshot` (`schemas.py`). Lock those field names with the backend early;
everything downstream depends on them. Because the services take a `ProjectState`
(not a DB handle), you can build/test fully against synthetic data and swap in the
real DB at the end with zero model changes.

**Frontend** — calls the endpoints above and renders the numbers + the
`projected_*_series` arrays as charts, plus the insights/chat text.

## Notes for the demo
- Without `GROQ_API_KEY`, insights/chat return **rule-based** text (marked
  `source: rule_based`) so nothing ever crashes on stage.
- Every prediction is marked `source: model | heuristic` so you can prove the
  trained models are actually running.
- Retrain anytime after tweaking the generator: `python -m ai.training.train_all`.
