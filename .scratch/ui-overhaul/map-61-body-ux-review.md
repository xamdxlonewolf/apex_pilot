## Destination











Ship a Mission Control shell that matches figure_1 / figure_2 as north star: Activity Rail + hybrid Explorer, dual-primary Workspace with Focus Modes, stage-driven Inspector, progressive enablement, real code editors, Product Header + native App Menu, and Cursor-informed file density â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ IA first, then visual polish gated by design skills â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ with a complete ticketed path from the current shell to that finished product. Design Spec supports; prior planning map is historical.











## Notes











- Domain: Apex Pilot desktop Mission Control UX; Tauri + React; Oracle DB / APEX first; multi-language editing (SQL, JS/TS, Python, CSS, etc.).





- North star: figure_1 + figure_2 (Conversation maps to Mission in product language). Design Spec supports. Cursor informs Explorer FS density/craft only â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ not multi-project switching (one project open at a time).





- Glossary: root CONTEXT.md (Workspace, Focus Mode, Activity Rail, Layout Chrome, Product Header, App Menu, Context Bar role, Command Palette, progressive Stub enablement, hybrid Explorer).





- Skills every session: grilling, domain-modeling, design-system-patterns, tailwind-design-system, frontend-design, web-design-guidelines, redesign-existing-projects. Visual/polish tickets must be checked against those design skills.





- Plan then build on this map: decision tickets first where needed; implementation/task tickets carry execution until the destination ships. Never more than one ticket resolved per session.





- Hard boundaries unchanged: no APEX export folders / root f*.sql; SQL via SQLcl MCP only; guarded facades; no Oracle password / SQL result row persistence by default; Stub honesty (no fake success).





- Supersedes Wayfinder: Apex Pilot desktop UI overhaul (#14) and Spec: Apex Pilot desktop UI overhaul (Mission Control) (#25) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ closed to avoid confusion; reuse research assets under .scratch/ui-overhaul/ and docs/design/ where still valid.





- Refer to tickets by **name** (title), not bare issue numbers.





- Current-shell gap inventory: `.scratch/ui-overhaul/figure-matching-gap-inventory.md` (supersedes 9B.1 panel matrix in `current-ui-adr-vs-design-spec.md` for live truth).





- Chrome ownership matrix: `.scratch/ui-overhaul/app-menu-vs-product-header-ownership.md`











- UX review follow-on (2026-07-12): canvas mission-control-ux-review section 4 tickets; Decisions 1–8 are acceptance criteria; Stub honesty unchanged.

## Decisions so far











- [Research: Gap inventory current shell vs figure_1/2](https://github.com/xamdxlonewolf/apex_pilot/issues/62) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Regions exist (Explorer/Mission/Inspector/Console/Toolbar/Context Bar); largest gaps are Activity Rail, Focus Modes, stage-driven Inspector, progressive New SQL/Run, real code editors, Product Header + native App Menu. Asset: `.scratch/ui-overhaul/figure-matching-gap-inventory.md`





- [Grilling: Focus Mode set and default landing](https://github.com/xamdxlonewolf/apex_pilot/issues/63) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Modes are Agent / SQL / Files / Review; default Agent on project open; Agent = Mission primacy with editors remaining dual-primary peers (not minimized away).





- [Grilling: Focus Mode auto-switch on open work](https://github.com/xamdxlonewolf/apex_pilot/issues/73) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Sticky Agent on editor open/focus; SQLâ”œÃ³Î“Ã‡Ã¡Î“Ã‡Â¥Files and Missionâ”œÃ³Î“Ã‡Ã¡Î“Ã‡Ã–Agent follow the work; Review exits the same way but is explicit-entry only (no auto-enter from Mission stage); triggers are open + tab focus.





- [Grilling: App Menu vs Product Header ownership](https://github.com/xamdxlonewolf/apex_pilot/issues/64) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Native App Menu replaces in-app Project/View menubar; Product Header is one band (hosts Context Bar role); Toolbar = New SQL/Run; palette never exclusive home; Help Check for updatesâ”œÃ³Î“Ã©Â¼â”¬Âª â”œÃ³Î“Ã‡Ã¡Î“Ã‡Ã– multi-item Updates dialog. Asset: `.scratch/ui-overhaul/app-menu-vs-product-header-ownership.md`





- [Grilling: Activity Rail â”œÃ³Î“Ã‡Ã¡Î“Ã‡Â¥ Focus Mode pairing](https://github.com/xamdxlonewolf/apex_pilot/issues/74) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Selective sync: rail Files/Agent/Code/Database/APEX/Review; Agent/Files/Review set+reflect Focus Mode; Code/Database/APEX Explorer-only (from Review â”œÃ³Î“Ã‡Ã¡Î“Ã‡Ã– Agent); SQL leaves rail; open lands Agent+Agent rail.





- [Task: Amend ADR-0007 for revised Mission Control IA](https://github.com/xamdxlonewolf/apex_pilot/issues/65) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ ADR-0007 (+ light design cross-links) records figure north star, dual-primary Workspace, Focus Modes, Activity Rail, hybrid Explorer, progressive enablement, stage-driven Inspector, Product Header + App Menu, real code editors.





- [Task: Shell IA â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Activity Rail, Focus Modes, Workspace](https://github.com/xamdxlonewolf/apex_pilot/issues/66) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Activity Rail + Focus Modes + dual-primary Workspace shipped; View panel toggles demoted to Layout Chrome. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/75





- [Task: Progressive enablement for New SQL and Run](https://github.com/xamdxlonewolf/apex_pilot/issues/67) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ New SQL focuses SQL Editor + explicit SQL Focus Mode; Run enables on real preconditions and submits live SqlSheet (no Stub/fake success). PR: https://github.com/xamdxlonewolf/apex_pilot/pull/76





- [Task: Stage-driven Inspector honest chrome](https://github.com/xamdxlonewolf/apex_pilot/issues/68) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Inspector stage nav Plan â”œÃ³Î“Ã‡Ã¡Î“Ã‡Ã– SQL Generated â”œÃ³Î“Ã‡Ã¡Î“Ã‡Ã– Review â”œÃ³Î“Ã‡Ã¡Î“Ã‡Ã– Execute â”œÃ³Î“Ã‡Ã¡Î“Ã‡Ã– Complete with honest Stub evidence; no fake plans/SQL/success. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/77. Asset: `.scratch/ui-overhaul/figure-matching-gap-inventory.md` â”œÃ©â”¬Âº4





- [Task: Hybrid Explorer FS and database object browse](https://github.com/xamdxlonewolf/apex_pilot/issues/69) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Files density craft + Database tables / mapped APEX workspaces open Workspace viewers (honest Stub metadata); APEX/`f*.sql` protection kept. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/78. Asset: `.scratch/ui-overhaul/figure-matching-gap-inventory.md` â”œÃ©â”¬Âº2





- [Task: Real code editor for SQL and common languages](https://github.com/xamdxlonewolf/apex_pilot/issues/70) â”œÃ³Î“Ã©Â¼Î“Ã‡Â¥ Shared Monaco (`@monaco-editor/react`, local Vite workers) for SQL Editor + File Editor; language map in `editorLanguages.ts`; protected APEX/`f*.sql` read-only. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/80. Asset: `.scratch/ui-overhaul/code-editor-library-choice.md`





- [Task: Product Header and native Tauri App Menu](https://github.com/xamdxlonewolf/apex_pilot/issues/71) â€” Product Header hosts Context Bar role + Settings; native Tauri File/Edit/View/Help App Menu (browser fallback for Vite/tests); interim Project/View menubar removed; Help â†’ Check for updatesâ€¦ opens Stub multi-item Updates dialog.





- [Task: Visual polish pass with design skills gate](https://github.com/xamdxlonewolf/apex_pilot/issues/72) — Spec tokens + Inter/JetBrains Mono + figure craft (rail/Inspector accent, env badge, health dots); design-skills gate checklist. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/83. Asset: `.scratch/ui-overhaul/visual-polish-design-skills-gate.md`
- [Grilling: Updates dialog updatable inventory](https://github.com/xamdxlonewolf/apex_pilot/issues/84) — Rows: Application; Oracle system skills; Prerequisites (SQLcl, Java, OS). Stub-honest until wired; Close-only footer; git/DB drift is a separate surface. Asset: .scratch/ui-overhaul/app-menu-vs-product-header-ownership.md



- [Grilling: Database/APEX open-to-view detail](https://github.com/xamdxlonewolf/apex_pilot/issues/85) — Read-only source viewer + Save to project (suggest path / replace confirm); Refresh = viewer only; after save open file + Files Focus Mode; APEX same contract.


- [Grilling: Developer Console craft depth vs figure_1](https://github.com/xamdxlonewolf/apex_pilot/issues/86) — Docked IA + live MCP is destination gate; add Downloads + Notifications as Stub tabs; default Problems; figure_1 MCP polish optional follow-on.

- [Grilling: Project git vs DB file drift surface](https://github.com/xamdxlonewolf/apex_pilot/issues/87) — On-demand Help → Compare project to database… (FS truth vs DB); results list + side-by-side Diff; optional AI report later. Stub entry on-map as #88. Asset: .scratch/ui-overhaul/project-vs-database-compare.md
- [Task: Help Compare project to database Stub entry](https://github.com/xamdxlonewolf/apex_pilot/issues/88) — Help/palette entry opens honest Stub results chrome; enabled only with project + connection; no fake diffs. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/89. Asset: .scratch/ui-overhaul/project-vs-database-compare.md











- [Task: Help Shortcuts vs Command Palette rename](https://github.com/xamdxlonewolf/apex_pilot/issues/94) — Option A: Help → Command Palette… (Ctrl+Shift+P unchanged); no shortcuts cheatsheet. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/100

## Not yet specified

- After Grillings on Browser App Menu / Product Header connection density / Focus Mode primacy: graduate implement Tasks for B1, H1+M4, H2 (not ticketed until decisions land).
- UX review polish P2 status-bar truncate / P3 Files actionable empty line — ticket only if still fog after Tasks above.
## Out of scope











- Changing safety invariants (SQLcl MCP-only SQL, guarded facades, APEX/f*.sql nontouch, password/result persistence)





- Multi-project concurrent open (Cursor agent project list is inspiration only)





- Fake demo Missions that look like real Execute success





- Rewriting backend Agent Core inside visual tickets (Inspector uses honest stage chrome until Agent Core lands)

- Live project↔database compare scan, Diff viewer wiring, and AI Generate report (beyond figure-matching Stub entry; separate follow-on effort)

















- [Defer: Agent Core Mission / Inspector evidence](https://github.com/xamdxlonewolf/apex_pilot/issues/98) — correctly Stub; do not fake figure checklist/SQL/success on this map (UX review Decision 8)
- [Defer: APEX / Review Explorer bodies + Console craft](https://github.com/xamdxlonewolf/apex_pilot/issues/99) — honest Stub / Partial craft; not IA blockers for this wave

Made with [Cursor](https://cursor.com)

































