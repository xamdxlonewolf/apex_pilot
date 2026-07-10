"""Deterministic SQL and SQLcl safety classification."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from enum import StrEnum


class SqlRequestAccess(StrEnum):
    """Access classification consumed by guarded MCP sessions."""

    READ_ONLY = "read_only"
    DATA_CHANGE = "data_change"


class SafetyDecision(StrEnum):
    """Execution decision produced by deterministic safety classification."""

    ALLOW = "allow"
    PROMPT = "prompt"
    BLOCK = "block"


class SafetyCategory(StrEnum):
    """High-level safety category for a classified request."""

    READ_ONLY = "read_only"
    DATA_CHANGE = "data_change"
    CONSTRUCTIVE_DDL = "constructive_ddl"
    DELETE_REQUIRES_PREVIEW = "delete_requires_preview"
    DESTRUCTIVE = "destructive"
    SECURITY_SENSITIVE = "security_sensitive"
    SQLCL_SAFE = "sqlcl_safe"
    SQLCL_RISKY = "sqlcl_risky"
    PLSQL = "plsql"
    UNKNOWN = "unknown"
    MIXED = "mixed"


class SqlOperation(StrEnum):
    """Primary SQL or MCP operation recognized by the classifier."""

    SELECT = "select"
    INSERT = "insert"
    UPDATE = "update"
    DELETE = "delete"
    MERGE = "merge"
    CREATE = "create"
    ALTER = "alter"
    DROP = "drop"
    TRUNCATE = "truncate"
    GRANT = "grant"
    REVOKE = "revoke"
    PLSQL = "plsql"
    TRANSACTION_CONTROL = "transaction_control"
    RUN_SQLCL = "run_sqlcl"
    MCP_TOOL = "mcp_tool"
    UNKNOWN = "unknown"
    MIXED = "mixed"


@dataclass(frozen=True)
class SqlStatementClassification:
    """Safety classification for one SQL statement."""

    decision: SafetyDecision
    access: SqlRequestAccess
    category: SafetyCategory
    operation: SqlOperation
    reasons: tuple[str, ...]
    requires_preview: bool = False


@dataclass(frozen=True)
class SqlSafetyClassification:
    """Safety classification for one MCP request or SQL text."""

    decision: SafetyDecision
    access: SqlRequestAccess
    category: SafetyCategory
    operation: SqlOperation
    reasons: tuple[str, ...]
    requires_preview: bool = False
    statements: tuple[SqlStatementClassification, ...] = ()


_TOKEN_PATTERN = re.compile(r"[A-Z][A-Z0-9_$#]*|\d+(?:\.\d+)?|<>|!=|<=|>=|:=|[(),;=*]|\S", re.IGNORECASE)
_DECISION_PRIORITY = {
    SafetyDecision.ALLOW: 0,
    SafetyDecision.PROMPT: 1,
    SafetyDecision.BLOCK: 2,
}
_CONSTRUCTIVE_CREATE_OBJECTS = frozenset(
    {
        "TABLE",
        "VIEW",
        "INDEX",
        "SEQUENCE",
        "SYNONYM",
        "MATERIALIZED",
    },
)
_PLSQL_CREATE_OBJECTS = frozenset({"FUNCTION", "PACKAGE", "PROCEDURE", "TRIGGER", "TYPE"})
_SECURITY_OBJECTS = frozenset({"USER", "ROLE", "PROFILE"})
_SAFE_SQLCL_COMMANDS = frozenset({"DESC", "DESCRIBE", "DDL", "HELP", "INFO", "SHOW"})
_SAFE_SQLCL_SET_OPTIONS = frozenset(
    {
        "DDL",
        "FEEDBACK",
        "HEADING",
        "LINESIZE",
        "PAGESIZE",
        "SQLFORMAT",
    },
)
_RISKY_SQLCL_COMMANDS = frozenset(
    {
        "@",
        "@@",
        "APEX",
        "EDIT",
        "GET",
        "IMPORT",
        "LB",
        "LIQUIBASE",
        "LOAD",
        "ORDS",
        "RUN",
        "SAVE",
        "SCRIPT",
        "SPOOL",
        "START",
        "STORE",
    },
)
_BLOCKED_SQLCL_COMMANDS = frozenset({"!", "$", "CONN", "CONNECT", "HOST", "PASSWORD"})


def classify_mcp_request(tool_name: str, arguments: Mapping[str, object]) -> SqlSafetyClassification:
    """Classify a SQLcl MCP tool request before it reaches a session."""
    normalized_tool = tool_name.strip().lower()
    if normalized_tool in {"list-connections", "connect", "disconnect"}:
        return _single_result(
            decision=SafetyDecision.ALLOW,
            access=SqlRequestAccess.READ_ONLY,
            category=SafetyCategory.READ_ONLY,
            operation=SqlOperation.MCP_TOOL,
            reasons=(f"MCP tool `{normalized_tool}` does not execute SQL text.",),
        )

    if normalized_tool == "run-sql":
        sql_text = _first_text_value(arguments, "sql", "statement", "query")
        if sql_text is None:
            return _unknown_result("MCP `run-sql` request did not include SQL text.")
        return classify_sql(sql_text)

    if normalized_tool == "run-sqlcl":
        command = _first_text_value(arguments, "command", "sqlcl", "text")
        if command is None:
            return _unknown_result("MCP `run-sqlcl` request did not include command text.")
        return classify_sqlcl_command(command)

    return _unknown_result(f"MCP tool `{tool_name}` is not in the safety allowlist.")


def classify_sql(sql: str) -> SqlSafetyClassification:
    """Classify SQL text using deterministic tokenization and conservative fallback."""
    statements = _split_sql_statements(sql)
    if not statements:
        return _unknown_result("SQL text is empty.")

    statement_results = tuple(_classify_sql_statement(statement) for statement in statements)
    return _combine_statement_results(statement_results)


def classify_sqlcl_command(command: str) -> SqlSafetyClassification:
    """Classify a SQLcl command for `run-sqlcl` allowlist policy."""
    tokens = _sqlcl_tokens(command)
    if not tokens:
        return _unknown_result("SQLcl command text is empty.", operation=SqlOperation.RUN_SQLCL)

    command_name = tokens[0]
    if command_name in _BLOCKED_SQLCL_COMMANDS:
        return _single_result(
            decision=SafetyDecision.BLOCK,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.SECURITY_SENSITIVE,
            operation=SqlOperation.RUN_SQLCL,
            reasons=(f"SQLcl command `{command_name}` can expose credentials or host access.",),
        )

    if command_name == "SET" and len(tokens) > 1 and tokens[1] in _SAFE_SQLCL_SET_OPTIONS:
        return _single_result(
            decision=SafetyDecision.ALLOW,
            access=SqlRequestAccess.READ_ONLY,
            category=SafetyCategory.SQLCL_SAFE,
            operation=SqlOperation.RUN_SQLCL,
            reasons=(f"SQLcl `SET {tokens[1]}` is allowlisted as formatting or metadata configuration.",),
        )

    if command_name in _SAFE_SQLCL_COMMANDS:
        return _single_result(
            decision=SafetyDecision.ALLOW,
            access=SqlRequestAccess.READ_ONLY,
            category=SafetyCategory.SQLCL_SAFE,
            operation=SqlOperation.RUN_SQLCL,
            reasons=(f"SQLcl command `{command_name}` is allowlisted for metadata or help output.",),
        )

    if command_name in _RISKY_SQLCL_COMMANDS:
        return _single_result(
            decision=SafetyDecision.PROMPT,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.SQLCL_RISKY,
            operation=SqlOperation.RUN_SQLCL,
            reasons=(f"SQLcl command `{command_name}` can run scripts, load data, write files, or change schemas.",),
        )

    return _single_result(
        decision=SafetyDecision.PROMPT,
        access=SqlRequestAccess.DATA_CHANGE,
        category=SafetyCategory.UNKNOWN,
        operation=SqlOperation.RUN_SQLCL,
        reasons=("Unknown SQLcl command requires explicit review before execution.",),
    )


def _classify_sql_statement(statement: str) -> SqlStatementClassification:
    tokens = _sql_tokens(statement)
    if not tokens:
        return _statement(
            decision=SafetyDecision.PROMPT,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.UNKNOWN,
            operation=SqlOperation.UNKNOWN,
            reasons=("SQL statement could not be tokenized.",),
        )

    first = tokens[0]
    if first in {"SELECT", "WITH"}:
        return _statement(
            decision=SafetyDecision.ALLOW,
            access=SqlRequestAccess.READ_ONLY,
            category=SafetyCategory.READ_ONLY,
            operation=SqlOperation.SELECT,
            reasons=("Read-only query is allowed.",),
        )

    if first == "INSERT":
        return _allowed_data_change(SqlOperation.INSERT, "INSERT is allowed but must use the primary MCP session.")

    if first == "UPDATE":
        return _allowed_data_change(SqlOperation.UPDATE, "UPDATE is allowed but must use the primary MCP session.")

    if first == "MERGE":
        if "DELETE" in tokens:
            return _statement(
                decision=SafetyDecision.PROMPT,
                access=SqlRequestAccess.DATA_CHANGE,
                category=SafetyCategory.DELETE_REQUIRES_PREVIEW,
                operation=SqlOperation.MERGE,
                reasons=("MERGE with a DELETE clause requires preview and approval.",),
                requires_preview=True,
            )
        return _allowed_data_change(SqlOperation.MERGE, "MERGE is allowed but must use the primary MCP session.")

    if first == "DELETE":
        reasons = ["DELETE requires preview and approval."]
        if "WHERE" not in tokens:
            reasons.append("DELETE without WHERE can affect every row.")
        return _statement(
            decision=SafetyDecision.PROMPT,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.DELETE_REQUIRES_PREVIEW,
            operation=SqlOperation.DELETE,
            reasons=tuple(reasons),
            requires_preview=True,
        )

    if first == "CREATE":
        return _classify_create(tokens)

    if first == "ALTER":
        return _classify_alter(tokens)

    if first == "DROP":
        return _classify_drop(tokens)

    if first == "TRUNCATE":
        return _statement(
            decision=SafetyDecision.BLOCK,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.DESTRUCTIVE,
            operation=SqlOperation.TRUNCATE,
            reasons=("TRUNCATE is irreversible DDL and is blocked for agent execution.",),
        )

    if first in {"GRANT", "REVOKE"}:
        return _statement(
            decision=SafetyDecision.BLOCK,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.SECURITY_SENSITIVE,
            operation=SqlOperation.GRANT if first == "GRANT" else SqlOperation.REVOKE,
            reasons=(f"{first} changes privileges and is blocked for agent execution.",),
        )

    if first in {"BEGIN", "DECLARE", "CALL", "EXEC", "EXECUTE"}:
        return _statement(
            decision=SafetyDecision.PROMPT,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.PLSQL,
            operation=SqlOperation.PLSQL,
            reasons=("PL/SQL or executable code requires explicit review before execution.",),
        )

    if first in {"COMMIT", "ROLLBACK", "SAVEPOINT"}:
        return _statement(
            decision=SafetyDecision.PROMPT,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.DATA_CHANGE,
            operation=SqlOperation.TRANSACTION_CONTROL,
            reasons=("Transaction control changes execution state and requires explicit review.",),
        )

    return _statement(
        decision=SafetyDecision.PROMPT,
        access=SqlRequestAccess.DATA_CHANGE,
        category=SafetyCategory.UNKNOWN,
        operation=SqlOperation.UNKNOWN,
        reasons=("Unknown SQL syntax requires explicit review before execution.",),
    )


def _classify_create(tokens: Sequence[str]) -> SqlStatementClassification:
    object_token = _create_object_token(tokens)
    if object_token in _SECURITY_OBJECTS:
        return _statement(
            decision=SafetyDecision.BLOCK,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.SECURITY_SENSITIVE,
            operation=SqlOperation.CREATE,
            reasons=(f"CREATE {object_token} is security-sensitive and blocked for agent execution.",),
        )

    if object_token in _PLSQL_CREATE_OBJECTS or (object_token == "TYPE" and "BODY" in tokens):
        return _statement(
            decision=SafetyDecision.PROMPT,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.PLSQL,
            operation=SqlOperation.CREATE,
            reasons=(f"CREATE {object_token} can define executable PL/SQL and requires review.",),
        )

    if object_token in _CONSTRUCTIVE_CREATE_OBJECTS:
        return _statement(
            decision=SafetyDecision.ALLOW,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.CONSTRUCTIVE_DDL,
            operation=SqlOperation.CREATE,
            reasons=(f"CREATE {object_token} is classified as constructive DDL.",),
        )

    return _statement(
        decision=SafetyDecision.PROMPT,
        access=SqlRequestAccess.DATA_CHANGE,
        category=SafetyCategory.UNKNOWN,
        operation=SqlOperation.CREATE,
        reasons=("CREATE target is not in the constructive DDL allowlist.",),
    )


def _classify_alter(tokens: Sequence[str]) -> SqlStatementClassification:
    if len(tokens) > 1 and tokens[1] in {"SYSTEM", *_SECURITY_OBJECTS}:
        return _statement(
            decision=SafetyDecision.BLOCK,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.SECURITY_SENSITIVE,
            operation=SqlOperation.ALTER,
            reasons=(f"ALTER {tokens[1]} is security-sensitive and blocked for agent execution.",),
        )

    if len(tokens) >= 5 and tokens[1] == "SESSION" and tokens[2] == "SET" and tokens[3] == "CURRENT_SCHEMA":
        return _statement(
            decision=SafetyDecision.ALLOW,
            access=SqlRequestAccess.READ_ONLY,
            category=SafetyCategory.READ_ONLY,
            operation=SqlOperation.ALTER,
            reasons=("ALTER SESSION SET CURRENT_SCHEMA is allowed for workspace schema switching.",),
        )

    if len(tokens) > 3 and tokens[1] == "TABLE" and tokens[3] == "ADD":
        return _statement(
            decision=SafetyDecision.ALLOW,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.CONSTRUCTIVE_DDL,
            operation=SqlOperation.ALTER,
            reasons=("ALTER TABLE ADD is classified as constructive DDL.",),
        )

    if "DROP" in tokens:
        return _statement(
            decision=SafetyDecision.PROMPT,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.DESTRUCTIVE,
            operation=SqlOperation.ALTER,
            reasons=("ALTER statement contains DROP and requires explicit review.",),
        )

    return _statement(
        decision=SafetyDecision.PROMPT,
        access=SqlRequestAccess.DATA_CHANGE,
        category=SafetyCategory.UNKNOWN,
        operation=SqlOperation.ALTER,
        reasons=("ALTER statement is not in the constructive DDL allowlist.",),
    )


def _classify_drop(tokens: Sequence[str]) -> SqlStatementClassification:
    if len(tokens) > 1 and tokens[1] in _SECURITY_OBJECTS:
        return _statement(
            decision=SafetyDecision.BLOCK,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.SECURITY_SENSITIVE,
            operation=SqlOperation.DROP,
            reasons=(f"DROP {tokens[1]} is security-sensitive and blocked for agent execution.",),
        )

    if "PURGE" in tokens:
        return _statement(
            decision=SafetyDecision.BLOCK,
            access=SqlRequestAccess.DATA_CHANGE,
            category=SafetyCategory.DESTRUCTIVE,
            operation=SqlOperation.DROP,
            reasons=("DROP PURGE bypasses the recycle bin and is blocked for agent execution.",),
        )

    return _statement(
        decision=SafetyDecision.PROMPT,
        access=SqlRequestAccess.DATA_CHANGE,
        category=SafetyCategory.DESTRUCTIVE,
        operation=SqlOperation.DROP,
        reasons=("DROP is destructive and requires explicit review.",),
    )


def _combine_statement_results(
    statements: tuple[SqlStatementClassification, ...],
) -> SqlSafetyClassification:
    decision = max((statement.decision for statement in statements), key=lambda item: _DECISION_PRIORITY[item])
    access = (
        SqlRequestAccess.DATA_CHANGE
        if any(statement.access is SqlRequestAccess.DATA_CHANGE for statement in statements)
        else SqlRequestAccess.READ_ONLY
    )
    requires_preview = any(statement.requires_preview for statement in statements)
    categories = {statement.category for statement in statements}
    operations = {statement.operation for statement in statements}
    category = statements[0].category if len(categories) == 1 else SafetyCategory.MIXED
    operation = statements[0].operation if len(operations) == 1 else SqlOperation.MIXED
    reasons = tuple(reason for statement in statements for reason in statement.reasons)
    return SqlSafetyClassification(
        decision=decision,
        access=access,
        category=category,
        operation=operation,
        reasons=reasons,
        requires_preview=requires_preview,
        statements=statements,
    )


def _allowed_data_change(operation: SqlOperation, reason: str) -> SqlStatementClassification:
    return _statement(
        decision=SafetyDecision.ALLOW,
        access=SqlRequestAccess.DATA_CHANGE,
        category=SafetyCategory.DATA_CHANGE,
        operation=operation,
        reasons=(reason,),
    )


def _statement(
    *,
    decision: SafetyDecision,
    access: SqlRequestAccess,
    category: SafetyCategory,
    operation: SqlOperation,
    reasons: tuple[str, ...],
    requires_preview: bool = False,
) -> SqlStatementClassification:
    return SqlStatementClassification(
        decision=decision,
        access=access,
        category=category,
        operation=operation,
        reasons=reasons,
        requires_preview=requires_preview,
    )


def _single_result(
    *,
    decision: SafetyDecision,
    access: SqlRequestAccess,
    category: SafetyCategory,
    operation: SqlOperation,
    reasons: tuple[str, ...],
    requires_preview: bool = False,
) -> SqlSafetyClassification:
    statement = _statement(
        decision=decision,
        access=access,
        category=category,
        operation=operation,
        reasons=reasons,
        requires_preview=requires_preview,
    )
    return SqlSafetyClassification(
        decision=decision,
        access=access,
        category=category,
        operation=operation,
        reasons=reasons,
        requires_preview=requires_preview,
        statements=(statement,),
    )


def _unknown_result(
    reason: str,
    *,
    operation: SqlOperation = SqlOperation.UNKNOWN,
) -> SqlSafetyClassification:
    return _single_result(
        decision=SafetyDecision.PROMPT,
        access=SqlRequestAccess.DATA_CHANGE,
        category=SafetyCategory.UNKNOWN,
        operation=operation,
        reasons=(reason,),
    )


def _create_object_token(tokens: Sequence[str]) -> str | None:
    index = 1
    if len(tokens) > 2 and tokens[index] == "OR" and tokens[index + 1] == "REPLACE":
        index += 2
    if len(tokens) > index:
        return tokens[index]
    return None


def _split_sql_statements(sql: str) -> tuple[str, ...]:
    if _starts_plsql_block(sql):
        stripped = sql.strip()
        return (stripped,) if stripped else ()

    statements: list[str] = []
    current: list[str] = []
    state = "normal"
    index = 0
    while index < len(sql):
        char = sql[index]
        next_char = sql[index + 1] if index + 1 < len(sql) else ""

        if state == "line_comment":
            current.append(char)
            if char in {"\n", "\r"}:
                state = "normal"
            index += 1
            continue

        if state == "block_comment":
            current.append(char)
            if char == "*" and next_char == "/":
                current.append(next_char)
                index += 2
                state = "normal"
            else:
                index += 1
            continue

        if state == "single_quote":
            current.append(char)
            if char == "'" and next_char == "'":
                current.append(next_char)
                index += 2
            elif char == "'":
                state = "normal"
                index += 1
            else:
                index += 1
            continue

        if state == "double_quote":
            current.append(char)
            if char == '"':
                state = "normal"
            index += 1
            continue

        if char == "-" and next_char == "-":
            current.append(char)
            current.append(next_char)
            index += 2
            state = "line_comment"
            continue

        if char == "/" and next_char == "*":
            current.append(char)
            current.append(next_char)
            index += 2
            state = "block_comment"
            continue

        if char == "'":
            current.append(char)
            index += 1
            state = "single_quote"
            continue

        if char == '"':
            current.append(char)
            index += 1
            state = "double_quote"
            continue

        if char == ";":
            statement = "".join(current).strip()
            if statement:
                statements.append(statement)
            current = []
            index += 1
            continue

        current.append(char)
        index += 1

    statement = "".join(current).strip()
    if statement:
        statements.append(statement)

    return tuple(statements)


def _starts_plsql_block(sql: str) -> bool:
    tokens = _sql_tokens(sql)
    if not tokens:
        return False
    if tokens[0] in {"BEGIN", "DECLARE"}:
        return True
    if tokens[0] != "CREATE":
        return False
    object_token = _create_object_token(tokens)
    return object_token in _PLSQL_CREATE_OBJECTS


def _sql_tokens(sql: str) -> tuple[str, ...]:
    return tuple(match.group(0).upper() for match in _TOKEN_PATTERN.finditer(_sanitize_sql(sql)))


def _sqlcl_tokens(command: str) -> tuple[str, ...]:
    stripped = command.strip()
    if stripped.startswith("@@"):
        return ("@@",)
    if stripped.startswith(("@", "!", "$")):
        return (stripped[0],)
    return tuple(part.upper() for part in stripped.split())


def _sanitize_sql(sql: str) -> str:
    output: list[str] = []
    state = "normal"
    index = 0
    while index < len(sql):
        char = sql[index]
        next_char = sql[index + 1] if index + 1 < len(sql) else ""

        if state == "line_comment":
            output.append("\n" if char in {"\n", "\r"} else " ")
            if char in {"\n", "\r"}:
                state = "normal"
            index += 1
            continue

        if state == "block_comment":
            output.append(" ")
            if char == "*" and next_char == "/":
                output.append(" ")
                index += 2
                state = "normal"
            else:
                index += 1
            continue

        if state == "single_quote":
            output.append(" ")
            if char == "'" and next_char == "'":
                output.append(" ")
                index += 2
            elif char == "'":
                state = "normal"
                index += 1
            else:
                index += 1
            continue

        if state == "double_quote":
            output.append(" ")
            if char == '"':
                state = "normal"
            index += 1
            continue

        if char == "-" and next_char == "-":
            output.append(" ")
            output.append(" ")
            index += 2
            state = "line_comment"
            continue

        if char == "/" and next_char == "*":
            output.append(" ")
            output.append(" ")
            index += 2
            state = "block_comment"
            continue

        if char == "'":
            output.append(" ")
            index += 1
            state = "single_quote"
            continue

        if char == '"':
            output.append(" ")
            index += 1
            state = "double_quote"
            continue

        output.append(char)
        index += 1

    return "".join(output)


def _first_text_value(mapping: Mapping[str, object], *keys: str) -> str | None:
    for key in keys:
        value = mapping.get(key)
        if isinstance(value, str):
            return value
    return None
