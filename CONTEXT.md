# Apex Pilot

Local-first Oracle development automation platform. This glossary is product
language only — not an implementation spec.

## Language

### Shell & surfaces

**Workspace**:
The dual-primary center of the open project — a shared focus area for Mission
and editors (SQL and other project files). Neither Mission nor editors are
demoted to secondary chrome.
_Avoid_: Single primary surface, chat-only center, editor-only IDE without agent

**Mission**:
The agent workflow surface in the Workspace where the user states intent and
follows plan / SQL / review / execution stages with the agent. A peer to
editors, not the sole center of gravity.
_Avoid_: Chat (as the product surface name), conversation app, messaging UI,
primary interaction surface (as exclusive claim)

**Inspector**:
The right-hand contextual evidence panel for workflow progress, classification,
object summary, and checklists. Explains; does not initiate work or own
execution. Content is stage-driven for the active Mission (Plan → SQL Generated
→ Review → Execute → Complete) rather than a static stub accordion. Before Agent
Core, stages may ship as honest chrome with empty or stub evidence — never fake
plans, SQL, or successful execution.
_Avoid_: Tools pane, right tool tabs (as the target role); always-identical
Inspector chrome regardless of Mission stage; demo data that looks like a real
run

**Explorer**:
The filesystem-and-posture navigator for Files, Agent, Code, APEX, and Review
bodies switched by the Activity Rail. In Files Focus Mode it is a visible
Workspace peer; in Agent, SQL, and Review it is a Drawer. Not a single tree
pretending to be both files and database objects — Database browse is its own
Drawer.
_Avoid_: Files pane (as the whole left surface); file tree only; logical-only
tree that hides the repo; FS-only Explorer with no object browsing elsewhere;
folding Database into Explorer tabs; folding APEX into Database as one rail icon

**Database Drawer**:
The dedicated slide-out surface for live (or summarized) database object browse,
opened by the Database Activity Rail item. Separate from Explorer so the file
tree and DB objects can be available together. Default side is right; user may
flip side.
_Avoid_: Database as only an Explorer posture; Files|Database tabs inside
Explorer; a second permanent column that never dismisses

**Drawer**:
A secondary tool surface that slides in on demand and dismisses easily — not
permanent layout chrome. Explorer (except in Files Focus), Inspector, and the
Database Drawer are Drawers; Mission when shown is a Workspace peer, not a
Drawer; Developer Console is Layout Chrome, not a Drawer.
_Avoid_: Permanent side panels for secondary tools; click-outside dismiss as the
primary close model; stacking multiple Drawers on the same side

**Activity Rail**:
The narrow left icon strip that switches working posture — Files, Agent, Code,
Database, APEX, Review — and selectively pairs with Focus Mode. Agent, Files,
and Review set and reflect their matching Focus Modes; Code and APEX change
Explorer only (except that choosing them while in Review exits Review to Agent);
Database opens the Database Drawer. SQL has no rail icon; entering SQL leaves
the current rail posture. Project open lands on Agent rail with Agent Focus
Mode. Required chrome in the finished shell — not optional decoration.
_Avoid_: Relying only on in-panel section tab buttons as the long-term nav model;
tight 1:1 rail≡Focus Mode; rail icons that never sync with Focus Mode; Bookmarks
or History as v1 rail icons

**Developer Console**:
The bottom in-shell observability region (Problems, Output, MCP Activity, SQL
History, Oracle Messages, Tasks, and related tabs).
_Avoid_: Floating MCP Activity window (as the product target)

**SQL Editor**:
A Workspace editor for authoring and running SQL. The only place SQL may be
edited. Uses a real code-editor surface (not a plain textarea) shared with other
Workspace editors.
_Avoid_: SQL Sheet (legacy interim name), hosting SQL edit in the Inspector;
textarea-as-editor as the finished product

**Database Source Document**:
A compile-capable SQL Editor document for editable source of an Oracle schema
object. It may originate from a local project file or a live database object;
its local saved state and database compilation state are distinct.
_Avoid_: Separate Object Editor or Package Editor products; treating Save as
Compile; automatic compilation

**File Editor**:
A Workspace editor for non-SQL project files (for example JavaScript, TypeScript,
Python, CSS, and related sources) opened from the project. Same real code-editor
fidelity as the SQL Editor for common languages.
_Avoid_: Treating only SQL as editable; forcing non-SQL work outside Apex Pilot;
second-class editors for non-SQL files

**Context Bar**:
The connection, Working Schema, and Environment picker *role* hosted inside the
Product Header — not a second stacked chrome strip under it.
_Avoid_: Burying connection/schema only inside a right tools strip; a permanent
second top strip that duplicates Product Header density

**Product Header**:
The single dense top identity/status band toward the figure_1 north star —
brand, project, Environment, Backend health, Context Bar pickers, and Settings —
not a classic Project/View menu strip as the primary way to navigate the shell.
Replaces the interim in-app menubar once the native App Menu ships. Connection
identity lives only in the Context Bar role (select + Connect); Settings lives
only here (not in the App Menu).
_Avoid_: VIEW menu as show/hide-only navigation; VS Code–style menu-as-IA;
permanent in-app Project/View menu button groups beside the header; restating
the connection name or MCP status as header health pills

**App Menu**:
The native desktop application menu (File, Edit, View, Help, and related) hosted
by the Tauri shell. Owns discoverable OS-standard and project-lifecycle actions
so in-app chrome can stay a Product Header + Toolbar. View holds Focus Mode
entries and Layout Chrome (panel show/hide); panel toggles are never primary IA.
Settings is not an App Menu item — Product Header gear is its home.
_Avoid_: Duplicating every App Menu action as permanent in-app menu buttons;
treating View show/hide as the main navigation model; File → Settings when the
header already owns Settings

**Toolbar**:
The always-on action chrome for frequent workflow verbs (New SQL, Run), with
progressive enablement, plus an optional MCP Activity console-focus shortcut.
Not for project lifecycle, Settings, or identity pickers.
_Avoid_: Parked Connect / Settings / project Open as permanent Toolbar buttons
when those belong in Product Header or Context Bar role

**Command Palette**:
The power-user index (Ctrl+Shift+P) that discovers and runs shell actions which
already have an App Menu, Product Header, Toolbar, or Layout Chrome home.
Universal discoverability — never the exclusive home for a product affordance.
_Avoid_: Hiding missing chrome by shipping actions only in the palette

**Focus Mode**:
One of four named Workspace arrangements — Agent, SQL, Files, or Review —
that switches which peer has primacy and which secondary surfaces start hidden
or off-stage as Drawers. Agent is Mission-forward (default when a project opens)
with editors still present as peers; SQL and Files are editor-forward with
Mission hidden by default (user may show and dismiss it); Review is for
AI-generated SQL review posture with Mission visible. Primacy is readable beyond
layout ratio: the secondary peer is visually de-emphasized while remaining fully
usable, and the primacy peer uses a light header accent. Agent uses a light
secondary dim; Review uses a stronger dim and quiet Review meta on the Mission
header; SQL and Files use a slightly stronger editor-forward ratio. Agent is
sticky when editors receive focus; SQL and Files follow the active editor peer;
focusing Mission restores Agent; Review is entered only explicitly (App Menu,
Focus Mode control, or Review rail). Explicit Focus Mode or paired rail
selection overrides sticky Agent. Agent / Files / Review update the matching
Activity Rail icon; SQL does not. Per-Focus Mission show/hide overrides last for
the session after the user changes them. Primary way to change working posture;
not the same as permanently hiding regions as navigation.
_Avoid_: View menu as show/hide-only navigation; VS Code Views as the product
model; a single forever-fixed center layout; Mission Mode / Build Mode /
Investigation Mode / Presentation Mode (as Focus Mode names); minimizing
editors away in Agent mode; auto-leaving Agent on editor focus; auto-entering
Review from Mission stage; treating Code / Database / APEX rail as Focus Modes;
relying on Mission↔Editors ratio alone; disabling the secondary peer; Review
looking identical to Agent side-by-side; locking Mission permanently off in
SQL/Files

**Layout Chrome**:
Power-user controls for showing, hiding, and resizing Explorer, Inspector,
Developer Console, Mission (when a Focus Mode hid it), and the Database Drawer.
Secondary to Focus Mode and opening work in the Workspace.
_Avoid_: Treating panel toggles as the main View story; omitting Mission or
Database show/hide

**Stub**:
A Design Spec surface present in the real layout whose backend or feature is
not live yet — shown with honest unfinished affordances, never fake success.
Actions use progressive enablement: enabled when real preconditions exist;
stubbed only when the capability itself is missing.
_Avoid_: Coming soon, WIP badge, Beta (as the unfinished-surface label), Gap (as
a user-visible badge); greying actions that could succeed with current
preconditions

**Gap**:
A Design Spec surface with no clear Roadmap or PR ownership path — a planning
signal only, marked in Roadmap / PR notes until an owner exists.
_Avoid_: Showing Gap as product UI chrome; conflating Gap with Stub

### Workflow & connection

**Connection Profile**:
The stable logical identity for one Oracle target. It may bind an interactive
application connection and a separate SQLcl saved connection for agent work;
each binding reports availability independently. An Environment selects a
Connection Profile.
_Avoid_: Treating a SQLcl saved connection name as the whole profile; making a
temporary UI surface own the connection lifetime

**Unconnected**:
A Database Source Document state with no live attached Connection Profile and
Working Schema target. Local save remains available; database actions require an
explicit attachment.
_Avoid_: Silently borrowing the current global connection or schema; disabling
local save because the database is unavailable

**Mission Control**:
The product framing for the dense IDE shell — Explorer, Workspace (Mission +
editors), Inspector, and Developer Console working together.
_Avoid_: Chat-first desktop (as product shape); VS Code–style “Views” that only
show/hide panels as the primary navigation model

**Working Schema**:
The schema context currently selected for exploration and SQL work.

**Environment**:
A logical project environment (e.g. dev/test/prod identity) that selects a
Connection Profile — not a connection name or live session itself.

**Mapping**:
Local binding of an Environment to a Connection Profile and optional APEX
workspace. The profile may independently bind interactive and SQLcl connection
paths. Hosted in connection / profile / preferences UX — not a permanent
Inspector tab.
