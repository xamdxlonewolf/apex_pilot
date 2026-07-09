# ADR-0006: Project Initialization Wizard and Preflight

## Status

Accepted

## Date

2026-07-09

## Context

PR 9A established portable `apex-pilot.json` manifests and local SQLite metadata.
Users still need a desktop path to create or open projects, choose retention,
map logical environments to local SQLcl saved connections, and verify machine
prerequisites before Agent Core work begins.

Apex Pilot must not auto-install Git, SQLcl, Java, or Python. Remote clone must
use the installed Git client and OS credential helpers or SSH agent only.

## Decision Drivers

- Keep project open/create flows ahead of Agent Core.
- Preserve the portable-manifest versus local-mapping boundary from ADR-0005.
- Guide users through missing prerequisites without claiming app-run installers.
- Support local path import and remote clone without storing Git credentials.
- Keep one active project per backend process for the current window model.

## Considered Options

### Option 1: Backend Project Service Plus Desktop Wizard

- Pros: Reuses storage primitives, exposes testable HTTP APIs, lets the React UI
  own menu/wizard UX while backend owns Git/manifest/preflight rules.
- Cons: Requires path entry in early UI before richer native file pickers land.

### Option 2: Frontend-Only Project Setup

- Pros: Faster UI iteration.
- Cons: Duplicates validation, weakens explainability, and risks bypassing
  retention/manifest invariants.

### Option 3: Defer Wizard Until After Agent Core

- Pros: Smaller near-term scope.
- Cons: Agent Core would lack durable project context and prerequisite gates.

## Decision

Apex Pilot will provide a project initialization wizard and first-launch
preflight on top of the PR 9A storage foundation.

The backend owns:

- Local profile create/list with duplicate-identity conflict handling.
- New project creation with `apex-pilot.json`, optional README, and optional
  `git init`.
- Existing path import and remote clone through installed Git only.
- Retention policy selection at create/import time.
- Logical environment to SQLcl saved-connection mapping and optional APEX
  workspace mapping.
- Preflight checks for Git, Python 3.12+, SQLcl 25.2+, Java 17/21, SQLcl MCP
  smoke via existing SQLcl preflight, and manifest load when a project path is
  present.

The desktop UI owns project menu actions (New Project, Open Project, Open
Recent, Close Project, Settings), retention selection UX, guided prerequisite
instructions, and local mapping editors. Missing tools show install guidance and
documentation links; the app does not run installers.

Opening a project validates the committed manifest and reports unmapped logical
environments. Live database work still requires an explicit SQLcl connection
selection through the existing MCP routes.

## Consequences

### Positive

- Users can create and reopen projects before Agent Core.
- Portable project facts remain commit-safe while connection names stay local.
- Prerequisite gaps are visible and actionable without silent auto-install.

### Negative

- Early UI may collect folder paths as text until native pickers are added.
- Clone/import depends on the user's installed Git and credential setup.

### Risks

- Users may open a project before mapping environments.
  Mitigation: surface unmapped environments in the opened-project payload and UI.
- Preflight can pass while a later live MCP connect still fails.
  Mitigation: keep MCP connect as an explicit later step with activity logging.

## Implementation Notes

- Project APIs live under bearer-protected `/profiles`, `/projects`, and
  `/preflight` routes.
- Runtime remembers one opened project per backend process.
- CLI launcher and multi-window project behavior remain PR 9D.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md)
- [ADR-0005](0005-local-project-manifest-and-sqlite-storage.md)
