"""In-memory MCP tool activity log for the local desktop session."""

from __future__ import annotations

from collections import deque
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime
from typing import Literal

ActivityStatus = Literal["succeeded", "failed"]

_SENSITIVE_ARGUMENT_KEYS = frozenset({"password", "token", "secret", "credential", "credentials"})


@dataclass(frozen=True)
class ToolActivityEntry:
    """One MCP tool-call activity entry."""

    sequence: int
    timestamp: datetime
    tool_name: str
    arguments: Mapping[str, object]
    status: ActivityStatus
    message: str | None = None

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable activity payload."""
        return {
            "sequence": self.sequence,
            "timestamp": self.timestamp.isoformat(),
            "tool_name": self.tool_name,
            "arguments": dict(self.arguments),
            "status": self.status,
            "message": self.message,
        }


class ToolActivityLog:
    """Session-scoped ring buffer of MCP tool activity."""

    def __init__(self, *, max_entries: int = 200) -> None:
        self._entries: deque[ToolActivityEntry] = deque(maxlen=max_entries)
        self._next_sequence = 1

    def record(
        self,
        *,
        tool_name: str,
        arguments: Mapping[str, object],
        status: ActivityStatus,
        message: str | None = None,
    ) -> ToolActivityEntry:
        """Record one completed MCP tool call."""
        entry = ToolActivityEntry(
            sequence=self._next_sequence,
            timestamp=datetime.now(UTC),
            tool_name=tool_name,
            arguments=_redact_arguments(arguments),
            status=status,
            message=message,
        )
        self._next_sequence += 1
        self._entries.append(entry)
        return entry

    def entries(self) -> tuple[ToolActivityEntry, ...]:
        """Return activity entries in oldest-first order."""
        return tuple(self._entries)


def _redact_arguments(arguments: Mapping[str, object]) -> dict[str, object]:
    redacted: dict[str, object] = {}
    for key, value in arguments.items():
        if key.lower() in _SENSITIVE_ARGUMENT_KEYS:
            redacted[key] = "<redacted>"
        else:
            redacted[key] = value
    return redacted
