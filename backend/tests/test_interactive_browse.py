"""Tests for interactive borrow-based schema browse facades."""

from __future__ import annotations

from dataclasses import dataclass, field

import pytest

from apex_pilot.interactive import (
    InteractiveBrowseService,
    InteractiveDriverBinding,
    InteractiveOraclePool,
    PoolNotOpenError,
)


@dataclass
class FakeCursor:
    rows: list[tuple[object, ...]]
    description: list[tuple[str]]
    closed: bool = False

    def execute(self, sql: str, binds: dict[str, object] | None = None) -> None:
        del sql, binds

    def fetchall(self) -> list[tuple[object, ...]]:
        return list(self.rows)

    def close(self) -> None:
        self.closed = True


@dataclass
class FakeConnection:
    connection_id: int
    script: list[tuple[list[tuple[str]], list[tuple[object, ...]]]] = field(default_factory=list)

    def cursor(self) -> FakeCursor:
        if not self.script:
            msg = "no cursor script left"
            raise RuntimeError(msg)
        description, rows = self.script.pop(0)
        return FakeCursor(rows=rows, description=description)


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
    lease_scripts: list[list[tuple[list[tuple[str]], list[tuple[object, ...]]]]] = field(default_factory=list)

    def acquire(self) -> FakeConnection:
        if not self.lease_scripts:
            msg = "no lease script left"
            raise RuntimeError(msg)
        connection = FakeConnection(
            connection_id=self._next_id,
            script=list(self.lease_scripts.pop(0)),
        )
        self._next_id += 1
        self.acquired.append(connection)
        return connection

    def release(self, connection: FakeConnection) -> None:
        if connection in self.acquired:
            self.acquired.remove(connection)

    def close(self) -> None:
        self.closed = True
        self.acquired.clear()


class FakeOracleDriver:
    def __init__(self) -> None:
        self.pools: list[FakeDriverPool] = []
        self.lease_scripts: list[list[tuple[list[tuple[str]], list[tuple[object, ...]]]]] = []

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
        pool.lease_scripts = self.lease_scripts
        self.pools.append(pool)
        return pool


BINDING = InteractiveDriverBinding(
    profile_id="profile-hr",
    display_name="HR Dev",
    username="hr",
    dsn="localhost:1521/FREEPDB1",
)


def _context_script() -> tuple[list[tuple[str]], list[tuple[object, ...]]]:
    return (
        [
            ("current_user",),
            ("current_schema",),
            ("proxy_user",),
            ("db_name",),
            ("container_name",),
            ("cdb_name",),
            ("host",),
        ],
        [("HR", "HR", None, "FREEPDB1", None, None, None)],
    )


def _counts_script() -> tuple[list[tuple[str]], list[tuple[object, ...]]]:
    return (
        [("object_type",), ("object_count",), ("valid_count",), ("invalid_count",)],
        [("TABLE", 2, 2, 0)],
    )


def _tables_script() -> tuple[list[tuple[str]], list[tuple[object, ...]]]:
    return (
        [("table_name",), ("num_rows",), ("last_analyzed",), ("partitioned",), ("iot_type",)],
        [("EMP", 14, None, "NO", None)],
    )


def test_browse_uses_short_lived_borrow_and_caches() -> None:
    driver = FakeOracleDriver()
    driver.lease_scripts = [
        [_context_script()],
        [_counts_script(), _tables_script()],
    ]
    pool = InteractiveOraclePool(driver=driver)
    pool.open(BINDING, password="s3cret")
    browse = InteractiveBrowseService(pool)

    first = browse.summarize_schema("hr")
    second = browse.summarize_schema("hr")

    assert first.schema_name == "HR"
    assert first.connection_name == "HR Dev"
    assert first.tables[0].table_name == "EMP"
    assert second.schema_name == "HR"
    assert len(driver.pools[0].acquired) == 0
    assert driver.pools[0]._next_id == 3


def test_browse_refresh_bypasses_cache() -> None:
    driver = FakeOracleDriver()
    driver.lease_scripts = [
        [_context_script()],
        [_counts_script(), _tables_script()],
        [_context_script()],
        [_counts_script(), _tables_script()],
    ]
    pool = InteractiveOraclePool(driver=driver)
    pool.open(BINDING, password="s3cret")
    browse = InteractiveBrowseService(pool)

    browse.summarize_schema("HR")
    browse.summarize_schema("HR", refresh=True)

    assert driver.pools[0]._next_id == 5
    assert len(driver.lease_scripts) == 0


def test_browse_requires_connected_pool() -> None:
    pool = InteractiveOraclePool(driver=FakeOracleDriver())
    browse = InteractiveBrowseService(pool)

    with pytest.raises(PoolNotOpenError):
        browse.fetch_database_context()
