"""Guarded SQL sheet execution through SQLcl MCP."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from typing import Any

from apex_pilot.mcp import SqlclConnectionError, SqlclMcpSession, SqlRequestAccess
from apex_pilot.safety import (
    SafetyDecision,
    SqlSafetyClassification,
    classify_sql,
)
from apex_pilot.schema import SchemaIntelligenceError, rows_from_mcp_payload

RUN_SQL_TOOL = "run-sql"


class SqlSheetError(Exception):
    """Raised when the SQL sheet cannot classify or execute a statement."""


class SqlSheetBlockedError(SqlSheetError):
    """Raised when classification blocks execution."""


class SqlSheetConfirmationRequiredError(SqlSheetError):
    """Raised when destructive/security-sensitive SQL needs confirmation."""

    def __init__(self, classification: SqlSafetyClassification) -> None:
        self.classification = classification
        super().__init__(
            "SQL requires confirmation before execution: "
            + "; ".join(classification.reasons)
        )


@dataclass(frozen=True)
class SqlSheetRunResult:
    """Result of a classified SQL sheet execution."""

    classification: SqlSafetyClassification
    connection_name: str | None
    rows: tuple[Mapping[str, object], ...]
    raw_text: str | None
    executed: bool


def classification_to_dict(classification: SqlSafetyClassification) -> dict[str, Any]:
    """Serialize a safety classification for API responses."""
    return {
        "decision": classification.decision.value,
        "access": classification.access.value,
        "category": classification.category.value,
        "operation": classification.operation.value,
        "reasons": list(classification.reasons),
        "requires_preview": classification.requires_preview,
        "statements": [
            {
                "decision": statement.decision.value,
                "access": statement.access.value,
                "category": statement.category.value,
                "operation": statement.operation.value,
                "reasons": list(statement.reasons),
                "requires_preview": statement.requires_preview,
            }
            for statement in classification.statements
        ],
    }


class SqlSheetService:
    """Classify and optionally execute SQL through the primary MCP session."""

    def __init__(self, session: SqlclMcpSession) -> None:
        self._session = session

    def classify(self, sql_text: str) -> SqlSafetyClassification:
        """Classify SQL text without executing it."""
        normalized = sql_text.strip()
        if not normalized:
            raise SqlSheetError("SQL text cannot be empty.")
        return classify_sql(normalized)

    async def run(
        self,
        sql_text: str,
        *,
        confirmed: bool = False,
        skip_destructive_prompt: bool = False,
    ) -> SqlSheetRunResult:
        """Classify SQL, enforce confirmation policy, then run through MCP."""
        classification = self.classify(sql_text)
        if classification.decision is SafetyDecision.BLOCK:
            raise SqlSheetBlockedError(
                "SQL is blocked by safety policy: " + "; ".join(classification.reasons)
            )

        needs_prompt = classification.decision is SafetyDecision.PROMPT
        if needs_prompt and not confirmed and not skip_destructive_prompt:
            raise SqlSheetConfirmationRequiredError(classification)

        if self._session.connection_name is None:
            raise SqlclConnectionError(
                "Connect to a SQLcl saved connection before running SQL."
            )

        payload = await self._session.call_tool(
            RUN_SQL_TOOL,
            {"sql": sql_text.strip(), "binds": {}},
            access=classification.access,
        )
        rows, raw_text = _extract_rows_and_text(payload)
        return SqlSheetRunResult(
            classification=classification,
            connection_name=self._session.connection_name,
            rows=rows,
            raw_text=raw_text,
            executed=True,
        )


def _extract_rows_and_text(
    payload: object,
) -> tuple[tuple[Mapping[str, object], ...], str | None]:
    raw_text = _payload_text(payload)
    try:
        rows = rows_from_mcp_payload(payload)
        return rows, raw_text
    except SchemaIntelligenceError:
        return (), raw_text


def _payload_text(payload: object) -> str | None:
    if isinstance(payload, str):
        return payload
    if isinstance(payload, Mapping):
        text = payload.get("text")
        if isinstance(text, str):
            return text
        content = payload.get("content")
        if isinstance(content, Sequence) and not isinstance(content, str):
            parts: list[str] = []
            for item in content:
                if isinstance(item, Mapping):
                    item_text = item.get("text")
                    if isinstance(item_text, str):
                        parts.append(item_text)
            if parts:
                return "\n".join(parts)
    return None
