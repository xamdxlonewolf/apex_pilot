## Destination

Ship a Mission Control shell that matches figure_1 / figure_2 as north star: Activity Rail + hybrid Explorer, dual-primary Workspace with Focus Modes, stage-driven Inspector, progressive enablement, real code editors, Product Header + native App Menu, and Cursor-informed file density — IA first, then visual polish gated by design skills — with a complete ticketed path from the current shell to that finished product. Design Spec supports; prior planning map is historical.

## Notes

- Domain: Apex Pilot desktop Mission Control UX; Tauri + React; Oracle DB / APEX first; multi-language editing (SQL, JS/TS, Python, CSS, etc.).
- North star: figure_1 + figure_2 (Conversation maps to Mission in product language). Design Spec supports. Cursor informs Explorer FS density/craft only — not multi-project switching (one project open at a time).
- Glossary: root CONTEXT.md (Workspace, Focus Mode, Activity Rail, Layout Chrome, Product Header, App Menu, Context Bar role, Command Palette, progressive Stub enablement, hybrid Explorer).
- Skills every session: grilling, domain-modeling, design-system-patterns, tailwind-design-system, frontend-design, web-design-guidelines, redesign-existing-projects. Visual/polish tickets must be checked against those design skills.
- Plan then build on this map: decision tickets first where needed; implementation/task tickets carry execution until the destination ships. Never more than one ticket resolved per session.
- Hard boundaries unchanged: no APEX export folders / root f*.sql; SQL via SQLcl MCP only; guarded facades; no Oracle password / SQL result row persistence by default; Stub honesty (no fake success).
- Supersedes Wayfinder: Apex Pilot desktop UI overhaul (#14) and Spec: Apex Pilot desktop UI overhaul (Mission Control) (#25) — closed to avoid confusion; reuse research assets under .scratch/ui-overhaul/ and docs/design/ where still valid.
- Refer to tickets by **name** (title), not bare issue numbers.
- Current-shell gap inventory: `.scratch/ui-overhaul/figure-matching-gap-inventory.md` (supersedes 9B.1 panel matrix in `current-ui-adr-vs-design-spec.md` for live truth).
- Chrome ownership matrix: `.scratch/ui-overhaul/app-menu-vs-product-header-ownership.md`

## Decisions so far

- [Research: Gap inventory current shell vs figure_1/2](https://github.com/xamdxlonewolf/apex_pilot/issues/62) — Regions exist (Explorer/Mission/Inspector/Console/Toolbar/Context Bar); largest gaps are Activity Rail, Focus Modes, stage-driven Inspector, progressive New SQL/Run, real code editors, Product Header + native App Menu. Asset: `.scratch/ui-overhaul/figure-matching-gap-inventory.md`
- [Grilling: Focus Mode set and default landing](https://github.com/xamdxlonewolf/apex_pilot/issues/63) — Modes are Agent / SQL / Files / Review; default Agent on project open; Agent = Mission primacy with editors remaining dual-primary peers (not minimized away).
- [Grilling: Focus Mode auto-switch on open work](https://github.com/xamdxlonewolf/apex_pilot/issues/73) — Sticky Agent on editor open/focus; SQL↔Files and Mission→Agent follow the work; Review exits the same way but is explicit-entry only (no auto-enter from Mission stage); triggers are open + tab focus.
- [Grilling: App Menu vs Product Header ownership](https://github.com/xamdxlonewolf/apex_pilot/issues/64) — Native App Menu replaces in-app Project/View menubar; Product Header is one band (hosts Context Bar role); Toolbar = New SQL/Run; palette never exclusive home; Help Check for updates… → multi-item Updates dialog. Asset: `.scratch/ui-overhaul/app-menu-vs-product-header-ownership.md`
- [Grilling: Activity Rail ↔ Focus Mode pairing](https://github.com/xamdxlonewolf/apex_pilot/issues/74) — Selective sync: rail Files/Agent/Code/Database/APEX/Review; Agent/Files/Review set+reflect Focus Mode; Code/Database/APEX Explorer-only (from Review → Agent); SQL leaves rail; open lands Agent+Agent rail.
- [Task: Amend ADR-0007 for revised Mission Control IA](https://github.com/xamdxlonewolf/apex_pilot/issues/65) — ADR-0007 (+ light design cross-links) records figure north star, dual-primary Workspace, Focus Modes, Activity Rail, hybrid Explorer, progressive enablement, stage-driven Inspector, Product Header + App Menu, real code editors.
- [Task: Shell IA — Activity Rail, Focus Modes, Workspace](https://github.com/xamdxlonewolf/apex_pilot/issues/66) — Activity Rail + Focus Modes + dual-primary Workspace shipped; View panel toggles demoted to Layout Chrome. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/75
- [Task: Progressive enablement for New SQL and Run](https://github.com/xamdxlonewolf/apex_pilot/issues/67) — New SQL focuses SQL Editor + explicit SQL Focus Mode; Run enables on real preconditions and submits live SqlSheet (no Stub/fake success). PR: https://github.com/xamdxlonewolf/apex_pilot/pull/76
- [Task: Stage-driven Inspector honest chrome](https://github.com/xamdxlonewolf/apex_pilot/issues/68) — Inspector stage nav Plan → SQL Generated → Review → Execute → Complete with honest Stub evidence; no fake plans/SQL/success. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/77. Asset: `.scratch/ui-overhaul/figure-matching-gap-inventory.md` §4
- [Task: Hybrid Explorer FS and database object browse](https://github.com/xamdxlonewolf/apex_pilot/issues/69) — Files density craft + Database tables / mapped APEX workspaces open Workspace viewers (honest Stub metadata); APEX/`f*.sql` protection kept. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/78. Asset: `.scratch/ui-overhaul/figure-matching-gap-inventory.md` §2

## Not yet specified

- Updates dialog updatable inventory (Application, Oracle system skills, …) beyond the Help entry-point pattern
- Code-editor library choice (Monaco vs alternatives) and language pack set
- Database/APEX object open-to-view detail (read-only viewer vs editable buffer; refresh vs FS sync)
- Developer Console craft depth vs figure_1 (tab inventory largely placed; MCP live, other tabs Stub — how much visual match in first IA slices?)
- Density / motion figure craft pass vs prefs that already ship (ADR-0007 §12 carryover)

## Out of scope

- Changing safety invariants (SQLcl MCP-only SQL, guarded facades, APEX/f*.sql nontouch, password/result persistence)
- Multi-project concurrent open (Cursor agent project list is inspiration only)
- Fake demo Missions that look like real Execute success
- Rewriting backend Agent Core inside visual tickets (Inspector uses honest stage chrome until Agent Core lands)
