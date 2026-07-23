"""Tests for SQL sheet classify/run routes."""

from collections.abc import Mapping
from dataclasses import dataclass

from fastapi.testclient import TestClient

from apex_pilot.api.app import create_app
from apex_pilot.api.runtime import ApexPilotRuntime


@dataclass(frozen=True)
class ToolCall:
    """Recorded fake MCP tool call."""

    tool_name: str
    arguments: dict[str, object]


class FakeToolClient:
    """Queue-backed fake MCP tool client."""

    def __init__(self, responses: list[object]) -> None:
        self._responses = responses
        self.calls: list[ToolCall] = []

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        self.calls.append(ToolCall(tool_name=tool_name, arguments=dict(arguments)))
        if not self._responses:
            raise AssertionError(f"No fake response queued for {tool_name}")
        return self._responses.pop(0)


def make_client(fake: FakeToolClient | None = None) -> TestClient:
    runtime = ApexPilotRuntime(fake or FakeToolClient([]))
    return TestClient(create_app(runtime=runtime, bearer_token="test-token"))


def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


def test_sql_classify_returns_allow_for_select() -> None:
    client = make_client()
    response = client.post(
        "/sql/classify",
        headers=auth_headers(),
        json={"sql": "select * from dual"},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["decision"] == "allow"
    assert payload["operation"] == "select"


def test_sql_run_requires_confirmation_for_delete() -> None:
    fake = FakeToolClient([{}])
    client = make_client(fake)
    client.post("/connections/dev/connect", headers=auth_headers())

    response = client.post(
        "/sql/run",
        headers=auth_headers(),
        json={"sql": "delete from emp where empno = 1"},
    )
    assert response.status_code == 409
    detail = response.json()["detail"]
    assert detail["classification"]["decision"] == "prompt"
    assert fake.calls == [ToolCall(tool_name="connect", arguments={"name": "dev"})]


def test_sql_run_executes_confirmed_select_through_mcp() -> None:
    fake = FakeToolClient(
        [
            {},
            {"rows": [{"DUMMY": "X"}]},
        ],
    )
    client = make_client(fake)
    client.post("/connections/dev/connect", headers=auth_headers())

    response = client.post(
        "/sql/run",
        headers=auth_headers(),
        json={"sql": "select * from dual", "confirmed": False},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["executed"] is True
    assert payload["rows"] == [{"DUMMY": "X"}]
    assert payload["classification"]["decision"] == "allow"
    assert fake.calls[-1] == ToolCall(
        tool_name="run-sql",
        arguments={"sql": "select * from dual", "binds": {}},
    )


def test_sql_run_blocks_security_sensitive_sql() -> None:
    fake = FakeToolClient([{}])
    client = make_client(fake)
    client.post("/connections/dev/connect", headers=auth_headers())
    response = client.post(
        "/sql/run",
        headers=auth_headers(),
        json={"sql": "drop user app cascade", "confirmed": True},
    )
    assert response.status_code == 403
    assert fake.calls == [ToolCall(tool_name="connect", arguments={"name": "dev"})]


def test_sql_run_qualifies_create_table_with_working_schema() -> None:
    fake = FakeToolClient(
        [
            {},
            {"text": "Table DEMO created."},
        ],
    )
    client = make_client(fake)
    client.post("/connections/dev/connect", headers=auth_headers())

    response = client.post(
        "/sql/run",
        headers=auth_headers(),
        json={
            "sql": "create table demo (id number primary key)",
            "schema_name": "APEX_PILOT",
            "confirmed": True,
        },
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["schema_name"] == "APEX_PILOT"
    assert fake.calls[-1] == ToolCall(
        tool_name="run-sql",
        arguments={
            "sql": "create table APEX_PILOT.demo (id number primary key)",
            "binds": {},
        },
    )
