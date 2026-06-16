"""FastAPI application factory."""

from fastapi import FastAPI

from apex_pilot import __version__
from apex_pilot.api.routes import router


def create_app() -> FastAPI:
    """Create the Apex Pilot FastAPI application."""
    api = FastAPI(
        title="Apex Pilot Backend",
        version=__version__,
        summary="Local backend for Apex Pilot.",
    )
    api.include_router(router)
    return api


app = create_app()


def main() -> None:
    """Run the local development API server."""
    import uvicorn

    uvicorn.run("apex_pilot.api.app:app", host="127.0.0.1", port=8000)
