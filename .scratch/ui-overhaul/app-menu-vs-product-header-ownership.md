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
| **App Menu → File** | New / Open / Recent / Close Project; Settings |
| **App Menu → Edit** | Undo / Redo / Cut / Copy / Paste / Select All (focused Workspace editor) |
| **App Menu → View** | Focus Modes (Agent / SQL / Files / Review); Layout Chrome toggles (Explorer, Inspector, Developer Console; Mission as power-user layout only); Focus MCP Activity in Developer Console |
| **App Menu → Help** | About; docs / repo link; Keyboard Shortcuts (or Show Command Palette); **Check for updates…** |
| **Product Header** | Single top band: brand, project, Environment, health, Context Bar pickers + Connect/reconnect, Settings gear |
| **Toolbar** | New SQL, Run (progressive enablement); optional MCP console-focus shortcut |
| **Command Palette** | Lists all shell actions that already have a chrome or App Menu home |
| **Removed** | Permanent in-app Project / View menu button groups |

## Context Bar

**Context Bar** is a *role* (connection, Working Schema, Environment pickers),
hosted **inside** the Product Header — not a second stacked chrome strip.

## Check for updates

Help → **Check for updates…** opens one **Updates** dialog with per-component
rows (Application, Oracle system skills, …). Exact updatable inventory is fog
for a later ticket; this decision only locks the entry point and multi-item
dialog pattern.

## Explicit non-goals (this ticket)

- Activity Rail ↔ Focus Mode pairing chrome (sibling grilling ticket)
- Implementing native Tauri menus / Product Header UI (task ticket)
- Full Updates dialog component list
