## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

With a project open, Apex Pilot shows Mission Control chrome and region identity: menu bar, toolbar, Context Bar, status bar, health indicators, and the four named regions — Explorer | Mission / workspace | Inspector | Developer Console. Startup funnel → workspace handoff from ADR-0006 stays intact. Default density and motion hard rules apply. Exact figure pixel-match is not a gate. Interim content may still live in the wrong hosts; region names and chrome identity are correct.

## Acceptance criteria

- [ ] Open-project workspace exposes Explorer, Mission/workspace, Inspector, and Developer Console regions by accessible name/role
- [ ] Toolbar and Context Bar are present (connection, Working Schema, Environment identity fields)
- [ ] Menu bar and status bar remain; status/health copy does not claim live agent or SQL success that did not occur
- [ ] Health indicators for backend / MCP / connection are glanceable in shell chrome
- [ ] Funnel → workspace handoff still works (silent health → preflight when needed → profile when needed → picker → workspace)
- [ ] Default density only; motion hard rules (no decorative animation, immediate resize, skeletons preferred, prefers-reduced-motion)
- [ ] Vitest App-shell coverage asserts region presence/names without relying on CSS class names or figure pixel-match

## Blocked by

- None — can start immediately
