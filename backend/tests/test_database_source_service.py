"""Unit/contract tests for guarded Database Source fetch/compile."""

from __future__ import annotations

from dataclasses import dataclass, field
from typing import Any

from apex_pilot.interactive import InteractiveDriverBinding, InteractiveOraclePool
from apex_pilot.interactive.source import (
    AttachmentState,
    BaselineFingerprint,
    CompileOutcome,
    CompileRequest,
    CompileTarget,
    DatabaseSourceService,
    OracleUnitType,
    fingerprint_digest,
)
from apex_pilot.interactive.source.fingerprint import normalize_source_text


@dataclass
class FakeCursor:
    connection: FakeConnection
    rows: list[tuple[Any, ...]] = field(default_factory=list)

    def execute(self, statement: str, parameters: dict[str, Any] | None = None) -> None:
        self.connection.execute_calls.append((statement, parameters or {}))
        sql = " ".join(statement.split()).upper()
        binds = parameters or {}

        if self.connection.fail_next_ddl and "CREATE OR REPLACE" in sql:
            self.connection.fail_next_ddl = False
            raise RuntimeError(self.connection.fail_next_ddl_message)

        if "CREATE OR REPLACE" in sql:
            self.connection.apply_ddl(statement)
            self.rows = []
            return

        if "FROM ALL_OBJECTS" in sql and "STATUS" in sql:
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
                text = obj["source"]
                # ALL_SOURCE style: strip CREATE OR REPLACE prefix if present.
                stripped = text.lstrip()
                body = (
                    stripped[len("CREATE OR REPLACE ") :] if stripped.upper().startswith("CREATE OR REPLACE ") else text
                )
                self.rows = [(line + "\n",) for line in body.splitlines()] or [(body,)]
            return

        if "FROM ALL_ERRORS" in sql:
            key = (binds["owner"], binds["name"], binds["object_type"])
            obj = self.connection.objects.get(key)
            self.rows = list(obj.get("errors", [])) if obj else []
            return

        if "FROM ALL_DEPENDENCIES" in sql:
            key = (binds["owner"], binds["name"], binds["object_type"])
            self.rows = list(self.connection.invalid_dependents.get(key, []))
            return

        self.rows = []

    def fetchall(self) -> list[tuple[Any, ...]]:
        return list(self.rows)

    def close(self) -> None:
        return None


@dataclass
class FakeConnection:
    connection_id: int
    objects: dict[tuple[str, str, str], dict[str, Any]] = field(default_factory=dict)
    invalid_dependents: dict[tuple[str, str, str], list[tuple[Any, ...]]] = field(default_factory=dict)
    execute_calls: list[tuple[str, dict[str, Any]]] = field(default_factory=list)
    fail_next_ddl: bool = False
    fail_next_ddl_message: str = "DPI-1080: connection was closed"
    closed: bool = False

    def cursor(self) -> FakeCursor:
        return FakeCursor(connection=self)

    def apply_ddl(self, statement: str) -> None:
        text = normalize_source_text(statement).strip()
        upper = text.upper()
        unit_type = None
        for candidate in (
            "PACKAGE BODY",
            "TYPE BODY",
            "PACKAGE",
            "TYPE",
            "PROCEDURE",
            "FUNCTION",
            "TRIGGER",
        ):
            token = f"CREATE OR REPLACE {candidate}"
            if upper.startswith(token):
                unit_type = candidate
                break
        if unit_type is None:
            return
        # crude name parse after type token
        rest = text[len(f"CREATE OR REPLACE {unit_type}") :].strip()
        head = rest.split(None, 1)[0].rstrip("(")
        if "." in head:
            owner, name = head.split(".", 1)
        else:
            owner, name = "HR", head
        owner = owner.upper().strip('"')
        name = name.upper().strip('"')
        key = (owner, name, unit_type)
        status = "INVALID" if "RAISE_APPLICATION_ERROR" in upper else "VALID"
        errors: list[tuple[Any, ...]] = []
        if status == "INVALID":
            errors = [(3, 1, 'PLS-00103: Encountered the symbol "RAISE_APPLICATION_ERROR"', "ERROR")]
        self.objects[key] = {
            "status": status,
            "source": text + "\n",
            "errors": errors,
        }


@dataclass
class FakeDriverPool:
    min: int
    max: int
    user: str
    dsn: str
    password: str
    shared_objects: dict[tuple[str, str, str], dict[str, Any]]
    shared_dependents: dict[tuple[str, str, str], list[tuple[Any, ...]]]
    timeout: int = 300
    closed: bool = False
    fail_next_ddl: bool = False
    fail_next_ddl_message: str = "DPI-1080: connection was closed"
    _next_id: int = 1
    acquired: list[FakeConnection] = field(default_factory=list)
    acquired_ids: list[int] = field(default_factory=list)
    all_connections: list[FakeConnection] = field(default_factory=list)

    def acquire(self) -> FakeConnection:
        connection = FakeConnection(
            connection_id=self._next_id,
            objects=self.shared_objects,
            invalid_dependents=self.shared_dependents,
            fail_next_ddl=self.fail_next_ddl,
            fail_next_ddl_message=self.fail_next_ddl_message,
        )
        self.fail_next_ddl = False
        self._next_id += 1
        self.acquired.append(connection)
        self.all_connections.append(connection)
        self.acquired_ids.append(connection.connection_id)
        return connection

    def release(self, connection: FakeConnection) -> None:
        if connection in self.acquired:
            self.acquired.remove(connection)
        connection.closed = True

    def close(self) -> None:
        self.closed = True
        self.acquired.clear()


class FakeOracleDriver:
    def __init__(
        self,
        *,
        objects: dict[tuple[str, str, str], dict[str, Any]] | None = None,
        dependents: dict[tuple[str, str, str], list[tuple[Any, ...]]] | None = None,
    ) -> None:
        self.objects = objects or {}
        self.dependents = dependents or {}
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
            shared_objects={key: dict(value) for key, value in self.objects.items()},
            shared_dependents={key: list(value) for key, value in self.dependents.items()},
            timeout=timeout,
        )
        self.pools.append(pool)
        return pool


PACKAGE_SPEC = """CREATE OR REPLACE PACKAGE hr.emp_pkg AS
  PROCEDURE ping;
END emp_pkg;
"""

PACKAGE_BODY = """CREATE OR REPLACE PACKAGE BODY hr.emp_pkg AS
  PROCEDURE ping IS BEGIN NULL; END;
END emp_pkg;
"""

COMBINED_SOURCE = f"{PACKAGE_SPEC}/\n\n{PACKAGE_BODY}/\n"

INVALID_BODY = """CREATE OR REPLACE PACKAGE BODY hr.emp_pkg AS
  PROCEDURE ping IS BEGIN RAISE_APPLICATION_ERROR(-20000, 'x'); END;
END emp_pkg;
"""


def _open_service(
    *,
    objects: dict[tuple[str, str, str], dict[str, Any]] | None = None,
    dependents: dict[tuple[str, str, str], list[tuple[Any, ...]]] | None = None,
) -> tuple[DatabaseSourceService, InteractiveOraclePool, FakeOracleDriver]:
    driver = FakeOracleDriver(objects=objects, dependents=dependents)
    pool = InteractiveOraclePool(driver=driver)
    pool.open(
        InteractiveDriverBinding(
            profile_id="profile-hr",
            display_name="HR",
            username="hr",
            dsn="localhost/xepdb1",
        ),
        password="secret",
    )
    return DatabaseSourceService(pool), pool, driver


def test_fingerprint_normalizes_transport_line_endings_only() -> None:
    lf = "CREATE OR REPLACE PROCEDURE p AS BEGIN NULL; END;\n"
    crlf = "CREATE OR REPLACE PROCEDURE p AS BEGIN NULL; END;\r\n"
    spaced = "CREATE OR REPLACE PROCEDURE p AS BEGIN NULL; END; \n"
    assert fingerprint_digest(lf) == fingerprint_digest(crlf)
    assert fingerprint_digest(lf) != fingerprint_digest(spaced)


def test_fetch_combined_package_preserves_metadata() -> None:
    objects = {
        ("HR", "EMP_PKG", "PACKAGE"): {
            "status": "VALID",
            "source": PACKAGE_SPEC,
            "errors": [],
        },
        ("HR", "EMP_PKG", "PACKAGE BODY"): {
            "status": "VALID",
            "source": PACKAGE_BODY,
            "errors": [],
        },
    }
    service, _pool, _driver = _open_service(objects=objects)

    document = service.fetch(
        owner="hr",
        name="emp_pkg",
        unit_type=OracleUnitType.PACKAGE,
        combined=True,
        working_schema="HR",
    )

    assert document.owner == "HR"
    assert document.name == "EMP_PKG"
    assert document.unit_types == (OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY)
    assert "CREATE OR REPLACE PACKAGE" in document.source_text
    assert "PACKAGE BODY" in document.source_text
    assert all(item.exists for item in document.fingerprints)


def test_compile_uses_isolated_lease_not_dedicated_pin() -> None:
    service, pool, driver = _open_service()
    dedicated = pool.acquire_dedicated("editor-1")
    dedicated_id = dedicated.connection.connection_id  # type: ignore[attr-defined]

    result = service.compile(
        CompileRequest(
            source_text=COMBINED_SOURCE,
            target=CompileTarget(
                owner="HR",
                name="EMP_PKG",
                unit_types=(OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY),
            ),
            attachment_state=AttachmentState.UNCONNECTED,
            confirm_attach=True,
        )
    )

    assert result.outcome is CompileOutcome.SUCCEEDED
    assert result.schema_ddl_outside_editor_transaction is True
    assert pool.status().dedicated_pinned == 1
    compile_ids = [conn_id for conn_id in driver.pools[0].acquired_ids if conn_id != dedicated_id]
    assert compile_ids, "compile should borrow a non-dedicated connection"


def test_compile_requires_attach_confirmation() -> None:
    service, _pool, _driver = _open_service()
    result = service.compile(
        CompileRequest(
            source_text=COMBINED_SOURCE,
            target=CompileTarget(
                owner="HR",
                name="EMP_PKG",
                unit_types=(OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY),
            ),
            attachment_state=AttachmentState.UNCONNECTED,
            confirm_attach=False,
        )
    )
    assert result.outcome is CompileOutcome.BLOCKED
    assert result.confirmation is not None
    assert result.confirmation.reason == "attach"


def test_stale_force_confirmation() -> None:
    objects = {
        ("HR", "EMP_PKG", "PACKAGE"): {
            "status": "VALID",
            "source": PACKAGE_SPEC,
            "errors": [],
        },
        ("HR", "EMP_PKG", "PACKAGE BODY"): {
            "status": "VALID",
            "source": PACKAGE_BODY,
            "errors": [],
        },
    }
    service, _pool, _driver = _open_service(objects=objects)
    result = service.compile(
        CompileRequest(
            source_text=COMBINED_SOURCE,
            target=CompileTarget(
                owner="HR",
                name="EMP_PKG",
                unit_types=(OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY),
            ),
            attachment_state=AttachmentState.ATTACHED,
            baseline_fingerprints=(
                BaselineFingerprint(
                    owner="HR",
                    name="EMP_PKG",
                    unit_type=OracleUnitType.PACKAGE,
                    digest="stale-digest",
                ),
            ),
            confirm_force=False,
        )
    )
    assert result.outcome is CompileOutcome.BLOCKED
    assert result.confirmation is not None
    assert result.confirmation.reason == "force"
    assert result.confirmation.stale_conflicts


def test_dropped_target_requires_recreate() -> None:
    service, _pool, _driver = _open_service(objects={})
    result = service.compile(
        CompileRequest(
            source_text=COMBINED_SOURCE,
            target=CompileTarget(
                owner="HR",
                name="EMP_PKG",
                unit_types=(OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY),
            ),
            attachment_state=AttachmentState.ATTACHED,
            confirm_recreate=False,
        )
    )
    assert result.outcome is CompileOutcome.BLOCKED
    assert result.confirmation is not None
    assert result.confirmation.reason == "recreate"


def test_partial_compile_stops_after_spec_success() -> None:
    objects = {
        ("HR", "EMP_PKG", "PACKAGE"): {
            "status": "VALID",
            "source": PACKAGE_SPEC,
            "errors": [],
        },
    }
    dependents = {
        ("HR", "EMP_PKG", "PACKAGE BODY"): [
            ("HR", "EMP_VIEW", "VIEW", "INVALID"),
        ]
    }
    service, _pool, _driver = _open_service(objects=objects, dependents=dependents)
    source = f"{PACKAGE_SPEC}/\n\n{INVALID_BODY}/\n"
    result = service.compile(
        CompileRequest(
            source_text=source,
            target=CompileTarget(
                owner="HR",
                name="EMP_PKG",
                unit_types=(OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY),
            ),
            attachment_state=AttachmentState.ATTACHED,
            confirm_recreate=True,
        )
    )
    assert result.outcome is CompileOutcome.PARTIAL
    assert result.units[0].status == "VALID"
    assert result.units[1].status == "INVALID"
    assert any(item.severity.value == "error" for item in result.diagnostics)
    assert result.invalid_dependents
    assert "Partial compile" in (result.message or "")


def test_unknown_network_outcome_does_not_auto_retry() -> None:
    service, _pool, driver = _open_service()
    driver.pools[0].fail_next_ddl = True
    driver.pools[0].fail_next_ddl_message = "ORA-03113: end-of-file on communication channel"

    result = service.compile(
        CompileRequest(
            source_text=COMBINED_SOURCE,
            target=CompileTarget(
                owner="HR",
                name="EMP_PKG",
                unit_types=(OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY),
            ),
            attachment_state=AttachmentState.UNCONNECTED,
            confirm_attach=True,
        )
    )
    assert result.outcome is CompileOutcome.UNKNOWN
    assert result.requires_reconcile is True
    ddl_calls = [
        statement
        for connection in driver.pools[0].all_connections
        for statement, _binds in connection.execute_calls
        if "CREATE OR REPLACE" in statement.upper()
    ]
    # No automatic retry: exactly one DDL attempt before unknown.
    assert len(ddl_calls) == 1
