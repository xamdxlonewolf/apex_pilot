# Apex Pilot Backend

This is the local FastAPI backend for Apex Pilot. The backend owns local API
contracts, SQLcl MCP lifecycle boundaries, agent orchestration, skills, safety,
schema intelligence, storage, and event streams.

## Development

Install dependencies:

```powershell
uv sync --all-groups
```

Run tests and checks:

```powershell
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run pyright
```

Run the local API:

```powershell
$env:APEX_PILOT_BEARER_TOKEN = "dev-token"
uv run apex-pilot-api
```

The backend exposes `GET /health` without authentication. The PR 8 vertical
slice also exposes bearer-protected local routes for the desktop UI:

- `GET /connections`
- `POST /connections/{connection_name}/connect`
- `GET /schema/summary?schema=APP&refresh=true`
- `GET /activity`

The live API starts SQLcl in MCP mode through the MCP Python SDK. It accepts
optional `APEX_PILOT_SQLCL_PATH`, `TNS_ADMIN`, `JAVA_HOME`,
`APEX_PILOT_BIND_HOST`, `APEX_PILOT_BIND_PORT`, and
`APEX_PILOT_BEARER_TOKEN` environment variables.

## SQLcl MCP Preflight

The `apex_pilot.mcp` package validates the local SQLcl MCP runtime before any
database-facing MCP process starts:

- SQLcl must resolve to an executable named `sql` or an explicitly configured
  absolute path.
- SQLcl must report version `25.2` or newer from `sql -V`.
- Java must be available from `JAVA_HOME` or `PATH`, with JRE 17 or 21.
- `TNS_ADMIN` is supported when configured and must point to an existing
  directory.

The backend starts SQLcl MCP with stdio only, using `sql -mcp` and optional
restrict-level arguments such as `sql -R 3 -mcp`. It does not pass Oracle
credentials. Connections must be saved in SQLcl ahead of time.

## SQLcl Connections

The `apex_pilot.mcp` package exposes saved-connection and session ownership
primitives on top of the SQLcl MCP boundary:

- Saved connections are listed with the MCP `list-connections` tool.
- Sessions connect with the MCP `connect` tool using a SQLcl saved connection
  name only.
- One explicit primary MCP session owns data-changing work.
- Optional read-only pool sessions are reserved for discovery and comparison.
  They reject write-classified requests before an MCP tool call is made.

Run the optional live preflight check only when SQLcl and Java are installed:

```powershell
$env:APEX_PILOT_LIVE_SQLCL_PREFLIGHT = "1"
$env:APEX_PILOT_SQLCL_PATH = "C:\path\to\sql.exe"
uv run pytest tests/test_sqlcl_preflight.py
```

## Package Layout

The Python package is `apex_pilot`. Top-level modules mirror the architecture
decisions documented in `../docs/adr/`:

- `api`: FastAPI app, routes, and HTTP contracts.
- `agent`: future PydanticAI orchestration.
- `mcp`: SQLcl MCP preflight, environment configuration, and lifecycle wrappers.
- `skills`: future system/user skill installation and runtime.
- `safety`: future deterministic SQL classification and approval policy.
- `schema`: future Oracle schema intelligence.
- `settings`: future local app configuration.
- `storage`: future local metadata persistence.
- `events`: future typed chat and tool activity events.

## Schema Intelligence

The `apex_pilot.schema` package provides read-only Oracle schema intelligence
through guarded SQLcl MCP sessions:

- Schema summaries query `ALL_OBJECTS`, `ALL_TABLES`, and database context
  through MCP `run-sql`.
- Dependency and reference helpers query `ALL_DEPENDENCIES`.
- Schema summaries are cached per session, connection, and schema with visible
  cache age and explicit refresh or clear-cache support.
- Returned dataclasses expose `to_dict()` payloads for future agent and UI
  contracts.

## SQL Safety Classification

The `apex_pilot.safety` package classifies SQL and SQLcl requests before MCP
execution:

- `SELECT` and `WITH` queries are allowed as read-only work.
- `INSERT`, `UPDATE`, `MERGE`, and constructive DDL are allowed but classified
  as data-changing work for primary-session execution.
- `DELETE` requires preview and approval.
- `TRUNCATE`, `DROP ... PURGE`, grants, revokes, and user/security operations
  are blocked.
- PL/SQL, unknown SQL, and risky or unknown `run-sqlcl` commands require a
  prompt.
