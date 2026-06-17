"""Tests for Oracle schema intelligence through guarded MCP sessions."""

import asyncio
from collections.abc import Mapping
from dataclasses import dataclass
from datetime import UTC, datetime, timedelta

import pytest

from apex_pilot.mcp import SqlclMcpSession
from apex_pilot.schema import (
    SchemaDependency,
    SchemaIntelligenceError,
    SchemaIntelligenceService,
    normalize_dictionary_identifier,
    rows_from_mcp_payload,
)


@dataclass(frozen=True)
class ToolCall:
    """Recorded fake MCP tool call."""

    tool_name: str
    arguments: dict[str, object]


class FakeToolClient:
    """Queue-backed fake MCP tool client."""

    def __init__(self, responses: list[object]) -> None:
        self._responses = responses
        self.calls: list[ToolCall] = []

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        """Record the call and return the next queued response."""
        self.calls.append(ToolCall(tool_name=tool_name, arguments=dict(arguments)))
        if not self._responses:
            raise AssertionError(f"No fake response queued for {tool_name}")
        return self._responses.pop(0)


class FakeClock:
    """Mutable clock for cache-age tests."""

    def __init__(self, value: datetime) -> None:
        self.value = value

    def __call__(self) -> datetime:
        """Return the current fake time."""
        return self.value


def test_schema_summary_uses_read_only_mcp_dictionary_queries() -> None:
    """Schema summaries are built from read-only MCP `run-sql` dictionary calls."""

    async def run_test() -> None:
        client = FakeToolClient(
            [
                {
                    "rows": [
                        {
                            "CURRENT_USER": "APP",
                            "DB_NAME": "FREE",
                            "CONTAINER_NAME": "FREEPDB1",
                            "CDB_NAME": "FREE",
                            "HOST": "localhost",
                        },
                    ],
                },
                {
                    "rows": [
                        {
                            "OBJECT_TYPE": "TABLE",
                            "OBJECT_COUNT": 2,
                            "VALID_COUNT": 2,
                            "INVALID_COUNT": 0,
                        },
                        {
                            "OBJECT_TYPE": "VIEW",
                            "OBJECT_COUNT": 1,
                            "VALID_COUNT": 0,
                            "INVALID_COUNT": 1,
                        },
                    ],
                },
                {
                    "rows": [
                        {
                            "TABLE_NAME": "ORDERS",
                            "NUM_ROWS": "10",
                            "LAST_ANALYZED": "2026-06-16T20:00:00",
                            "PARTITIONED": "NO",
                            "IOT_TYPE": None,
                        },
                    ],
                },
            ],
        )
        session = SqlclMcpSession.read_only(client)
        service = SchemaIntelligenceService(session, clock=lambda: datetime(2026, 6, 16, tzinfo=UTC))

        summary = await service.summarize_schema("APP")

        assert summary.schema_name == "APP"
        assert summary.cache_age_seconds == 0.0
        assert summary.database_context.current_user == "APP"
        assert summary.object_counts[0].object_type == "TABLE"
        assert summary.object_counts[1].invalid_count == 1
        assert summary.tables[0].table_name == "ORDERS"
        assert summary.tables[0].num_rows == 10
        assert summary.to_dict()["schema_name"] == "APP"
        assert len(client.calls) == 3
        assert all(call.tool_name == "run-sql" for call in client.calls)
        assert client.calls[1].arguments["binds"] == {"schema_name": "APP"}
        assert "all_objects" in str(client.calls[1].arguments["sql"])
        assert "all_tables" in str(client.calls[2].arguments["sql"])

    asyncio.run(run_test())


def test_schema_summary_cache_reports_visible_age_and_refreshes_on_request() -> None:
    """Session cache avoids repeated dictionary queries while reporting cache age."""

    async def run_test() -> None:
        clock = FakeClock(datetime(2026, 6, 16, 20, 0, tzinfo=UTC))
        client = FakeToolClient(
            [
                {"rows": [{"CURRENT_USER": "APP"}]},
                {"rows": [{"OBJECT_TYPE": "TABLE", "OBJECT_COUNT": 1, "VALID_COUNT": 1, "INVALID_COUNT": 0}]},
                {"rows": []},
                {"rows": [{"CURRENT_USER": "APP"}]},
                {"rows": [{"OBJECT_TYPE": "TABLE", "OBJECT_COUNT": 2, "VALID_COUNT": 2, "INVALID_COUNT": 0}]},
                {"rows": []},
            ],
        )
        service = SchemaIntelligenceService(SqlclMcpSession.read_only(client), clock=clock)

        first = await service.summarize_schema("APP")
        clock.value = clock.value + timedelta(seconds=90)
        cached = await service.summarize_schema("APP")
        refreshed = await service.summarize_schema("APP", refresh=True)

        assert first.object_counts[0].object_count == 1
        assert cached.cache_age_seconds == 90.0
        assert cached.object_counts[0].object_count == 1
        assert refreshed.cache_age_seconds == 0.0
        assert refreshed.object_counts[0].object_count == 2
        assert len(client.calls) == 6

    asyncio.run(run_test())


def test_schema_dependency_helpers_query_all_dependencies_through_mcp() -> None:
    """Dependency and reference helpers return structured dependency edges."""

    async def run_test() -> None:
        client = FakeToolClient(
            [
                {
                    "rows": [
                        {
                            "OWNER": "APP",
                            "NAME": "ORDER_V",
                            "TYPE": "VIEW",
                            "REFERENCED_OWNER": "APP",
                            "REFERENCED_NAME": "ORDERS",
                            "REFERENCED_TYPE": "TABLE",
                        },
                    ],
                },
                {
                    "rows": [
                        {
                            "OWNER": "APP",
                            "NAME": "ORDER_API",
                            "TYPE": "PACKAGE BODY",
                            "REFERENCED_OWNER": "APP",
                            "REFERENCED_NAME": "ORDERS",
                            "REFERENCED_TYPE": "TABLE",
                        },
                    ],
                },
            ],
        )
        service = SchemaIntelligenceService(SqlclMcpSession.read_only(client))

        dependencies = await service.list_object_dependencies("APP", "ORDER_V")
        references = await service.list_object_references("APP", "ORDERS")

        assert dependencies == (
            SchemaDependency(
                owner="APP",
                name="ORDER_V",
                type="VIEW",
                referenced_owner="APP",
                referenced_name="ORDERS",
                referenced_type="TABLE",
            ),
        )
        assert references[0].name == "ORDER_API"
        assert client.calls[0].arguments["binds"] == {"schema_name": "APP", "object_name": "ORDER_V"}
        assert client.calls[1].arguments["binds"] == {"schema_name": "APP", "object_name": "ORDERS"}
        assert all("all_dependencies" in str(call.arguments["sql"]) for call in client.calls)

    asyncio.run(run_test())


def test_schema_cache_can_be_cleared_manually() -> None:
    """Manual cache clearing forces the next summary request to query MCP again."""

    async def run_test() -> None:
        client = FakeToolClient(
            [
                {"rows": [{"CURRENT_USER": "APP"}]},
                {"rows": []},
                {"rows": []},
                {"rows": [{"CURRENT_USER": "APP"}]},
                {"rows": []},
                {"rows": []},
            ],
        )
        service = SchemaIntelligenceService(SqlclMcpSession.read_only(client))

        await service.summarize_schema("APP")
        service.clear_cache()
        await service.summarize_schema("APP")

        assert len(client.calls) == 6

    asyncio.run(run_test())


def test_rows_from_mcp_payload_rejects_unsupported_shapes() -> None:
    """Unsupported MCP payloads fail clearly instead of being silently accepted."""
    with pytest.raises(SchemaIntelligenceError, match="unsupported"):
        rows_from_mcp_payload({"rows": "not-row-data"})


def test_rows_from_mcp_payload_unwraps_nested_mcp_text_json() -> None:
    """MCP text-content envelopes can carry JSON row payloads."""
    rows = rows_from_mcp_payload(
        {
            "content": [
                {
                    "type": "text",
                    "text": '{"result": {"rows": [{"OBJECT_TYPE": "TABLE", "OBJECT_COUNT": 1}]}}',
                },
            ],
        },
    )

    assert rows == ({"OBJECT_TYPE": "TABLE", "OBJECT_COUNT": 1},)


def test_dictionary_identifier_normalization_matches_oracle_defaults() -> None:
    """Unquoted Oracle dictionary identifiers are uppercase; quoted names keep case."""
    assert normalize_dictionary_identifier(" app ") == "APP"
    assert normalize_dictionary_identifier('"MixedCase"') == "MixedCase"

    with pytest.raises(SchemaIntelligenceError, match="empty"):
        normalize_dictionary_identifier(" ")
