# ADR-0005: Local Project Manifest and SQLite Storage

## Status

Accepted

## Date

2026-07-09

## Context

Apex Pilot needs durable local state before Agent Core can own project context,
Mission history, approvals, and memory search. Project facts must be shareable
through Git without leaking machine-local SQLcl connection names or secrets.
Private runtime state must stay on the user's machine.

Phase 1 also needs searchable Mission/tool metadata without introducing a
vector database or a second Oracle storage path that would bypass SQLcl MCP.
Storage vocabulary may still say “chat threads/messages”; the product surface
is Mission (see CONTEXT.md and ADR-0007).

## Decision Drivers

- Keep portable project facts commit-safe and machine-independent.
- Keep SQLcl saved connection names and user/runtime state local.
- Persist explainable Mission/chat-thread history, SQL text, classification,
  approval metadata, and tool logs without storing SQL result rows by default.
- Support local profiles with duplicate detection.
- Prefer built-in SQLite capabilities over optional extensions for phase 1.
- Preserve a later path for optional vector memory without making it required.

## Considered Options

### Option 1: Committed JSON Manifest Plus Local SQLite

- Pros: Clear portable versus private boundary, simple Git collaboration, strong
  local metadata and FTS5 search support, no Oracle driver storage path.
- Cons: Requires local mapping of logical environments to SQLcl connections and
  explicit retention maintenance.

### Option 2: All Project State in Local SQLite Only

- Pros: Simpler single store.
- Cons: Project facts are not portable across machines or teammates.

### Option 3: All Non-Secret State in the Repo Manifest

- Pros: Maximum portability.
- Cons: Tempting to commit machine-local connection names; poor fit for chat,
  profiles, retention, and tool history.

### Option 4: SQLite Plus Immediate Vector Extension

- Pros: Semantic memory earlier.
- Cons: Adds optional/extension risk before the base storage API is proven.

## Decision

Apex Pilot will use a committed JSON project manifest, initially
`apex-pilot.json`, for portable project facts, and a local SQLite database for
private/user/runtime facts.

The manifest stores project identity, logical environments, and non-secret
schema/APEX hints. It must not store SQLcl saved connection names, passwords, or
other machine-local secrets.

Local SQLite stores profiles, project paths, retention policy, logical
environment to SQLcl connection mappings, connection-to-APEX-workspace mappings,
chat threads/messages (Mission history persistence), and tool activity metadata.
SQL result rows are not persisted by default.

Phase 1 memory search uses SQLite tables plus FTS5 after a runtime capability
check. Vector memory is deferred behind an optional adapter interface and is not
required for Agent Core.

Local profiles use a random profile ID plus a stable salted hash of email and
username for duplicate detection. Retention is a user-selected policy enforced
by explicit maintenance, not silent deletion on every read. Mission history
display helpers load from the latest message backward in 2-week windows.
Renaming storage identifiers from “chat” to “mission” is optional follow-up and
not required to keep this ADR aligned with the Design Spec.

## Consequences

### Positive

- Teammates can share project environment names without sharing local SQLcl
  connection names.
- Agent Core can depend on durable project memory and profile context.
- Persistence stays aligned with the no-result-rows-by-default invariant.
- Vector memory can be added later without rewriting the core schema.

### Negative

- Opening a project requires local environment mapping before live database work.
- Retention pruning must be an explicit, explainable maintenance action.
- Runtime must fail clearly when SQLite JSON or FTS5 support is unavailable.

### Risks

- Manifest and local mapping can drift if environment names change.
  Mitigation: validate manifest environments against local mappings at project
  open time in later wizard/preflight work.
- FTS5 availability can vary by SQLite build.
  Mitigation: check capabilities at database open and surface a clear error.

## Implementation Notes

- Keep storage primitives in `apex_pilot.storage`.
- Do not expose raw SQLite handles to PydanticAI tools.
- Do not add direct Oracle driver persistence in phase 1.
- PR 9B owns the project wizard UI and retention selection UX on top of this
  foundation; see ADR-0006.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md)
- [ADR-0003](0003-guarded-agent-and-skill-boundaries.md)
