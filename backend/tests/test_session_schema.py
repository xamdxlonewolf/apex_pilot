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
    from apex_pilot.mcp import SqlclMcpSession
    from apex_pilot.schema import SchemaIntelligenceService

    class _UnusedClient:
        async def call_tool(self, tool_name: str, arguments: object) -> object:
            raise AssertionError("should not call MCP")

    service = SchemaIntelligenceService(SqlclMcpSession.primary(_UnusedClient()))
    bundled = service.sql_with_current_schema("apex_pilot", "create table demo (id number)")
    assert bundled == "create table APEX_PILOT.demo (id number)"


def test_qualify_sql_for_schema_skips_already_qualified_and_dual() -> None:
    from apex_pilot.schema import qualify_sql_for_schema

    assert (
        qualify_sql_for_schema("APEX_PILOT", "create table HR.demo (id number)") == "create table HR.demo (id number)"
    )
    assert qualify_sql_for_schema("APEX_PILOT", "select * from dual") == "select * from dual"
    assert qualify_sql_for_schema("APEX_PILOT", "select * from user_tables") == "select * from user_tables"
    assert (
        qualify_sql_for_schema("APEX_PILOT", "insert into orders (id) values (1)")
        == "insert into APEX_PILOT.orders (id) values (1)"
    )
    assert (
        qualify_sql_for_schema(
            "APEX_PILOT",
            "create index demo_ix on demo (id)",
        )
        == "create index APEX_PILOT.demo_ix on APEX_PILOT.demo (id)"
    )
