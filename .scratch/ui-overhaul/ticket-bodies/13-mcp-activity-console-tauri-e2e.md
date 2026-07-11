## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

MCP Activity becomes an in-shell Developer Console tab; floating/overlay MCP is retired as the product path after migration. Introduce the lightest Tauri-capable e2e harness the repo can sustain and cover native shell smoke plus this MCP → Console migration. Vitest continues to own jsdom/browser-fallback paths. No standalone Playwright or figure pixel-match suites.

## Acceptance criteria

- [ ] MCP Activity is available as a Developer Console tab
- [ ] Floating/overlay MCP is no longer the product target after migration
- [ ] Light Tauri e2e harness exists with high-value smoke for native shell and MCP → Console migration
- [ ] Machine-local prerequisites for Tauri e2e are documented or gated so CI policy stays explicit
- [ ] Vitest still covers jsdom Console/MCP presentation paths

## Blocked by

- PLACEHOLDER_BLOCKERS
