"""Tests for session schema suggestion and CURRENT_SCHEMA switching."""

from apex_pilot.safety import SafetyDecision, classify_sql
from apex_pilot.schema import DatabaseContext, suggested_schema_from_context


def test_suggested_schema_prefers_login_user_over_current_schema() -> None:
    context = DatabaseContext(
        current_user="MCCOBB",
        current_schema="HR",
        proxy_user=None,
        db_name="ORCL",
        container_name=None,
        cdb_name=None,
        host=None,
    )
    assert suggested_schema_from_context(context) == "MCCOBB"


def test_suggested_schema_parses_proxy_bracket_user() -> None:
    context = DatabaseContext(
        current_user="323847[SCHEMA_NAME_HERE]",
        current_schema=None,
        proxy_user="323847",
        db_name="ORCL",
        container_name=None,
        cdb_name=None,
        host=None,
    )
    assert suggested_schema_from_context(context) == "SCHEMA_NAME_HERE"


def test_alter_session_current_schema_is_allowed() -> None:
    result = classify_sql("ALTER SESSION SET CURRENT_SCHEMA = APP")
    assert result.decision is SafetyDecision.ALLOW
    assert result.access.value == "read_only"


def test_sql_with_current_schema_prefixes_user_sql() -> None:
    from apex_pilot.schema import SchemaIntelligenceService
    from apex_pilot.mcp import SqlclMcpSession

    class _UnusedClient:
        async def call_tool(self, tool_name: str, arguments: object) -> object:
            raise AssertionError("should not call MCP")

    service = SchemaIntelligenceService(SqlclMcpSession.primary(_UnusedClient()))
    bundled = service.sql_with_current_schema("hr", "select * from dual")
    assert bundled.startswith("ALTER SESSION SET CURRENT_SCHEMA = HR;")
    assert bundled.endswith("select * from dual")
