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


def test_health_endpoint_allows_local_cors_preflight() -> None:
    """Bearer-authenticated frontend calls can preflight local backend routes."""
    client = TestClient(create_app())

    response = client.options(
        "/health",
        headers={
            "Origin": "http://127.0.0.1:1420",
            "Access-Control-Request-Method": "GET",
            "Access-Control-Request-Headers": "authorization",
        },
    )

    assert response.status_code == 200
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:1420"
    assert "Authorization" in response.headers["access-control-allow-headers"]
