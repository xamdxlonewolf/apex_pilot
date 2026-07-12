## Destination

Ship a Mission Control shell that matches figure_1 / figure_2 as north star: Activity Rail + hybrid Explorer, dual-primary Workspace with Focus Modes, stage-driven Inspector, progressive enablement, real code editors, Product Header + native App Menu, and Cursor-informed file density — IA first, then visual polish gated by design skills — with a complete ticketed path from the current shell to that finished product. Design Spec supports; prior planning map is historical.

## Notes

- Domain: Apex Pilot desktop Mission Control UX; Tauri + React; Oracle DB / APEX first; multi-language editing (SQL, JS/TS, Python, CSS, etc.).
- North star: figure_1 + figure_2 (Conversation maps to Mission in product language). Design Spec supports. Cursor informs Explorer FS density/craft only — not multi-project switching (one project open at a time).
- Glossary: root CONTEXT.md (Workspace, Focus Mode, Activity Rail, Layout Chrome, Product Header, App Menu, progressive Stub enablement, hybrid Explorer).
- Skills every session: grilling, domain-modeling, design-system-patterns, tailwind-design-system, frontend-design, web-design-guidelines, redesign-existing-projects. Visual/polish tickets must be checked against those design skills.
- Plan then build on this map: decision tickets first where needed; implementation/task tickets carry execution until the destination ships. Never more than one ticket resolved per session.
- Hard boundaries unchanged: no APEX export folders / root f*.sql; SQL via SQLcl MCP only; guarded facades; no Oracle password / SQL result row persistence by default; Stub honesty (no fake success).
- Supersedes Wayfinder: Apex Pilot desktop UI overhaul (#14) and Spec: Apex Pilot desktop UI overhaul (Mission Control) (#25) — closed to avoid confusion; reuse research assets under .scratch/ui-overhaul/ and docs/design/ where still valid.
- Refer to tickets by **name** (title), not bare issue numbers.
- Current-shell gap inventory: `.scratch/ui-overhaul/figure-matching-gap-inventory.md` (supersedes 9B.1 panel matrix in `current-ui-adr-vs-design-spec.md` for live truth).

## Decisions so far

- [Research: Gap inventory current shell vs figure_1/2](https://github.com/xamdxlonewolf/apex_pilot/issues/62) — Regions exist (Explorer/Mission/Inspector/Console/Toolbar/Context Bar); largest gaps are Activity Rail, Focus Modes, stage-driven Inspector, progressive New SQL/Run, real code editors, Product Header + native App Menu. Asset: `.scratch/ui-overhaul/figure-matching-gap-inventory.md`
- [Grilling: Focus Mode set and default landing](https://github.com/xamdxlonewolf/apex_pilot/issues/63) — Modes are Agent / SQL / Files / Review; default Agent on project open; Agent = Mission primacy with editors remaining dual-primary peers (not minimized away).
- [Grilling: Focus Mode auto-switch on open work](https://github.com/xamdxlonewolf/apex_pilot/issues/73) — Sticky Agent on editor open/focus; SQL↔Files and Mission→Agent follow the work; Review exits the same way but is explicit-entry only (no auto-enter from Mission stage); triggers are open + tab focus.

## Not yet specified

- Full App Menu inventory vs Product Header / Toolbar ownership
- Code-editor library choice (Monaco vs alternatives) and language pack set
- Database/APEX object open-to-view detail (read-only viewer vs editable buffer; refresh vs FS sync)
- Developer Console craft depth vs figure_1 (tab inventory largely placed; MCP live, other tabs Stub — how much visual match in first IA slices?)
- Density / motion figure craft pass vs prefs that already ship (ADR-0007 §12 carryover)

## Out of scope

- Changing safety invariants (SQLcl MCP-only SQL, guarded facades, APEX/f*.sql nontouch, password/result persistence)
- Multi-project concurrent open (Cursor agent project list is inspiration only)
- Fake demo Missions that look like real Execute success
- Rewriting backend Agent Core inside visual tickets (Inspector uses honest stage chrome until Agent Core lands)
