# ADR-0008: Dual-Path Oracle Access and Credential Ownership

## Status

Accepted — supersedes
[ADR-0002](0002-sql-execution-through-sqlcl-mcp.md).

## Date

2026-07-16

## Context

ADR-0002 established SQLcl MCP as Apex Pilot's only Oracle execution path. That
boundary keeps agent and skill execution auditable, avoids exposing raw MCP
clients, and lets SQLcl own saved credentials.

The interactive desktop now also needs durable, low-latency database access for
Database Drawer browsing, SQL Editor sessions, and Database Source Document
compilation. Those surfaces need per-editor transaction isolation, stable
connection attachment across React remounts, and short-lived isolated leases
for DDL. Treating a temporary UI surface as the owner of an MCP connection
causes reconnect churn and cannot provide the required session model cleanly.

Introducing `python-oracledb` creates a second execution and credential
boundary. The project therefore needs an explicit split that preserves SQLcl
MCP for agents and skills, keeps every interactive operation behind guarded
application services, and defines fail-closed secret storage and reconnect
behavior.

## Decision Drivers

- Keep agents and skills on the existing guarded SQLcl MCP boundary.
- Give human-initiated interactive surfaces durable, isolated Oracle sessions.
- Prevent frontend code, agents, and skills from receiving raw driver access.
- Keep passwords out of project manifests, SQLite, files, logs, events, and MCP
  arguments.
- Preserve deterministic classification, approval, target selection, and
  execution logging across both paths.
- Work across Windows, macOS, and Linux without silently weakening secret
  storage.
- Never replay a write whose outcome is uncertain after a connection failure.
- Keep Connection Profile identity durable while each live binding can report
  availability independently.

## Considered Options

### Option 1: Continue with SQLcl MCP for all database access

- Pros: Retains one credential owner and one execution adapter.
- Cons: Does not provide the durable per-editor session and isolated interactive
  DDL lifecycle required by the desktop IDE.

### Option 2: Guarded dual-path access with split credential ownership

- Pros: Preserves SQLcl MCP for model-driven work while giving interactive
  surfaces a backend-owned pool, dedicated editor sessions, and explicit
  transaction isolation.
- Cons: Adds a second execution adapter, a second credential binding, native
  keyring packaging work, and additional safety contract tests.

### Option 3: Dual-path access with an encrypted home-file fallback

- Pros: Appears to provide password persistence when no native keyring is
  available.
- Cons: Does not solve key-encryption-key custody without another protected
  secret, and adds cryptographic lifecycle, recovery, and migration
  responsibilities.

## Decision

Apex Pilot will use **guarded dual-path Oracle access**.

### Execution ownership

- Agents, PydanticAI tools, system skills, and user skills execute database work
  only through guarded application facades backed by SQLcl MCP. They never
  receive a raw MCP client, `python-oracledb` connection, pool, cursor, or
  credential.
- Human-initiated interactive surfaces may use `python-oracledb` only through
  narrow backend application facades. Initial authorized callers are Database
  Drawer browsing, SQL Editor database actions, and Database Source Document
  fetch and compile.
- One backend-owned `python-oracledb` pool belongs to the active project's
  selected logical Connection Profile. React mounts, Settings, drawers, and
  Focus changes do not own or close it.
- A Connection Profile has one stable opaque identity and two independent
  bindings: an interactive driver binding and an optional SQLcl saved-connection
  binding. An Environment selects the logical profile. Each binding reports its
  own availability honestly.
- The interactive pool defaults to `min=1` and `max=6`. Up to five SQL/PLSQL
  editor documents may lazily pin dedicated sessions, leaving one slot for
  short-lived browse, health, and isolated compile leases. A further editor
  remains Unconnected until capacity is released or the configured limit is
  raised.
- Database Drawer and session-context reads use short-lived read-only leases.
  Each attached SQL/PLSQL editor uses its own lazy dedicated session. Database
  Source compilation uses a short-lived isolated lease so Oracle DDL cannot
  implicitly commit or roll back an editor's pinned transaction.
- The interactive pool closes only on project close, confirmed profile change,
  explicit disconnect, or app exit. Profile changes preserve editor text and
  leave affected documents visibly Unconnected until explicitly attached.

### Safety and approval

- Both execution paths pass through guarded application services that record the
  exact request, classification, approval state, Connection Profile, Working
  Schema, execution adapter, and outcome.
- Frontend code receives task-specific APIs and typed results, never general
  cursor or arbitrary driver primitives.
- Database Source Compile follows its accepted attachment, stale-source,
  target-identity, confirmation, and diagnostic policy. Normal compile of an
  attached, non-stale target is the user's explicit action; create, retarget,
  stale force, and dropped-target recreation require separate confirmation.
- The guarded driver architecture is authorized. Arbitrary interactive SQL Run
  follows the classification and approval matrix in
  [ADR-0009](0009-interactive-sql-run-approval-matrix.md) and must not ship
  until that matrix is implemented and tested. Read-only browsing and Database
  Source Compile may proceed under their already-defined policies.
- A failed connection establishment may be retried once before an operation is
  sent. Apex Pilot never automatically replays a database-changing statement
  when Oracle may already have received it.

### Credential ownership and persistence

- SQLcl owns credentials for the agent/skill path in its saved-connection
  wallet. Apex Pilot stores and passes only the saved-connection name for that
  binding.
- Apex Pilot owns a separate interactive-driver secret only when that binding is
  configured. Persistent storage is limited to an allowlisted native backend:
  Windows Credential Manager, macOS Keychain, or a supported Linux Secret
  Service/KWallet session.
- Before offering **Remember password**, Apex Pilot must identify the expected
  native backend and pass a non-secret `set → get → delete` canary probe.
  Plaintext, file, null, unknown, or unexpected chained keyring backends are
  rejected.
- The keyring account key is the stable opaque Connection Profile ID, not a
  display name, Environment name, username, connect descriptor, or Working
  Schema.
- Locked, cancelled, unavailable, missing-dependency, and failed keyring states
  are reported distinctly and fail closed. Apex Pilot may prompt for a
  session-only password or remain Unconnected; it never silently falls through
  to file persistence.
- A session-only password may remain in backend process memory for the active
  profile, including across an application idle disconnect. It is cleared on
  explicit disconnect, profile change, project close, or app exit.
- Apex Pilot will not create a generic encrypted connections file. Environment
  variables are limited to explicit local development and test workflows, not
  the desktop **Remember password** feature.
- Non-secret Connection Profile metadata lives in the existing local SQLite
  store under the user's `.apex_pilot/` home directory. It may include the
  opaque profile ID, display name, username, connect descriptor, SQLcl
  saved-connection binding, and schema/environment mappings. It never contains
  passwords or wallet contents.
- Passwords, keyring values, wallet material, and complete connect strings
  containing credentials must not appear in logs, events, approval records, or
  tool activity.

### Lifetime and reconnect policy

- Oracle server profiles, Resource Manager, network devices, and cloud services
  may impose external limits. Apex Pilot does not assume a universal Oracle or
  firewall idle timeout and does not issue keepalive SQL to defeat
  administrator policy.
- A clean interactive session warns after 14 minutes of application-level
  database inactivity and disconnects after 15 minutes. The user range is
  10–30 minutes; deployment policy may impose a lower ceiling. The default
  warning lead time is 60 seconds.
- Idle short-lived read-only pool members retire after 5 minutes. The SQLcl MCP
  process stops 5 minutes after its final database session disconnects and
  restarts on demand.
- No application idle disconnect occurs while a call is in flight or a
  transaction is known to be active or uncertain. Existing explicit transaction
  resolution guards remain in force.
- A clean stale or externally expired connection reconnects lazily when the user
  next attempts an action. Apex Pilot validates or replaces the session,
  verifies the Connection Profile, restores and verifies the Working Schema,
  and only then continues.
- If a connection expires with an active transaction, or a failure occurs after
  a write may have been sent, Apex Pilot reports the lost or unknown state and
  requires reconciliation. It does not pretend the transaction survived or
  replay the operation.
- Backend health, SQLcl MCP process state, Connection Profile state, binding
  availability, disconnect reason, and validation status are separate
  dimensions. A running process is not presented as a connected database
  session.

## Consequences

### Positive

- Interactive database work survives UI remounts and gains predictable
  per-editor isolation.
- Agent and skill trust boundaries remain on SQLcl MCP and guarded application
  facades.
- Native secret storage fails closed without inventing a cross-platform
  encrypted-file subsystem.
- Connection identity, live session state, and adapter availability remain
  distinct and explainable.
- Lazy reconnect handles clean stale sessions without risking duplicate writes.

### Negative

- Apex Pilot must implement and test two database adapters and two independent
  credential bindings.
- Packaging must include and verify platform-specific native keyring
  dependencies.
- Users without an available native keyring must re-enter the interactive
  password per app/project session or remain Unconnected.
- A pool of dedicated editor sessions consumes more Oracle sessions than one
  shared connection.

### Risks

- A broad driver facade could recreate raw database access indirectly.
  Mitigation: keep contracts task-specific and test that frontend, agent, and
  skill layers cannot obtain raw connections, cursors, pools, or credentials.
- Safety behavior could drift between SQLcl MCP and `python-oracledb`.
  Mitigation: share classification and approval policy, record the adapter used,
  and run contract tests against both guarded paths.
- Native keyring availability and prompt behavior vary by platform and desktop
  session. Mitigation: allowlist, probe, fail closed, and test packaged builds on
  each supported platform.
- An expired session can lose transaction state. Mitigation: never replay
  uncertain writes and require explicit reconciliation.

## Implementation Notes

- Existing SQLcl MCP behavior remains the current implementation until
  follow-up work introduces the guarded interactive pool.
- Add the interactive driver as an application service boundary, not as a
  general utility import available to frontend, agent, or skill modules.
- Preserve sticky per-document profile/schema targets and the isolated compile
  lease defined for Database Source Documents.
- Implement and test Interactive SQL Run against
  [ADR-0009](0009-interactive-sql-run-approval-matrix.md) before enabling that
  capability.
- Keep SQL result rows session-scoped and do not persist them by default.
- Test keyring backend identity and canary behavior on packaged Windows, macOS,
  and supported Linux desktop environments.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md) — superseded
- [ADR-0003](0003-guarded-agent-and-skill-boundaries.md)
- [ADR-0005](0005-local-project-manifest-and-sqlite-storage.md)
- [ADR-0007](0007-desktop-shell-and-workspace-ux.md)
- [ADR-0009](0009-interactive-sql-run-approval-matrix.md)
