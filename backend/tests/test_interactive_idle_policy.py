"""Tests for idle/lifetime policy for the interactive Oracle pool (ADR-0008 / #127)."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from apex_pilot.interactive import (
    DEFAULT_IDLE_TIMEOUT_SECONDS,
    DEFAULT_WARNING_LEAD_SECONDS,
    READONLY_POOL_MEMBER_TIMEOUT_SECONDS,
    DisconnectReason,
    InteractiveDriverBinding,
    InteractiveOraclePool,
    InteractivePoolError,
    InteractivePoolState,
    PoolNotOpenError,
)


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
            parts = sql.replace("=", " = ").split()
            self.connection.current_schema = parts[-1].strip().strip("\"'")


@dataclass
class FakeDriverPool:
    min: int
    max: int
    user: str
    dsn: str
    password: str
    timeout: int
    closed: bool = False
    _next_id: int = 1
    acquired: list[FakeConnection] = field(default_factory=list)

    def acquire(self) -> FakeConnection:
        if self.closed:
            msg = "pool is closed"
            raise RuntimeError(msg)
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
        timeout: int = READONLY_POOL_MEMBER_TIMEOUT_SECONDS,
    ) -> FakeDriverPool:
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
    def __init__(self, start: float = 0.0) -> None:
        self.now = start

    def __call__(self) -> float:
        return self.now

    def advance(self, seconds: float) -> None:
        self.now += seconds


BINDING = InteractiveDriverBinding(
    profile_id="profile-hr",
    display_name="HR Dev",
    username="hr",
    dsn="localhost:1521/FREEPDB1",
)


def _open_pool(clock: FakeClock | None = None) -> tuple[InteractiveOraclePool, FakeOracleDriver, FakeClock]:
    driver = FakeOracleDriver()
    clock = clock or FakeClock()
    pool = InteractiveOraclePool(driver=driver, clock=clock)
    pool.open(BINDING, password="s3cret")
    return pool, driver, clock


def test_pool_opens_with_five_minute_member_timeout() -> None:
    pool, driver, _clock = _open_pool()

    assert driver.pools[0].timeout == READONLY_POOL_MEMBER_TIMEOUT_SECONDS
    assert pool.status().idle_timeout_seconds == DEFAULT_IDLE_TIMEOUT_SECONDS
    assert pool.status().warning_lead_seconds == DEFAULT_WARNING_LEAD_SECONDS


def test_warns_after_fourteen_minutes_of_inactivity() -> None:
    pool, _driver, clock = _open_pool()

    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS - DEFAULT_WARNING_LEAD_SECONDS)
    status = pool.evaluate_idle_policy()

    assert status.state is InteractivePoolState.CONNECTED
    assert status.idle_warning is True
    assert status.seconds_until_idle_disconnect == pytest.approx(DEFAULT_WARNING_LEAD_SECONDS)
    assert status.disconnect_reason is None


def test_disconnects_after_fifteen_minutes_keeping_session_password() -> None:
    pool, driver, clock = _open_pool()
    pool.set_working_schema("HR")

    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS)
    status = pool.evaluate_idle_policy()

    assert status.state is InteractivePoolState.DISCONNECTED
    assert status.disconnect_reason is DisconnectReason.APP_IDLE
    assert status.has_session_password is True
    assert status.profile_id == "profile-hr"
    assert status.working_schema == "HR"
    assert driver.pools[0].closed is True
    with pytest.raises(PoolNotOpenError), pool.borrow_readonly():
        pass


def test_no_idle_teardown_while_call_in_flight() -> None:
    pool, driver, clock = _open_pool()

    with pool.borrow_readonly():
        clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS + 10)
        status = pool.evaluate_idle_policy()
        assert status.state is InteractivePoolState.CONNECTED
        assert status.idle_warning is False
        assert driver.pools[0].closed is False

    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS)
    status = pool.evaluate_idle_policy()
    assert status.state is InteractivePoolState.DISCONNECTED
    assert status.disconnect_reason is DisconnectReason.APP_IDLE


def test_no_idle_teardown_while_transaction_uncertain() -> None:
    pool, driver, clock = _open_pool()
    pool.set_transaction_uncertain(True)

    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS + 5)
    status = pool.evaluate_idle_policy()

    assert status.state is InteractivePoolState.CONNECTED
    assert driver.pools[0].closed is False

    pool.set_transaction_uncertain(False)
    status = pool.evaluate_idle_policy()
    assert status.state is InteractivePoolState.DISCONNECTED


def test_touch_activity_resets_idle_clock() -> None:
    pool, _driver, clock = _open_pool()

    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS - DEFAULT_WARNING_LEAD_SECONDS)
    assert pool.evaluate_idle_policy().idle_warning is True

    pool.touch_activity()
    status = pool.evaluate_idle_policy()
    assert status.idle_warning is False
    assert status.seconds_until_idle_disconnect == pytest.approx(DEFAULT_IDLE_TIMEOUT_SECONDS)


def test_dismiss_idle_prompt_leaves_unconnected_until_manual_reconnect() -> None:
    pool, driver, clock = _open_pool()

    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS - DEFAULT_WARNING_LEAD_SECONDS)
    status = pool.dismiss_idle_prompt()

    assert status.state is InteractivePoolState.DISCONNECTED
    assert status.disconnect_reason is DisconnectReason.APP_IDLE
    assert status.reconnect_prompt_dismissed is True
    assert status.has_session_password is True
    assert driver.pools[0].closed is True


def test_dismiss_idle_prompt_blocked_while_in_flight_or_uncertain() -> None:
    pool, driver, _clock = _open_pool()

    with pool.borrow_readonly():
        with pytest.raises(InteractivePoolError, match="in flight"):
            pool.dismiss_idle_prompt()
        assert driver.pools[0].closed is False
        assert pool.status().state is InteractivePoolState.CONNECTED

    pool.set_transaction_uncertain(True)
    with pytest.raises(InteractivePoolError, match="uncertain"):
        pool.dismiss_idle_prompt()
    assert driver.pools[0].closed is False


def test_reconnect_reuses_session_password_and_restores_working_schema() -> None:
    pool, driver, clock = _open_pool()
    pool.set_working_schema("HR")
    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS)
    pool.evaluate_idle_policy()

    status = pool.reconnect()

    assert status.state is InteractivePoolState.CONNECTED
    assert status.disconnect_reason is None
    assert status.working_schema == "HR"
    assert status.reconnect_prompt_dismissed is False
    assert len(driver.pools) == 2
    assert driver.pools[0].closed is True
    assert driver.pools[1].closed is False
    assert driver.pools[1].password == "s3cret"


def test_explicit_close_clears_session_password() -> None:
    pool, _driver, clock = _open_pool()
    clock.advance(DEFAULT_IDLE_TIMEOUT_SECONDS)
    pool.evaluate_idle_policy()
    assert pool.status().has_session_password is True

    pool.close()

    assert pool.status().has_session_password is False
    assert pool.status().profile_id is None
    with pytest.raises(InteractivePoolError):
        pool.reconnect()


def test_idle_timeout_clamped_to_product_range() -> None:
    driver = FakeOracleDriver()
    clock = FakeClock()
    pool = InteractiveOraclePool(
        driver=driver,
        clock=clock,
        idle_timeout_seconds=5 * 60,
    )
    assert pool.status().idle_timeout_seconds == 10 * 60

    pool = InteractiveOraclePool(
        driver=driver,
        clock=clock,
        idle_timeout_seconds=60 * 60,
    )
    assert pool.status().idle_timeout_seconds == 30 * 60
