"""Backend runtime settings for the local FastAPI service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


@dataclass(frozen=True)
class BackendSettings:
    """Environment-backed settings for the local backend process."""

    host: str = "127.0.0.1"
    port: int = 8000
    bearer_token: str | None = None
    sqlcl_path: Path | None = None
    tns_admin: Path | None = None
    java_home: Path | None = None
    restrict_level: int | None = None

    @classmethod
    def from_env(cls) -> BackendSettings:
        """Build settings from APEX_PILOT_* environment variables."""
        return cls(
            host=os.environ.get("APEX_PILOT_BIND_HOST", "127.0.0.1"),
            port=int(os.environ.get("APEX_PILOT_BIND_PORT", "8000")),
            bearer_token=os.environ.get("APEX_PILOT_BEARER_TOKEN"),
            sqlcl_path=_optional_path("APEX_PILOT_SQLCL_PATH"),
            tns_admin=_optional_path("TNS_ADMIN"),
            java_home=_optional_path("JAVA_HOME"),
            restrict_level=_optional_int("APEX_PILOT_SQLCL_RESTRICT_LEVEL"),
        )


def _optional_path(env_name: str) -> Path | None:
    value = os.environ.get(env_name)
    return Path(value) if value else None


def _optional_int(env_name: str) -> int | None:
    value = os.environ.get(env_name)
    return int(value) if value else None
