"""Tests for the first backend UI vertical-slice routes."""

from collections.abc import Mapping
from dataclasses import dataclass
from typing import Any, cast

from fastapi.testclient import TestClient

from apex_pilot.api.app import create_app
from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.mcp import SqlclMcpError


@dataclass(frozen=True)
class ToolCall:
    """Recorded fake MCP tool call."""

    tool_name: str
    arguments: dict[str, object]


class FakeToolClient:
    """Queue-backed fake MCP tool client for API route tests."""

    def __init__(self, responses: list[object]) -> None:
        self._responses = responses
        self.calls: list[ToolCall] = []

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        """Record the call and return the next queued response."""
        self.calls.append(ToolCall(tool_name=tool_name, arguments=dict(arguments)))
        if not self._responses:
            raise AssertionError(f"No fake response queued for {tool_name}")
        return self._responses.pop(0)


def make_client(fake: FakeToolClient | None = None) -> TestClient:
    """Build a test client with an injectable Apex Pilot runtime."""
    runtime = ApexPilotRuntime(fake or FakeToolClient([]))
    return TestClient(create_app(runtime=runtime, bearer_token="test-token"))


def auth_headers() -> dict[str, str]:
    """Return valid test bearer auth headers."""
    return {"Authorization": "Bearer test-token"}


def test_vertical_slice_routes_require_bearer_auth() -> None:
    """MCP-backed routes require the per-run bearer token."""
    client = make_client()

    assert client.get("/health").status_code == 200
    assert client.get("/connections").status_code == 401
    assert client.get("/connections", headers={"Authorization": "Bearer wrong"}).status_code == 401


def test_connections_can_be_listed_and_selected_through_mcp() -> None:
    """Connections route delegates to SQLcl MCP saved-connection tools."""
    fake = FakeToolClient(
        [
            {"connections": [{"name": "dev", "displayName": "Development"}, "test"]},
            {},
        ],
    )
    client = make_client(fake)

    list_response = client.get("/connections", headers=auth_headers())
    connect_response = client.post("/connections/dev/connect", headers=auth_headers())

    assert list_response.status_code == 200
    assert list_response.json() == {
        "connections": [
            {"name": "dev", "display_name": "Development"},
            {"name": "test", "display_name": None},
        ],
    }
    assert connect_response.status_code == 200
    assert connect_response.json() == {"connection_name": "dev"}
    assert fake.calls == [
        ToolCall(tool_name="list-connections", arguments={}),
        ToolCall(tool_name="connect", arguments={"name": "dev"}),
    ]


def test_describe_connection_uses_connmgr_show_without_raw_text() -> None:
    """Describe route runs CONNMGR SHOW and returns username/DSN only."""
    fake = FakeToolClient(
        [
            {
                "content": [
                    {
                        "type": "text",
                        "text": "Name: dev\nUser: HR\nURL: localhost:1521/FREEPDB1\n",
                    },
                ],
            },
        ],
    )
    client = make_client(fake)

    response = client.get("/connections/dev/describe", headers=auth_headers())

    assert response.status_code == 200
    assert response.json() == {
        "name": "dev",
        "username": "HR",
        "connect_string": "localhost:1521/FREEPDB1",
    }
    assert "raw_text" not in response.json()
    assert fake.calls == [
        ToolCall(tool_name="run-sqlcl", arguments={"command": "CONNMGR SHOW dev"}),
    ]


def test_schema_summary_route_returns_structured_payload_and_activity() -> None:
    """Schema route returns structured JSON and records MCP run-sql activity."""
    fake = FakeToolClient(
        [
            {
                "rows": [
                    {
                        "CURRENT_USER": "APP",
                        "DB_NAME": "FREE",
                        "CONTAINER_NAME": "FREEPDB1",
                        "CDB_NAME": "FREE",
                        "HOST": "localhost",
                    },
                ],
            },
            {"rows": [{"OBJECT_TYPE": "TABLE", "OBJECT_COUNT": 1, "VALID_COUNT": 1, "INVALID_COUNT": 0}]},
            {"rows": [{"TABLE_NAME": "ORDERS", "NUM_ROWS": 10, "PARTITIONED": "NO"}]},
        ],
    )
    client = make_client(fake)

    response = client.get("/schema/summary?schema=app", headers=auth_headers())
    activity_response = client.get("/activity", headers=auth_headers())

    assert response.status_code == 200
    payload = cast("dict[str, Any]", response.json())
    assert payload["schema_name"] == "APP"
    assert payload["database_context"]["current_user"] == "APP"
    assert payload["object_counts"] == [
        {"object_type": "TABLE", "object_count": 1, "valid_count": 1, "invalid_count": 0},
    ]
    assert payload["tables"][0]["table_name"] == "ORDERS"
    assert activity_response.status_code == 200
    activity = cast("dict[str, Any]", activity_response.json())
    assert [entry["tool_name"] for entry in activity["entries"]] == ["run-sql", "run-sql", "run-sql"]
    assert all(entry["status"] == "succeeded" for entry in activity["entries"])


def test_mcp_failures_return_json_error_payloads() -> None:
    """MCP failures are surfaced as API errors instead of unhandled 500s."""

    class FailingToolClient:
        async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
            _ = (tool_name, arguments)
            raise SqlclMcpError("Unknown tool: invalid_tool_name")

    client = TestClient(create_app(runtime=ApexPilotRuntime(FailingToolClient()), bearer_token="test-token"))

    response = client.get(
        "/connections",
        headers={
            **auth_headers(),
            "Origin": "http://127.0.0.1:1420",
        },
    )

    assert response.status_code == 502
    assert response.json() == {"detail": "Unknown tool: invalid_tool_name"}
    assert response.headers["access-control-allow-origin"] == "http://127.0.0.1:1420"
