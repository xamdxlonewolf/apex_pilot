"""Guarded Database Source Document fetch, parse, and compile."""

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
    DocumentKind,
    FetchedSourceDocument,
    OracleUnitType,
    ParseSuccess,
    SourceDiagnostic,
    SourceFingerprint,
)
from apex_pilot.interactive.source.parser import SourceParseError, parse_database_source
from apex_pilot.interactive.source.service import (
    DatabaseSourceService,
    SourceConfirmationRequiredError,
    SourceIdentityError,
    SourceServiceError,
    baseline_from_fingerprints,
)

__all__ = [
    "AttachmentState",
    "BaselineFingerprint",
    "CompareResult",
    "CompileOutcome",
    "CompileRequest",
    "CompileResult",
    "CompileTarget",
    "ConfirmationRequired",
    "DatabaseSourceService",
    "DocumentKind",
    "FetchedSourceDocument",
    "OracleUnitType",
    "ParseSuccess",
    "SourceConfirmationRequiredError",
    "SourceDiagnostic",
    "SourceFingerprint",
    "SourceIdentityError",
    "SourceParseError",
    "SourceServiceError",
    "baseline_from_fingerprints",
    "fingerprint_digest",
    "normalize_source_text",
    "parse_database_source",
]
