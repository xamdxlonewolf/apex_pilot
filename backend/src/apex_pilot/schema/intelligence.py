"""Oracle schema intelligence through guarded SQLcl MCP sessions."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass, replace
from datetime import UTC, datetime

from apex_pilot.mcp import SqlclMcpSession
from apex_pilot.safety import SqlRequestAccess

RUN_SQL_TOOL = "run-sql"

DATABASE_CONTEXT_SQL = """
SELECT SYS_CONTEXT('USERENV', 'SESSION_USER') AS current_user,
       SYS_CONTEXT('USERENV', 'DB_NAME') AS db_name,
       SYS_CONTEXT('USERENV', 'CON_NAME') AS container_name,
       SYS_CONTEXT('USERENV', 'CDB_NAME') AS cdb_name,
       SYS_CONTEXT('USERENV', 'SERVER_HOST') AS host
FROM   DUAL
"""

SCHEMA_OBJECT_COUNTS_SQL = """
SELECT object_type,
       COUNT(*) AS object_count,
       SUM(CASE WHEN status = 'VALID' THEN 1 ELSE 0 END) AS valid_count,
       SUM(CASE WHEN status = 'INVALID' THEN 1 ELSE 0 END) AS invalid_count
FROM   all_objects
WHERE  owner = :schema_name
  AND  object_type NOT IN ('INDEX','INDEX PARTITION','TABLE PARTITION',
                           'TABLE SUBPARTITION','LOB','LOB PARTITION')
GROUP  BY object_type
ORDER  BY object_type
"""

SCHEMA_TABLES_SQL = """
SELECT table_name,
       num_rows,
       last_analyzed,
       partitioned,
       iot_type
FROM   all_tables
WHERE  owner = :schema_name
ORDER  BY table_name
"""

OBJECT_DEPENDENCIES_SQL = """
SELECT owner,
       name,
       type,
       referenced_owner,
       referenced_name,
       referenced_type
FROM   all_dependencies
WHERE  owner = :schema_name
  AND  name = :object_name
ORDER  BY referenced_owner, referenced_name, referenced_type
"""

OBJECT_REFERENCES_SQL = """
SELECT owner,
       name,
       type,
       referenced_owner,
       referenced_name,
       referenced_type
FROM   all_dependencies
WHERE  referenced_owner = :schema_name
  AND  referenced_name = :object_name
ORDER  BY owner, name, type
"""


class SchemaIntelligenceError(RuntimeError):
    """Raised when schema intelligence cannot parse MCP output."""


@dataclass(frozen=True)
class DatabaseContext:
    """Current Oracle database/session context."""

    current_user: str | None
    db_name: str | None
    container_name: str | None
    cdb_name: str | None
    host: str | None

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable context payload."""
        return {
            "current_user": self.current_user,
            "db_name": self.db_name,
            "container_name": self.container_name,
            "cdb_name": self.cdb_name,
            "host": self.host,
        }


@dataclass(frozen=True)
class SchemaObjectCount:
    """Count and validity summary for one Oracle object type."""

    object_type: str
    object_count: int
    valid_count: int
    invalid_count: int

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable object-count payload."""
        return {
            "object_type": self.object_type,
            "object_count": self.object_count,
            "valid_count": self.valid_count,
            "invalid_count": self.invalid_count,
        }


@dataclass(frozen=True)
class SchemaTable:
    """Visible table metadata for a schema summary."""

    table_name: str
    num_rows: int | None
    last_analyzed: str | None
    partitioned: str | None
    iot_type: str | None

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable table payload."""
        return {
            "table_name": self.table_name,
            "num_rows": self.num_rows,
            "last_analyzed": self.last_analyzed,
            "partitioned": self.partitioned,
            "iot_type": self.iot_type,
        }


@dataclass(frozen=True)
class SchemaDependency:
    """Dependency edge from `owner.name` to `referenced_owner.referenced_name`."""

    owner: str
    name: str
    type: str
    referenced_owner: str
    referenced_name: str
    referenced_type: str

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable dependency payload."""
        return {
            "owner": self.owner,
            "name": self.name,
            "type": self.type,
            "referenced_owner": self.referenced_owner,
            "referenced_name": self.referenced_name,
            "referenced_type": self.referenced_type,
        }


@dataclass(frozen=True)
class SchemaSummary:
    """Structured summary of Oracle schema metadata."""

    connection_name: str | None
    schema_name: str
    captured_at: datetime
    cache_age_seconds: float
    database_context: DatabaseContext
    object_counts: tuple[SchemaObjectCount, ...]
    tables: tuple[SchemaTable, ...]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable schema summary payload."""
        return {
            "connection_name": self.connection_name,
            "schema_name": self.schema_name,
            "captured_at": self.captured_at.isoformat(),
            "cache_age_seconds": self.cache_age_seconds,
            "database_context": self.database_context.to_dict(),
            "object_counts": [item.to_dict() for item in self.object_counts],
            "tables": [item.to_dict() for item in self.tables],
        }


class SchemaIntelligenceService:
    """Read-only Oracle schema intelligence using SQLcl MCP."""

    def __init__(
        self,
        session: SqlclMcpSession,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._session = session
        self._clock = clock or _utc_now
        self._summary_cache: dict[tuple[str | None, str], SchemaSummary] = {}

    async def summarize_schema(self, schema_name: str, *, refresh: bool = False) -> SchemaSummary:
        """Return a cached or freshly queried schema summary."""
        normalized_schema = normalize_dictionary_identifier(schema_name)
        cache_key = (self._session.connection_name, normalized_schema)
        now = self._clock()

        if not refresh and cache_key in self._summary_cache:
            cached = self._summary_cache[cache_key]
            return replace(cached, cache_age_seconds=_age_seconds(cached.captured_at, now))

        database_context_rows = await self._run_read_only_sql(DATABASE_CONTEXT_SQL)
        object_count_rows = await self._run_read_only_sql(
            SCHEMA_OBJECT_COUNTS_SQL,
            {"schema_name": normalized_schema},
        )
        table_rows = await self._run_read_only_sql(
            SCHEMA_TABLES_SQL,
            {"schema_name": normalized_schema},
        )

        summary = SchemaSummary(
            connection_name=self._session.connection_name,
            schema_name=normalized_schema,
            captured_at=now,
            cache_age_seconds=0.0,
            database_context=_parse_database_context(database_context_rows),
            object_counts=tuple(_parse_object_count(row) for row in object_count_rows),
            tables=tuple(_parse_table(row) for row in table_rows),
        )
        self._summary_cache[cache_key] = summary
        return summary

    async def list_object_dependencies(
        self,
        schema_name: str,
        object_name: str,
    ) -> tuple[SchemaDependency, ...]:
        """List objects referenced by the selected schema object."""
        rows = await self._run_read_only_sql(
            OBJECT_DEPENDENCIES_SQL,
            {
                "schema_name": normalize_dictionary_identifier(schema_name),
                "object_name": normalize_dictionary_identifier(object_name),
            },
        )
        return tuple(_parse_dependency(row) for row in rows)

    async def list_object_references(
        self,
        schema_name: str,
        object_name: str,
    ) -> tuple[SchemaDependency, ...]:
        """List objects that reference the selected schema object."""
        rows = await self._run_read_only_sql(
            OBJECT_REFERENCES_SQL,
            {
                "schema_name": normalize_dictionary_identifier(schema_name),
                "object_name": normalize_dictionary_identifier(object_name),
            },
        )
        return tuple(_parse_dependency(row) for row in rows)

    def clear_cache(self) -> None:
        """Clear cached schema summaries so the next request refreshes metadata."""
        self._summary_cache.clear()

    async def _run_read_only_sql(
        self,
        sql: str,
        binds: Mapping[str, object] | None = None,
    ) -> tuple[Mapping[str, object], ...]:
        payload = await self._session.call_tool(
            RUN_SQL_TOOL,
            {
                "sql": sql.strip(),
                "binds": dict(binds or {}),
            },
            access=SqlRequestAccess.READ_ONLY,
        )
        return rows_from_mcp_payload(payload)


def normalize_dictionary_identifier(identifier: str) -> str:
    """Normalize an Oracle dictionary identifier for bind values."""
    normalized = identifier.strip()
    if not normalized:
        msg = "Oracle dictionary identifier cannot be empty."
        raise SchemaIntelligenceError(msg)
    return normalized


def rows_from_mcp_payload(payload: object) -> tuple[Mapping[str, object], ...]:
    """Extract row mappings from common SQLcl MCP fake/live payload shapes."""
    if isinstance(payload, Sequence) and not isinstance(payload, str):
        return tuple(_ensure_row_mapping(row) for row in payload)

    if isinstance(payload, Mapping):
        for key in ("rows", "items", "data", "result"):
            value = payload.get(key)
            if isinstance(value, Sequence) and not isinstance(value, str):
                return tuple(_ensure_row_mapping(row) for row in value)

    msg = "SQLcl MCP run-sql returned an unsupported row payload shape."
    raise SchemaIntelligenceError(msg)


def _parse_database_context(rows: Sequence[Mapping[str, object]]) -> DatabaseContext:
    row = rows[0] if rows else {}
    return DatabaseContext(
        current_user=_optional_text(row, "current_user"),
        db_name=_optional_text(row, "db_name"),
        container_name=_optional_text(row, "container_name"),
        cdb_name=_optional_text(row, "cdb_name"),
        host=_optional_text(row, "host"),
    )


def _parse_object_count(row: Mapping[str, object]) -> SchemaObjectCount:
    return SchemaObjectCount(
        object_type=_required_text(row, "object_type"),
        object_count=_required_int(row, "object_count"),
        valid_count=_required_int(row, "valid_count"),
        invalid_count=_required_int(row, "invalid_count"),
    )


def _parse_table(row: Mapping[str, object]) -> SchemaTable:
    return SchemaTable(
        table_name=_required_text(row, "table_name"),
        num_rows=_optional_int(row, "num_rows"),
        last_analyzed=_optional_text(row, "last_analyzed"),
        partitioned=_optional_text(row, "partitioned"),
        iot_type=_optional_text(row, "iot_type"),
    )


def _parse_dependency(row: Mapping[str, object]) -> SchemaDependency:
    return SchemaDependency(
        owner=_required_text(row, "owner"),
        name=_required_text(row, "name"),
        type=_required_text(row, "type"),
        referenced_owner=_required_text(row, "referenced_owner"),
        referenced_name=_required_text(row, "referenced_name"),
        referenced_type=_required_text(row, "referenced_type"),
    )


def _ensure_row_mapping(row: object) -> Mapping[str, object]:
    if isinstance(row, Mapping):
        return row

    msg = "SQLcl MCP run-sql row must be a mapping."
    raise SchemaIntelligenceError(msg)


def _required_text(row: Mapping[str, object], key: str) -> str:
    value = _lookup_case_insensitive(row, key)
    if isinstance(value, str) and value:
        return value

    msg = f"SQLcl MCP row is missing required text field `{key}`."
    raise SchemaIntelligenceError(msg)


def _optional_text(row: Mapping[str, object], key: str) -> str | None:
    value = _lookup_case_insensitive(row, key)
    if value is None:
        return None
    if isinstance(value, datetime):
        return value.isoformat()
    return str(value)


def _required_int(row: Mapping[str, object], key: str) -> int:
    value = _lookup_case_insensitive(row, key)
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value)

    msg = f"SQLcl MCP row is missing required integer field `{key}`."
    raise SchemaIntelligenceError(msg)


def _optional_int(row: Mapping[str, object], key: str) -> int | None:
    value = _lookup_case_insensitive(row, key)
    if value is None:
        return None
    if isinstance(value, int):
        return value
    if isinstance(value, float) and value.is_integer():
        return int(value)
    if isinstance(value, str) and value.strip().isdigit():
        return int(value)

    msg = f"SQLcl MCP row field `{key}` is not an integer."
    raise SchemaIntelligenceError(msg)


def _lookup_case_insensitive(row: Mapping[str, object], key: str) -> object:
    if key in row:
        return row[key]

    upper_key = key.upper()
    if upper_key in row:
        return row[upper_key]

    lower_key = key.lower()
    if lower_key in row:
        return row[lower_key]

    for row_key, value in row.items():
        if isinstance(row_key, str) and row_key.lower() == lower_key:
            return value

    return None


def _age_seconds(captured_at: datetime, now: datetime) -> float:
    return max((now - captured_at).total_seconds(), 0.0)


def _utc_now() -> datetime:
    return datetime.now(UTC)
