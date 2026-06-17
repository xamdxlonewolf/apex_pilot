"""FastAPI application factory."""

from __future__ import annotations

import json
import secrets
from collections.abc import AsyncIterator, Callable
from contextlib import AbstractAsyncContextManager, asynccontextmanager

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from apex_pilot import __version__
from apex_pilot.api.routes import router
from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.settings import BackendSettings

LOCAL_APP_ORIGIN_REGEX = r"^(https?://(127\.0\.0\.1|localhost)(:\d+)?|https?://tauri\.localhost|tauri://localhost)$"


def create_app(
    *,
    runtime: ApexPilotRuntime | None = None,
    bearer_token: str | None = None,
) -> FastAPI:
    """Create the Apex Pilot FastAPI application."""
    api = FastAPI(
        title="Apex Pilot Backend",
        version=__version__,
        summary="Local backend for Apex Pilot.",
        lifespan=_lifespan(runtime),
    )
    api.add_middleware(
        CORSMiddleware,
        allow_origin_regex=LOCAL_APP_ORIGIN_REGEX,
        allow_credentials=True,
        allow_methods=["GET", "POST", "OPTIONS"],
        allow_headers=["Authorization", "Content-Type"],
    )
    api.state.apex_pilot_bearer_token = bearer_token
    api.state.apex_pilot_runtime = runtime
    api.include_router(router)
    return api


def main() -> None:
    """Run the local API server."""
    import uvicorn

    settings = BackendSettings.from_env()
    bearer_token = settings.bearer_token or secrets.token_urlsafe(32)
    runtime = ApexPilotRuntime.live(settings)
    api = create_app(runtime=runtime, bearer_token=bearer_token)

    print(
        json.dumps(
            {
                "event": "apex_pilot_backend_starting",
                "baseUrl": f"http://{settings.host}:{settings.port}",
                "bearerToken": bearer_token,
            },
        ),
        flush=True,
    )
    uvicorn.run(api, host=settings.host, port=settings.port)


def _lifespan(runtime: ApexPilotRuntime | None) -> Callable[[FastAPI], AbstractAsyncContextManager[None]]:
    @asynccontextmanager
    async def lifespan(_api: FastAPI) -> AsyncIterator[None]:
        if runtime is not None:
            await runtime.start()
        try:
            yield
        finally:
            if runtime is not None:
                await runtime.stop()

    return lifespan


app = create_app()
