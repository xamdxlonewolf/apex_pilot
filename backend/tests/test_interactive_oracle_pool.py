"""Tests for the app-owned interactive python-oracledb pool."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from apex_pilot.interactive import (
    DedicatedSessionLimitError,
    InteractiveDriverBinding,
    InteractiveOraclePool,
    InteractivePoolState,
    InteractivePoolStatus,
    PoolNotOpenError,
)


@dataclass
class FakeConnection:
    """Fake Oracle connection handle."""

    connection_id: int
    closed: bool = False


@dataclass
class FakeDriverPool:
    """Fake oracledb connection pool."""

    min: int
    max: int
    user: str
    dsn: str
    password: str
    closed: bool = False
    _next_id: int = 1
    acquired: list[FakeConnection] = field(default_factory=list)

    def acquire(self) -> FakeConnection:
        if self.closed:
            msg = "pool is closed"
            raise RuntimeError(msg)
        if len(self.acquired) >= self.max:
            msg = "pool exhausted"
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
    """Injectable driver seam for InteractiveOraclePool tests."""

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
    ) -> FakeDriverPool:
        pool = FakeDriverPool(min=min, max=max, user=user, dsn=dsn, password=password)
        self.pools.append(pool)
        return pool


BINDING = InteractiveDriverBinding(
    profile_id="profile-hr",
    display_name="HR Dev",
    username="hr",
    dsn="localhost:1521/FREEPDB1",
)


def test_pool_opens_and_reports_connected() -> None:
    """Opening the interactive pool reports Connected for the profile binding."""
    driver = FakeOracleDriver()
    pool = InteractiveOraclePool(driver=driver)

    pool.open(BINDING, password="s3cret")

    status = pool.status()
    assert status == InteractivePoolStatus(
        state=InteractivePoolState.CONNECTED,
        profile_id="profile-hr",
        display_name="HR Dev",
        dedicated_pinned=0,
        dedicated_limit=5,
        pool_min=1,
        pool_max=6,
    )
    assert len(driver.pools) == 1
    assert driver.pools[0].user == "hr"
    assert driver.pools[0].dsn == "localhost:1521/FREEPDB1"
    assert driver.pools[0].min == 1
    assert driver.pools[0].max == 6


def test_ui_remount_does_not_recreate_pool() -> None:
    """Repeated open for the same profile is a no-op — remounts must not thrash."""
    driver = FakeOracleDriver()
    pool = InteractiveOraclePool(driver=driver)
    pool.open(BINDING, password="s3cret")

    pool.open(BINDING, password="s3cret")

    assert len(driver.pools) == 1
    assert pool.status().state is InteractivePoolState.CONNECTED


def test_borrow_returns_short_lived_lease() -> None:
    """Browse/health callers borrow a connection and release it when the lease ends."""
    driver = FakeOracleDriver()
    pool = InteractiveOraclePool(driver=driver)
    pool.open(BINDING, password="s3cret")

    with pool.borrow_readonly() as connection:
        assert isinstance(connection, FakeConnection)
        assert connection.connection_id == 1
        assert len(driver.pools[0].acquired) == 1

    assert len(driver.pools[0].acquired) == 0


def test_dedicated_sessions_respect_five_pin_limit() -> None:
    """At most five dedicated editor sessions may pin; a sixth raises capacity error."""
    driver = FakeOracleDriver()
    pool = InteractiveOraclePool(driver=driver)
    pool.open(BINDING, password="s3cret")

    for index in range(5):
        handle = pool.acquire_dedicated(f"doc-{index}")
        assert handle.document_id == f"doc-{index}"

    assert pool.status().dedicated_pinned == 5

    with pytest.raises(DedicatedSessionLimitError):
        pool.acquire_dedicated("doc-5")

    pool.release_dedicated("doc-0")
    handle = pool.acquire_dedicated("doc-5")
    assert handle.document_id == "doc-5"
    assert pool.status().dedicated_pinned == 5


def test_reacquire_same_document_is_idempotent() -> None:
    """Re-acquiring a dedicated session for the same document returns the pinned handle."""
    driver = FakeOracleDriver()
    pool = InteractiveOraclePool(driver=driver)
    pool.open(BINDING, password="s3cret")

    first = pool.acquire_dedicated("sql-1")
    second = pool.acquire_dedicated("sql-1")

    assert first is second
    assert pool.status().dedicated_pinned == 1
    assert len(driver.pools[0].acquired) == 1


def test_close_tears_down_pool_and_clears_status() -> None:
    """Explicit close (project/profile/disconnect) closes the driver pool."""
    driver = FakeOracleDriver()
    pool = InteractiveOraclePool(driver=driver)
    pool.open(BINDING, password="s3cret")
    pool.acquire_dedicated("sql-1")

    pool.close()

    assert driver.pools[0].closed is True
    assert pool.status().state is InteractivePoolState.DISCONNECTED
    with pytest.raises(PoolNotOpenError), pool.borrow_readonly():
        pass
