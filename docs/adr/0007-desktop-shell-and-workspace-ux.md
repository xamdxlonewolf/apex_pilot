# ADR-0007: Desktop Shell and Workspace UX

## Status

Accepted

## Date

2026-07-09

## Context

PR 9B delivered project wizard and preflight APIs with an interim stacked-cards
UI. PR 9B.1 then shipped an interim dense IDE shell (Files | Chat | Tools, plus
a floating MCP Activity window) so Agent Core would not lean on throwaway
layout.

Authoritative UI/UX direction is the Obsidian / repo note
[Apex Pilot Desktop Design Spec](../design/Apex%20Pilot%20Desktop%20Design%20Spec.txt)
(plus figure_1 / figure_2). Where this ADR previously conflicted with the Design
Spec, the Design Spec wins. Wayfinder grilling
[Grilling: Resolve Design Spec vs ADR conflicts](https://github.com/xamdxlonewolf/apex_pilot/issues/18)
locked the target shell below; the interim 9B.1 composition is historical
context only, not the accepted product shape.

## Decision Drivers

- Align the accepted shell with the Design Spec Mission Control layout.
- Keep native folder pickers and Tauri FS for local files; backend owns MCP and
  metadata.
- Preserve APEX export folder and root `f*.sql` invariants in Explorer.
- Make SQL execution explainable through classification, Inspector evidence, and
  Developer Console / MCP activity.
- Allow visible stubs for unfinished backend without inventing fake success.
- Avoid inventing Agent Core Mission send behavior early; stubs are honest.

## Considered Options

### Option 1: Design Spec Mission Control Shell (chosen)

- Pros: Matches locked UX authority; clear homes for Mission, Inspector,
  Explorer, workspace editors, and in-shell Developer Console.
- Cons: Larger frontend migration from the interim 9B.1 shell.

### Option 2: Keep Interim Files | Chat | Tools Forever

- Pros: Smaller near-term diff.
- Cons: Contradicts Design Spec and figures; Agent Core would harden against the
  wrong IA.

### Option 3: Frontend-Only SQL Execution Via Raw MCP

- Pros: Fewer backend routes.
- Cons: Breaks guarded façade invariant and weakens classification/approval path.

## Decision

Apex Pilot’s accepted desktop shell is the Design Spec Mission Control layout:

1. **Startup funnel** (unchanged in spirit from 9B.1 / ADR-0006): silent health →
   full preflight when first-time or unhealthy → profile setup when needed →
   recent-projects picker → project workspace.
2. **Always-on chrome:** menu bar, **toolbar**, **context bar** (connection /
   working schema / environment), and bottom status bar. Left / center / right /
   bottom regions appear when a project is open.
3. **Left — Explorer:** multi-section navigation (project files, database, APEX,
   REST, favorites, pinned, recent). Project files via Tauri FS (browser fallback
   for Vite-only tests); junk hidden by default; APEX export folders and root
   `f*.sql` shown as protected. Schema browsing lives under Explorer / object
   viewers — not as a permanent right-pane tool tab.
4. **Center — Mission and workspace editors:** the primary surface is the
   **Mission** workspace (timeline, mission card, plan/SQL/review/exec stages,
   composer, history). Center also hosts workspace editor tabs such as the
   **SQL Editor** (relocated from the interim right-pane SQL Sheet), object /
   package / APEX / REST / diff viewers, and file editors. Mission composer may
   ship with send disabled until Agent Core; stubs must be honest.
5. **Right — Inspector only:** workflow progress, classification, object /
   dependency summary, checklists, and related evidence. The Inspector explains;
   it does not own execution or replace the SQL Editor / Schema Browser.
6. **Bottom — Developer Console:** in-shell console region with tabs such as
   Problems, Output, MCP Activity, SQL History, Oracle Messages, Tasks. **MCP
   Activity is a Console tab**, not a floating-window product target. A temporary
   floating/overlay path may exist only as a migration stub until the console
   region ships.
7. **Connection / mappings:** connection switcher, working schema, and
   environment identity belong in the context bar and connection/profile UX
   (`DS-CONN`, connection wizard / preferences). Env → SQLcl / APEX workspace
   mappings remain a product capability hosted there — not as a forever right
   tab.
8. **Persistence:** profile-scoped layout prefs and project-scoped open tabs may
   start in local desktop storage and later move into SQLite without changing the
   UX contract.
9. **Close project** returns to the picker with an unsaved-work prompt when the
   SQL Editor or other editors have dirty state. One project per window.
10. **Implementation strategy:** screen/shell-first Spec layout, with design
    tokens and shared components growing as screens need them. Exact pixel-match
    to figure_1 / figure_2 is not a gate for first Spec-shell PRs; visual intent
    and IA are.

### Historical interim (PR 9B.1 — superseded as target)

Shipped for sequencing, no longer the accepted Decision:

- Center chat composer; right shared tool tabs (Schema / SQL Sheet / Mappings /
  files); MCP Activity as a floating Tauri window (overlay in browser).

## Consequences

### Positive

- Paper trail matches Design Spec authority before Agent Core hardens UI
  assumptions.
- Clear relocation homes for SQL Editor, schema browsing, and mappings.
- Observability stays in-shell and explainable beside Mission / Inspector.

### Negative

- Frontend must migrate off the interim 9B.1 composition.
- Many Spec surfaces will land as stubs before backend/Agent Core catch up.

### Risks

- Tauri plugin permissions must stay scoped to the project root for FS access.
- SQL Editor must never bypass `PROMPT`/`BLOCK` decisions from the classifier.
- Migration stubs (e.g. temporary floating MCP) must not be mistaken for the
  target UX in docs or Roadmap language.

## Implementation Notes

- Keep `POST /sql/classify` and `POST /sql/run` for the SQL Editor path.
- Prefer `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` for pickers and
  tree reads.
- Do not auto-install prerequisites; keep guided preflight from ADR-0006.
- Do not enable Mission send until Agent Core; use honest stubs.
- Roadmap UI overhaul items (UI-0…UI-9) track Spec surfaces; stub/gap-marking
  conventions are owned separately.
- Wizard chrome may grow richer per Design Spec without changing ADR-0006’s
  backend ownership of create/open/clone/preflight/mappings.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md)
- [ADR-0005](0005-local-project-manifest-and-sqlite-storage.md)
- [ADR-0006](0006-project-initialization-wizard-and-preflight.md)
