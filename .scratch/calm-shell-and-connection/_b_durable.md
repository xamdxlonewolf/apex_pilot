Part of #121

## Question

Lock the durable dual-path connection model: oracledb pool ownership, borrow vs dedicated matrix, pool size limits, and how UI remounts must never tear the pool down.

## Charting decisions already locked (confirm / refine only)

- **Interactive path:** app-owned python-oracledb connection pool.
- **Agent path:** SQLcl MCP only.
- Pool **survives** Settings and other UI changes; no reconnect thrash on dialog close.
- **Borrow** the same connection when safe; take a **dedicated** pool connection when a surface needs isolation.
- Working assumption (refine): DB browser dedicated; each SQL/PLSQL editor tab dedicated.
- Idle/reconnect policy and secrets policy are separate tickets but must stay consistent with this model.

## Acceptance

- HITL lock: borrow vs dedicated matrix (at least DB browse + SQL/PLSQL tabs + any other interactive callers).
- HITL lock: pool min/max / sensible limits.
- HITL lock: what “project’s chosen connection” means when MCP saved connections + app profile mapping both exist.
- Enough detail for ADR + pool implementation tickets.
