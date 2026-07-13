# Product Header connection density

Resolved by [Grilling: Product Header connection density](https://github.com/xamdxlonewolf/apex_pilot/issues/92)
on [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61).

UX review: H1 (connection cues) + M4 (Settings / MCP chrome homes).

Glossary terms: `CONTEXT.md` (Product Header, Context Bar, Toolbar, App Menu,
Command Palette).

## Locked cue homes

| Cue | Home |
| --- | --- |
| Connection **name** + change | Context Bar **select + Connect / Reconnect** only |
| Connection health pill (`Connected: {name}`) | **Removed** — Connect button owns connect state |
| Status bar DB | Short **`DB: {name}`** / **`DB: not connected`** (+ `· connecting…` while busy). No permanent “Connected to …” duplicate |
| MCP | Developer Console → MCP Activity owns the live surface; **Toolbar MCP Activity** + **App Menu → View** stay focus shortcuts; **no** Product Header MCP health pill |
| Settings | **Product Header gear only** — remove from App Menu → File (palette may still discover it) |
| Backend health | Keep **one** Product Header Backend health pill |

## Toolbar

New SQL, Run (progressive), optional MCP Activity console focus. No Settings.

## Implement

[Task: Product Header connection density (H1+M4)](https://github.com/xamdxlonewolf/apex_pilot/issues/104)
applies these chrome cuts in Product Header, status bar, App Menu / browser
menu, and tests. Do not invent a fourth MCP badge.
