# Architecture Decision Records

This directory contains Architecture Decision Records (ADRs) for Apex Pilot.
ADRs capture decisions that affect architecture, execution boundaries,
persistence, trust, security posture, or long-term maintenance.

## Index

| ADR | Title | Status | Date |
| --- | --- | --- | --- |
| [0001](0001-local-first-desktop-architecture.md) | Local-First Desktop Architecture | Accepted | 2026-06-16 |
| [0002](0002-sql-execution-through-sqlcl-mcp.md) | SQL Execution Through SQLcl MCP | Accepted | 2026-06-16 |
| [0003](0003-guarded-agent-and-skill-boundaries.md) | Guarded Agent and Skill Boundaries | Accepted | 2026-06-16 |
| [0004](0004-oracle-system-skills-sparse-checkout.md) | Oracle System Skills Sparse Checkout | Accepted | 2026-06-16 |

## Creating a New ADR

1. Copy `template.md` to `NNNN-short-title.md`.
2. Fill in the template.
3. Use `Proposed` until the decision is accepted.
4. Update this index when the ADR is added.

## Status Values

- **Proposed**: Under discussion.
- **Accepted**: Decision made and expected to guide implementation.
- **Deprecated**: No longer relevant.
- **Superseded**: Replaced by another ADR.
- **Rejected**: Considered but not adopted.
