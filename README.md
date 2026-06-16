# Apex Pilot

Apex Pilot is a local-first Oracle development automation platform. The first
product shape is a chat-first desktop application that runs a local backend,
uses Oracle SQLcl MCP for every database execution path, and layers Oracle/APEX
skills on top for inspection, validation, transformation, and generation.

This repository is being built in small PR-sized slices. The backend scaffold
lives in `backend/`; later PRs will add the frontend, SQLcl MCP integration,
agent runtime, skill runtime, and APEX workflows.

## Core Architecture

- **Desktop app**: Tauri with a React and TypeScript frontend.
- **Local backend**: FastAPI service owned by the desktop app in packaged mode.
- **Agent layer**: PydanticAI with LiteLLM model profiles.
- **Execution layer**: Oracle SQLcl MCP only.
- **Skill layer**: Oracle `db` and `apex` system skills plus shared and user
  extensions.
- **Local persistence**: SQLite metadata database, with secrets stored in the OS
  keyring or environment variables.

## Non-Negotiable Invariants

- SQL execution happens only through SQLcl MCP.
- Skills do not directly access the database.
- PydanticAI tools receive guarded application facades only, never raw MCP
  clients.
- System skills are installed from `https://github.com/oracle/skills.git` by
  sparse checkout of only `apex/` and `db/`.
- Local HTTP APIs bind to loopback, use a dynamic port, and require a per-run
  bearer token.
- SQL result rows are not persisted by default.
- Database-changing actions must be visible through SQL text, risk
  classification, approval state, selected connection, model profile, and MCP
  tool logs.

## Planned Repository Shape

```text
.
├── backend/                  # FastAPI backend scaffold
├── frontend/                 # Future Tauri + React desktop app
├── docs/
│   └── adr/                  # Architecture Decision Records
├── AGENTS.md                 # Agent and maintainer guardrails
├── CONTRIBUTING.md           # Contribution workflow and review expectations
└── README.md
```

The backend package name will be `apex_pilot`. Its planned top-level modules are
`api`, `agent`, `mcp`, `skills`, `safety`, `schema`, `settings`, `storage`, and
`events`.

## Safety Model

Apex Pilot treats SQLcl MCP as the database execution boundary. Oracle
connections are selected by SQLcl saved connection name, and Apex Pilot must not
store Oracle passwords.

The SQL safety policy is intentionally deterministic and conservative:

- `SELECT` is allowed.
- `INSERT`, `UPDATE`, and constructive DDL are allowed.
- `DELETE` requires a prompt and preview.
- Destructive or security-sensitive SQL requires stronger approval or blocking,
  depending on risk.
- SQLcl-specific `run-sqlcl` commands are controlled by an allowlist.

## Development Roadmap

Work is split into small reviewable PRs:

1. Project foundation docs and ADRs.
2. Backend scaffold.
3. Frontend/Tauri scaffold.
4. SQLcl preflight and MCP wrapper.
5. Connections and read-only MCP pool.
6. SQL safety classifier.
7. Schema intelligence.
8. First desktop vertical slice.
9. Agent core.
10. Skill installer.
11. Skill runtime.
12. Approval workflow.
13. APEXLang check-only flow.

## Backend Development

Run backend commands from `backend/`:

```powershell
uv sync --all-groups
uv run pytest
uv run ruff check .
uv run ruff format --check .
uv run pyright
```

The current backend exposes `GET /health`.

## Documentation

- `AGENTS.md` defines repository guardrails for AI agents and maintainers.
- `CONTRIBUTING.md` defines contribution, review, and verification expectations.
- `docs/adr/` records accepted architecture decisions.

## License

This project is licensed under the MIT License. See `LICENSE` for details.