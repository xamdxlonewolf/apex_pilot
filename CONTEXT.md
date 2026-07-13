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
The left multi-section navigator switched by the Activity Rail. Files posture
shows the real filesystem tree — local/git source of truth before objects are
pushed and compiled to the database. Database and APEX postures are separate
rail-selected bodies showing live (or summarized) objects that can be opened to
view. Not a single tree pretending to be both.
_Avoid_: Files pane (as the whole left surface); file tree only; logical-only
tree that hides the repo; FS-only Explorer with no database object browsing;
folding APEX into Database as one rail icon

**Activity Rail**:
The narrow left icon strip that switches Explorer posture — Files, Agent, Code,
Database, APEX, Review — and selectively pairs with Focus Mode. Agent, Files,
and Review set and reflect their matching Focus Modes; Code, Database, and APEX
change Explorer only (except that choosing them while in Review exits Review to
Agent). SQL has no rail icon; entering SQL leaves the current rail posture.
Project open lands on Agent rail with Agent Focus Mode. Required chrome in the
finished shell — not optional decoration.
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
that switches which peer has primacy without removing the other from the
product. Agent is Mission-forward (default when a project opens) with SQL and
File editors still present as peers; SQL and Files are editor-forward; Review
is for AI-generated SQL review posture. Agent is sticky when editors receive
focus; SQL and Files follow the active editor peer; focusing Mission restores
Agent; Review is entered only explicitly (App Menu, Focus Mode control, or
Review rail). Explicit Focus Mode or paired rail selection overrides sticky
Agent. Agent / Files / Review update the matching Activity Rail icon; SQL does
not. Primary way to change working posture; not the same as permanently hiding
regions as navigation.
_Avoid_: View menu as show/hide-only navigation; VS Code Views as the product
model; a single forever-fixed center layout; Mission Mode / Build Mode /
Investigation Mode / Presentation Mode (as Focus Mode names); minimizing
editors away in Agent mode; auto-leaving Agent on editor focus; auto-entering
Review from Mission stage; treating Code / Database / APEX rail as Focus Modes

**Layout Chrome**:
Power-user controls for showing, hiding, and resizing Explorer, Inspector, and
Developer Console. Secondary to Focus Mode and opening work in the Workspace.
_Avoid_: Treating panel toggles as the main View story

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

**Mission Control**:
The product framing for the dense IDE shell — Explorer, Workspace (Mission +
editors), Inspector, and Developer Console working together.
_Avoid_: Chat-first desktop (as product shape); VS Code–style “Views” that only
show/hide panels as the primary navigation model

**Working Schema**:
The schema context currently selected for exploration and SQL work.

**Environment**:
A logical project environment (e.g. dev/test/prod identity) mapped locally to a
SQLcl saved connection — not the connection name itself.

**Mapping**:
Local binding of a logical environment to a SQLcl saved connection and optional
APEX workspace. Hosted in connection / profile / preferences UX — not a
permanent Inspector tab.
