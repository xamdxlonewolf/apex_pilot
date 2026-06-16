# Contributing

Thanks for contributing to Apex Pilot. This project is intentionally split into
small PRs so architecture, safety boundaries, and user-facing behavior can be
reviewed before broad implementation lands.

## Workflow

1. Start from `main`.
2. Keep changes scoped to one roadmap PR or one clearly reviewable concern.
3. Update documentation and ADRs when changing architecture, safety boundaries,
   persistence, execution, or trust assumptions.
4. Stage only named files or hunks.
5. Do not commit secrets, local connection files, generated APEX exports, or
   root-level `f*.sql` APEX export files.

## Project Boundaries

- SQL execution must go through SQLcl MCP.
- Skills must not directly access the database.
- PydanticAI tools must use guarded application facades only.
- System skills must come from a sparse checkout of only `apex/` and `db/` from
  `https://github.com/oracle/skills.git`.
- User skills require consent and must not override system skill safety policy.
- SQL result rows are not persisted by default.
- Local HTTP APIs must bind to loopback and require a per-run bearer token.

## Planned Quality Gates

Foundation documentation PRs should verify Markdown renders cleanly.

Future backend PRs are expected to use:

- `uv run pytest`
- `uv run ruff check`
- `uv run ruff format --check`
- `uv run pyright`

Future frontend PRs are expected to use:

- `pnpm lint`
- `pnpm typecheck`
- `pnpm test`
- `pnpm build`

Live Oracle or SQLcl tests should be optional and gated by explicit environment
variables. Public CI must not require a live Oracle database.

## ADRs

Use ADRs for decisions that affect architecture, runtime boundaries,
integration choices, persistence, security posture, or user trust.

When adding an ADR:

1. Copy `docs/adr/template.md`.
2. Name it `NNNN-short-title.md`.
3. Set the status to `Proposed` or `Accepted`.
4. Document context, decision drivers, considered options, decision, and
   consequences.
5. Update `docs/adr/README.md`.

Accepted ADRs should not be rewritten to change history. Add a new ADR that
supersedes or amends the previous decision.

## Review Expectations

Reviewers should prioritize:

- Safety boundary regressions.
- Direct database access or raw MCP exposure.
- Persistence of secrets or SQL result rows.
- Missing tests for deterministic safety behavior.
- Docs or ADR drift from implemented behavior.

## APEX Export Handling

Oracle APEX export folders and root-level `f*.sql` files are treated as generated
exports. Do not edit them as part of normal development. If a change appears to
require touching them, pause and ask for explicit project guidance.
