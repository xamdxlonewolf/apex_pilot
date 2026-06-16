"""HTTP routes for the backend scaffold."""

from typing import Literal

from fastapi import APIRouter
from pydantic import BaseModel, ConfigDict

from apex_pilot import __version__

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response payload."""

    model_config = ConfigDict(frozen=True)

    status: Literal["ok"]
    service: str
    version: str


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health_check() -> HealthResponse:
    """Return backend health metadata."""
    return HealthResponse(
        status="ok",
        service="apex-pilot-backend",
        version=__version__,
    )
