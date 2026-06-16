"""Tests for SQLcl MCP saved-connection and session ownership behavior."""

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass

import pytest

from apex_pilot.mcp import (
    CONNECT_TOOL,
    LIST_CONNECTIONS_TOOL,
    SqlclConnectionError,
    SqlclConnectionManager,
    SqlclMcpSession,
    SqlclMcpSessionRole,
    SqlclReadOnlyPool,
    SqlclReadOnlySessionError,
    SqlclSavedConnection,
    SqlRequestAccess,
    normalize_saved_connection_name,
)


@dataclass(frozen=True)
class ToolCall:
    """Recorded fake MCP tool call."""

    tool_name: str
    arguments: dict[str, object]


class FakeToolClient:
    """Small fake SQLcl MCP tool client for connection tests."""

    def __init__(self, responses: Mapping[str, object] | None = None) -> None:
        self._responses = dict(responses or {})
        self.calls: list[ToolCall] = []

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        """Record a tool call and return the configured fake response."""
        self.calls.append(ToolCall(tool_name=tool_name, arguments=dict(arguments)))
        return self._responses.get(tool_name, {})


def test_session_lists_sqlcl_saved_connections() -> None:
    """Saved connections are discovered only through the MCP list-connections tool."""

    async def run_test() -> None:
        client = FakeToolClient(
            {
                LIST_CONNECTIONS_TOOL: {
                    "connections": [
                        {"name": "dev", "displayName": "Development"},
                        "prod",
                    ],
                },
            },
        )
        session = SqlclMcpSession.primary(client)

        connections = await session.list_saved_connections()

        assert connections == (
            SqlclSavedConnection(name="dev", display_name="Development"),
            SqlclSavedConnection(name="prod"),
        )
        assert client.calls == [ToolCall(tool_name=LIST_CONNECTIONS_TOOL, arguments={})]

    asyncio.run(run_test())


def test_connect_uses_saved_connection_name_only() -> None:
    """Connecting passes only a saved SQLcl connection name to MCP."""

    async def run_test() -> None:
        client = FakeToolClient()
        session = SqlclMcpSession.primary(client)

        connected_name = await session.connect(" dev ")

        assert connected_name == "dev"
        assert session.connection_name == "dev"
        assert client.calls == [ToolCall(tool_name=CONNECT_TOOL, arguments={"name": "dev"})]

    asyncio.run(run_test())


def test_connection_name_rejects_obvious_connect_strings() -> None:
    """Credential-bearing or descriptor-like values are not accepted as saved names."""
    with pytest.raises(SqlclConnectionError, match="saved connection name"):
        normalize_saved_connection_name("scott/tiger@orclpdb")


def test_connection_manager_connects_primary_and_read_only_pool() -> None:
    """The manager keeps the primary session explicit and connects pool sessions separately."""

    async def run_test() -> None:
        primary_client = FakeToolClient()
        pool_client_a = FakeToolClient()
        pool_client_b = FakeToolClient()
        manager = SqlclConnectionManager(
            primary_client,
            read_only_clients=(pool_client_a, pool_client_b),
        )

        connected_name = await manager.connect("dev")

        assert connected_name == "dev"
        assert manager.primary_session.role is SqlclMcpSessionRole.PRIMARY
        assert manager.primary_session.connection_name == "dev"
        assert manager.read_only_pool is not None
        assert manager.read_only_pool.size == 2
        assert primary_client.calls == [ToolCall(tool_name=CONNECT_TOOL, arguments={"name": "dev"})]
        assert pool_client_a.calls == [ToolCall(tool_name=CONNECT_TOOL, arguments={"name": "dev"})]
        assert pool_client_b.calls == [ToolCall(tool_name=CONNECT_TOOL, arguments={"name": "dev"})]

    asyncio.run(run_test())


def test_read_only_pool_blocks_write_classified_requests() -> None:
    """Read-only pool sessions reject data-changing requests before an MCP tool call."""

    async def run_test() -> None:
        client = FakeToolClient()
        pool = SqlclReadOnlyPool((client,))
        session = pool.acquire()

        with pytest.raises(SqlclReadOnlySessionError, match="Read-only"):
            await session.call_tool(
                "run-sql",
                {"sql": "update emp set sal = sal + 1"},
                access=SqlRequestAccess.DATA_CHANGE,
            )

        assert session.role is SqlclMcpSessionRole.READ_ONLY
        assert client.calls == []

    asyncio.run(run_test())


def test_primary_session_allows_write_classified_requests() -> None:
    """Data-changing requests are reserved for the explicit primary MCP session."""

    async def run_test() -> None:
        client = FakeToolClient({"run-sql": {"ok": True}})
        session = SqlclMcpSession.primary(client)

        result = await session.call_tool(
            "run-sql",
            {"sql": "update emp set sal = sal + 1"},
            access=SqlRequestAccess.DATA_CHANGE,
        )

        assert result == {"ok": True}
        assert client.calls == [
            ToolCall(
                tool_name="run-sql",
                arguments={"sql": "update emp set sal = sal + 1"},
            ),
        ]

    asyncio.run(run_test())
