"""Tests for deterministic SQL and SQLcl safety classification."""

import asyncio
from collections.abc import Mapping

import pytest

from apex_pilot.mcp import SqlclReadOnlyPool, SqlclReadOnlySessionError
from apex_pilot.safety import (
    SafetyCategory,
    SafetyDecision,
    SqlOperation,
    SqlRequestAccess,
    classify_mcp_request,
    classify_sql,
    classify_sqlcl_command,
)


class FakeToolClient:
    """Minimal MCP client double used to prove classifier access gates sessions."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        """Record calls that pass the read-only pool guard."""
        self.calls.append((tool_name, dict(arguments)))
        return {"ok": True}


@pytest.mark.parametrize(
    ("sql", "operation"),
    [
        ("select * from employees", SqlOperation.SELECT),
        ("with q as (select * from employees) select * from q", SqlOperation.SELECT),
    ],
)
def test_classifier_allows_read_only_queries(sql: str, operation: SqlOperation) -> None:
    """SELECT-style statements are allowed and marked read-only."""
    classification = classify_sql(sql)

    assert classification.decision is SafetyDecision.ALLOW
    assert classification.access is SqlRequestAccess.READ_ONLY
    assert classification.operation is operation
    assert classification.category is SafetyCategory.READ_ONLY


@pytest.mark.parametrize(
    ("sql", "operation", "category"),
    [
        ("insert into audit_log (id) values (1)", SqlOperation.INSERT, SafetyCategory.DATA_CHANGE),
        (
            "update employees set salary = salary * 1.1 where department_id = :dept_id",
            SqlOperation.UPDATE,
            SafetyCategory.DATA_CHANGE,
        ),
        (
            "create table app_log (id number generated always as identity)",
            SqlOperation.CREATE,
            SafetyCategory.CONSTRUCTIVE_DDL,
        ),
        ("alter table app_log add created_at timestamp", SqlOperation.ALTER, SafetyCategory.CONSTRUCTIVE_DDL),
    ],
)
def test_classifier_allows_data_change_and_constructive_ddl(
    sql: str,
    operation: SqlOperation,
    category: SafetyCategory,
) -> None:
    """Allowed write-classified SQL must still use the explicit primary session."""
    classification = classify_sql(sql)

    assert classification.decision is SafetyDecision.ALLOW
    assert classification.access is SqlRequestAccess.DATA_CHANGE
    assert classification.operation is operation
    assert classification.category is category


@pytest.mark.parametrize(
    "sql",
    [
        "delete from audit_log where log_date < sysdate - 30",
        "delete from audit_log",
    ],
)
def test_classifier_prompts_for_delete_with_preview(sql: str) -> None:
    """DELETE always requires preview and approval, including no-WHERE deletes."""
    classification = classify_sql(sql)

    assert classification.decision is SafetyDecision.PROMPT
    assert classification.access is SqlRequestAccess.DATA_CHANGE
    assert classification.operation is SqlOperation.DELETE
    assert classification.category is SafetyCategory.DELETE_REQUIRES_PREVIEW
    assert classification.requires_preview


@pytest.mark.parametrize(
    ("sql", "operation", "category"),
    [
        ("truncate table audit_log", SqlOperation.TRUNCATE, SafetyCategory.DESTRUCTIVE),
        ("drop table audit_log purge", SqlOperation.DROP, SafetyCategory.DESTRUCTIVE),
        ("grant dba to app_user", SqlOperation.GRANT, SafetyCategory.SECURITY_SENSITIVE),
        ("revoke create session from app_user", SqlOperation.REVOKE, SafetyCategory.SECURITY_SENSITIVE),
        ("create user app_user identified by values 'hash'", SqlOperation.CREATE, SafetyCategory.SECURITY_SENSITIVE),
        ("alter user app_user account unlock", SqlOperation.ALTER, SafetyCategory.SECURITY_SENSITIVE),
    ],
)
def test_classifier_blocks_destructive_and_security_sensitive_sql(
    sql: str,
    operation: SqlOperation,
    category: SafetyCategory,
) -> None:
    """Irreversible and security-sensitive SQL is blocked before MCP execution."""
    classification = classify_sql(sql)

    assert classification.decision is SafetyDecision.BLOCK
    assert classification.access is SqlRequestAccess.DATA_CHANGE
    assert classification.operation is operation
    assert classification.category is category


@pytest.mark.parametrize(
    ("sql", "category"),
    [
        ("begin delete from audit_log; end;", SafetyCategory.PLSQL),
        ("declare v_count number; begin select count(*) into v_count from audit_log; end;", SafetyCategory.PLSQL),
        ("explain this unknown thing", SafetyCategory.UNKNOWN),
    ],
)
def test_classifier_prompts_for_plsql_and_unknown_syntax(sql: str, category: SafetyCategory) -> None:
    """PL/SQL and unknown syntax use conservative prompt fallback."""
    classification = classify_sql(sql)

    assert classification.decision is SafetyDecision.PROMPT
    assert classification.access is SqlRequestAccess.DATA_CHANGE
    assert classification.category is category


@pytest.mark.parametrize(
    "command",
    [
        "set sqlformat json",
        "show user",
        "desc employees",
        "ddl employees",
    ],
)
def test_classifier_allows_safe_sqlcl_commands(command: str) -> None:
    """Metadata and formatting SQLcl commands are allowlisted."""
    classification = classify_sqlcl_command(command)

    assert classification.decision is SafetyDecision.ALLOW
    assert classification.access is SqlRequestAccess.READ_ONLY
    assert classification.category is SafetyCategory.SQLCL_SAFE
    assert classification.operation is SqlOperation.RUN_SQLCL


@pytest.mark.parametrize(
    "command",
    [
        "lb update -changelog-file controller.xml",
        "load data.csv employees",
        "script ./inventory.js",
        "@dangerous-script.sql",
        "mystery command",
    ],
)
def test_classifier_prompts_for_risky_or_unknown_sqlcl_commands(command: str) -> None:
    """Risky or unknown SQLcl commands require explicit approval."""
    classification = classify_sqlcl_command(command)

    assert classification.decision is SafetyDecision.PROMPT
    assert classification.access is SqlRequestAccess.DATA_CHANGE
    assert classification.operation is SqlOperation.RUN_SQLCL


@pytest.mark.parametrize(
    "command",
    [
        "host dir",
        "!pwd",
        "connect scott/tiger@orcl",
    ],
)
def test_classifier_blocks_host_or_credential_sqlcl_commands(command: str) -> None:
    """Host access and credential-bearing connect commands are blocked."""
    classification = classify_sqlcl_command(command)

    assert classification.decision is SafetyDecision.BLOCK
    assert classification.access is SqlRequestAccess.DATA_CHANGE
    assert classification.category is SafetyCategory.SECURITY_SENSITIVE


def test_mcp_request_classifier_extracts_sql_and_sqlcl_text() -> None:
    """MCP request classification maps tool arguments into the correct classifier."""
    sql_classification = classify_mcp_request("run-sql", {"sql": "select * from employees"})
    sqlcl_classification = classify_mcp_request("run-sqlcl", {"command": "lb update"})

    assert sql_classification.decision is SafetyDecision.ALLOW
    assert sql_classification.access is SqlRequestAccess.READ_ONLY
    assert sqlcl_classification.decision is SafetyDecision.PROMPT
    assert sqlcl_classification.access is SqlRequestAccess.DATA_CHANGE


def test_write_classified_sql_cannot_use_read_only_pool_session() -> None:
    """Classifier access output blocks write requests on read-only pool sessions."""

    async def run_test() -> None:
        client = FakeToolClient()
        pool = SqlclReadOnlyPool((client,))
        session = pool.acquire()
        classification = classify_mcp_request("run-sql", {"sql": "update employees set salary = salary + 1"})

        with pytest.raises(SqlclReadOnlySessionError):
            await session.call_tool(
                "run-sql",
                {"sql": "update employees set salary = salary + 1"},
                access=classification.access,
            )

        assert client.calls == []

    asyncio.run(run_test())
