"""Tests for backend health endpoint."""

from typing import Any, cast

from fastapi.testclient import TestClient

from apex_pilot import __version__
from apex_pilot.api.app import create_app


def test_health_endpoint_returns_ok() -> None:
    """Health endpoint returns stable service metadata."""
    client = TestClient(create_app())

    response = client.get("/health")

    assert response.status_code == 200
    assert cast("dict[str, Any]", response.json()) == {
        "status": "ok",
        "service": "apex-pilot-backend",
        "version": __version__,
    }
