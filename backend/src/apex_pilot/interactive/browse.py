"""Guarded read-only browse facades over short-lived borrow leases (ADR-0008)."""

from __future__ import annotations

from collections.abc import Callable, Mapping, Sequence
from dataclasses import replace
from datetime import UTC, datetime
from typing import Any

from apex_pilot.interactive.pool import (
    InteractiveOraclePool,
    InteractivePoolError,
    InteractivePoolState,
    PoolNotOpenError,
)
from apex_pilot.schema.intelligence import (
    DATABASE_CONTEXT_SQL,
    SCHEMA_OBJECT_COUNTS_SQL,
    SCHEMA_TABLES_SQL,
    DatabaseContext,
    SchemaIntelligenceError,
    SchemaSummary,
    _parse_database_context,
    _parse_object_count,
    _parse_table,
    normalize_dictionary_identifier,
)


class InteractiveBrowseError(InteractivePoolError):
    """Raised when interactive browse cannot complete a read-only lease."""


class InteractiveBrowseService:
    """Database Drawer / session-context reads via borrow_readonly leases."""

    def __init__(
        self,
        pool: InteractiveOraclePool,
        *,
        clock: Callable[[], datetime] | None = None,
    ) -> None:
        self._pool = pool
        self._clock = clock or _utc_now
        self._summary_cache: dict[tuple[str, str], SchemaSummary] = {}
        self._context_cache: dict[str, DatabaseContext] = {}

    def clear_cache(self) -> None:
        """Drop cached browse results (Refresh / profile / Working Schema change)."""
        self._summary_cache.clear()
        self._context_cache.clear()

    def fetch_database_context(self, *, refresh: bool = False) -> DatabaseContext:
        """Return session context through a short-lived read-only borrow lease."""
        binding = self._require_connected_binding()
        if not refresh and binding.profile_id in self._context_cache:
            return self._context_cache[binding.profile_id]

        try:
            with self._pool.borrow_readonly() as connection:
                rows = _fetch_mappings(connection, DATABASE_CONTEXT_SQL)
        except PoolNotOpenError:
            raise
        except Exception as error:
            msg = "Interactive browse failed while reading session context."
            raise InteractiveBrowseError(msg) from error

        context = _parse_database_context(rows)
        self._context_cache[binding.profile_id] = context
        return context

    def summarize_schema(self, schema_name: str, *, refresh: bool = False) -> SchemaSummary:
        """Return a schema summary through short-lived borrow leases."""
        binding = self._require_connected_binding()
        normalized_schema = normalize_dictionary_identifier(schema_name)
        cache_key = (binding.profile_id, normalized_schema)
        now = self._clock()

        if not refresh and cache_key in self._summary_cache:
            cached = self._summary_cache[cache_key]
            return replace(cached, cache_age_seconds=_age_seconds(cached.captured_at, now))

        try:
            database_context = self.fetch_database_context(refresh=refresh)
        except Exception:  # noqa: BLE001 - empty context keeps summary usable
            database_context = DatabaseContext(
                current_user=None,
                current_schema=None,
                proxy_user=None,
                db_name=None,
                container_name=None,
                cdb_name=None,
                host=None,
            )

        try:
            with self._pool.borrow_readonly() as connection:
                object_count_rows = _fetch_mappings(
                    connection,
                    SCHEMA_OBJECT_COUNTS_SQL,
                    {"schema_name": normalized_schema},
                )
                table_rows = _fetch_mappings(
                    connection,
                    SCHEMA_TABLES_SQL,
                    {"schema_name": normalized_schema},
                )
        except PoolNotOpenError:
            raise
        except SchemaIntelligenceError:
            raise
        except Exception as error:
            msg = f"Interactive browse failed while summarizing schema `{normalized_schema}`."
            raise InteractiveBrowseError(msg) from error

        summary = SchemaSummary(
            connection_name=binding.display_name or binding.profile_id,
            schema_name=normalized_schema,
            captured_at=now,
            cache_age_seconds=0.0,
            database_context=database_context,
            object_counts=tuple(_parse_object_count(row) for row in object_count_rows),
            tables=tuple(_parse_table(row) for row in table_rows),
        )
        self._summary_cache[cache_key] = summary
        return summary

    def _require_connected_binding(self):
        status = self._pool.status()
        if status.state is not InteractivePoolState.CONNECTED or status.profile_id is None:
            msg = "Interactive Oracle pool is not connected."
            raise PoolNotOpenError(msg)
        binding = self._pool.binding
        if binding is None:
            msg = "Interactive Oracle pool is not connected."
            raise PoolNotOpenError(msg)
        return binding


def _fetch_mappings(
    connection: Any,
    sql: str,
    binds: Mapping[str, object] | None = None,
) -> tuple[Mapping[str, object], ...]:
    """Execute read-only SQL on a borrowed connection; never return the connection."""
    cursor = connection.cursor()
    try:
        cursor.execute(sql.strip(), dict(binds or {}))
        description = cursor.description or ()
        columns = [str(item[0]).lower() for item in description]
        rows: list[Mapping[str, object]] = []
        for raw in cursor.fetchall():
            if isinstance(raw, Mapping):
                rows.append({str(key).lower(): value for key, value in raw.items()})
                continue
            if isinstance(raw, Sequence) and not isinstance(raw, (str, bytes)):
                rows.append(dict(zip(columns, raw, strict=False)))
                continue
            msg = "Interactive browse cursor returned an unsupported row shape."
            raise SchemaIntelligenceError(msg)
        return tuple(rows)
    finally:
        close = getattr(cursor, "close", None)
        if callable(close):
            close()


def _age_seconds(captured_at: datetime, now: datetime) -> float:
    return max((now - captured_at).total_seconds(), 0.0)


def _utc_now() -> datetime:
    return datetime.now(UTC)
