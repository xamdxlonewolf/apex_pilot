"""Tests for interactive idle reconnect HTTP API and SQLcl MCP idle stop."""

from __future__ import annotations

from collections.abc import Mapping
from dataclasses import dataclass, field

from fastapi.testclient import TestClient

from apex_pilot.api.app import create_app
from apex_pilot.api.runtime import SQLCL_MCP_IDLE_STOP_SECONDS, ApexPilotRuntime
from apex_pilot.interactive import InteractiveOraclePool, InteractivePoolState
from apex_pilot.interactive.pool import DEFAULT_IDLE_TIMEOUT_SECONDS, DEFAULT_WARNING_LEAD_SECONDS
from apex_pilot.mcp import CONNECT_TOOL, DISCONNECT_TOOL, LIST_CONNECTIONS_TOOL


@dataclass
class FakeConnection:
    connection_id: int
    closed: bool = False
    current_schema: str | None = None

    def cursor(self) -> FakeCursor:
        return FakeCursor(self)


@dataclass
class FakeCursor:
    connection: FakeConnection

    def execute(self, sql: str) -> None:
        if "CURRENT_SCHEMA" in sql.upper():
            self.connection.current_schema = sql.split()[-1].strip()


@dataclass
class FakeDriverPool:
    min: int
    max: int
    user: str
    dsn: str
    password: str
    timeout: int = 300
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
        config_dir: str | None = None,
        wallet_location: str | None = None,
        wallet_password: str | None = None,
    ) -> FakeDriverPool:
        _ = (config_dir, wallet_location, wallet_password)
        pool = FakeDriverPool(
            min=min,
            max=max,
            user=user,
            dsn=dsn,
            password=password,
            timeout=timeout,
        )
        self.pools.append(pool)
        return pool


class FakeClock:
    def __init__(self) -> None:
        self.now = 0.0

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


class FakeToolClient:
    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        self.calls.append((tool_name, dict(arguments)))
        if tool_name == LIST_CONNECTIONS_TOOL:
            return {"connections": [{"name": "dev", "displayName": "Development"}]}
        if tool_name == CONNECT_TOOL:
            return {}
        if tool_name == DISCONNECT_TOOL:
            return {}
        return {}


class ManagedFakeClient(FakeToolClient):
    def __init__(self) -> None:
        super().__init__()
        self.starts = 0
        self.stops = 0
        self._running = True

    @property
    def is_running(self) -> bool:
        return self._running

    async def start(self) -> None:
        self.starts += 1
        self._running = True

    async def stop(self) -> None:
        self.stops += 1
        self._running = False


def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


CONNECT_BODY = {
    "profile_id": "profile-hr",
    "display_name": "HR Dev",
    "username": "hr",
    "dsn": "localhost:1521/FREEPDB1",
    "password": "s3cret",
    "working_schema": "HR",
}


def make_client(
    *,
    clock: FakeClock | None = None,
    managed: ManagedFakeClient | None = None,
) -> tuple[TestClient, FakeOracleDriver, FakeClock, ManagedFakeClient | FakeToolClient]:
    fake_clock = clock or FakeClock()
    driver = FakeOracleDriver()
    pool = InteractiveOraclePool(driver=driver, clock=fake_clock)
    tool_client: ManagedFakeClient | FakeToolClient = managed or FakeToolClient()
    runtime = ApexPilotRuntime(
        tool_client,
        managed_client=managed,  # type: ignore[arg-type]
        interactive_pool=pool,
        clock=fake_clock,
    )
    return (
        TestClient(create_app(runtime=runtime, bearer_token="test-token")),
        driver,
        fake_clock,
        tool_client,
    )


def test_status_reports_idle_warning_then_disconnect() -> None:
    client, driver, clock, _tools = make_client()
    assert client.post("/interactive/connect", headers=auth_headers(), json=CONNECT_BODY).status_code == 200

    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS - DEFAULT_WARNING_LEAD_SECONDS)
    warning = client.get("/interactive/status", headers=auth_headers()).json()
    assert warning["state"] == InteractivePoolState.CONNECTED
    assert warning["idle_warning"] is True
    assert warning["working_schema"] == "HR"

    clock.advance(DEFAULT_WARNING_LEAD_SECONDS)
    disconnected = client.get("/interactive/status", headers=auth_headers()).json()
    assert disconnected["state"] == InteractivePoolState.DISCONNECTED
    assert disconnected["disconnect_reason"] == "app_idle"
    assert disconnected["has_session_password"] is True
    assert driver.pools[0].closed is True
    assert "s3cret" not in str(disconnected)


def test_reconnect_endpoint_reuses_session_password() -> None:
    client, driver, clock, _tools = make_client()
    client.post("/interactive/connect", headers=auth_headers(), json=CONNECT_BODY)
    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS)
    client.get("/interactive/status", headers=auth_headers())

    response = client.post("/interactive/reconnect", headers=auth_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == InteractivePoolState.CONNECTED
    assert payload["working_schema"] == "HR"
    assert payload["disconnect_reason"] is None
    assert len(driver.pools) == 2


def test_dismiss_idle_leaves_unconnected() -> None:
    client, _driver, clock, _tools = make_client()
    client.post("/interactive/connect", headers=auth_headers(), json=CONNECT_BODY)
    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS - DEFAULT_WARNING_LEAD_SECONDS)

    response = client.post("/interactive/dismiss-idle", headers=auth_headers())

    assert response.status_code == 200
    payload = response.json()
    assert payload["state"] == InteractivePoolState.DISCONNECTED
    assert payload["reconnect_prompt_dismissed"] is True
    assert payload["has_session_password"] is True


def test_touch_clears_idle_warning() -> None:
    client, _driver, clock, _tools = make_client()
    client.post("/interactive/connect", headers=auth_headers(), json=CONNECT_BODY)
    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS - DEFAULT_WARNING_LEAD_SECONDS)
    assert client.get("/interactive/status", headers=auth_headers()).json()["idle_warning"] is True

    payload = client.post("/interactive/touch", headers=auth_headers()).json()

    assert payload["idle_warning"] is False
    assert payload["state"] == InteractivePoolState.CONNECTED


def test_sqlcl_mcp_stops_five_minutes_after_final_disconnect_and_restarts() -> None:
    managed = ManagedFakeClient()
    client, _driver, clock, _tools = make_client(managed=managed)

    assert client.post("/connections/dev/connect", headers=auth_headers()).status_code == 200
    assert client.post("/connections/disconnect", headers=auth_headers()).status_code == 200
    assert managed.stops == 0

    clock.advance(SQLCL_MCP_IDLE_STOP_SECONDS - 1)
    status = client.get("/interactive/status", headers=auth_headers()).json()
    assert status["mcp_process"] == "running"
    assert managed.stops == 0

    clock.advance(1)
    status = client.get("/interactive/status", headers=auth_headers()).json()
    assert status["mcp_process"] == "stopped"
    assert managed.stops == 1
    assert managed.is_running is False

    reconnect = client.post("/connections/dev/connect", headers=auth_headers())
    assert reconnect.status_code == 200
    assert managed.starts == 1
    assert managed.is_running is True
