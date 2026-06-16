# Apex Pilot Backend

This is the local FastAPI backend for Apex Pilot. It is intentionally small in
PR 2: the scaffold establishes package structure, quality tooling, and a health
endpoint before SQLcl MCP, agent, skill, and schema behavior is added.

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

## Package Layout

The Python package is `apex_pilot`. Top-level modules mirror the architecture
decisions documented in `../docs/adr/`:

- `api`: FastAPI app, routes, and HTTP contracts.
- `agent`: future PydanticAI orchestration.
- `mcp`: future SQLcl MCP lifecycle and client wrappers.
- `skills`: future system/user skill installation and runtime.
- `safety`: future deterministic SQL classification and approval policy.
- `schema`: future Oracle schema intelligence.
- `settings`: future local app configuration.
- `storage`: future local metadata persistence.
- `events`: future typed chat and tool activity events.
