"""SQLcl MCP saved-connection and session ownership primitives."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum
from typing import Protocol

from apex_pilot.mcp.sqlcl import SqlclMcpError
from apex_pilot.safety import SqlRequestAccess

LIST_CONNECTIONS_TOOL = "list-connections"
CONNECT_TOOL = "connect"

_CONNECT_STRING_MARKERS = frozenset({"/", "@", ":", "(", ")", ";"})


class SqlclConnectionError(SqlclMcpError):
    """Raised when SQLcl saved-connection handling fails."""


class SqlclReadOnlySessionError(SqlclConnectionError):
    """Raised when a read-only MCP session is asked to perform write work."""


class SqlclMcpSessionRole(StrEnum):
    """Ownership role for a SQLcl MCP session."""

    PRIMARY = "primary"
    READ_ONLY = "read_only"


@dataclass(frozen=True)
class SqlclSavedConnection:
    """A SQLcl saved connection visible through MCP."""

    name: str
    display_name: str | None = None


class SqlclMcpToolClient(Protocol):
    """Minimal tool-call surface needed by the connection layer."""

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        """Call one SQLcl MCP tool with JSON-like arguments."""
        ...


def normalize_saved_connection_name(connection_name: str) -> str:
    """Validate and normalize a SQLcl saved connection name."""
    normalized = connection_name.strip()
    if not normalized:
        msg = "SQLcl saved connection name cannot be empty."
        raise SqlclConnectionError(msg)

    if any(marker in normalized for marker in _CONNECT_STRING_MARKERS):
        msg = "Use a SQLcl saved connection name, not a connect string or credential-bearing value."
        raise SqlclConnectionError(msg)

    return normalized


def parse_saved_connections(payload: object) -> tuple[SqlclSavedConnection, ...]:
    """Parse the saved-connection list returned by SQLcl MCP."""
    entries = _connection_entries(payload)
    return tuple(_parse_connection_entry(entry) for entry in entries)


class SqlclMcpSession:
    """Guarded SQLcl MCP session bound to a primary or read-only role."""

    def __init__(self, client: SqlclMcpToolClient, *, role: SqlclMcpSessionRole) -> None:
        self._client = client
        self._role = role
        self._connection_name: str | None = None

    @classmethod
    def primary(cls, client: SqlclMcpToolClient) -> SqlclMcpSession:
        """Create the explicit primary MCP session."""
        return cls(client, role=SqlclMcpSessionRole.PRIMARY)

    @classmethod
    def read_only(cls, client: SqlclMcpToolClient) -> SqlclMcpSession:
        """Create a read-only MCP session for discovery and comparison."""
        return cls(client, role=SqlclMcpSessionRole.READ_ONLY)

    @property
    def role(self) -> SqlclMcpSessionRole:
        """Return this session's ownership role."""
        return self._role

    @property
    def connection_name(self) -> str | None:
        """Return the saved connection selected for this session, if connected."""
        return self._connection_name

    async def list_saved_connections(self) -> tuple[SqlclSavedConnection, ...]:
        """List SQLcl saved connections through the MCP `list-connections` tool."""
        payload = await self._client.call_tool(LIST_CONNECTIONS_TOOL, {})
        return parse_saved_connections(payload)

    async def connect(self, connection_name: str) -> str:
        """Connect this MCP session by SQLcl saved connection name."""
        normalized_name = normalize_saved_connection_name(connection_name)
        await self._client.call_tool(CONNECT_TOOL, {"name": normalized_name})
        self._connection_name = normalized_name
        return normalized_name

    async def call_tool(
        self,
        tool_name: str,
        arguments: Mapping[str, object],
        *,
        access: SqlRequestAccess = SqlRequestAccess.READ_ONLY,
    ) -> object:
        """Call a SQLcl MCP tool after enforcing this session's access role."""
        if self._role is SqlclMcpSessionRole.READ_ONLY and access is not SqlRequestAccess.READ_ONLY:
            msg = "Read-only SQLcl MCP pool sessions cannot perform data-changing requests."
            raise SqlclReadOnlySessionError(msg)

        return await self._client.call_tool(tool_name, arguments)


class SqlclReadOnlyPool:
    """Small round-robin pool of read-only SQLcl MCP sessions."""

    def __init__(self, clients: Sequence[SqlclMcpToolClient]) -> None:
        if not clients:
            msg = "Read-only SQLcl MCP pool requires at least one client."
            raise SqlclConnectionError(msg)

        self._sessions = tuple(SqlclMcpSession.read_only(client) for client in clients)
        self._next_index = 0

    @property
    def size(self) -> int:
        """Return the number of read-only sessions in the pool."""
        return len(self._sessions)

    def acquire(self) -> SqlclMcpSession:
        """Return the next read-only session using round-robin selection."""
        session = self._sessions[self._next_index]
        self._next_index = (self._next_index + 1) % len(self._sessions)
        return session

    async def connect_all(self, connection_name: str) -> tuple[str, ...]:
        """Connect every read-only pool session to the same saved connection."""
        normalized_name = normalize_saved_connection_name(connection_name)
        connected_names = []
        for session in self._sessions:
            connected_names.append(await session.connect(normalized_name))
        return tuple(connected_names)


class SqlclConnectionManager:
    """Coordinate one primary SQLcl MCP session with optional read-only pool sessions."""

    def __init__(
        self,
        primary_client: SqlclMcpToolClient,
        *,
        read_only_clients: Sequence[SqlclMcpToolClient] = (),
    ) -> None:
        self._primary_session = SqlclMcpSession.primary(primary_client)
        self._read_only_pool = SqlclReadOnlyPool(read_only_clients) if read_only_clients else None

    @property
    def primary_session(self) -> SqlclMcpSession:
        """Return the explicit primary MCP session."""
        return self._primary_session

    @property
    def read_only_pool(self) -> SqlclReadOnlyPool | None:
        """Return the read-only MCP pool, if configured."""
        return self._read_only_pool

    async def list_saved_connections(self) -> tuple[SqlclSavedConnection, ...]:
        """List saved connections through the primary MCP session."""
        return await self._primary_session.list_saved_connections()

    async def connect(self, connection_name: str) -> str:
        """Connect the primary session and any read-only pool sessions by saved name."""
        normalized_name = normalize_saved_connection_name(connection_name)
        connected_name = await self._primary_session.connect(normalized_name)

        if self._read_only_pool is not None:
            await self._read_only_pool.connect_all(normalized_name)

        return connected_name


def _connection_entries(payload: object) -> Sequence[object]:
    if isinstance(payload, str):
        return _split_connection_name_text(payload)

    if isinstance(payload, Mapping):
        for key in ("connections", "items"):
            value = payload.get(key)
            if isinstance(value, str):
                return _split_connection_name_text(value)
            if isinstance(value, Sequence) and not isinstance(value, str):
                return _expand_connection_sequence(value)

    if isinstance(payload, Sequence) and not isinstance(payload, str):
        return _expand_connection_sequence(payload)

    msg = "SQLcl MCP list-connections returned an unsupported payload shape."
    raise SqlclConnectionError(msg)


def _expand_connection_sequence(entries: Sequence[object]) -> list[object]:
    """Flatten entries that may themselves be comma-separated name strings."""
    expanded: list[object] = []
    for entry in entries:
        if isinstance(entry, str) and ("," in entry or "\n" in entry):
            expanded.extend(_split_connection_name_text(entry))
        else:
            expanded.append(entry)
    return expanded


def _split_connection_name_text(text: str) -> list[str]:
    names: list[str] = []
    for line in text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        for part in line.split(","):
            name = part.strip()
            if name:
                names.append(name)
    return names


def _parse_connection_entry(entry: object) -> SqlclSavedConnection:
    if isinstance(entry, str):
        return SqlclSavedConnection(name=normalize_saved_connection_name(entry))

    if isinstance(entry, Mapping):
        name = _first_text_value(entry, "name", "connectionName", "connection_name", "id")
        if name is None:
            msg = "SQLcl MCP connection entry is missing a saved connection name."
            raise SqlclConnectionError(msg)

        display_name = _first_text_value(entry, "displayName", "display_name", "label")
        return SqlclSavedConnection(
            name=normalize_saved_connection_name(name),
            display_name=display_name.strip() if display_name else None,
        )

    msg = "SQLcl MCP connection entry must be a saved connection name or mapping."
    raise SqlclConnectionError(msg)


def _first_text_value(mapping: Mapping[object, object], *keys: str) -> str | None:
    for key in keys:
        value = mapping.get(key)
        if isinstance(value, str):
            return value
    return None
