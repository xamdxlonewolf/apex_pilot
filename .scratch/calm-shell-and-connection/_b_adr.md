Part of #121

## Question

Supersede ADR-0002 for dual-path DB access and lock secrets policy (OS keyring primary; home-path metadata; encrypted file only as fallback).

## Charting decisions already locked

- Interactive SQL/browse via python-oracledb pool; agents/skills stay on SQLcl MCP.
- Prefer existing SQLcl/MCP saved connections; else collect credentials once mapped to profile/display name.
- Secrets in OS keyring; non-secret metadata under user home `.apex_pilot/`; encrypted connections file only if keyring unavailable.

## Acceptance

- HITL ADR text agreed and merged (or PR linked) superseding [ADR-0002](docs/adr/0002-sql-execution-through-sqlcl-mcp.md).
- Secrets/trust-boundary decision recorded (same ADR or companion ADR).
- Safety facade still required for interactive path (classification/approval not bypassed).
- No plaintext password persistence.

## Blocked by

- Grilling: Durable dual-path project connection session
