# Current UI + ADR-0007 vs Design Spec

Research asset for Wayfinder ticket
[Research: Inventory current UI and ADR-0007 vs Design Spec](https://github.com/xamdxlonewolf/apex_pilot/issues/16)
(map: [Wayfinder: Apex Pilot desktop UI overhaul](https://github.com/xamdxlonewolf/apex_pilot/issues/14)).

Compared against Design Spec inventory:
[`.scratch/ui-overhaul/design-spec-surface-inventory.md`](./design-spec-surface-inventory.md)
(`DS-*` IDs).

**Authority (map Notes):** Design Spec wins over conflicting UI ADRs; ADRs and
vault alignment docs update to match. This ticket inventories conflicts — it
does not rewrite ADRs (owned by grilling tickets).

**Sources read:** `frontend/src/*` (App, IdeWorkspace, StartupFunnel, ChatPane,
FileTree, SchemaBrowser, SqlSheet, McpActivityWindow, ActivityTree, AppSettings,
prefs, styles), `docs/adr/0001`, `0005`, `0006`, `0007`, README product shape.

---

## 1. Current shell / features (what ships today)

### Chrome (`App.tsx` + `styles.css`)

| Surface | Implementation | Notes |
| --- | --- | --- |
| Window shell | `.ide-shell` grid: menubar / main / statusbar | Dark IDE chrome (`--chrome`, `--panel`, accent `#4f8cff`) |
| Menu bar | Project (New / Open / Recent / Close / Settings) + View (MCP Activity) + brand text | Flat button menubar, not native OS menus |
| Toolbar | **Absent** | No global toolbar |
| Context bar | **Absent** as a dedicated strip | Connection + schema live in right-pane `connection-strip` |
| Health indicators | Statusbar backend/DB/project strings only | No agent/MCP/health badges as Design Spec health strip |
| Status bar | Always-on footer | Backend status, connection message, project path, DB name |
| Layout | 3 columns when project open: left Files · center Chat · right Tools | Profile-scoped `--left-width` / `--right-width` in localStorage |
| MCP Activity | Floating Tauri `WebviewWindow` (`mcp-activity`) or in-app overlay | Opened from View menu; not docked in shell |

### Startup / project flows (`StartupFunnel.tsx`, ADR-0006)

Phases: `booting` → `preflight` → `profile` → `picker` → wizards (`new` /
`open` / `clone` / `settings`) → workspace.

| Feature | Status |
| --- | --- |
| Silent health then full preflight | Shipped |
| Profile create when none | Shipped |
| Recent-projects picker | Shipped |
| New / Open path / Clone wizards | Shipped (forms, not multi-step wizard chrome) |
| Settings (profile + layout prefs) | Shipped (`AppSettings`) |
| Close project + unsaved SQL prompt | Shipped |
| One project per window | Shipped (backend + UI) |

### Workspace panes (`IdeWorkspace.tsx`)

| Pane | Component | Behavior |
| --- | --- | --- |
| Left | `FileTree` | Project FS tree via Tauri FS; junk hide; APEX/`f*.sql` protected |
| Center | `ChatPane` | Transcript placeholder; composer present; **Send disabled** until Agent Core |
| Right | Tab strip | Default tabs: Schema, SQL Sheet, Mappings; file tabs open from tree |

Right-pane tools:

- **Schema** (`SchemaBrowser`) — MCP schema summary, working schema, save JSON
- **SQL Sheet** (`SqlSheet`) — classify/execute via guarded `/sql/run`, prompt for destructive, local run log
- **Mappings** (`ProjectMappings`) — env → SQLcl connection / APEX workspace
- **File preview** — read-only text for opened files (including protected exports after confirm)

### Connection / schema

- Connection select + Connect/Reconnect in right pane
- Auto-connect from project defaults / manifest mappings
- Working schema override persisted per project in localStorage
- Statusbar shows connected DB name

### Persistence (client)

- Profile layout prefs (`leftWidth`, `rightWidth`, `showJunkFiles`,
  `skipDestructiveSqlPrompt`) — `prefs.ts` / localStorage
- Project open tabs + connection/schema defaults — localStorage
- ADR-0007 allows later move to SQLite without changing UX contract

### Explicitly not shipped

- Mission timeline / workflow stages / Inspector
- In-shell Developer Console (Problems, Output, SQL History, Oracle Messages, Tasks, …)
- Explorer sections beyond project files (DB / APEX / REST / favorites / pinned / recent objects)
- Object / package / APEX / REST / diff editors
- Command palette, density modes, full shortcut set
- Agent Core chat send / streaming
- Native OS menu integration

---

## 2. ADR commitments (UX-relevant)

### ADR-0007 — Desktop Shell and Workspace UX (primary)

Accepted 2026-07-09. Commits to:

1. Startup funnel (health → preflight → profile → picker → workspace)
2. Always-on menus + bottom status bar; left/right panes only with project open
3. Left project file tree (Tauri FS); protect APEX export folders and root `f*.sql`
4. **Center chat composer always present; send disabled until Agent Core**
5. **Right shared tab strip** for schema, project files, SQL sheets
6. Schema via MCP summary; SQL sheet via guarded classify/execute
7. **MCP Activity as floating Tauri window** (overlay fallback in browser)
8. Close → picker with unsaved prompt; one project per window

Implementation notes: do not enable chat send until Agent Core; do not
auto-install prerequisites.

### Related ADRs (UX language / surfaces)

| ADR | UX-relevant commitment | Tension with Design Spec |
| --- | --- | --- |
| **0001** Local-first desktop | Tauri + React; “chat-first” desktop with chat, tool logs, approvals, connection selection | Spec is Mission Control IDE, not chat-first product framing |
| **0005** Manifest + SQLite | Persist chat threads/messages + tool activity metadata (not SQL result rows) | Naming is “chat”; Spec uses Mission / timeline / audit |
| **0006** Wizard + preflight | Project menu actions; guided preflight; no auto-install; mappings UX | Aligns in spirit with DS-DIALOGS-project / DS-SHELL-startup; Spec wants richer wizard chrome |
| **0002 / 0003** | SQL via SQLcl MCP; guarded façades | Compatible — Spec assumes same trust model |

Hard boundaries in ADRs (SQLcl MCP-only, guarded façades, APEX/`f*.sql`
nontouch, no password/result-row persistence) are **invariants**, not UI
conflicts — Design Spec overhaul must preserve them.

---

## 3. Conflict / omission matrix vs Design Spec (`DS-*`)

Legend:

- **Conflict** — shipped or ADR-committed behavior contradicts Spec placement/role
- **Partial** — related surface exists but wrong shape/name/completeness
- **Omission** — Spec surface has no current UI or ADR commitment
- **Align** — compatible; keep

### DS-SHELL

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-SHELL-window / arch / panels | Partial | Dense IDE shell exists; panel philosophy is Files\|Chat\|Tools, not Explorer\|Mission\|Inspector\|Console |
| DS-SHELL-menu | Partial | Project + View only; Spec expects fuller menu bar |
| DS-SHELL-toolbar | Omission | No toolbar |
| DS-SHELL-context | Conflict / omission | No context bar; connection lives in right tools strip |
| DS-SHELL-health | Partial | Statusbar strings ≠ Spec health indicators |
| DS-SHELL-layout / resize / dock | Partial | Two resizable side widths; no docking / bottom console region |
| DS-SHELL-startup / session / empty | Partial / Align | Funnel matches ADR-0007; session restore is tabs/defaults only, not full Spec session model |
| DS-SHELL-offline / weight / motion | Omission | No Spec offline chrome, visual-weight, or motion system |

### DS-MISSION (vs current Chat)

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-MISSION-* (all) | Conflict | Center is interim **Chat** with disabled send. Spec: Mission workspace (timeline, mission card, plan/SQL/review/exec stages, composer, history, streaming). ADR-0007 explicitly locks “center chat”. Vocabulary + IA conflict. |

### DS-INSPECTOR

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-INSPECTOR-* | Omission / Conflict | No Inspector. Right pane is **tool tabs** (schema/SQL/mappings/files), not workflow progress / classification / object summary / checklist. Closest fragments: SQL classification in SqlSheet; schema summary in SchemaBrowser — wrong host surface. |

### DS-EXPLORER (vs FileTree)

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-EXPLORER-project | Partial | File tree ≈ project section only |
| DS-EXPLORER-db / apex / rest / favorites / pinned / recent | Omission | Not present |
| DS-EXPLORER-search / filter / badges / menu / dnd | Omission | Junk toggle only; protected badges for APEX/`f*.sql` |
| Protected APEX/`f*.sql` | Align | Matches Spec + ADR hard boundaries |

### DS-WORKSPACE

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-WORKSPACE-sql | Partial | SQL Sheet exists but hosted in **right tools**, not center editor workspace |
| DS-WORKSPACE-tabs | Partial | Tab strip on right; Spec center workspace tabs for editors |
| DS-WORKSPACE-object / package / apex / rest / diff / split / crumb | Omission | File preview only |
| Schema browser as workspace type | Partial | Exists as right tab; Spec Explorer/DB + object viewers differ |

### DS-WORKFLOW

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-WORKFLOW-* | Omission | No mission lifecycle UI. SQL classify/prompt/run is a **local sheet path**, not Intent→…→Completion Mission+Inspector flow. Agent Core not landed. |

### DS-CONSOLE

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-CONSOLE-mcp | **Conflict** | ADR-0007 + code: **floating Tauri window / overlay**. Spec Figure 2 + DS-CONSOLE: MCP Activity is an **in-shell Developer Console tab**. Map fog already calls this out. |
| DS-CONSOLE-problems / output / sql-hist / oracle / tasks / downloads / notif | Omission | SqlSheet has a private run log; ActivityTree only in MCP float |
| DS-CONSOLE-layout / tabs / toolbar / persist | Omission | No bottom console region |

### DS-DIALOGS

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-DIALOGS-project / import | Partial | Funnel forms for new/open/clone; not Spec wizard chrome |
| DS-DIALOGS-prefs | Partial | AppSettings layout/profile; not full preferences |
| DS-DIALOGS-connection | Partial / omission | Connection select in strip; no dedicated connection wizard |
| DS-DIALOGS-confirm / alerts | Partial | `window.confirm` for protected files / close dirty; no Spec dialog system |

### DS-CONN

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-CONN-switcher / schema | Partial | Present in right strip + statusbar, not Spec context bar / switcher |
| DS-CONN-profile / env / validate / history / auth UI | Partial / omission | Profiles + env mappings exist; Spec connection UX richer |
| DS-CONN-safety | Align | Saved connection names; no password persistence in UI |

### DS-DESIGN / DS-COMPONENTS / DS-INTERACT / DS-PLATFORM

| ID | Verdict | Detail |
| --- | --- | --- |
| DS-DESIGN-* | Omission / Partial | Ad-hoc CSS variables (dark JetBrains-like). No Spec token set, density modes, type scale, motion rules. |
| DS-COMPONENTS-* | Omission | No shared component library matching Spec catalogue |
| DS-INTERACT-* | Partial | Basic buttons/forms; no command palette, toast system, Spec empty/loading language |
| DS-PLATFORM-shortcuts / motion / arch | Partial | React/Tauri aligns (DS-PLATFORM-arch); shortcuts/motion unspecified in product |

### Product framing / glossary

| Topic | Current / ADR | Design Spec | Verdict |
| --- | --- | --- | --- |
| Product shape | README + ADR-0001 “chat-first” | Professional desktop IDE / Mission Control | Conflict (framing) |
| Center surface name | Chat | Mission | Conflict |
| Right contextual surface | Tools tabs | Inspector | Conflict |
| Left navigation | Files (FS tree) | Explorer (multi-section) | Partial |
| Observability | Floating MCP Activity | Developer Console (incl. MCP tab) | Conflict |
| Editors | Right-pane SQL/schema | Center workspace editors | Conflict |

---

## 4. Priority conflict shortlist (for grilling #18)

Ordered for decision impact (not implementation order):

1. **MCP Activity placement** — ADR-0007 floating window vs **DS-CONSOLE-mcp** in-shell console (map fog item).
2. **Center surface identity** — ADR-0007 “chat” vs **DS-MISSION** Mission workspace (glossary + CONTEXT.md fog).
3. **Right pane role** — tool tab host vs **DS-INSPECTOR** workflow inspector; where SQL Sheet / Schema live afterward (**DS-WORKSPACE**).
4. **Shell composition** — add bottom **DS-CONSOLE**; introduce **DS-SHELL-toolbar** + **DS-SHELL-context**; expand **DS-EXPLORER** beyond files.
5. **Which ADRs rewrite** — at least **0007**; likely glossary touch in **0001** / persistence naming in **0005**; **0006** mostly keep with wizard-chrome upgrades.
6. **Design-system vs screen-first** after handoff — current CSS is interim; Spec has full **DS-DESIGN** / **DS-COMPONENTS** (map fog).

Non-conflicts to preserve: SQLcl MCP-only SQL, guarded façades, APEX/`f*.sql` protection, no password / result-row persistence, local-first Tauri+FastAPI, startup preflight without auto-install, one project per window.

---

## 5. Suggested citation pattern

- “Conflict: ADR-0007 §7 floating MCP vs **DS-CONSOLE-mcp** (§223) / Figure 2.”
- “Omission: **DS-INSPECTOR-*** — no current surface; right pane is Tools tabs.”
- “Partial: FileTree ≈ **DS-EXPLORER-project** only; missing **DS-EXPLORER-db/apex/rest**.”
- “Align: protected APEX/`f*.sql` in FileTree with ADR-0007 + hard boundaries.”

---

## 6. Follow-ups

- Grilling ticket owns conflict resolution and ADR rewrite list (#18).
- Gap-scan vs vault PR Roadmap / Apex Pilot note is #17 (may overlap omissions here).
- Stub copy / gap-marking conventions are #19.
- Optional: attach figure_1 / figure_2 under `.scratch/ui-overhaul/figures/` for layout proof against this matrix.
