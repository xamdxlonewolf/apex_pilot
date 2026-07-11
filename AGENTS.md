# Agent Guide

This repository is the source for Apex Pilot, a local-first Oracle development
automation platform. Agents working here should preserve the project invariants
even before implementation code exists.

## Hard Boundaries

- Do not touch Oracle APEX export folders.
- Do not touch root-level `f*.sql` APEX export files.
- Do not add direct database access paths. SQL execution must go through SQLcl
  MCP.
- Do not expose raw MCP clients to PydanticAI tools. Expose only guarded
  application facades.
- Do not design skills that connect directly to Oracle. Skills may inspect,
  transform, validate, and generate; application services own execution.
- Do not persist Oracle passwords. Use SQLcl saved connection names, OS keyring,
  or environment variables for secrets.

## Architecture Direction

- Frontend: Tauri, React, TypeScript.
- Backend: FastAPI with Python package `apex_pilot`.
- Agent: PydanticAI with LiteLLM model profile support.
- Execution: Oracle SQLcl MCP only.
- Persistence: local SQLite metadata, not SQL result rows by default.
- System skills: sparse checkout of `apex/` and `db/` from
  `https://github.com/oracle/skills.git`.

Planned backend modules are `api`, `agent`, `mcp`, `skills`, `safety`, `schema`,
`settings`, `storage`, and `events`.

## Safety Expectations

- Classify SQL deterministically where possible.
- Use conservative fallback behavior for PL/SQL, SQLcl commands, and unknown
  syntax.
- Require prompt and preview for `DELETE`.
- Prompt or block destructive and security-sensitive SQL based on risk.
- Make every database-changing action explainable through SQL text,
  classification, approval state, selected connection, model profile, and MCP
  tool log.

## Documentation Expectations

- Update or add ADRs for meaningful architecture decisions.
- Keep PRs small and scoped to the planned roadmap.
- Stage named files or hunks only; do not rely on blanket staging.
- Keep foundation docs consistent with `README.md`, `CONTRIBUTING.md`, and
  `docs/adr/`.

## Verification

For this foundation phase, verify Markdown renders cleanly. Future code PRs
should add and run the relevant backend, frontend, and contract checks described
in `CONTRIBUTING.md`.

## Agent skills

### Issue tracker

Issues live in this repo's GitHub Issues (via `gh`). See `docs/agents/issue-tracker.md`.

### Triage labels

Default vocabulary: `needs-triage`, `needs-info`, `ready-for-agent`, `ready-for-human`, `wontfix`. See `docs/agents/triage-labels.md`.

### Domain docs

Single-context: root `CONTEXT.md` + `docs/adr/`. See `docs/agents/domain.md`.
