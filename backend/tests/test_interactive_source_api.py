"""HTTP contract tests for /interactive/source/* routes."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from fastapi.testclient import TestClient

from apex_pilot.api.app import create_app
from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.mcp import CONNECT_TOOL, LIST_CONNECTIONS_TOOL

PACKAGE_SPEC = """CREATE OR REPLACE PACKAGE hr.emp_pkg AS
  PROCEDURE ping;
END emp_pkg;
"""

PACKAGE_BODY = """CREATE OR REPLACE PACKAGE BODY hr.emp_pkg AS
  PROCEDURE ping IS BEGIN NULL; END;
END emp_pkg;
"""

COMBINED_SOURCE = f"{PACKAGE_SPEC}/\n\n{PACKAGE_BODY}/\n"


@dataclass
class FakeCursor:
    connection: FakeConnection
    rows: list[tuple[Any, ...]] = field(default_factory=list)

    def execute(self, statement: str, parameters: dict[str, Any] | None = None) -> None:
        self.connection.execute_calls.append(statement)
        sql = " ".join(statement.split()).upper()
        binds = parameters or {}
        if "CREATE OR REPLACE" in sql:
            self.connection.compiled.append(statement)
            self.rows = []
            return
        if "FROM ALL_OBJECTS" in sql:
            key = (binds["owner"], binds["name"], binds["object_type"])
            obj = self.connection.objects.get(key)
            self.rows = [(obj["status"],)] if obj else []
            return
        if "FROM ALL_SOURCE" in sql:
            key = (binds["owner"], binds["name"], binds["object_type"])
            obj = self.connection.objects.get(key)
            if obj is None:
                self.rows = []
            else:
                body = obj["source"]
                if body.lstrip().upper().startswith("CREATE OR REPLACE "):
                    body = body.lstrip()[len("CREATE OR REPLACE ") :]
                self.rows = [(line + "\n",) for line in body.splitlines()] or [(body,)]
            return
        if "FROM ALL_ERRORS" in sql:
            self.rows = []
            return
        if "FROM ALL_DEPENDENCIES" in sql:
            self.rows = []
            return
        self.rows = []

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self.rows)

    def close(self) -> None:
        return None


@dataclass
class FakeConnection:
    connection_id: int
    objects: dict[tuple[str, str, str], dict[str, Any]]
    execute_calls: list[str] = field(default_factory=list)
    compiled: list[str] = field(default_factory=list)
    closed: bool = False

    def cursor(self) -> FakeCursor:
        return FakeCursor(connection=self)


@dataclass
class FakeDriverPool:
    min: int
    max: int
    user: str
    dsn: str
    password: str
    shared_objects: dict[tuple[str, str, str], dict[str, Any]]
    closed: bool = False
    _next_id: int = 1
    acquired: list[FakeConnection] = field(default_factory=list)

    def acquire(self) -> FakeConnection:
        connection = FakeConnection(connection_id=self._next_id, objects=self.shared_objects)
        self._next_id += 1
        self.acquired.append(connection)
        return connection

    def release(self, connection: FakeConnection) -> None:
        if connection in self.acquired:
            self.acquired.remove(connection)
        connection.closed = True

    def close(self) -> None:
        self.closed = True
        self.acquired.clear()


class FakeOracleDriver:
    def __init__(self) -> None:
        self.pools: list[FakeDriverPool] = []
        self.objects: dict[tuple[str, str, str], dict[str, Any]] = {
            ("HR", "EMP_PKG", "PACKAGE"): {"status": "VALID", "source": PACKAGE_SPEC, "errors": []},
            ("HR", "EMP_PKG", "PACKAGE BODY"): {
                "status": "VALID",
                "source": PACKAGE_BODY,
                "errors": [],
            },
        }

    def create_pool(
        self,
        *,
        user: str,
        password: str,
        dsn: str,
        min: int,
        max: int,
    ) -> FakeDriverPool:
        pool = FakeDriverPool(
            min=min,
            max=max,
            user=user,
            dsn=dsn,
            password=password,
            shared_objects=self.objects,
        )
        self.pools.append(pool)
        return pool


class FakeToolClient:
    async def call_tool(self, tool_name: str, arguments: dict[str, object]) -> object:
        if tool_name == LIST_CONNECTIONS_TOOL:
            return {"connections": [{"name": "dev", "displayName": "Development"}]}
        if tool_name == CONNECT_TOOL:
            return {"connection": arguments.get("connection_name", "dev")}
        return {}


def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


def make_client() -> tuple[TestClient, FakeOracleDriver]:
    driver = FakeOracleDriver()
    runtime = ApexPilotRuntime(FakeToolClient(), interactive_driver=driver)
    return TestClient(create_app(runtime=runtime, bearer_token="test-token")), driver


def _connect(client: TestClient) -> None:
    response = client.post(
        "/interactive/connect",
        headers=auth_headers(),
        json={
            "profile_id": "profile-hr",
            "display_name": "HR Dev",
            "username": "hr",
            "dsn": "localhost/xepdb1",
            "password": "secret",
        },
    )
    assert response.status_code == 200


def test_parse_endpoint_returns_units() -> None:
    client, _driver = make_client()
    response = client.post(
        "/interactive/source/parse",
        headers=auth_headers(),
        json={"source_text": COMBINED_SOURCE},
    )
    assert response.status_code == 200
    payload = response.json()
    assert payload["kind"] == "combined_package"
    assert len(payload["units"]) == 2


def test_fetch_and_compile_contract() -> None:
    client, _driver = make_client()
    _connect(client)

    fetched = client.post(
        "/interactive/source/fetch",
        headers=auth_headers(),
        json={
            "owner": "HR",
            "name": "EMP_PKG",
            "unit_type": "PACKAGE",
            "combined": True,
        },
    )
    assert fetched.status_code == 200
    document = fetched.json()
    assert document["owner"] == "HR"
    assert document["unit_types"] == ["PACKAGE", "PACKAGE BODY"]

    blocked = client.post(
        "/interactive/source/compile",
        headers=auth_headers(),
        json={
            "source_text": document["source_text"],
            "owner": "HR",
            "name": "EMP_PKG",
            "unit_types": ["PACKAGE", "PACKAGE BODY"],
            "attachment_state": "unconnected",
            "confirm_attach": False,
            "baseline_fingerprints": document["fingerprints"],
        },
    )
    assert blocked.status_code == 409
    assert blocked.json()["detail"]["confirmation"]["reason"] == "attach"

    compiled = client.post(
        "/interactive/source/compile",
        headers=auth_headers(),
        json={
            "source_text": document["source_text"],
            "owner": "HR",
            "name": "EMP_PKG",
            "unit_types": ["PACKAGE", "PACKAGE BODY"],
            "attachment_state": "attached",
            "confirm_attach": False,
            "baseline_fingerprints": document["fingerprints"],
        },
    )
    assert compiled.status_code == 200
    payload = compiled.json()
    assert payload["outcome"] == "succeeded"
    assert payload["schema_ddl_outside_editor_transaction"] is True
    assert len(payload["units"]) == 2


def test_parse_rejects_sqlcl_via_http() -> None:
    client, _driver = make_client()
    response = client.post(
        "/interactive/source/parse",
        headers=auth_headers(),
        json={
            "source_text": "CREATE OR REPLACE PROCEDURE p AS BEGIN NULL; END;\n/\nSET DEFINE OFF\n",
        },
    )
    assert response.status_code == 400
    assert "SQLcl" in response.json()["detail"]["message"]
