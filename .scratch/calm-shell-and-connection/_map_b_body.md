## Destination

Make the project’s chosen Oracle connection durable for the app session: app-owned python-oracledb pool for interactive UI (SQL/PLSQL editors, DB browse, etc.); SQLcl MCP reserved for agents/skills; eliminate remount/dialog reconnect thrash; idle/lifetime handling with reconnect prompt (optional auto); supersede ADR-0002.

## Notes

- Domain: Apex Pilot connection durability + dual-path DB access (Tauri/React frontend, FastAPI/`apex_pilot` backend).
- Skills: grilling, domain-modeling, architecture-decision-records; research as needed. Frontend surfaces touch design-system-patterns only for status/reconnect chrome.
- Context: `CONTEXT.md`, [ADR-0002](docs/adr/0002-sql-execution-through-sqlcl-mcp.md) (to be superseded), backend `apex_pilot.mcp`, `backend/README.md`, `.scratch/calm-shell-and-connection/`.
- Prior map: [Wayfinder: Ship calm Focus shell](https://github.com/xamdxlonewolf/apex_pilot/issues/113) — cook Map A (or daily-usable) before implementing Map B unless user overrides.
- Runbook: `.scratch/calm-shell-and-connection/IMPLEMENTATION-ORDER.md`.
- Charting locked: dual-path; pool survives Settings/UI changes; borrow vs dedicated (working assumption: DB browser dedicated; each SQL/PLSQL tab dedicated); idle timer + reconnect prompt with cancel→manual; prefer SQLcl/MCP saved connections → OS keyring for secrets → home-path metadata; encrypted `~/.apex_pilot_connections` only as keyring fallback.
- Hard boundaries: no APEX export / root `f*.sql` edits; Stub honesty; no fake connected/Execute success.
- Execution override: AFK `wayfinder:task` tickets may ship code via PR. HITL grillings decide; ADR must land before pool implementation.

## Decisions so far

<!-- empty at charting -->

## Not yet specified

- Exact pool min/max and which surfaces share vs take dedicated connections (matrix after B1/B2).
- Idle timer value once Oracle/network limits are researched.
- Whether reconnect preference is per-project or global.
- How oracledb pool maps to SQLcl saved-connection names when both exist.
- Whether SQL classification/approval gates change for the interactive path (likely same safety facade).

## Out of scope

- Multi-project concurrent open / multi-DB app sessions.
- Moving agents off SQLcl MCP.
- Calm Focus shell UI (Map A).
- Fake Agent Core Execute / demo Missions.
- Touching APEX export folders / root `f*.sql`.
- Persisting Oracle passwords in plaintext or as primary home-file store (keyring first).
