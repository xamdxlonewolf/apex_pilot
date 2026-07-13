# ADR-0007: Desktop Shell and Workspace UX

## Status

Accepted

## Date

2026-07-11

## Context

PR 9B delivered project wizard and preflight APIs with an interim stacked-cards
UI. PR 9B.1 then shipped an interim dense IDE shell (Files | Chat | Tools, plus
a floating MCP Activity window) so Agent Core would not lean on throwaway
layout.

Authoritative UI/UX direction is figure_1 / figure_2 as north star, with the
Obsidian / repo note
[Apex Pilot Desktop Design Spec](../design/Apex%20Pilot%20Desktop%20Design%20Spec.txt)
supporting. Product language is Mission (not Conversation). Glossary authority
is root `CONTEXT.md`.

Wayfinder map
[Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61)
and its closed grilling tickets revise the accepted shell beyond the first
Design Spec vs ADR lock
([Grilling: Resolve Design Spec vs ADR conflicts](https://github.com/xamdxlonewolf/apex_pilot/issues/18)).
The interim 9B.1 composition remains historical context only, not the accepted
product shape.

## Decision Drivers

- Match figure_1 / figure_2 Mission Control IA (Activity Rail, dual-primary
  Workspace, Focus Modes, stage-driven Inspector, Product Header + App Menu).
- Keep native folder pickers and Tauri FS for local files; backend owns MCP and
  metadata.
- Preserve APEX export folder and root `f*.sql` invariants in Explorer.
- Make SQL execution explainable through classification, Inspector evidence, and
  Developer Console / MCP activity.
- Allow visible stubs and progressive enablement without inventing fake success.
- Avoid inventing Agent Core Mission send behavior early; stubs are honest.

## Considered Options

### Option 1: Figure-matching Mission Control Shell (chosen)

- Pros: Matches locked UX north star and glossary; clear homes for Activity
  Rail, hybrid Explorer, dual-primary Workspace, Inspector, and in-shell
  Developer Console; Cursor-informed FS density without multi-project switching.
- Cons: Larger frontend migration from the interim 9B.1 shell and from the
  earlier Spec-shell ADR text that lacked Focus Modes / Product Header / App
  Menu detail.

### Option 2: Keep Interim Files | Chat | Tools Forever

- Pros: Smaller near-term diff.
- Cons: Contradicts figures and Design Spec; Agent Core would harden against the
  wrong IA.

### Option 3: Frontend-Only SQL Execution Via Raw MCP

- Pros: Fewer backend routes.
- Cons: Breaks guarded façade invariant and weakens classification/approval path.

## Decision

Apex Pilot’s accepted desktop shell is the figure-matching Mission Control
layout:

1. **Startup funnel** (unchanged in spirit from 9B.1 / ADR-0006): silent health →
   full preflight when first-time or unhealthy → profile setup when needed →
   recent-projects picker → project workspace.
2. **Always-on chrome when a project is open:**
   - **Native App Menu** (File / Edit / View / Help) owns OS-standard and
     project-lifecycle discoverability; replaces the interim in-app Project /
     View menubar
     ([Grilling: App Menu vs Product Header ownership](https://github.com/xamdxlonewolf/apex_pilot/issues/64)).
   - **Product Header** — one dense top identity/status band (brand, project,
     Environment, health, Context Bar pickers + Connect, Settings gear). Context
     Bar is a *role* hosted inside the Product Header, not a second stacked
     strip.
   - **Toolbar** — frequent workflow verbs only (New SQL, Run), with progressive
     enablement. Optional MCP console-focus shortcut may live here.
   - Bottom status bar. Left / center / right / bottom regions appear when a
     project is open.
   - **Command Palette** discovers actions that already have an App Menu,
     Product Header, Toolbar, or Layout Chrome home — never the exclusive home
     for a product affordance. Help → Check for updates… opens one Updates
     dialog with per-component rows (exact inventory remains a later decision).
3. **Left — Activity Rail + hybrid Explorer:**
   - **Activity Rail** is required chrome: Files, Agent, Code, Database, APEX,
     Review (Bookmarks / History deferred). Selective sync with Focus Mode:
     Agent / Files / Review set and reflect matching modes; Code / APEX change
     Explorer posture only (from Review they exit Review → Agent); Database opens
     the dedicated Database Drawer; SQL has no rail icon and leaves the current
     rail posture; project open lands Agent Focus Mode + Agent rail
     ([Grilling: Activity Rail ↔ Focus Mode pairing](https://github.com/xamdxlonewolf/apex_pilot/issues/74)).
   - **Explorer** bodies are hybrid: Files posture is the real filesystem tree
     (local/git source of truth) via Tauri FS (browser fallback for Vite-only
     tests); junk hidden by default; APEX export folders and root `f*.sql` shown
     as protected. APEX remains an Explorer posture for this map; Database is a
     dedicated Drawer (not an Explorer body). REST / favorites / pinned / recent
     may remain Explorer sections as Spec surfaces mature.
   - **Calm Focus drawers** ([Wayfinder: Ship calm Focus shell](https://github.com/xamdxlonewolf/apex_pilot/issues/113)):
     Activity Rail is always-on. Mission defaults visible in Agent/Review and
     hidden in SQL/Files (session per-Focus override). Explorer is a peer in
     Files Focus and a **docked push drawer** elsewhere (same column UI).
     Inspector and Database are docked push drawers (closed by default; Database
     defaults right; same-side mutual exclusion with Inspector). Drawers take
     layout width and shrink the Workspace — they must not overlay it. Side prefs
     are profile-persisted; open/closed is session-only. Dismiss via close
     control, Escape, or toggle — not click-outside. MCP Activity / View MCP
     toggles Developer Console (with an explicit console close control).
     Activity Rail: Files opens Explorer peer; Agent/Review switch Focus only;
     Code/APEX open Explorer dock; Database opens Database dock.
4. **Center — dual-primary Workspace:** Mission and editors (SQL Editor, File
   Editor, and related viewers) share primacy as peers. Neither is demoted to
   secondary chrome.
   - **Focus Modes** — Agent, SQL, Files, Review. Default on project open:
     Agent. Agent is Mission-forward with editors remaining dual-primary peers
     (not minimized away). SQL and Files are editor-forward; Review is
     AI-generated SQL review posture
     ([Grilling: Focus Mode set and default landing](https://github.com/xamdxlonewolf/apex_pilot/issues/63)).
   - **Auto-switch:** Agent is sticky on editor open/focus; SQL ↔ Files follow
     the active editor peer; focusing Mission restores Agent; Review is
     explicit-entry only (no auto-enter from Mission stage). Triggers are open
     and tab focus. Explicit Focus Mode or paired rail selection overrides
     sticky Agent
     ([Grilling: Focus Mode auto-switch on open work](https://github.com/xamdxlonewolf/apex_pilot/issues/73)).
   - **Layout Chrome** (App Menu View / shortcuts / Toolbar) shows, hides, and
     resizes Explorer, Inspector, Database Drawer, Mission, and Developer
     Console — secondary to Focus Mode; panel toggles are never primary IA.
     Console open/closed and drawer side prefs are profile-persisted; drawer and
     Mission open/closed are session-only.
   - **Mission** hosts timeline, mission card, plan/SQL/review/exec stages,
     composer, and history. Composer may ship with send disabled until Agent
     Core; stubs must be honest.
   - **Editors** use real Monaco code-editor surfaces (via `@monaco-editor/react`,
     not plain textareas) for SQL and common project languages (JS/TS, Python,
     CSS, etc.). Language ids are mapped in `frontend/src/editorLanguages.ts`
     (Oracle PL/SQL-ish extensions use Monaco `sql` until a dedicated grammar
     exists). Object / package / APEX / REST / diff viewers live in the Workspace
     as Spec surfaces mature.
5. **Inspector + Database Drawers:** Inspector remains stage-driven evidence
   chrome (Plan → Complete) as a slide-out Drawer. Database is a dedicated Drawer
   hosting schema browse. Both default closed; same-side mutual exclusion
   applies. The Inspector explains; it does not own execution or replace the SQL
   Editor / Database object browse.
6. **Bottom — Developer Console:** in-shell console region with tabs such as
   Problems, Output, MCP Activity, SQL History, Oracle Messages, Tasks. **MCP
   Activity is a Console tab**, not a floating-window product target. A temporary
   floating/overlay path may exist only as a migration stub until the console
   region ships.
7. **Connection / mappings:** connection switcher, Working Schema, and
   Environment identity belong in the Product Header Context Bar role and
   connection/profile UX (`DS-CONN`, connection wizard / preferences). Env →
   SQLcl / APEX workspace mappings remain a product capability hosted there —
   not as a forever right tab.
8. **Persistence:** profile-scoped layout prefs and project-scoped open tabs may
   start in local desktop storage and later move into SQLite without changing the
   UX contract.
9. **Close project** returns to the picker with an unsaved-work prompt when the
   SQL Editor or other editors have dirty state. One project per window (no
   multi-project concurrent open; Cursor agent project list is inspiration for
   Explorer FS craft only).
10. **Implementation strategy:** IA first toward figure_1 / figure_2, then visual
    polish gated by design skills. Screen/shell-first Spec layout, with design
    tokens and shared components growing as screens need them. Exact pixel-match
    to figure_1 / figure_2 is not a gate for first shell IA PRs; visual intent
    and IA are.
11. **Stub and gap-marking conventions** (locked by
    [Grilling: Lock stub copy and gap-marking conventions](https://github.com/xamdxlonewolf/apex_pilot/issues/19);
    Roadmap **UI-9** applies them across layout):
    - **Primary user copy:** exactly `Not implemented yet`.
    - **Optional secondary:** one short line naming the missing dependency or
      capability when it reduces confusion. No ship dates, no fake progress.
    - **Chrome badge:** exactly `Stub` on the hosting chrome (section title,
      tab, dialog title, etc.) when a Spec surface is present but unfinished.
    - **Interactive controls:** keep Spec layout; **progressive enablement** —
      enable actions when real preconditions exist; stub/disable only when the
      capability itself is missing. Never fake a successful run.
    - **No fake data:** no sample rows, fake SQL results, or mock success
      timelines. Real in-flight loading (spinners/skeletons) is not a stub.
    - **Planning IDs:** `DS-*` / `UI-*` stay in docs, tickets, and code comments
      — never in user-visible stub UI.
    - **Migration / interim:** a still-working old path (e.g. floating MCP until
      Developer Console) is not badged Stub; document the migration in ADR /
      Roadmap only. Non-functional placeholders use Stub conventions.
    - **Gap (docs only):** if a Design Spec surface has no clear Roadmap / PR
      path, mark it in planning docs with a `Gap:` line citing the stable
      `DS-*` id, add or update the owning UI-* / PR item, and keep it under an
      explicit Gaps / orphans subsection until claimed. Product UI still shows
      Stub once the surface is placed — never a user-visible Gap badge. Remove
      the Gap line once a path exists (the surface may remain Stub until built).
12. **Keyboard, density, and motion adoption** (locked by
    [Grilling: Keyboard, density, and motion adoption](https://github.com/xamdxlonewolf/apex_pilot/issues/24);
    split by concern, sequenced with UI-7 for design-system work):
    - **Keyboard (shell / early overhaul):** always-visible focus; Tab/arrow
      traversal of shell chrome and panels; core Spec General panel toggles
      (`Ctrl+\`` Developer Console, `Ctrl+B` Explorer, `Ctrl+Shift+I`
      Inspector, `Ctrl+Shift+M` Mission, `Ctrl+Shift+D` Database, and related
      shell toggles).
      Surface-specific shortcuts (Mission, SQL Editor, Explorer, Inspector,
      Console) ship with their owning features. Full “all shortcuts
      configurable” remains Spec Future.
    - **Command palette:** minimal palette is a shell-adjacent early ticket
      soon after Spec shell IA so `Ctrl+Shift+P` is real; it does **not** block
      the first shell IA PR. **Quick Open** (`Ctrl+P`) trails until file/object
      search exists.
    - **Density:** shell/layout PRs use Spec **Default** spacing only.
      Compact / Comfortable modes and the preference switcher are **UI-7**
      scope (typography unchanged per Spec). Figure craft density pass may
      follow once IA is in place.
    - **Motion (shell gates):** no decorative animation; panel resize immediate;
      prefer skeletons over spinners; respect `prefers-reduced-motion`.
    - **Motion (UI-7 / polish):** Spec duration table (hover/expand/collapse/
      dialogs/notifications) and panel/timeline choreography. Roadmap **UI-7**
      is the checklist owner for density modes, motion durations, and focus
      token polish.

### Historical interim (PR 9B.1 — superseded as target)

Shipped for sequencing, no longer the accepted Decision:

- Center chat composer; right shared tool tabs (Schema / SQL Sheet / Mappings /
  files); MCP Activity as a floating Tauri window (overlay in browser); in-app
  Project / View menubar without Product Header / App Menu / Activity Rail /
  Focus Modes.

## Consequences

### Positive

- Paper trail matches figure_1 / figure_2 and glossary before Agent Core hardens
  UI assumptions.
- Clear homes for dual-primary Workspace, Focus Modes, Activity Rail, hybrid
  Explorer, Product Header, App Menu, and real code editors.
- Observability stays in-shell and explainable beside Mission / Inspector.
- Progressive enablement and stage-driven Inspector keep unfinished Agent Core
  honest.

### Negative

- Frontend must migrate off the interim 9B.1 composition and earlier Spec-shell
  chrome that lacked rail / Focus Mode / Product Header detail.
- Many Spec surfaces will land as stubs before backend/Agent Core catch up.

### Risks

- Tauri plugin permissions must stay scoped to the project root for FS access.
- SQL Editor must never bypass `PROMPT`/`BLOCK` decisions from the classifier.
- Migration stubs (e.g. temporary floating MCP) must not be mistaken for the
  target UX in docs or Roadmap language.
- Editor library is Monaco (`@monaco-editor/react`); DB/APEX open-to-view detail
  remains a later decision — do not invent it in shell IA PRs without a ticket.

## Implementation Notes

- Keep `POST /sql/classify` and `POST /sql/run` for the SQL Editor path.
- Prefer `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` for pickers and
  tree reads.
- Do not auto-install prerequisites; keep guided preflight from ADR-0006.
- Do not enable Mission send until Agent Core; use honest stubs per Decision §11.
- Roadmap UI overhaul items (UI-0…UI-9) track Spec surfaces; **UI-9** is the
  apply-across-layout pointer to Decision §11 (not a second policy source).
- **UI-7** owns density modes, Spec motion duration table / choreography, and
  focus token polish per Decision §12; shell PRs still honor §12 keyboard and
  motion hard rules.
- Wizard chrome may grow richer per Design Spec without changing ADR-0006’s
  backend ownership of create/open/clone/preflight/mappings.
- Ownership matrix asset:
  `.scratch/ui-overhaul/app-menu-vs-product-header-ownership.md`.
- Gap inventory (live shell vs figures):
  `.scratch/ui-overhaul/figure-matching-gap-inventory.md`.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md)
- [ADR-0005](0005-local-project-manifest-and-sqlite-storage.md)
- [ADR-0006](0006-project-initialization-wizard-and-preflight.md)
- Wayfinder map: [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61)
