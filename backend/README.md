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
uv run apex-pilot-api
```

The scaffold exposes `GET /health`, which returns a small JSON payload with
service status and version metadata.

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
