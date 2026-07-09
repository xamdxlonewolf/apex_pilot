"""In-memory MCP tool activity log for the local desktop session."""

from __future__ import annotations

import uuid
from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

ActivityStatus = Literal["succeeded", "failed"]

_SENSITIVE_ARGUMENT_KEYS = frozenset({"password", "token", "secret", "credential", "credentials"})
DEFAULT_ACTIVITY_RETENTION = timedelta(days=14)


@dataclass(frozen=True)
class ToolActivityEntry:
    """One MCP tool-call activity entry."""

    sequence: int
    timestamp: datetime
    tool_name: str
    arguments: Mapping[str, object]
    status: ActivityStatus
    message: str | None = None
    connection_name: str | None = None
    session_id: str | None = None

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable activity payload."""
        return {
            "sequence": self.sequence,
            "timestamp": self.timestamp.isoformat(),
            "tool_name": self.tool_name,
            "arguments": dict(self.arguments),
            "status": self.status,
            "message": self.message,
            "connection_name": self.connection_name,
            "session_id": self.session_id,
        }


class ToolActivityLog:
    """Process-scoped MCP tool activity with connection/session tagging and retention."""

    def __init__(
        self,
        *,
        max_entries: int = 2000,
        retention: timedelta = DEFAULT_ACTIVITY_RETENTION,
    ) -> None:
        self._entries: deque[ToolActivityEntry] = deque(maxlen=max_entries)
        self._next_sequence = 1
        self._active_connection_name: str | None = None
        self._active_session_id: str | None = None
        self._retention = retention

    @property
    def active_connection_name(self) -> str | None:
        """Return the currently active SQLcl saved connection name."""
        return self._active_connection_name

    @property
    def active_session_id(self) -> str | None:
        """Return the currently active connection session id."""
        return self._active_session_id

    def set_active_connection(self, connection_name: str | None) -> str | None:
        """Start a new activity session for a saved connection.

        Reconnecting keeps prior entries and opens a new session bucket.
        """
        normalized = connection_name.strip() if connection_name else None
        self._active_connection_name = normalized or None
        self._active_session_id = str(uuid.uuid4()) if self._active_connection_name else None
        return self._active_session_id

    def record(
        self,
        *,
        tool_name: str,
        arguments: Mapping[str, object],
        status: ActivityStatus,
        message: str | None = None,
        connection_name: str | None = None,
        session_id: str | None = None,
    ) -> ToolActivityEntry:
        """Record one completed MCP tool call without wiping prior history."""
        resolved_connection = connection_name or self._infer_connection_name(tool_name, arguments)
        if resolved_connection and self._active_connection_name is None:
            self._active_connection_name = resolved_connection
        if self._active_session_id is None and self._active_connection_name is not None:
            self._active_session_id = str(uuid.uuid4())

        entry = ToolActivityEntry(
            sequence=self._next_sequence,
            timestamp=datetime.now(UTC),
            tool_name=tool_name,
            arguments=_redact_arguments(arguments),
            status=status,
            message=message,
            connection_name=resolved_connection or self._active_connection_name,
            session_id=session_id or self._active_session_id,
        )
        self._next_sequence += 1
        self._entries.append(entry)
        self._prune_expired()
        return entry

    def entries(self, *, connection_name: str | None = None) -> tuple[ToolActivityEntry, ...]:
        """Return activity entries in oldest-first order, optionally filtered."""
        self._prune_expired()
        if connection_name is None:
            return tuple(self._entries)
        normalized = connection_name.strip()
        return tuple(entry for entry in self._entries if entry.connection_name == normalized)

    def _infer_connection_name(self, tool_name: str, arguments: Mapping[str, object]) -> str | None:
        for key in ("connection_name", "connectionName", "name"):
            value = arguments.get(key)
            if isinstance(value, str) and value.strip():
                return value.strip()
        if tool_name in {"connect", "list-connections", "connections_list"}:
            return self._active_connection_name
        return self._active_connection_name

    def _prune_expired(self) -> None:
        cutoff = datetime.now(UTC) - self._retention
        while self._entries and self._entries[0].timestamp < cutoff:
            self._entries.popleft()


def _redact_arguments(arguments: Mapping[str, object]) -> dict[str, object]:
    redacted: dict[str, object] = {}
    for key, value in arguments.items():
        if key.lower() in _SENSITIVE_ARGUMENT_KEYS:
            redacted[key] = "<redacted>"
        else:
            redacted[key] = value
    return redacted
