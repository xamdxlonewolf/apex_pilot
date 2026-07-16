# ADR-0002: SQL Execution Through SQLcl MCP

## Status

Superseded by
[ADR-0008](0008-dual-path-oracle-access-and-credential-ownership.md)

## Date

2026-06-16

## Context

Apex Pilot will inspect Oracle schemas and execute user-approved database work.
The project needs one execution boundary that can be logged, classified, tested,
and reviewed. Allowing multiple database access paths would make approval,
connection ownership, and auditing harder to reason about.

Oracle SQLcl MCP provides the intended interface for saved connections and
database execution.

## Decision Drivers

- Keep all database execution visible through one boundary.
- Avoid storing Oracle passwords in Apex Pilot.
- Support SQLcl saved connection names as the user-facing connection primitive.
- Make risk classification and approval enforceable before execution.
- Allow fake MCP tests and optional live SQLcl tests.

## Considered Options

### Option 1: SQLcl MCP Only

- Pros: Single execution path, aligns with Oracle tooling, supports saved
  connections, and can be wrapped with deterministic safety checks.
- Cons: Requires SQLcl preflight checks, MCP lifecycle management, and fake MCP
  transport tests.

### Option 2: Direct Database Drivers

- Pros: Mature driver ecosystem and direct query control.
- Cons: Adds credential storage pressure, creates a second execution path, and
  weakens MCP auditability.

### Option 3: Skill-Owned Database Access

- Pros: Skills could perform richer workflows independently.
- Cons: Breaks the core safety model by letting extensions bypass application
  classification, approval, and logging.

## Decision

SQL execution in Apex Pilot will happen only through SQLcl MCP. Oracle
connections will use SQLcl saved connection names only. Apex Pilot will discover
connections through SQLcl MCP and will not store Oracle passwords.

The application may manage a small MCP process pool, but pooled sessions used for
discovery and comparison are read-only. Data-changing work must go through one
explicit primary MCP session.

## Consequences

### Positive

- Database work has a single auditable path.
- Safety classification, approval, and tool logging can be enforced centrally.
- Fake MCP responses can cover unit and contract tests.
- Users keep Oracle connection secrets in SQLcl or local secret stores.

### Negative

- SQLcl availability and version checks become required application concerns.
- Features depend on MCP capabilities and SQLcl behavior.
- Read-only pool and primary session rules need test coverage.

### Risks

- A future shortcut could accidentally introduce direct driver access.
- Mitigation: document this as a hard invariant in `README.md`, `AGENTS.md`,
  `CONTRIBUTING.md`, and Cursor project rules.

## Implementation Notes

- Validate SQLcl version 25.2+ and Java/JRE availability before MCP use.
- Support `TNS_ADMIN` configuration.
- Use SQLcl saved connection names for connection selection.
- Keep application code behind logical MCP tool names, then translate to the
  live SQLcl MCP tool names and argument schema in one adapter. SQLcl 25.x live
  smoke testing advertised underscore names such as `connections_list`,
  `sql_run`, and `sqlcl_run` even though public examples also describe
  hyphenated names.
- Parse SQLcl MCP result payloads defensively. Live `sql_run` responses may
  return CSV text content instead of structured JSON rows, so schema
  intelligence must normalize those payloads before building contract responses.
- Classify SQL deterministically where practical.
- Allow `SELECT`.
- Allow `INSERT`, `UPDATE`, and constructive DDL.
- Require prompt and preview for `DELETE`.
- Prompt or block destructive and security-sensitive SQL based on risk.
- Control SQLcl-specific `run-sqlcl` commands through an allowlist.
- Gate live Oracle/SQLcl tests behind explicit environment variables.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0003](0003-guarded-agent-and-skill-boundaries.md)
- [ADR-0008](0008-dual-path-oracle-access-and-credential-ownership.md)
