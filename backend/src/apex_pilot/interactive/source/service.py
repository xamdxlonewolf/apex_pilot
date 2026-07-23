"""Guarded Database Source fetch/compare/compile on isolated pool leases."""

from __future__ import annotations

from collections.abc import Iterator, Sequence
from contextlib import contextmanager
from typing import Any, Protocol

from apex_pilot.interactive.pool import InteractiveOraclePool, InteractivePoolError, PoolNotOpenError
from apex_pilot.interactive.source.fingerprint import fingerprint_digest, normalize_source_text
from apex_pilot.interactive.source.models import (
    AttachmentState,
    BaselineFingerprint,
    CompareResult,
    CompileOutcome,
    CompileRequest,
    CompileResult,
    CompileTarget,
    ConfirmationRequired,
    DependentObject,
    DiagnosticSeverity,
    DocumentKind,
    FetchedSourceDocument,
    OracleUnitType,
    ParsedSourceUnit,
    SourceDiagnostic,
    SourceFingerprint,
    SourceUnitIdentity,
    StaleConflict,
    UnitCompileResult,
)
from apex_pilot.interactive.source.parser import SourceParseError, parse_database_source


class SourceServiceError(Exception):
    """Base error for guarded source operations."""


class SourceConfirmationRequiredError(SourceServiceError):
    """Raised when compile needs an explicit confirmation flag."""

    def __init__(self, confirmation: ConfirmationRequired) -> None:
        self.confirmation = confirmation
        super().__init__(confirmation.message)


class SourceIdentityError(SourceServiceError):
    """Raised when parsed identity does not match the sticky target."""


class OracleCursor(Protocol):
    """Minimal cursor surface used by the source service."""

    def execute(self, statement: str, parameters: dict[str, Any] | None = None) -> Any:
        """Execute SQL or DDL."""
        ...

    def fetchall(self) -> Sequence[Sequence[Any]]:
        """Fetch all rows."""
        ...

    def close(self) -> None:
        """Close the cursor."""
        ...


class OracleConnection(Protocol):
    """Minimal connection surface used by the source service."""

    def cursor(self) -> OracleCursor:
        """Open a cursor."""
        ...


OBJECT_STATUS_SQL = """
SELECT status
FROM   all_objects
WHERE  owner = :owner
  AND  object_name = :name
  AND  object_type = :object_type
"""

OBJECT_SOURCE_SQL = """
SELECT text
FROM   all_source
WHERE  owner = :owner
  AND  name = :name
  AND  type = :object_type
ORDER  BY line
"""

OBJECT_ERRORS_SQL = """
SELECT line,
       position,
       text,
       attribute
FROM   all_errors
WHERE  owner = :owner
  AND  name = :name
  AND  type = :object_type
ORDER  BY sequence
"""

INVALID_DEPENDENTS_SQL = """
SELECT d.owner,
       d.name,
       d.type,
       o.status
FROM   all_dependencies d
JOIN   all_objects o
       ON  o.owner = d.owner
       AND o.object_name = d.name
       AND o.object_type = d.type
WHERE  d.referenced_owner = :owner
  AND  d.referenced_name = :name
  AND  d.referenced_type = :object_type
  AND  o.status = 'INVALID'
ORDER  BY d.owner, d.name, d.type
"""

_NETWORK_MARKERS = (
    "dpi",
    "dpyn",
    "network",
    "connection",
    "broken pipe",
    "not connected",
    "closed",
    "timeout",
    "timed out",
    "ora-03113",
    "ora-03114",
    "ora-03135",
    "ora-12571",
    "ora-12170",
)


class DatabaseSourceService:
    """App-owned facade for Database Source Document fetch/compare/compile."""

    def __init__(self, pool: InteractiveOraclePool) -> None:
        self._pool = pool

    def parse(
        self,
        source_text: str,
        *,
        expected_owner: str | None = None,
        expected_name: str | None = None,
        expected_unit_types: tuple[OracleUnitType, ...] | None = None,
    ):
        """Parse without touching Oracle."""
        return parse_database_source(
            source_text,
            expected_owner=expected_owner,
            expected_name=expected_name,
            expected_unit_types=expected_unit_types,
        )

    def fetch(
        self,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
        combined: bool = False,
        working_schema: str | None = None,
    ) -> FetchedSourceDocument:
        """Fetch complete editable CREATE OR REPLACE source for one object."""
        owner_norm = owner.strip().upper()
        name_norm = name.strip().upper()
        unit_types = _unit_types_for_fetch(unit_type, combined=combined)

        with self._isolated_connection() as connection:
            fingerprints: list[SourceFingerprint] = []
            source_chunks: list[str] = []
            for current_type in unit_types:
                fingerprint = self._read_fingerprint(
                    connection,
                    owner=owner_norm,
                    name=name_norm,
                    unit_type=current_type,
                    include_source=True,
                )
                if not fingerprint.exists or fingerprint.source_text is None:
                    raise SourceServiceError(
                        f"Oracle object not found: {owner_norm}.{name_norm} ({current_type.value})."
                    )
                fingerprints.append(fingerprint)
                source_chunks.append(fingerprint.source_text.rstrip() + "\n/")

        kind = _kind_for_unit_types(unit_types)
        return FetchedSourceDocument(
            kind=kind,
            owner=owner_norm,
            name=name_norm,
            unit_types=unit_types,
            source_text="\n\n".join(source_chunks) + "\n",
            fingerprints=tuple(fingerprints),
            working_schema=working_schema.strip().upper() if working_schema else None,
        )

    def compare(
        self,
        source_text: str,
        *,
        owner: str,
        name: str,
        unit_types: tuple[OracleUnitType, ...] | None = None,
    ) -> CompareResult:
        """Compare local buffer source with current database stored source."""
        parsed = parse_database_source(
            source_text,
            expected_owner=owner,
            expected_name=name,
            expected_unit_types=unit_types,
        )
        owner_norm = owner.strip().upper()
        name_norm = name.strip().upper()
        local_fps = tuple(
            SourceFingerprint(
                owner=unit.identity.normalized_owner(owner_norm) or owner_norm,
                name=unit.identity.normalized_name(),
                unit_type=unit.identity.unit_type,
                digest=fingerprint_digest(_canonical_unit_text(unit)),
                exists=True,
                status=None,
                source_text=_canonical_unit_text(unit),
            )
            for unit in parsed.units
        )

        with self._isolated_connection() as connection:
            database_fps = tuple(
                self._read_fingerprint(
                    connection,
                    owner=owner_norm,
                    name=name_norm,
                    unit_type=unit.identity.unit_type,
                    include_source=True,
                )
                for unit in parsed.units
            )

        exists = all(item.exists for item in database_fps)
        identical = exists and all(local.digest == db.digest for local, db in zip(local_fps, database_fps, strict=True))
        database_source = None
        if exists:
            database_source = "\n\n".join((item.source_text or "").rstrip() + "\n/" for item in database_fps) + "\n"
        return CompareResult(
            exists=exists,
            identical=identical,
            local_fingerprints=local_fps,
            database_fingerprints=database_fps,
            local_source=normalize_source_text(source_text),
            database_source=database_source,
        )

    def compile(self, request: CompileRequest) -> CompileResult:
        """Compile through an isolated pool lease with stale/attach guards."""
        try:
            parsed = parse_database_source(
                request.source_text,
                expected_owner=request.target.owner,
                expected_name=request.target.name,
                expected_unit_types=request.target.unit_types,
            )
        except SourceParseError as error:
            return CompileResult(
                outcome=CompileOutcome.BLOCKED,
                diagnostics=error.diagnostics,
                message=str(error),
            )

        confirmation = self._required_confirmation(request, parsed.units)
        if confirmation is not None:
            return CompileResult(
                outcome=CompileOutcome.BLOCKED,
                confirmation=confirmation,
                message=confirmation.message,
            )

        try:
            with self._isolated_connection() as connection:
                stale = self._stale_conflicts(connection, request, parsed.units)
                if stale and not request.confirm_force:
                    confirmation = ConfirmationRequired(
                        reason="force",
                        message=(
                            "Database source changed since the baseline fingerprint. "
                            "Compare sources and confirm Force Compile."
                        ),
                        stale_conflicts=stale,
                    )
                    return CompileResult(
                        outcome=CompileOutcome.BLOCKED,
                        confirmation=confirmation,
                        message=confirmation.message,
                    )

                missing = [
                    unit
                    for unit in parsed.units
                    if not self._object_exists(
                        connection,
                        owner=request.target.owner.upper(),
                        name=request.target.name.upper(),
                        unit_type=unit.identity.unit_type,
                    )
                ]
                creating_via_attach = request.attachment_state is AttachmentState.UNCONNECTED and request.confirm_attach
                if (
                    missing
                    and not request.confirm_recreate
                    and not creating_via_attach
                    and request.attachment_state is AttachmentState.ATTACHED
                ):
                    confirmation = ConfirmationRequired(
                        reason="recreate",
                        message=(
                            "Compile target was dropped. Confirm Recreate Object for "
                            f"{request.target.owner.upper()}.{request.target.name.upper()}."
                        ),
                    )
                    return CompileResult(
                        outcome=CompileOutcome.BLOCKED,
                        confirmation=confirmation,
                        message=confirmation.message,
                    )

                unit_results: list[UnitCompileResult] = []
                all_diagnostics: list[SourceDiagnostic] = []
                ddl_started = False
                for unit in parsed.units:
                    try:
                        ddl_started = True
                        self._execute_ddl(connection, unit.ddl_text)
                    except Exception as error:  # noqa: BLE001 - boundary maps uncertain DDL
                        if ddl_started and _looks_like_uncertain_network(error):
                            return CompileResult(
                                outcome=CompileOutcome.UNKNOWN,
                                units=tuple(unit_results),
                                diagnostics=tuple(all_diagnostics),
                                schema_ddl_outside_editor_transaction=True,
                                message=(
                                    "Compile outcome is unknown after a connection failure. "
                                    "Reconnect and reconcile before compiling again."
                                ),
                                requires_reconcile=True,
                            )
                        unit_results.append(
                            UnitCompileResult(
                                identity=_effective_identity(unit.identity, request.target.owner),
                                executed=False,
                                status=None,
                                fingerprint=None,
                                error=str(error),
                            )
                        )
                        return CompileResult(
                            outcome=CompileOutcome.FAILED,
                            units=tuple(unit_results),
                            diagnostics=tuple(all_diagnostics),
                            schema_ddl_outside_editor_transaction=True,
                            message=str(error),
                        )

                    fingerprint = self._read_fingerprint(
                        connection,
                        owner=request.target.owner.upper(),
                        name=request.target.name.upper(),
                        unit_type=unit.identity.unit_type,
                        include_source=True,
                    )
                    diagnostics = self._read_errors(
                        connection,
                        owner=request.target.owner.upper(),
                        name=request.target.name.upper(),
                        unit_type=unit.identity.unit_type,
                        start_line=unit.start_line,
                    )
                    all_diagnostics.extend(diagnostics)
                    unit_results.append(
                        UnitCompileResult(
                            identity=_effective_identity(unit.identity, request.target.owner),
                            executed=True,
                            status=fingerprint.status,
                            fingerprint=fingerprint,
                            diagnostics=diagnostics,
                        )
                    )

                    failed = fingerprint.status == "INVALID" or any(
                        item.severity is DiagnosticSeverity.ERROR for item in diagnostics
                    )
                    if failed:
                        # Combined: stop on spec failure; never auto-restore.
                        invalid_dependents = self._invalid_dependents(
                            connection,
                            owner=request.target.owner.upper(),
                            name=request.target.name.upper(),
                            unit_type=unit.identity.unit_type,
                        )
                        outcome = (
                            CompileOutcome.PARTIAL
                            if unit_results
                            and any(result.executed and result.status == "VALID" for result in unit_results[:-1])
                            else CompileOutcome.FAILED
                        )
                        return CompileResult(
                            outcome=outcome,
                            units=tuple(unit_results),
                            diagnostics=tuple(all_diagnostics),
                            invalid_dependents=invalid_dependents,
                            schema_ddl_outside_editor_transaction=True,
                            message=(
                                "Partial compile: specification succeeded but a later unit failed."
                                if outcome is CompileOutcome.PARTIAL
                                else "Compile failed."
                            ),
                        )

                invalid_dependents = self._invalid_dependents(
                    connection,
                    owner=request.target.owner.upper(),
                    name=request.target.name.upper(),
                    unit_type=parsed.units[-1].identity.unit_type,
                )
                return CompileResult(
                    outcome=CompileOutcome.SUCCEEDED,
                    units=tuple(unit_results),
                    diagnostics=tuple(all_diagnostics),
                    invalid_dependents=invalid_dependents,
                    schema_ddl_outside_editor_transaction=True,
                    message="Compile succeeded.",
                )
        except PoolNotOpenError as error:
            return CompileResult(
                outcome=CompileOutcome.BLOCKED,
                message=str(error),
            )
        except InteractivePoolError as error:
            return CompileResult(
                outcome=CompileOutcome.BLOCKED,
                message=str(error),
            )

    def reconcile(
        self,
        *,
        owner: str,
        name: str,
        unit_types: tuple[OracleUnitType, ...],
    ) -> tuple[SourceFingerprint, ...]:
        """Re-read stored source/status after an unknown DDL outcome."""
        owner_norm = owner.strip().upper()
        name_norm = name.strip().upper()
        with self._isolated_connection() as connection:
            return tuple(
                self._read_fingerprint(
                    connection,
                    owner=owner_norm,
                    name=name_norm,
                    unit_type=unit_type,
                    include_source=True,
                )
                for unit_type in unit_types
            )

    @contextmanager
    def _isolated_connection(self) -> Iterator[OracleConnection]:
        """Borrow a short-lived lease so DDL cannot touch editor transactions."""
        with self._pool.borrow_isolated() as connection:
            yield connection  # type: ignore[misc]

    def _required_confirmation(
        self,
        request: CompileRequest,
        units: tuple[ParsedSourceUnit, ...],
    ) -> ConfirmationRequired | None:
        if request.attachment_state is AttachmentState.UNCONNECTED and not request.confirm_attach:
            return ConfirmationRequired(
                reason="attach",
                message="First compile requires explicit Attach & Compile confirmation.",
            )
        if request.attachment_state is AttachmentState.RETARGET_PENDING and not request.confirm_retarget:
            return ConfirmationRequired(
                reason="retarget",
                message="Retarget requires explicit Attach as New Target confirmation.",
            )

        # Guard identity drift against sticky target even when parse expected_* matched.
        for unit in units:
            identity = _effective_identity(unit.identity, request.target.owner)
            if identity.normalized_name() != request.target.name.upper():
                raise SourceIdentityError("Parsed name does not match compile target.")
            if identity.unit_type not in request.target.unit_types:
                raise SourceIdentityError("Parsed unit type does not match compile target.")
        return None

    def _stale_conflicts(
        self,
        connection: OracleConnection,
        request: CompileRequest,
        units: tuple[ParsedSourceUnit, ...],
    ) -> tuple[StaleConflict, ...]:
        if not request.baseline_fingerprints:
            return ()
        baseline_by_key = {
            (item.owner.upper(), item.name.upper(), item.unit_type): item for item in request.baseline_fingerprints
        }
        conflicts: list[StaleConflict] = []
        for unit in units:
            owner = request.target.owner.upper()
            name = request.target.name.upper()
            key = (owner, name, unit.identity.unit_type)
            baseline = baseline_by_key.get(key)
            if baseline is None:
                continue
            current = self._read_fingerprint(
                connection,
                owner=owner,
                name=name,
                unit_type=unit.identity.unit_type,
                include_source=True,
            )
            if not current.exists:
                continue
            if current.digest != baseline.digest:
                conflicts.append(
                    StaleConflict(
                        unit_type=unit.identity.unit_type,
                        name=name,
                        owner=owner,
                        baseline_digest=baseline.digest,
                        current_digest=current.digest,
                        baseline_source=None,
                        local_source=_canonical_unit_text(unit),
                        current_source=current.source_text,
                    )
                )
        return tuple(conflicts)

    def _read_fingerprint(
        self,
        connection: OracleConnection,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
        include_source: bool,
    ) -> SourceFingerprint:
        status = self._object_status(connection, owner=owner, name=name, unit_type=unit_type)
        if status is None:
            return SourceFingerprint(
                owner=owner,
                name=name,
                unit_type=unit_type,
                digest="",
                exists=False,
                status=None,
                source_text=None,
            )
        source_text = self._object_source_text(connection, owner=owner, name=name, unit_type=unit_type)
        digest = fingerprint_digest(source_text)
        return SourceFingerprint(
            owner=owner,
            name=name,
            unit_type=unit_type,
            digest=digest,
            exists=True,
            status=status,
            source_text=source_text if include_source else None,
        )

    def _object_exists(
        self,
        connection: OracleConnection,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
    ) -> bool:
        return self._object_status(connection, owner=owner, name=name, unit_type=unit_type) is not None

    def _object_status(
        self,
        connection: OracleConnection,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
    ) -> str | None:
        rows = _fetch_all(
            connection,
            OBJECT_STATUS_SQL,
            {"owner": owner, "name": name, "object_type": unit_type.value},
        )
        if not rows:
            return None
        return str(rows[0][0]).upper()

    def _object_source_text(
        self,
        connection: OracleConnection,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
    ) -> str:
        rows = _fetch_all(
            connection,
            OBJECT_SOURCE_SQL,
            {"owner": owner, "name": name, "object_type": unit_type.value},
        )
        if not rows:
            msg = f"Stored source missing for {owner}.{name} ({unit_type.value})."
            raise SourceServiceError(msg)
        body = "".join(str(row[0]) for row in rows)
        return _to_create_or_replace(body, unit_type)

    def _read_errors(
        self,
        connection: OracleConnection,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
        start_line: int,
    ) -> tuple[SourceDiagnostic, ...]:
        rows = _fetch_all(
            connection,
            OBJECT_ERRORS_SQL,
            {"owner": owner, "name": name, "object_type": unit_type.value},
        )
        diagnostics: list[SourceDiagnostic] = []
        for line, position, text, attribute in rows:
            attr = str(attribute).upper() if attribute is not None else "ERROR"
            severity = DiagnosticSeverity.WARNING if attr == "WARNING" else DiagnosticSeverity.ERROR
            oracle_line = int(line) if line is not None else None
            mapped_line = (start_line + oracle_line - 1) if oracle_line and oracle_line > 0 else start_line
            diagnostics.append(
                SourceDiagnostic(
                    severity=severity,
                    message=str(text).rstrip(),
                    line=mapped_line,
                    column=int(position) if position is not None else None,
                    unit_type=unit_type,
                    unit_name=name,
                    attribute=attr,
                )
            )
        return tuple(diagnostics)

    def _invalid_dependents(
        self,
        connection: OracleConnection,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
    ) -> tuple[DependentObject, ...]:
        rows = _fetch_all(
            connection,
            INVALID_DEPENDENTS_SQL,
            {"owner": owner, "name": name, "object_type": unit_type.value},
        )
        return tuple(
            DependentObject(
                owner=str(row[0]).upper(),
                name=str(row[1]).upper(),
                object_type=str(row[2]).upper(),
                status=str(row[3]).upper(),
            )
            for row in rows
        )

    def _execute_ddl(self, connection: OracleConnection, ddl_text: str) -> None:
        cursor = connection.cursor()
        try:
            cursor.execute(ddl_text)
        finally:
            cursor.close()


def _fetch_all(
    connection: OracleConnection,
    sql: str,
    parameters: dict[str, Any],
) -> list[Sequence[Any]]:
    cursor = connection.cursor()
    try:
        cursor.execute(sql, parameters)
        return list(cursor.fetchall())
    finally:
        cursor.close()


def _effective_identity(identity: SourceUnitIdentity, default_owner: str) -> SourceUnitIdentity:
    return SourceUnitIdentity(
        owner=identity.normalized_owner(default_owner),
        name=identity.normalized_name(),
        unit_type=identity.unit_type,
    )


def _canonical_unit_text(unit: ParsedSourceUnit) -> str:
    return normalize_source_text(unit.ddl_text.rstrip() + "\n")


def _to_create_or_replace(body: str, unit_type: OracleUnitType) -> str:
    normalized = normalize_source_text(body)
    stripped = normalized.lstrip()
    if stripped.upper().startswith("CREATE"):
        return normalized if normalized.endswith("\n") else normalized + "\n"
    prefix = f"CREATE OR REPLACE {unit_type.value}\n"
    # ALL_SOURCE usually starts with PACKAGE / PROCEDURE / ... text.
    upper = stripped.upper()
    type_token = unit_type.value
    if upper.startswith(type_token):
        remainder = stripped[len(type_token) :]
        text = f"CREATE OR REPLACE {type_token}{remainder}"
    else:
        text = prefix + stripped
    return text if text.endswith("\n") else text + "\n"


def _unit_types_for_fetch(unit_type: OracleUnitType, *, combined: bool) -> tuple[OracleUnitType, ...]:
    if not combined:
        return (unit_type,)
    if unit_type in {OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY}:
        return (OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY)
    if unit_type in {OracleUnitType.TYPE, OracleUnitType.TYPE_BODY}:
        return (OracleUnitType.TYPE, OracleUnitType.TYPE_BODY)
    msg = f"Combined fetch is only supported for package/type, not {unit_type.value}."
    raise SourceServiceError(msg)


def _kind_for_unit_types(unit_types: tuple[OracleUnitType, ...]) -> DocumentKind:
    if unit_types == (OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY):
        return DocumentKind.COMBINED_PACKAGE
    if unit_types == (OracleUnitType.TYPE, OracleUnitType.TYPE_BODY):
        return DocumentKind.COMBINED_TYPE
    return DocumentKind.SINGLE


def _looks_like_uncertain_network(error: Exception) -> bool:
    message = str(error).casefold()
    return any(marker in message for marker in _NETWORK_MARKERS)


def compile_target_from_parse(
    owner: str,
    name: str,
    unit_types: Sequence[OracleUnitType],
) -> CompileTarget:
    """Helper for building a sticky target from known identity."""
    return CompileTarget(
        owner=owner.strip().upper(),
        name=name.strip().upper(),
        unit_types=tuple(unit_types),
    )


def baseline_from_fingerprints(
    fingerprints: Sequence[SourceFingerprint],
) -> tuple[BaselineFingerprint, ...]:
    """Convert fetched fingerprints into client baseline records."""
    return tuple(
        BaselineFingerprint(
            owner=item.owner,
            name=item.name,
            unit_type=item.unit_type,
            digest=item.digest,
        )
        for item in fingerprints
        if item.exists
    )
