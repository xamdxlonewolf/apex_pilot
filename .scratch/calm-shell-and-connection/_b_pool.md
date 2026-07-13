Part of #121

## Question

Implement the app-owned python-oracledb pool, stop remount/auto-connect thrash, and expose a borrow/dedicated API for interactive surfaces.

## Acceptance

- One project pool for the chosen connection; survives Settings/dialog open/close.
- Surfaces borrow or take dedicated connections per grilling matrix — no per-mount reconnect storm.
- Honest connected / reconnecting / dead cues wired to Context Bar + status bar (minimum).
- Does not change agent/MCP path.
- Implements only after ADR supersede is resolved.

## Blocked by

- Grilling: Durable dual-path project connection session
- Grilling: ADR supersede ADR-0002 + secrets policy
