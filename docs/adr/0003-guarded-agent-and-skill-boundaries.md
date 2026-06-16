# ADR-0003: Guarded Agent and Skill Boundaries

## Status

Accepted

## Date

2026-06-16

## Context

Apex Pilot will use an LLM-backed agent to orchestrate Oracle and APEX
development workflows. The agent needs rich context and useful tools, but it must
not bypass deterministic safety classification, connection ownership, approval
state, or MCP tool logging.

The project will also support Oracle system skills and user extensions. Skills
can provide domain intelligence and transformations, but direct database access
from skills would make the safety model inconsistent.

## Decision Drivers

- Keep model-driven orchestration behind deterministic application controls.
- Prevent raw MCP access from reaching PydanticAI tools.
- Let skills transform, inspect, validate, and generate without owning
  execution.
- Preserve user consent for local user skills.
- Make database-changing actions explainable and auditable.

## Considered Options

### Option 1: Guarded Application Facades

- Pros: Centralizes safety, approval, logging, and connection selection while
  still giving the agent useful capabilities.
- Cons: Requires more application services and contract tests.

### Option 2: Raw MCP Tools Exposed to the Agent

- Pros: Faster to prototype and less wrapper code.
- Cons: Lets the agent bypass the app's intended safety and approval model.

### Option 3: Skill Runtime Owns Execution

- Pros: Skills can implement complete workflows independently.
- Cons: Creates inconsistent trust boundaries and makes user skill consent hard
  to reason about.

## Decision

PydanticAI tools will expose only guarded application facades. Initial facades
will include SQL request, object description, skill execution, schema context,
and approval request APIs. The agent will not receive raw MCP client access.

Skills will not directly access the database. Skills may inspect, transform,
validate, and generate artifacts, but execution remains owned by application
services that enforce classification, approvals, selected connection, and MCP
logging.

## Consequences

### Positive

- The agent can orchestrate workflows without owning the execution boundary.
- Safety classification and human approvals stay enforceable.
- Skill behavior can be extended without giving every extension database
  privileges.
- Tool activity can be shown consistently in the UI.

### Negative

- Application facades require careful API design and testing.
- Some upstream skill workflows may need adapters to fit this boundary.
- The first agent implementation will take longer than a raw-tool prototype.

### Risks

- Facades can become too broad and recreate raw execution access indirectly.
- Mitigation: add tests proving raw MCP clients are not exposed to agent tools
  and keep facade contracts narrow.

## Implementation Notes

- Use PydanticAI with LiteLLM model profiles.
- Support remote LiteLLM proxy servers, direct provider APIs, and local model
  options.
- Store non-secret model profile data locally.
- Store model and database secrets in OS keyring or environment variables.
- Persist approval metadata by default, not SQL result rows.
- Pause agent runs for prompted actions and resume only when approving the exact
  request identified by `approval_id`.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md)
- [ADR-0004](0004-oracle-system-skills-sparse-checkout.md)
