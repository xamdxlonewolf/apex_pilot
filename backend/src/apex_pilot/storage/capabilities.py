"""Runtime checks for required SQLite capabilities."""

from __future__ import annotations

import sqlite3
from dataclasses import dataclass

from apex_pilot.storage.errors import StorageCapabilityError


@dataclass(frozen=True)
class SqliteCapabilities:
    """Detected SQLite runtime capabilities."""

    json_supported: bool
    fts5_supported: bool
    sqlite_version: str

    @property
    def ready(self) -> bool:
        """Return True when phase 1 storage requirements are met."""
        return self.json_supported and self.fts5_supported


def probe_sqlite_capabilities(connection: sqlite3.Connection) -> SqliteCapabilities:
    """Probe JSON and FTS5 support on an open SQLite connection."""
    sqlite_version = sqlite3.sqlite_version
    json_supported = _supports_json(connection)
    fts5_supported = _supports_fts5(connection)
    return SqliteCapabilities(
        json_supported=json_supported,
        fts5_supported=fts5_supported,
        sqlite_version=sqlite_version,
    )


def require_sqlite_capabilities(connection: sqlite3.Connection) -> SqliteCapabilities:
    """Probe capabilities and raise when phase 1 requirements are missing."""
    capabilities = probe_sqlite_capabilities(connection)
    missing: list[str] = []
    if not capabilities.json_supported:
        missing.append("JSON functions")
    if not capabilities.fts5_supported:
        missing.append("FTS5")
    if missing:
        raise StorageCapabilityError(
            "SQLite is missing required capabilities for Apex Pilot storage: "
            + ", ".join(missing)
            + f" (sqlite {capabilities.sqlite_version})."
        )
    return capabilities


def _supports_json(connection: sqlite3.Connection) -> bool:
    try:
        row = connection.execute("SELECT json_valid(?)", ("{}",)).fetchone()
    except sqlite3.Error:
        return False
    return bool(row and row[0] == 1)


def _supports_fts5(connection: sqlite3.Connection) -> bool:
    try:
        connection.execute("CREATE VIRTUAL TABLE temp._apex_pilot_fts_probe USING fts5(content)")
        connection.execute("DROP TABLE temp._apex_pilot_fts_probe")
    except sqlite3.Error:
        return False
    return True
