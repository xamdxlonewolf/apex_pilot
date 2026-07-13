## Destination

Ship a calm Focus shell: primary work surface + hideable/slide-out secondary tools, larger Activity Rail with optional labels, left-aligned iconed file tree, and uniform resize — Cursor-light, not everything-on-one-page.

## Notes

- Domain: Apex Pilot desktop Mission Control UX (Tauri + React); calm Focus shell after figure-matching IA from [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61).
- Skills every session should consult: grilling, domain-modeling, design-system-patterns, frontend-design, web-design-guidelines, redesign-existing-projects.
- Context: `.scratch/ui-overhaul/`, `.scratch/calm-shell-and-connection/`, `CONTEXT.md`, [ADR-0007](docs/adr/0007-desktop-shell-and-workspace-ux.md).
- File-tree visual reference: `.scratch/calm-shell-and-connection/file-tree-visual-reference.png`.
- Runbook: `.scratch/calm-shell-and-connection/IMPLEMENTATION-ORDER.md`.
- Prefer Cursor / Codex-desktop calm focus over VS Code dashboard density. Never become VS Code.
- Charting locked: Files Focus → Mission hidden by default; Inspector + DB browse as drawers (Explorer drawer in Agent/SQL-heavy modes); rail breakpoint default + user preference for icons-only vs icons+labels; real expandable file explorer with type icons; uniform splitters for visible peers; design overhaul allowed **only if** the visual-direction grilling says so.
- Connection durability is **Map B** — do not implement here.
- Execution override: AFK `wayfinder:task` tickets may ship code via PR (same pattern as map 61). HITL grillings decide; tasks implement.

## Decisions so far

<!-- empty at charting -->

## Not yet specified

- Exact drawer animation / dismiss affordances after Focus + slide-out ownership grilling.
- Whether Layout Chrome needs new controls beyond existing Focus Mode UI.
- Token / typography changes if visual-direction grilling chooses a broader polish pass.
- Whether ADR-0007 needs a calm-shell amend after drawers land.

## Out of scope

- Becoming VS Code (calm focus + drawers only as inspiration).
- Multi-project concurrent open (product is single-project).
- Agent Core / fake Execute success / demo Missions.
- Connection reconnect thrash / session durability (separate Map B).
- Touching APEX export folders / root `f*.sql`.
- Persisting Oracle passwords or SQL result rows by default.
