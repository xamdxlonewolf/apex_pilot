"""HTTP API tests for the app-owned interactive Oracle pool."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from apex_pilot.api.app import create_app
from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.interactive import InteractivePoolState
from apex_pilot.mcp import CONNECT_TOOL, LIST_CONNECTIONS_TOOL


@dataclass
class FakeConnection:
    connection_id: int
    closed: bool = False


@dataclass
class FakeDriverPool:
    min: int
    max: int
    user: str
    dsn: str
    password: str
    closed: bool = False
    _next_id: int = 1
    acquired: list[FakeConnection] = field(default_factory=list)

    def acquire(self) -> FakeConnection:
        connection = FakeConnection(connection_id=self._next_id)
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

    def create_pool(
        self,
        *,
        user: str,
        password: str,
        dsn: str,
        min: int,
        max: int,
        timeout: int = 300,
    ) -> FakeDriverPool:
        _ = timeout
        pool = FakeDriverPool(min=min, max=max, user=user, dsn=dsn, password=password)
        self.pools.append(pool)
        return pool


class FakeToolClient:
    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        if tool_name == LIST_CONNECTIONS_TOOL:
            return {"connections": [{"name": "dev", "displayName": "Development"}]}
        if tool_name == CONNECT_TOOL:
            return {"connection": arguments.get("connection_name", "dev")}
        return {}


def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


def make_client(driver: FakeOracleDriver | None = None) -> tuple[TestClient, FakeOracleDriver]:
    fake_driver = driver or FakeOracleDriver()
    runtime = ApexPilotRuntime(FakeToolClient(), interactive_driver=fake_driver)
    return TestClient(create_app(runtime=runtime, bearer_token="test-token")), fake_driver


def test_interactive_status_starts_disconnected() -> None:
    client, _driver = make_client()

    response = client.get("/interactive/status", headers=auth_headers())

    assert response.status_code == 200
    assert response.json()["state"] == InteractivePoolState.DISCONNECTED
    assert response.json()["profile_id"] is None


def test_interactive_connect_is_idempotent_for_same_profile() -> None:
    client, driver = make_client()
    body = {
        "profile_id": "profile-hr",
        "display_name": "HR Dev",
        "username": "hr",
        "dsn": "localhost:1521/FREEPDB1",
        "password": "s3cret",
    }

    first = client.post("/interactive/connect", headers=auth_headers(), json=body)
    second = client.post("/interactive/connect", headers=auth_headers(), json=body)

    assert first.status_code == 200
    assert second.status_code == 200
    assert first.json()["state"] == InteractivePoolState.CONNECTED
    assert second.json()["state"] == InteractivePoolState.CONNECTED
    assert len(driver.pools) == 1
    assert "password" not in first.json()
    assert "s3cret" not in first.text


def test_project_close_closes_interactive_pool() -> None:
    client, driver = make_client()
    client.post(
        "/interactive/connect",
        headers=auth_headers(),
        json={
            "profile_id": "profile-hr",
            "display_name": "HR Dev",
            "username": "hr",
            "dsn": "localhost:1521/FREEPDB1",
            "password": "s3cret",
        },
    )

    close_response = client.post("/projects/close", headers=auth_headers())
    status_response = client.get("/interactive/status", headers=auth_headers())

    assert close_response.status_code == 204
    assert status_response.json()["state"] == InteractivePoolState.DISCONNECTED
    assert driver.pools[0].closed is True


def test_mcp_connect_path_unchanged_with_interactive_pool() -> None:
    client, _driver = make_client()

    mcp = client.post("/connections/dev/connect", headers=auth_headers())
    interactive = client.get("/interactive/status", headers=auth_headers())

    assert mcp.status_code == 200
    assert mcp.json()["connection_name"] == "dev"
    assert interactive.json()["state"] == InteractivePoolState.DISCONNECTED


def _connect_interactive(client: TestClient) -> None:
    response = client.post(
        "/interactive/connect",
        headers=auth_headers(),
        json={
            "profile_id": "profile-hr",
            "display_name": "HR Dev",
            "username": "hr",
            "dsn": "localhost:1521/FREEPDB1",
            "password": "s3cret",
        },
    )
    assert response.status_code == 200


def test_dedicated_session_acquire_release_through_http() -> None:
    client, driver = make_client()
    _connect_interactive(client)

    acquired = client.post(
        "/interactive/sessions/acquire",
        headers=auth_headers(),
        json={"document_id": "sql:1"},
    )
    status_after_pin = client.get("/interactive/status", headers=auth_headers())
    released = client.post(
        "/interactive/sessions/release",
        headers=auth_headers(),
        json={"document_id": "sql:1"},
    )
    status_after_release = client.get("/interactive/status", headers=auth_headers())

    assert acquired.status_code == 200
    assert acquired.json() == {
        "document_id": "sql:1",
        "profile_id": "profile-hr",
        "dedicated_pinned": 1,
        "dedicated_limit": 5,
        "state": "pinned",
    }
    assert "connection" not in acquired.json()
    assert status_after_pin.json()["dedicated_pinned"] == 1
    assert released.status_code == 200
    assert released.json()["state"] == "released"
    assert status_after_release.json()["dedicated_pinned"] == 0
    assert len(driver.pools[0].acquired) == 0


def test_dedicated_session_capacity_is_honest_conflict() -> None:
    client, _driver = make_client()
    _connect_interactive(client)

    for index in range(5):
        response = client.post(
            "/interactive/sessions/acquire",
            headers=auth_headers(),
            json={"document_id": f"sql:{index}"},
        )
        assert response.status_code == 200

    sixth = client.post(
        "/interactive/sessions/acquire",
        headers=auth_headers(),
        json={"document_id": "sql:5"},
    )
    assert sixth.status_code == 409
    assert "limit" in sixth.json()["detail"].lower()


def test_dedicated_acquire_without_pool_is_conflict_not_fake_success() -> None:
    client, _driver = make_client()

    response = client.post(
        "/interactive/sessions/acquire",
        headers=auth_headers(),
        json={"document_id": "sql:1"},
    )

    assert response.status_code == 409
    assert "not connected" in response.json()["detail"].lower()


def test_remount_style_reconnect_keeps_dedicated_pins() -> None:
    """Settings/remount open for the same profile must not tear dedicated pins."""
    client, driver = make_client()
    body = {
        "profile_id": "profile-hr",
        "display_name": "HR Dev",
        "username": "hr",
        "dsn": "localhost:1521/FREEPDB1",
        "password": "s3cret",
    }
    client.post("/interactive/connect", headers=auth_headers(), json=body)
    client.post(
        "/interactive/sessions/acquire",
        headers=auth_headers(),
        json={"document_id": "sql:1"},
    )

    remount = client.post("/interactive/connect", headers=auth_headers(), json=body)
    status = client.get("/interactive/status", headers=auth_headers())

    assert remount.status_code == 200
    assert remount.json()["state"] == InteractivePoolState.CONNECTED
    assert status.json()["dedicated_pinned"] == 1
    assert len(driver.pools) == 1
