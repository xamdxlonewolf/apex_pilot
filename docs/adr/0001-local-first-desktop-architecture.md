# ADR-0001: Local-First Desktop Architecture

## Status

Accepted

## Date

2026-06-16

## Context

Apex Pilot is intended to automate Oracle and Oracle APEX development workflows
while keeping database access, credentials, generated artifacts, and user
approvals under local user control. The first product shape needs a desktop
experience with chat, tool activity, connection selection, approvals, and safe
schema inspection.

The project also needs a repository structure that can support independent
backend, frontend, agent, safety, MCP, and skill-runtime work in small PRs.

## Decision Drivers

- Keep Oracle credentials and local development context on the user's machine.
- Support a rich desktop UI for chat, tool logs, approvals, and connection
  selection.
- Allow backend capabilities to be tested independently from desktop packaging.
- Preserve a path to a future hosted or team server without designing that first.
- Keep implementation PRs reviewable by separating backend and frontend
  concerns.

## Considered Options

### Option 1: Local Desktop App With Local Backend

- Pros: Keeps control local, supports native desktop integration, provides a
  clear backend API boundary, and allows packaged sidecar deployment.
- Cons: Requires a startup handshake, sidecar lifecycle management, and local
  API authentication.

### Option 2: Web-Only Hosted Service

- Pros: Centralized deployment and simpler client installation.
- Cons: Moves Oracle connection handling and user context into a hosted trust
  boundary too early.

### Option 3: CLI-First Tool

- Pros: Fastest implementation path and simple distribution.
- Cons: Does not match the desired chat-first desktop experience with visible
  approvals and tool activity.

## Decision

Apex Pilot will be local desktop first. The frontend will use Tauri with React
and TypeScript. The backend will be a FastAPI local service, owned by Tauri as a
sidecar process in packaged mode. Development mode may run frontend and backend
processes separately.

The repository will be a monorepo with `backend/`, `frontend/`, and root
architecture documentation. The backend Python package name will be
`apex_pilot`, with planned top-level modules for `api`, `agent`, `mcp`,
`skills`, `safety`, `schema`, `settings`, `storage`, and `events`.

## Consequences

### Positive

- Credentials and execution context stay local by default.
- The backend can enforce safety and execution boundaries behind HTTP and
  WebSocket contracts.
- The UI can provide explicit approval, connection, chat, and tool-log
  workflows.
- Future hosted or team-server modes can be explored after local invariants are
  proven.

### Negative

- The app must manage backend process lifecycle and startup handshake details.
- Local HTTP APIs need careful loopback binding and per-run authentication.
- CI and packaging will need backend and frontend quality gates.

### Risks

- Packaging complexity may slow the first vertical slice.
- Mitigation: establish backend and frontend scaffolds separately, then prove a
  narrow Tauri sidecar flow in the first vertical slice.

## Implementation Notes

- FastAPI must bind to `127.0.0.1` on a dynamic available port.
- Tauri must pass a per-run bearer token to the frontend at startup.
- Browser-based Tauri dev mode must allow CORS only for loopback/Tauri origins
  because bearer-authenticated frontend requests use the `Authorization` header
  and trigger preflight requests.
- The frontend may resolve backend config from development environment variables
  or a Tauri runtime command. Packaged mode should prefer a generated per-run
  token and sidecar-owned loopback URL.
- Chat streaming and tool activity should use typed WebSocket event envelopes.
- Backend/frontend API contracts should be driven by FastAPI OpenAPI, with
  generated TypeScript client/types where practical.

## Related Decisions

- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md)
- [ADR-0003](0003-guarded-agent-and-skill-boundaries.md)
