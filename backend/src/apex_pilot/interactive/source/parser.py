"""Strict Database Source Document parser (CREATE OR REPLACE + / only)."""

from __future__ import annotations

import re
from dataclasses import dataclass

from apex_pilot.interactive.source.models import (
    DiagnosticSeverity,
    DocumentKind,
    OracleUnitType,
    ParsedSourceUnit,
    ParseSuccess,
    SourceDiagnostic,
    SourceUnitIdentity,
)


class SourceParseError(Exception):
    """Raised when a document is not a valid Database Source Document."""

    def __init__(self, message: str, *, diagnostics: tuple[SourceDiagnostic, ...] = ()) -> None:
        self.diagnostics = diagnostics
        super().__init__(message)


_DELIMITER_LINE_RE = re.compile(r"^\s*/\s*$")
_CREATE_HEAD_RE = re.compile(
    r"""
    ^\s*CREATE\s+OR\s+REPLACE\s+
    (?:EDITIONABLE\s+|NONEDITIONABLE\s+)?
    (?P<type>PACKAGE(?:\s+BODY)?|PROCEDURE|FUNCTION|TRIGGER|TYPE(?:\s+BODY)?)\s+
    (?:(?P<owner>"[^"]+"|[A-Za-z][\w$\#]*)\s*\.\s*)?
    (?P<name>"[^"]+"|[A-Za-z][\w$\#]*)
    """,
    re.IGNORECASE | re.VERBOSE | re.MULTILINE,
)
_SQLCL_COMMAND_RE = re.compile(
    r"""
    ^\s*(?:
        @|@@|
        SET\b|SHOW\b|CONN(?:ECT)?\b|DISCONNECT\b|HOST\b|SPOOL\b|START\b|
        EXEC(?:UTE)?\b|DESC(?:RIBE)?\b|WHENEVER\b|VARIABLE\b|PRINT\b|
        DEFINE\b|UNDEFINE\b|ACCEPT\b|PROMPT\b|PAUSE\b|CLEAR\b|COLUMN\b|
        BREAK\b|COMPUTE\b|TTITLE\b|BTITLE\b|HELP\b|EXIT\b|QUIT\b|
        HISTORY\b|ALIAS\b|SCRIPT\b|LOAD\b|CD\b|ODBC\b|TIMING\b|
        REM\b|REMARK\b
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)
_FORBIDDEN_SQL_HEAD_RE = re.compile(
    r"""
    ^\s*(?:
        SELECT\b|WITH\b|INSERT\b|UPDATE\b|DELETE\b|MERGE\b|CALL\b|
        ALTER\b|DROP\b|TRUNCATE\b|GRANT\b|REVOKE\b|ANALYZE\b|COMMENT\b|
        LOCK\b|EXPLAIN\b|BEGIN\b|DECLARE\b|COMMIT\b|ROLLBACK\b|SAVEPOINT\b|
        CREATE\s+(?!OR\s+REPLACE\b)
    )
    """,
    re.IGNORECASE | re.VERBOSE,
)
_UNIT_TYPE_MAP = {
    "PACKAGE": OracleUnitType.PACKAGE,
    "PACKAGE BODY": OracleUnitType.PACKAGE_BODY,
    "PROCEDURE": OracleUnitType.PROCEDURE,
    "FUNCTION": OracleUnitType.FUNCTION,
    "TRIGGER": OracleUnitType.TRIGGER,
    "TYPE": OracleUnitType.TYPE,
    "TYPE BODY": OracleUnitType.TYPE_BODY,
}


@dataclass(frozen=True)
class _Segment:
    text: str
    start_line: int
    end_line: int


def parse_database_source(
    source_text: str,
    *,
    expected_owner: str | None = None,
    expected_name: str | None = None,
    expected_unit_types: tuple[OracleUnitType, ...] | None = None,
) -> ParseSuccess:
    """Parse a strict Database Source Document into allowed CREATE OR REPLACE units."""
    if not source_text or not source_text.strip():
        raise SourceParseError(
            "Database Source Document is empty.",
            diagnostics=(
                SourceDiagnostic(
                    severity=DiagnosticSeverity.ERROR,
                    message="Document contains no CREATE OR REPLACE units.",
                    line=1,
                    column=1,
                ),
            ),
        )

    segments = _split_delimiter_segments(source_text)
    units: list[ParsedSourceUnit] = []
    diagnostics: list[SourceDiagnostic] = []

    for segment in segments:
        if _is_whitespace_or_comments_only(segment.text):
            continue
        unit, unit_diagnostics = _parse_unit_segment(segment)
        diagnostics.extend(unit_diagnostics)
        if unit is None:
            raise SourceParseError(
                unit_diagnostics[0].message if unit_diagnostics else "Invalid source segment.",
                diagnostics=tuple(unit_diagnostics),
            )
        units.append(unit)

    if not units:
        raise SourceParseError(
            "Database Source Document contains no CREATE OR REPLACE units.",
            diagnostics=(
                SourceDiagnostic(
                    severity=DiagnosticSeverity.ERROR,
                    message="Expected at least one CREATE OR REPLACE unit.",
                    line=1,
                    column=1,
                ),
            ),
        )

    kind = _document_kind(units)
    _validate_combined_identity(units, kind)

    if expected_unit_types is not None:
        actual = tuple(unit.identity.unit_type for unit in units)
        if actual != expected_unit_types:
            raise SourceParseError(
                "Parsed unit types do not match the attached target identity.",
                diagnostics=(
                    SourceDiagnostic(
                        severity=DiagnosticSeverity.ERROR,
                        message=(
                            "Identity mismatch: expected "
                            f"{', '.join(item.value for item in expected_unit_types)} "
                            f"but found {', '.join(item.value for item in actual)}."
                        ),
                        line=units[0].start_line,
                        column=1,
                        unit_type=units[0].identity.unit_type,
                        unit_name=units[0].identity.name,
                    ),
                ),
            )

    if expected_name is not None:
        expected_name_norm = expected_name.upper()
        for unit in units:
            if unit.identity.normalized_name() != expected_name_norm:
                raise SourceParseError(
                    "Parsed object name does not match the attached target identity.",
                    diagnostics=(
                        SourceDiagnostic(
                            severity=DiagnosticSeverity.ERROR,
                            message=(
                                f"Identity mismatch: expected name {expected_name_norm} "
                                f"but found {unit.identity.normalized_name()}."
                            ),
                            line=unit.start_line,
                            column=1,
                            unit_type=unit.identity.unit_type,
                            unit_name=unit.identity.name,
                        ),
                    ),
                )

    if expected_owner is not None:
        expected_owner_norm = expected_owner.upper()
        for unit in units:
            owner = unit.identity.normalized_owner(expected_owner_norm)
            if owner != expected_owner_norm:
                raise SourceParseError(
                    "Parsed owner does not match the attached target identity.",
                    diagnostics=(
                        SourceDiagnostic(
                            severity=DiagnosticSeverity.ERROR,
                            message=(
                                f"Identity mismatch: expected owner {expected_owner_norm} "
                                f"but found {owner}."
                            ),
                            line=unit.start_line,
                            column=1,
                            unit_type=unit.identity.unit_type,
                            unit_name=unit.identity.name,
                        ),
                    ),
                )

    return ParseSuccess(kind=kind, units=tuple(units), diagnostics=tuple(diagnostics))


def strip_client_delimiters(source_text: str) -> str:
    """Remove conventional `/` client delimiters while preserving non-delimiter content."""
    lines = source_text.splitlines()
    kept = [line for line in lines if not _DELIMITER_LINE_RE.match(line)]
    return "\n".join(kept)


def _split_delimiter_segments(source_text: str) -> list[_Segment]:
    lines = source_text.splitlines()
    segments: list[_Segment] = []
    buffer: list[str] = []
    start_line = 1

    for index, line in enumerate(lines, start=1):
        if _DELIMITER_LINE_RE.match(line):
            if buffer:
                segments.append(
                    _Segment(
                        text="\n".join(buffer),
                        start_line=start_line,
                        end_line=index - 1,
                    )
                )
                buffer = []
            start_line = index + 1
            continue
        if not buffer and not line.strip():
            start_line = index + 1
            continue
        if not buffer:
            start_line = index
        buffer.append(line)

    if buffer:
        segments.append(
            _Segment(
                text="\n".join(buffer),
                start_line=start_line,
                end_line=start_line + len(buffer) - 1,
            )
        )
    return segments


def _parse_unit_segment(
    segment: _Segment,
) -> tuple[ParsedSourceUnit | None, list[SourceDiagnostic]]:
    diagnostics: list[SourceDiagnostic] = []
    match = _CREATE_HEAD_RE.search(segment.text)
    if match is None:
        # No CREATE unit: reject SQLcl / extra SQL / unknown content at statement head.
        for relative, line in enumerate(segment.text.splitlines()):
            absolute = segment.start_line + relative
            if _is_comment_or_blank_line(line):
                continue
            if _SQLCL_COMMAND_RE.match(line):
                diagnostics.append(
                    SourceDiagnostic(
                        severity=DiagnosticSeverity.ERROR,
                        message=(
                            "SQLcl command is not allowed in Database Source Documents: "
                            f"{line.strip()}"
                        ),
                        line=absolute,
                        column=1,
                    )
                )
                return None, diagnostics
            if _FORBIDDEN_SQL_HEAD_RE.match(line):
                diagnostics.append(
                    SourceDiagnostic(
                        severity=DiagnosticSeverity.ERROR,
                        message=(
                            "Extra SQL is not allowed in Database Source Documents: "
                            f"{line.strip()}"
                        ),
                        line=absolute,
                        column=1,
                    )
                )
                return None, diagnostics
            diagnostics.append(
                SourceDiagnostic(
                    severity=DiagnosticSeverity.ERROR,
                    message="Expected CREATE OR REPLACE for an allowed unit type.",
                    line=absolute,
                    column=1,
                )
            )
            return None, diagnostics
        diagnostics.append(
            SourceDiagnostic(
                severity=DiagnosticSeverity.ERROR,
                message="Expected CREATE OR REPLACE for an allowed unit type.",
                line=_first_code_line_number(segment),
                column=1,
            )
        )
        return None, diagnostics

    # Disallow content before CREATE (other than comments/whitespace).
    prefix = segment.text[: match.start()]
    if not _is_whitespace_or_comments_only(prefix):
        prefix_line = segment.start_line
        for relative, line in enumerate(prefix.splitlines()):
            if _is_comment_or_blank_line(line):
                continue
            prefix_line = segment.start_line + relative
            if _SQLCL_COMMAND_RE.match(line):
                diagnostics.append(
                    SourceDiagnostic(
                        severity=DiagnosticSeverity.ERROR,
                        message=(
                            "SQLcl command is not allowed in Database Source Documents: "
                            f"{line.strip()}"
                        ),
                        line=prefix_line,
                        column=1,
                    )
                )
                return None, diagnostics
            if _FORBIDDEN_SQL_HEAD_RE.match(line):
                diagnostics.append(
                    SourceDiagnostic(
                        severity=DiagnosticSeverity.ERROR,
                        message=(
                            "Extra SQL is not allowed in Database Source Documents: "
                            f"{line.strip()}"
                        ),
                        line=prefix_line,
                        column=1,
                    )
                )
                return None, diagnostics
            break
        diagnostics.append(
            SourceDiagnostic(
                severity=DiagnosticSeverity.ERROR,
                message="Only comments/whitespace may precede CREATE OR REPLACE.",
                line=prefix_line,
                column=1,
            )
        )
        return None, diagnostics

    # Ensure a second CREATE does not appear in the same segment.
    rest = segment.text[match.end() :]
    if _CREATE_HEAD_RE.search(rest):
        diagnostics.append(
            SourceDiagnostic(
                severity=DiagnosticSeverity.ERROR,
                message="Each `/`-delimited segment may contain only one CREATE OR REPLACE unit.",
                line=segment.start_line,
                column=1,
            )
        )
        return None, diagnostics

    unit_type = _UNIT_TYPE_MAP[re.sub(r"\s+", " ", match.group("type").upper())]
    owner = _unquote_identifier(match.group("owner")) if match.group("owner") else None
    name = _unquote_identifier(match.group("name"))
    create_line = segment.start_line + segment.text[: match.start()].count("\n")
    identity = SourceUnitIdentity(owner=owner, name=name, unit_type=unit_type)
    ddl_text = segment.text.strip()
    return (
        ParsedSourceUnit(
            identity=identity,
            ddl_text=ddl_text,
            start_line=create_line,
            end_line=segment.end_line,
        ),
        diagnostics,
    )


def _document_kind(units: list[ParsedSourceUnit]) -> DocumentKind:
    types = tuple(unit.identity.unit_type for unit in units)
    if types == (OracleUnitType.PACKAGE, OracleUnitType.PACKAGE_BODY):
        return DocumentKind.COMBINED_PACKAGE
    if types == (OracleUnitType.TYPE, OracleUnitType.TYPE_BODY):
        return DocumentKind.COMBINED_TYPE
    if len(units) == 1:
        return DocumentKind.SINGLE
    raise SourceParseError(
        "Unsupported unit combination for a Database Source Document.",
        diagnostics=(
            SourceDiagnostic(
                severity=DiagnosticSeverity.ERROR,
                message=(
                    "V1 supports a single unit or combined package/type "
                    "(specification then body)."
                ),
                line=units[0].start_line,
                column=1,
            ),
        ),
    )


def _validate_combined_identity(units: list[ParsedSourceUnit], kind: DocumentKind) -> None:
    if kind is DocumentKind.SINGLE:
        return
    first, second = units
    if first.identity.normalized_name() != second.identity.normalized_name():
        raise SourceParseError(
            "Combined document units must share the same object name.",
            diagnostics=(
                SourceDiagnostic(
                    severity=DiagnosticSeverity.ERROR,
                    message=(
                        f"Combined unit names differ: {first.identity.normalized_name()} "
                        f"vs {second.identity.normalized_name()}."
                    ),
                    line=second.start_line,
                    column=1,
                    unit_type=second.identity.unit_type,
                    unit_name=second.identity.name,
                ),
            ),
        )
    left_owner = first.identity.owner.upper() if first.identity.owner else None
    right_owner = second.identity.owner.upper() if second.identity.owner else None
    if left_owner and right_owner and left_owner != right_owner:
        raise SourceParseError(
            "Combined document units must share the same owner.",
            diagnostics=(
                SourceDiagnostic(
                    severity=DiagnosticSeverity.ERROR,
                    message=f"Combined unit owners differ: {left_owner} vs {right_owner}.",
                    line=second.start_line,
                    column=1,
                    unit_type=second.identity.unit_type,
                    unit_name=second.identity.name,
                ),
            ),
        )


def _unquote_identifier(raw: str) -> str:
    value = raw.strip()
    if value.startswith('"') and value.endswith('"') and len(value) >= 2:
        return value[1:-1].replace('""', '"')
    return value.upper()


def _is_whitespace_or_comments_only(text: str) -> bool:
    return _strip_sql_comments(text).strip() == ""


def _is_comment_or_blank_line(line: str) -> bool:
    stripped = line.strip()
    return not stripped or stripped.startswith("--")


def _first_code_line_number(segment: _Segment) -> int:
    for relative, line in enumerate(segment.text.splitlines()):
        if not _is_comment_or_blank_line(line) and not line.strip().startswith("/*"):
            return segment.start_line + relative
    return segment.start_line


def _strip_sql_comments(text: str) -> str:
    """Remove `--` and `/* */` comments without attempting full SQL lexing."""
    result: list[str] = []
    index = 0
    length = len(text)
    in_block = False
    while index < length:
        if in_block:
            end = text.find("*/", index)
            if end < 0:
                break
            index = end + 2
            in_block = False
            continue
        if text.startswith("/*", index):
            in_block = True
            index += 2
            continue
        if text.startswith("--", index):
            newline = text.find("\n", index)
            if newline < 0:
                break
            result.append("\n")
            index = newline + 1
            continue
        result.append(text[index])
        index += 1
    return "".join(result)
