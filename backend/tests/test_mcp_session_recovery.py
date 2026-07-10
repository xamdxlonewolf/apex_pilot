"""Tests for MCP session recovery after a dead stdio transport."""

from __future__ import annotations

import asyncio
from collections.abc import Mapping
from typing import Any

from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.mcp import SqlclMcpError


class RecoverableListClient:
    """Fails the first list-connections call with a dead-session error."""

    def __init__(self) -> None:
        self.calls = 0
        self.starts = 0
        self.stops = 0

    async def start(self) -> None:
        self.starts += 1

    async def stop(self) -> None:
        self.stops += 1

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> Any:
        _ = arguments
        self.calls += 1
        if tool_name != "list-connections":
            raise AssertionError(f"Unexpected tool {tool_name}")
        if self.calls == 1:
            raise SqlclMcpError("SQLcl MCP tool `connections_list` failed: Connection closed")
        return {"connections": ["dev"]}


class RecoverableConnectClient:
    """Fails the first connect call with a dead-session error."""

    def __init__(self) -> None:
        self.calls = 0
        self.starts = 0
        self.stops = 0

    async def start(self) -> None:
        self.starts += 1

    async def stop(self) -> None:
        self.stops += 1

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> Any:
        _ = arguments
        self.calls += 1
        if tool_name != "connect":
            raise AssertionError(f"Unexpected tool {tool_name}")
        if self.calls == 1:
            raise SqlclMcpError("SQLcl MCP tool `connect` failed: Connection closed")
        return {}


def test_list_connections_restarts_dead_managed_mcp_client() -> None:
    """A closed MCP transport is restarted once and the list call is retried."""
    client = RecoverableListClient()
    runtime = ApexPilotRuntime(client, managed_client=client)  # type: ignore[arg-type]

    connections = asyncio.run(runtime.list_saved_connections())

    assert [item.name for item in connections] == ["dev"]
    assert client.stops == 1
    assert client.starts == 1
    assert client.calls == 2


def test_connect_recovers_dead_session() -> None:
    """Connect recovers a dead session under the MCP lock."""
    client = RecoverableConnectClient()
    runtime = ApexPilotRuntime(client, managed_client=client)  # type: ignore[arg-type]

    connected = asyncio.run(runtime.connect("dev"))

    assert connected == "dev"
    assert client.stops == 1
    assert client.starts == 1
    assert client.calls == 2
