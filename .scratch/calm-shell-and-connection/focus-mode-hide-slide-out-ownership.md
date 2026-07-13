# Focus Mode hide/show + slide-out ownership

Resolution asset for
[Grilling: Focus Mode hide/show + slide-out ownership](https://github.com/xamdxlonewolf/apex_pilot/issues/115)
(map: [Wayfinder: Ship calm Focus shell](https://github.com/xamdxlonewolf/apex_pilot/issues/113)).

Implements via
[Task: Wire Focus hide + slide-out drawers](https://github.com/xamdxlonewolf/apex_pilot/issues/120)
and follow-up
[Task: Dock drawers + console dismiss + rail open semantics](https://github.com/xamdxlonewolf/apex_pilot/issues/129).

## Mission visibility by Focus Mode

| Focus Mode | Mission default | Notes |
| --- | --- | --- |
| Agent | Visible peer | Primacy story |
| Review | Visible peer | Primacy story |
| SQL | Hidden | Editor-forward; user can show/dismiss |
| Files | Hidden | Editor-forward; user can show/dismiss |

- Defaults only — never a hard lock. User can always show Mission and dismiss it again via Layout Chrome / Focus controls.
- **Session override (per Focus):** On first entry to a Focus Mode in the session, apply the default. After the user shows or hides Mission in that Focus, remember that choice until session end. Switching away and back restores the override, not the bare default.
- Open/closed for Mission is **not** profile-persisted.

## Peers vs drawers

| Surface | Role |
| --- | --- |
| Activity Rail | Always present chrome |
| Editors (Workspace) | Always peers when a project is open |
| Mission | Peer when visible; not a drawer |
| Explorer | **Peer in Files Focus**; **docked drawer elsewhere** (same column UI — open/closed by Focus, not two looks) |
| Inspector | Docked drawer — starts **closed** in all four Focus Modes |
| Database | **Dedicated docked drawer** (not an Explorer posture, not Files\|Database tabs) |
| APEX | Remains **Explorer posture** for this map (dedicated drawer deferred) |
| Developer Console | **Layout Chrome only** — docked bottom show/hide/resize, not a side drawer |

**Dock, don't overlay:** Explorer (outside Files), Inspector, and Database are **push docks** in the shell body grid — they take layout width and shrink Mission/Editors. Short slide on open is fine; honor `prefers-reduced-motion`. They must not cover the primary workspace.

## Database drawer

- Separate surface from Explorer so Files (peer tree) and Database objects can be available together.
- Activity Rail → Database **opens/focuses** the Database drawer (does not replace Explorer with a Database body).
- APEX continues to use Explorer via the rail for this map.

## Default sides and conflicts

| Drawer | Default side |
| --- | --- |
| Explorer | Left |
| Inspector | Right |
| Database | Right |

- User may flip side **per drawer**.
- **Same-side mutual exclusion:** If Inspector and Database share a side, opening one dismisses the other. If they are on different sides, both may stay open.
- Explorer on the left does not exclude Database on the right.

## Persistence

- **Side preferences:** profile-scoped, one per drawer (Explorer / Inspector / Database). Matches ADR-0007 layout prefs.
- **Open/closed:** session-only for drawers and for Mission overrides.

## Open affordances

| Surface | Primary open | Also |
| --- | --- | --- |
| Explorer peer (Files) | Activity Rail → Files | Layout Chrome → Explorer |
| Explorer dock (Agent/SQL/Review) | Activity Rail → Agent / Review / Code / APEX | Layout Chrome → Explorer |
| Database drawer | Activity Rail → Database | Layout Chrome → Database |
| Inspector | Layout Chrome → Inspector | Optional compact header/toolbar control only if it already fits — do not invent a second rail |
| Mission (when hidden) | Layout Chrome / Focus controls (“Show Mission”) | |
| Developer Console | Layout Chrome / `Ctrl+\`` / Console close control | MCP Activity / View MCP **toggles** open↔closed (opens to MCP tab) |

**Rail open semantics:**

| Rail | Effect |
| --- | --- |
| Files | Files Focus + Explorer open (peer) |
| Agent / Review | Switch Focus + open Explorer dock to that posture |
| Code / APEX | Open Explorer dock to that posture (Explorer-only; no Focus change unless leaving Review). Rail highlight stays on Code/APEX — Focus→rail sync must not rewrite it to Agent. |
| Database | Open Database dock |

**Focus transition:** Leaving Files (Explorer peer) for Agent / SQL / Review applies Focus defaults (Explorer **closed** for Agent/SQL/Review). Rail selection that targets Explorer re-opens it to the chosen posture.

## Dismiss affordances

Applies to Explorer drawer, Inspector, Database, and to Mission when user-shown in SQL/Files:

1. Explicit **close control** on the surface chrome
2. **Escape** closes the focused / topmost drawer (or Mission when its chrome is focused)
3. **Toggle** the same open affordance again
4. **Not** click-outside-to-dismiss on the Workspace

## Layout Chrome additions

Beyond existing Explorer / Inspector / Console toggles, Layout Chrome (and Focus controls as appropriate) must expose:

- Show / hide **Mission**
- Show / hide **Database** drawer

## Explicitly deferred

- Dedicated **APEX** drawer (Explorer posture for now)
- Persisting open/closed drawer or Mission state across sessions
- Stacking two drawers on the same side
- Click-outside dismiss
- Turning Developer Console into a drawer

## Visual motion

Slide-in/out craft and reduced-motion behavior remain owned by
[Grilling: Calm shell visual direction](https://github.com/xamdxlonewolf/apex_pilot/issues/114)
(`.scratch/calm-shell-and-connection/calm-shell-visual-direction.md`).
