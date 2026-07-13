# App Menu vs Product Header ownership

Resolved by [Grilling: App Menu vs Product Header ownership](https://github.com/xamdxlonewolf/apex_pilot/issues/64)
on [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61).

Glossary terms: `CONTEXT.md` (Product Header, App Menu, Toolbar, Context Bar,
Command Palette, Layout Chrome, Focus Mode).

## Principle

- Native **App Menu** owns discoverable OS-standard and project-lifecycle
  actions.
- In-app **Project / View menubar button groups go away** once App Menu ships.
- **Product Header** is one dense top identity/status band (not menu-as-IA).
- **Toolbar** is frequent workflow verbs only.
- **Command Palette** discovers everything; never exclusive home.
- **View show/hide** is Layout Chrome only — not primary IA (Focus Mode is).

## Ownership matrix

| Home | Owns |
| --- | --- |
| **App Menu → File** | New / Open / Recent / Close Project (no Settings — header gear only) |
| **App Menu → Edit** | Undo / Redo / Cut / Copy / Paste / Select All (focused Workspace editor) |
| **App Menu → View** | Focus Modes (Agent / SQL / Files / Review); Layout Chrome toggles (Explorer, Inspector, Developer Console; Mission as power-user layout only); Focus MCP Activity in Developer Console |
| **App Menu → Help** | About; docs / repo link; Keyboard Shortcuts (or Show Command Palette); **Check for updates…**; **Compare project to database…** (Stub entry on-map; live compare later) |
| **Product Header** | Single top band: brand, project, Environment, Backend health pill, Context Bar pickers + Connect/reconnect, Settings gear. No connection-name or MCP health pills (see connection-density asset) |
| **Toolbar** | New SQL, Run (progressive enablement); optional MCP console-focus shortcut; no Settings |
| **Command Palette** | Lists all shell actions that already have a chrome or App Menu home |
| **Removed** | Permanent in-app Project / View menu button groups; App Menu File → Settings (moved to header-only) |

## Context Bar

**Context Bar** is a *role* (connection, Working Schema, Environment pickers),
hosted **inside** the Product Header — not a second stacked chrome strip.

## Connection / Settings / MCP density

Locked by
[Grilling: Product Header connection density](https://github.com/xamdxlonewolf/apex_pilot/issues/92)
(UX review H1 + M4). Full cue table:
`.scratch/ui-overhaul/product-header-connection-density.md`.

Summary: Context Bar select + Connect is the only connection-name control;
drop header connection and MCP health pills; status bar keeps short `DB:`;
Settings is Product Header only; MCP lives in Console with Toolbar + View
focus shortcuts.

## Check for updates

Help → **Check for updates…** opens one **Updates** dialog with per-component
rows. Inventory locked by
[Grilling: Updates dialog updatable inventory](https://github.com/xamdxlonewolf/apex_pilot/issues/84):

1. **Application** (shell + bundled backend as one unit)
2. **Oracle system skills** (sparse `apex/` + `db/` checkout)
3. **Prerequisites:** SQLcl, Java, OS (status/check when wired; no JDK install
   from Apex Pilot — guided fix stays preflight)

Stub-honest until wired; per-row Check disabled until real; footer Close only.
Git/DB drift is **not** an Updates row (separate sync surface).

## Browser App Menu presentation

Locked by
[Grilling: Browser App Menu presentation](https://github.com/xamdxlonewolf/apex_pilot/issues/91)
(UX review B1):

- **BrowserAppMenu** (Vite / tests / non-Tauri) ships as a true **dropdown
  menubar**: only **File | Edit | View | Help** visible until opened — never a
  flat horizontal expansion of every menuitem.
- **Native Tauri App Menu** remains the IA source of truth; browser fallback
  mirrors that shape (same items, separators, enablement).
- **Top-level** open/switch is **click-only** (no hover-to-open or
  hover-to-switch among File / Edit / View / Help). Escape and outside-click
  close.
- **Nested submenu cascades** may open on hover **when IA actually has them**.
  Do not invent nests for their own sake (today View stays one flat dropdown
  with separators, matching native). Keep the interaction ready for cascades if
  IA adds them later.
- Implement as a follow-on Task (B1), not in this grilling.

## Explicit non-goals (this ticket)

- Activity Rail ↔ Focus Mode pairing chrome (sibling grilling ticket)
- Implementing native Tauri menus / Product Header UI (task ticket)
- Wiring real update checkers (later tasks once inventory is locked)
- ~~Implementing dropdown BrowserAppMenu chrome~~ — shipped in
  [Task: BrowserAppMenu dropdown menubar (B1)](https://github.com/xamdxlonewolf/apex_pilot/issues/102)
