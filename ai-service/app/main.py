import asyncio
import logging
import time
from hmac import compare_digest

from fastapi import Depends, FastAPI, Header, HTTPException, Query, Response
from pydantic import BaseModel

from app.config import (
    AI_PROVIDER,
    AI_REQUEST_TIMEOUT_SECONDS,
    AI_SERVICE_TOKEN,
    GROQ_MODEL,
)
from app.groq_provider import (
    ProviderError,
    analyze_application,
    check_provider,
    is_configured,
)
from app.schemas import ApplicationAnalysis, ApplicationAnalysisRequest, ProviderStatus

logger = logging.getLogger(__name__)
app = FastAPI(
    title="Janaseva AI Service",
    description="Private AI assistance service for Janaseva AI.",
    version="0.1.0",
)


def verify_backend_token(
    token: str | None = Header(default=None, alias="X-Janaseva-AI-Service-Token"),
) -> None:
    if not AI_SERVICE_TOKEN:
        raise HTTPException(
            status_code=503,
            detail={"code": "AI_SERVICE_AUTH_NOT_CONFIGURED"},
        )
    if not token or not compare_digest(token, AI_SERVICE_TOKEN):
        raise HTTPException(
            status_code=401,
            detail={"code": "AI_SERVICE_UNAUTHORIZED"},
        )


class HealthResponse(BaseModel):
    status: str
    service: str


@app.get("/health", response_model=HealthResponse, tags=["health"])
def health_check() -> HealthResponse:
    return HealthResponse(status="ok", service="ai-service")


@app.get(
    "/provider-status",
    response_model=ProviderStatus,
    tags=["provider"],
    dependencies=[Depends(verify_backend_token)],
)
def provider_status(
    response: Response,
    check_connectivity: bool = Query(default=False),
) -> ProviderStatus:
    response.headers["Cache-Control"] = "no-store, no-cache, must-revalidate"
    response.headers["Pragma"] = "no-cache"
    response.headers["Expires"] = "0"
    if not is_configured():
        return ProviderStatus(
            provider=AI_PROVIDER.title(),
            model=GROQ_MODEL,
            status="NOT_CONFIGURED",
            reason="NOT_CONFIGURED",
        )
    status, reason = check_provider() if check_connectivity else ("CONFIGURED", None)
    return ProviderStatus(
        provider=AI_PROVIDER.title(),
        model=GROQ_MODEL,
        status=status,
        reason=reason,
    )


@app.post(
    "/analyze/application",
    response_model=ApplicationAnalysis,
    tags=["analysis"],
    dependencies=[Depends(verify_backend_token)],
)
async def application_analysis(
    request: ApplicationAnalysisRequest,
) -> ApplicationAnalysis:
    started = time.monotonic()
    try:
        result = await asyncio.wait_for(
            asyncio.to_thread(analyze_application, request),
            timeout=AI_REQUEST_TIMEOUT_SECONDS,
        )
        logger.info(
            "ai_stage=fastapi_request elapsed_ms=%d",
            round((time.monotonic() - started) * 1000),
        )
        return result
    except TimeoutError:
        logger.warning(
            "ai_stage=fastapi_request elapsed_ms=%d",
            round((time.monotonic() - started) * 1000),
        )
        raise HTTPException(
            status_code=504,
            detail={"code": "FASTAPI_REQUEST_TIMEOUT"},
        ) from None
    except ProviderError as cause:
        logger.info(
            "ai_stage=fastapi_request elapsed_ms=%d",
            round((time.monotonic() - started) * 1000),
        )
        detail = {"code": cause.code}
        if cause.retry_after_seconds is not None:
            detail["retryAfterSeconds"] = cause.retry_after_seconds
        if cause.upstream_status is not None:
            detail["upstreamStatus"] = cause.upstream_status
        raise HTTPException(
            status_code=cause.http_status,
            detail=detail,
            headers=(
                {"Retry-After": str(cause.retry_after_seconds)}
                if cause.retry_after_seconds is not None
                else None
            ),
        ) from None
