"""Backend runtime settings for the local FastAPI service."""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def default_metadata_db_path() -> Path:
    """Return the default local metadata SQLite path under the user data directory."""
    override = os.environ.get("APEX_PILOT_METADATA_DB")
    if override:
        return Path(override)
    if os.name == "nt":
        base = Path(os.environ.get("LOCALAPPDATA", Path.home() / "AppData" / "Local"))
    else:
        base = Path(os.environ.get("XDG_DATA_HOME", Path.home() / ".local" / "share"))
    return base / "apex-pilot" / "metadata.sqlite3"


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
    metadata_db_path: Path | None = None

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
            metadata_db_path=_optional_path("APEX_PILOT_METADATA_DB") or default_metadata_db_path(),
        )


def _optional_path(env_name: str) -> Path | None:
    value = os.environ.get(env_name)
    return Path(value) if value else None


def _optional_int(env_name: str) -> int | None:
    value = os.environ.get(env_name)
    return int(value) if value else None
