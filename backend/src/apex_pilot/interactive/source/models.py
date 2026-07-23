"""Typed contracts for Database Source Document fetch and compile."""

from __future__ import annotations

from dataclasses import dataclass, field
from enum import StrEnum
from typing import Any, Literal


class OracleUnitType(StrEnum):
    """V1 compile-capable Oracle stored-source unit types."""

    PACKAGE = "PACKAGE"
    PACKAGE_BODY = "PACKAGE BODY"
    PROCEDURE = "PROCEDURE"
    FUNCTION = "FUNCTION"
    TRIGGER = "TRIGGER"
    TYPE = "TYPE"
    TYPE_BODY = "TYPE BODY"


class DocumentKind(StrEnum):
    """How a Database Source Document groups units."""

    SINGLE = "single"
    COMBINED_PACKAGE = "combined_package"
    COMBINED_TYPE = "combined_type"


class AttachmentState(StrEnum):
    """Client-reported attachment state for confirmation gating."""

    UNCONNECTED = "unconnected"
    ATTACHED = "attached"
    RETARGET_PENDING = "retarget_pending"


class CompileOutcome(StrEnum):
    """High-level compile action outcome."""

    SUCCEEDED = "succeeded"
    FAILED = "failed"
    PARTIAL = "partial"
    BLOCKED = "blocked"
    UNKNOWN = "unknown"


class DiagnosticSeverity(StrEnum):
    """Diagnostic severity for parser or Oracle compiler messages."""

    ERROR = "error"
    WARNING = "warning"
    INFO = "info"


@dataclass(frozen=True)
class SourceUnitIdentity:
    """Exact owner/type/name identity for one compile unit."""

    owner: str | None
    name: str
    unit_type: OracleUnitType

    def normalized_owner(self, fallback: str | None = None) -> str | None:
        """Return uppercased owner, falling back when the declaration omitted it."""
        owner = self.owner or fallback
        return owner.upper() if owner else None

    def normalized_name(self) -> str:
        """Return uppercased object name."""
        return self.name.upper()

    def matches(self, other: SourceUnitIdentity, *, default_owner: str | None = None) -> bool:
        """True when owner/type/name agree (declaration owner may inherit default)."""
        left_owner = self.normalized_owner(default_owner)
        right_owner = other.normalized_owner(default_owner)
        return (
            left_owner == right_owner
            and self.unit_type is other.unit_type
            and self.normalized_name() == other.normalized_name()
        )


@dataclass(frozen=True)
class SourceDiagnostic:
    """Parser or Oracle compiler diagnostic with buffer line mapping."""

    severity: DiagnosticSeverity
    message: str
    line: int | None = None
    column: int | None = None
    unit_type: OracleUnitType | None = None
    unit_name: str | None = None
    attribute: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "severity": self.severity.value,
            "message": self.message,
            "line": self.line,
            "column": self.column,
            "unit_type": self.unit_type.value if self.unit_type else None,
            "unit_name": self.unit_name,
            "attribute": self.attribute,
        }


@dataclass(frozen=True)
class ParsedSourceUnit:
    """One allowed CREATE OR REPLACE unit extracted from a document."""

    identity: SourceUnitIdentity
    ddl_text: str
    start_line: int
    end_line: int


@dataclass(frozen=True)
class ParseSuccess:
    """Successful Database Source Document parse."""

    kind: DocumentKind
    units: tuple[ParsedSourceUnit, ...]
    diagnostics: tuple[SourceDiagnostic, ...] = ()


@dataclass(frozen=True)
class SourceFingerprint:
    """Canonical fingerprint for one stored-source unit."""

    owner: str
    name: str
    unit_type: OracleUnitType
    digest: str
    exists: bool
    status: str | None = None
    source_text: str | None = None

    def to_dict(self, *, include_source: bool = False) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        payload: dict[str, Any] = {
            "owner": self.owner,
            "name": self.name,
            "unit_type": self.unit_type.value,
            "digest": self.digest,
            "exists": self.exists,
            "status": self.status,
        }
        if include_source:
            payload["source_text"] = self.source_text
        return payload


@dataclass(frozen=True)
class BaselineFingerprint:
    """Client-held fingerprint captured at open/attach/reconcile/compile."""

    owner: str
    name: str
    unit_type: OracleUnitType
    digest: str


@dataclass(frozen=True)
class CompileTarget:
    """Sticky per-document compile target."""

    owner: str
    name: str
    unit_types: tuple[OracleUnitType, ...]


@dataclass(frozen=True)
class DependentObject:
    """Dependent object reported after DDL (typically newly INVALID)."""

    owner: str
    name: str
    object_type: str
    status: str

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "owner": self.owner,
            "name": self.name,
            "object_type": self.object_type,
            "status": self.status,
        }


@dataclass(frozen=True)
class UnitCompileResult:
    """Per-unit compile attempt result."""

    identity: SourceUnitIdentity
    executed: bool
    status: str | None
    fingerprint: SourceFingerprint | None
    diagnostics: tuple[SourceDiagnostic, ...] = ()
    error: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "owner": self.identity.owner,
            "name": self.identity.name,
            "unit_type": self.identity.unit_type.value,
            "executed": self.executed,
            "status": self.status,
            "fingerprint": self.fingerprint.to_dict() if self.fingerprint else None,
            "diagnostics": [item.to_dict() for item in self.diagnostics],
            "error": self.error,
        }


@dataclass(frozen=True)
class StaleConflict:
    """Pre-compile stale-source comparison payload."""

    unit_type: OracleUnitType
    name: str
    owner: str
    baseline_digest: str
    current_digest: str
    baseline_source: str | None
    local_source: str
    current_source: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "unit_type": self.unit_type.value,
            "name": self.name,
            "owner": self.owner,
            "baseline_digest": self.baseline_digest,
            "current_digest": self.current_digest,
            "baseline_source": self.baseline_source,
            "local_source": self.local_source,
            "current_source": self.current_source,
        }


@dataclass(frozen=True)
class ConfirmationRequired:
    """Compile blocked pending an explicit confirmation flag."""

    reason: Literal["attach", "retarget", "force", "recreate"]
    message: str
    stale_conflicts: tuple[StaleConflict, ...] = ()

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "reason": self.reason,
            "message": self.message,
            "stale_conflicts": [item.to_dict() for item in self.stale_conflicts],
        }


@dataclass(frozen=True)
class FetchedSourceDocument:
    """Editable CREATE OR REPLACE source opened from the database."""

    kind: DocumentKind
    owner: str
    name: str
    unit_types: tuple[OracleUnitType, ...]
    source_text: str
    fingerprints: tuple[SourceFingerprint, ...]
    working_schema: str | None = None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "kind": self.kind.value,
            "owner": self.owner,
            "name": self.name,
            "unit_types": [unit.value for unit in self.unit_types],
            "source_text": self.source_text,
            "fingerprints": [item.to_dict(include_source=False) for item in self.fingerprints],
            "working_schema": self.working_schema,
        }


@dataclass(frozen=True)
class CompareResult:
    """First-attach / reconcile comparison across local and database source."""

    exists: bool
    identical: bool
    local_fingerprints: tuple[SourceFingerprint, ...]
    database_fingerprints: tuple[SourceFingerprint, ...]
    local_source: str
    database_source: str | None

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "exists": self.exists,
            "identical": self.identical,
            "local_fingerprints": [item.to_dict() for item in self.local_fingerprints],
            "database_fingerprints": [item.to_dict() for item in self.database_fingerprints],
            "local_source": self.local_source,
            "database_source": self.database_source,
        }


@dataclass(frozen=True)
class CompileResult:
    """Guarded compile attempt outcome."""

    outcome: CompileOutcome
    units: tuple[UnitCompileResult, ...] = ()
    diagnostics: tuple[SourceDiagnostic, ...] = ()
    confirmation: ConfirmationRequired | None = None
    invalid_dependents: tuple[DependentObject, ...] = ()
    schema_ddl_outside_editor_transaction: bool = False
    message: str | None = None
    requires_reconcile: bool = False

    def to_dict(self) -> dict[str, Any]:
        """Serialize for HTTP responses."""
        return {
            "outcome": self.outcome.value,
            "units": [item.to_dict() for item in self.units],
            "diagnostics": [item.to_dict() for item in self.diagnostics],
            "confirmation": self.confirmation.to_dict() if self.confirmation else None,
            "invalid_dependents": [item.to_dict() for item in self.invalid_dependents],
            "schema_ddl_outside_editor_transaction": self.schema_ddl_outside_editor_transaction,
            "message": self.message,
            "requires_reconcile": self.requires_reconcile,
        }


@dataclass
class CompileRequest:
    """Inbound compile request after HTTP validation."""

    source_text: str
    target: CompileTarget
    attachment_state: AttachmentState
    baseline_fingerprints: tuple[BaselineFingerprint, ...] = ()
    working_schema: str | None = None
    confirm_attach: bool = False
    confirm_retarget: bool = False
    confirm_force: bool = False
    confirm_recreate: bool = False
    local_unit_sources: dict[tuple[str, str, str], str] = field(default_factory=dict)
