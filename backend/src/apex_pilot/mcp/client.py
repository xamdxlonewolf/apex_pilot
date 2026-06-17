"""MCP SDK client adapter for SQLcl tool calls."""

from __future__ import annotations

import asyncio
import csv
import io
import json
import re
from collections.abc import Mapping
from contextlib import AsyncExitStack
from typing import Any

from mcp import ClientSession, StdioServerParameters
from mcp.client.stdio import stdio_client

from apex_pilot.events import ToolActivityLog
from apex_pilot.mcp.connections import SqlclMcpToolClient
from apex_pilot.mcp.sqlcl import (
    SqlclMcpConfig,
    SqlclMcpError,
    SqlclPreflightResult,
    run_sqlcl_preflight,
)

_CLIENT_MODEL_NAME = "Apex Pilot"
_LIVE_TOOL_NAMES = {
    "list-connections": "connections_list",
    "run-sql": "sql_run",
    "run-sqlcl": "sqlcl_run",
}


class SqlclMcpSdkClient:
    """SQLcl MCP tool client backed by the official MCP Python SDK."""

    def __init__(
        self,
        config: SqlclMcpConfig,
        *,
        preflight: SqlclPreflightResult | None = None,
    ) -> None:
        self._config = config
        self._preflight = preflight
        self._exit_stack: AsyncExitStack | None = None
        self._session: ClientSession | None = None

    @property
    def is_running(self) -> bool:
        """Return whether the SDK session has been initialized."""
        return self._session is not None

    async def start(self) -> None:
        """Start SQLcl in MCP mode and initialize the client session."""
        if self._session is not None:
            msg = "SQLcl MCP SDK client is already running."
            raise SqlclMcpError(msg)

        if self._preflight is None:
            self._preflight = await asyncio.to_thread(run_sqlcl_preflight, self._config)

        stack = AsyncExitStack()
        try:
            read_stream, write_stream = await stack.enter_async_context(
                stdio_client(
                    StdioServerParameters(
                        command=str(self._preflight.sqlcl_path),
                        args=_sqlcl_mcp_args(self._config),
                        env=dict(self._preflight.environment),
                    ),
                ),
            )
            session = await stack.enter_async_context(ClientSession(read_stream, write_stream))
            await session.initialize()
        except Exception:
            await stack.aclose()
            raise

        self._exit_stack = stack
        self._session = session

    async def stop(self) -> None:
        """Stop the initialized MCP client session and SQLcl process."""
        if self._exit_stack is None:
            return

        await self._exit_stack.aclose()
        self._exit_stack = None
        self._session = None

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        """Call one SQLcl MCP tool and return its structured or JSON payload."""
        if self._session is None:
            msg = "SQLcl MCP SDK client must be started before calling tools."
            raise SqlclMcpError(msg)

        live_tool_name, live_arguments = _translate_tool_call(tool_name, arguments)
        try:
            result = await self._session.call_tool(live_tool_name, live_arguments)
        except Exception as error:
            msg = f"SQLcl MCP tool `{live_tool_name}` failed: {error}"
            raise SqlclMcpError(msg) from error

        if result.isError:
            msg = _result_message(result.model_dump(mode="json"))
            raise SqlclMcpError(msg)

        structured_content = result.structuredContent
        if structured_content is not None:
            return structured_content

        return _payload_from_result(live_tool_name, result.model_dump(mode="json"))


class ToolActivityMcpClient:
    """MCP tool client wrapper that records completed tool activity."""

    def __init__(self, client: SqlclMcpToolClient, activity_log: ToolActivityLog) -> None:
        self._client = client
        self._activity_log = activity_log

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        """Call a tool and record success or failure without persisting result rows."""
        try:
            payload = await self._client.call_tool(tool_name, arguments)
        except Exception as error:
            self._activity_log.record(
                tool_name=tool_name,
                arguments=arguments,
                status="failed",
                message=str(error),
            )
            raise

        self._activity_log.record(
            tool_name=tool_name,
            arguments=arguments,
            status="succeeded",
        )
        return payload


def _sqlcl_mcp_args(config: SqlclMcpConfig) -> list[str]:
    args: list[str] = []
    if config.restrict_level is not None:
        args.extend(("-R", str(config.restrict_level)))
    args.append("-mcp")
    return args


def _translate_tool_call(tool_name: str, arguments: Mapping[str, object]) -> tuple[str, dict[str, object]]:
    live_tool_name = _LIVE_TOOL_NAMES.get(tool_name, tool_name)
    live_arguments = dict(arguments)

    if live_tool_name == "connections_list":
        live_arguments.setdefault("model", _CLIENT_MODEL_NAME)
        live_arguments.setdefault("definition_type", "ALL")
        return live_tool_name, live_arguments

    if live_tool_name == "connect":
        connection_name = live_arguments.pop("name", None)
        if connection_name is not None:
            live_arguments["connection_name"] = connection_name
        live_arguments.setdefault("model", _CLIENT_MODEL_NAME)
        return live_tool_name, live_arguments

    if live_tool_name == "sql_run":
        live_arguments["sql"] = _sql_with_inlined_binds(
            str(live_arguments.get("sql", "")),
            live_arguments.pop("binds", {}),
        )
        live_arguments.setdefault("model", _CLIENT_MODEL_NAME)
        live_arguments.setdefault("execution_type", "SYNCHRONOUS")
        return live_tool_name, live_arguments

    if live_tool_name == "sqlcl_run":
        command = live_arguments.pop("command", None)
        if command is not None:
            live_arguments["sqlcl"] = command
        live_arguments.setdefault("model", _CLIENT_MODEL_NAME)
        live_arguments.setdefault("execution_type", "SYNCHRONOUS")
        return live_tool_name, live_arguments

    return live_tool_name, live_arguments


def _sql_with_inlined_binds(sql: str, binds: object) -> str:
    if not isinstance(binds, Mapping):
        return sql

    rendered_sql = sql
    for name, value in binds.items():
        if not isinstance(name, str):
            continue
        rendered_sql = re.sub(
            rf":{re.escape(name)}\b",
            _sql_literal(value),
            rendered_sql,
        )
    return rendered_sql


def _sql_literal(value: object) -> str:
    if value is None:
        return "NULL"
    if isinstance(value, bool):
        return "1" if value else "0"
    if isinstance(value, int | float):
        return str(value)
    return "'" + str(value).replace("'", "''") + "'"


def _payload_from_result(tool_name: str, result: dict[str, Any]) -> object:
    content = result.get("content")
    if isinstance(content, list) and len(content) == 1:
        first = content[0]
        if isinstance(first, dict) and isinstance(first.get("text"), str):
            try:
                return json.loads(first["text"])
            except json.JSONDecodeError:
                if tool_name == "connections_list":
                    return [line.strip() for line in first["text"].splitlines() if line.strip()]
                if tool_name == "sql_run":
                    return _csv_rows_from_text(first["text"])
                return result

    return result


def _csv_rows_from_text(text: str) -> list[dict[str, object]]:
    if not text.strip() or "no rows selected" in text.lower():
        return []

    reader = csv.DictReader(io.StringIO(text))
    rows: list[dict[str, object]] = []
    for row in reader:
        rows.append({key: _csv_value(value) for key, value in row.items() if key is not None})
    return rows


def _csv_value(value: str | None) -> object:
    if value is None or value == "":
        return None
    return value


def _result_message(result: dict[str, Any]) -> str:
    content = result.get("content")
    if isinstance(content, list) and content:
        first = content[0]
        if isinstance(first, dict) and isinstance(first.get("text"), str):
            return first["text"]

    return "SQLcl MCP tool call failed."
