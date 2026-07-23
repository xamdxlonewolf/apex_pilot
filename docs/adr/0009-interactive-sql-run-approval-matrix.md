# ADR-0009: Interactive SQL Run Approval Matrix

## Status

Accepted

## Date

2026-07-16

## Context

[ADR-0008](0008-dual-path-oracle-access-and-credential-ownership.md) authorizes
guarded `python-oracledb` for human-initiated interactive surfaces, but requires
a separate decision before arbitrary Interactive SQL Run may ship. Existing
safety language allowed `SELECT`, `INSERT`, `UPDATE`, and constructive DDL;
required prompt and preview for `DELETE`; and left destructive and
security-sensitive SQL as "prompt or block depending on risk" without an
executable matrix.

Interactive SQL Run needs:

- A script model that works on the interactive driver (not full SQLcl).
- Deterministic classification with conservative handling of PL/SQL and unknown
  syntax.
- Clear Allow / Prompt / Preview / Block actions for the SQL Editor.
- Shared classification with the agent/SQLcl path without making the editor
  naggy for ordinary writes.
- Exact-request approval binding and fail-closed behavior when preview or
  mid-script execution fails.

## Decision Drivers

- Keep Interactive Run honest to Oracle session semantics (pinned editor
  transactions, no invented autocommit).
- Preserve Run-as-intent for normal developer SQL while forcing confirms for
  destructive, security-sensitive, and uncertain work.
- Prevent `@` includes and opaque PL/SQL from bypassing the matrix.
- Share one classifier across both execution adapters; keep agent writes
  stricter than interactive silent Allow.
- Never replay uncertain writes; never pretend a failed preview succeeded.

## Considered Options

### Option 1: Single-statement Run only

- Pros: Simplest atomic approval unit.
- Cons: Rejects normal multi-statement Oracle scripts and PL/SQL terminators.

### Option 2: Full SQLcl/SQL*Plus script mode on the interactive path

- Pros: Familiar script surface.
- Cons: Conflicts with ADR-0008's guarded `python-oracledb` boundary.

### Option 3: Narrowed script mode with whole-script preflight and a four-action
matrix

- Pros: Fits the interactive driver; supports real scripts and includes; one
  approval decision; explicit Preview for mass DML.
- Cons: Requires a SQL splitter/classifier, include sandbox, and PL/SQL static
  extraction work.

## Decision

Interactive SQL Run uses **narrowed script mode** on the guarded interactive
driver, a **four-action** approval vocabulary, and **whole-script preflight**
with max-risk aggregation. Full SQLcl/SQL*Plus emulation is out of scope.

### Execution unit

- A Run may contain multiple SQL statements and PL/SQL units separated by `;`
  or `/`.
- Local directives are limited to an allowlist. Unsupported directives are
  rejected at preflight and never sent to Oracle.
- Project-relative `@` / `@@` includes of `.sql` files are allowed. Includes are
  fully expanded before classification, with cycle detection and these limits:
  depth 10, max 200 files, max 5 MiB expanded text. Paths must resolve under the
  project root with no escape.
- Allowed local `SET` directives in v1: `DEFINE`, `VERIFY`, `FEEDBACK`, and
  `SERVEROUTPUT` each `ON`/`OFF`. `SERVEROUTPUT` is applied through the guarded
  session facade when needed.

### Approval actions

| Action | Meaning |
| --- | --- |
| `Allow` | After successful preflight, execute with no extra dialog. Hitting Run is intent. |
| `Prompt` | Confirm SQL/classification summary, Connection Profile, and Working Schema. |
| `Prompt + Preview` | Prompt plus a required preview step before execute is unlocked. |
| `Block` | Refuse execution until the script changes. |

Whole-script preflight classifies every unit (after include expansion), takes
the **highest** risk action, and presents **one** approval with a per-statement
summary and include tree. After approval, execution stops on the first failure.

### Interactive matrix (v1)

| Class | Action |
| --- | --- |
| `SELECT` (including `FOR UPDATE`) | `Allow` |
| `INSERT`; `UPDATE`/`MERGE` with detectable predicate | `Allow` |
| Constructive DDL (`CREATE`, `CREATE OR REPLACE`, non-destructive `ALTER`), `COMMENT`, `RENAME` | `Allow` |
| `COMMIT`, `ROLLBACK`, `SAVEPOINT`, `SET TRANSACTION` | `Allow` |
| Allowed local `SET` and resolved includes | Preflight only; risk comes from expanded SQL |
| `DELETE` (any); `UPDATE` with no detectable `WHERE` | `Prompt + Preview` |
| `TRUNCATE`, `DROP`, shape-breaking `ALTER` | `Prompt` |
| Security-sensitive SQL (`GRANT`, `REVOKE`, user/role DDL, and similar) | `Prompt` |
| `LOCK TABLE` | `Prompt` |
| PL/SQL with extractable static SQL only | Max of embedded classes |
| PL/SQL containing dynamic SQL | At least `Prompt` |
| Unparsed / unknown syntax | `Block` |
| Unsupported directive, include escape, or over limit | Preflight reject (`Block`) |

`MERGE` that is too complex for confident `ON`/`WHERE` detection escalates to
`Prompt` (never silent `Allow`).

### Preview semantics

For `Prompt + Preview`, Apex Pilot runs a bounded dry-run read (rewritten
`SELECT COUNT(*)` and optional sample keys) using the same `FROM`/`WHERE` under
the editor session and Working Schema. If preview fails, the original statement
does **not** run. The user may **Abort** or **Proceed without preview** via an
extra confirm.

### Transactions

Interactive editors keep explicit transaction control. There is no application
autocommit. `COMMIT` / `ROLLBACK` / `SAVEPOINT` remain `Allow`. When preflight
detects DDL that will implicitly commit, that fact appears in the summary.
Open-transaction state remains visible in editor chrome per ADR-0008.

### Approval binding

An approval binds to a hash of the fully expanded script, Connection Profile,
Working Schema, and classification summary. Any edit, retarget, or include-file
change invalidates it. Sticky class-based grants are out of scope for v1.

### Failure semantics

On mid-script error: stop immediately; leave the pinned transaction as-is; show
units that ran, failed, and did not run; do not auto-rollback, auto-commit, or
replay. Connection establishment may still retry once before send per ADR-0008;
database-changing statements are never automatically replayed when Oracle may
already have received them.

### Shared classifier, stricter agent writes

Both execution paths share the same classification engine and class names.
Interactive Run may silent-`Allow` low-risk writes. The agent/SQLcl path never
silent-Allows writes; those classes require at least `Prompt`. Read-only
browsing and Database Source Compile remain under their existing policies and
are not this matrix.

## Consequences

### Positive

- Interactive SQL Run has an explicit ship gate that ADR-0008 required.
- Ordinary editor workflows stay low-friction; dangerous and uncertain work is
  gated.
- Includes cannot bypass classification.
- Agent and interactive paths stay aligned on classes without identical UX.

### Negative

- Requires a robust splitter, include sandbox, and PL/SQL static-SQL extraction.
- Deep classification is imperfect; dynamic SQL and parse failures stay
  conservative.
- Large include trees add preflight cost (bounded by the expansion caps).

### Risks

- Static extraction may miss risky dynamic behavior inside PL/SQL.
  Mitigation: any dynamic SQL escalates to at least `Prompt`; unparsed → `Block`.
- Count-based DELETE preview can be expensive or fail on complex SQL.
  Mitigation: bounds/timeouts; fail closed to Abort or Proceed-without-preview.
- Classifier drift between adapters.
  Mitigation: shared policy module and contract tests on both guarded paths.

## Implementation Notes

- Do not enable Interactive SQL Run until classifier, include expansion,
  approval binding, preview, and stop-on-failure tests exist.
- Keep approval UI outside the Workspace editor surface per the desktop UX
  model; the editor requests approval through the application approval flow.
- Record exact request text (expanded), classification, approval state, profile,
  schema, adapter, and outcome. Never log passwords or credential material.
- Exact parser/tokenizer library remains an open implementation choice; behavior
  must match this matrix.
- SQLcl-specific `run-sqlcl` command allowlisting remains a separate agent-path
  concern and is not redefined here.

## Related Decisions

- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md) — superseded execution
  ownership; early safety bullets refined here
- [ADR-0003](0003-guarded-agent-and-skill-boundaries.md)
- [ADR-0007](0007-desktop-shell-and-workspace-ux.md)
- [ADR-0008](0008-dual-path-oracle-access-and-credential-ownership.md)
