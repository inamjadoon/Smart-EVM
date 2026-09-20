"""FastAPI router — this is the integration surface for your teammates.

Backend owner mounts it with one line:
    from ai.routers import router as ai_router
    app.include_router(ai_router)

Frontend calls POST /ai/... with a ProjectState JSON body.
"""
from __future__ import annotations

from fastapi import APIRouter

from .schemas import (
    ProjectState, ForecastResult, CostPrediction, DelayPrediction,
    SuccessPrediction, PredictionBundle, InsightResponse, ChatRequest, ChatResponse,
)
from .services import predictor
from .genai import insights_agent, chat_service, llm_client

router = APIRouter(prefix="/ai", tags=["ai"])


@router.get("/health")
def health() -> dict:
    return {"status": "ok", "llm_configured": llm_client.is_configured()}


@router.post("/predict", response_model=PredictionBundle)
def predict(project: ProjectState) -> PredictionBundle:
    return predictor.predict_all(project)


@router.post("/forecast", response_model=ForecastResult)
def forecast(project: ProjectState) -> ForecastResult:
    return predictor.forecast(project)


@router.post("/predict/cost", response_model=CostPrediction)
def predict_cost(project: ProjectState) -> CostPrediction:
    return predictor.predict_cost(project)


@router.post("/predict/delay", response_model=DelayPrediction)
def predict_delay(project: ProjectState) -> DelayPrediction:
    return predictor.predict_delay(project)


@router.post("/predict/success", response_model=SuccessPrediction)
def predict_success(project: ProjectState) -> SuccessPrediction:
    return predictor.classify_success(project)


@router.post("/insights", response_model=InsightResponse)
def insights(project: ProjectState) -> InsightResponse:
    return insights_agent.generate_insights(project)


@router.post("/chat", response_model=ChatResponse)
def chat(req: ChatRequest) -> ChatResponse:
    return chat_service.answer_question(req.question, req.project)
