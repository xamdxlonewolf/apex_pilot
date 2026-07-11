# Apex Pilot

Local-first Oracle development automation platform. This glossary is product
language only — not an implementation spec.

## Language

### Shell & surfaces

**Mission**:
The center workspace where the user states intent and follows plan / SQL /
review / execution stages with the agent. Primary interaction surface.
_Avoid_: Chat (as the product surface name), conversation app, messaging UI

**Inspector**:
The right-hand contextual evidence panel for workflow progress, classification,
object summary, and checklists. Explains; does not initiate work or own
execution.
_Avoid_: Tools pane, right tool tabs (as the target role)

**Explorer**:
The left multi-section navigator for project files, database, APEX, REST,
favorites, pinned, and recent objects.
_Avoid_: Files pane (as the whole left surface), file tree only

**Developer Console**:
The bottom in-shell observability region (Problems, Output, MCP Activity, SQL
History, Oracle Messages, Tasks, and related tabs).
_Avoid_: Floating MCP Activity window (as the product target)

**SQL Editor**:
The center workspace editor for authoring and running SQL. The only place SQL
may be edited.
_Avoid_: SQL Sheet (legacy interim name), hosting SQL edit in the Inspector

**Context Bar**:
The chrome strip for current connection, working schema, and environment
identity.
_Avoid_: Burying connection/schema only inside a right tools strip

**Toolbar**:
The always-on action chrome above the workspace regions (Spec shell).

**Stub**:
A Design Spec surface present in the real layout whose backend or feature is
not live yet — shown with honest unfinished affordances, never fake success.
_Avoid_: Coming soon, WIP badge, Beta (as the unfinished-surface label), Gap (as
a user-visible badge)

**Gap**:
A Design Spec surface with no clear Roadmap or PR ownership path — a planning
signal only, marked in Roadmap / PR notes until an owner exists.
_Avoid_: Showing Gap as product UI chrome; conflating Gap with Stub

### Workflow & connection

**Mission Control**:
The product framing for the dense IDE shell — Explorer, Mission, Inspector, and
Developer Console working together.
_Avoid_: Chat-first desktop (as product shape)

**Working Schema**:
The schema context currently selected for exploration and SQL work.

**Environment**:
A logical project environment (e.g. dev/test/prod identity) mapped locally to a
SQLcl saved connection — not the connection name itself.

**Mapping**:
Local binding of a logical environment to a SQLcl saved connection and optional
APEX workspace. Hosted in connection / profile / preferences UX — not a
permanent Inspector tab.
