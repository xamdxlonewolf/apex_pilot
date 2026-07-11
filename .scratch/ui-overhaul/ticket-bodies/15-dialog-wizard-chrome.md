## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Richer Spec dialog/wizard chrome for the connection wizard and related funnel surfaces improves UX without rewriting ADR-0006 backend contracts for create/open/clone/preflight/mappings.

## Acceptance criteria

- [ ] Connection wizard and related funnel dialogs use Spec dialog/wizard chrome
- [ ] Backend ownership of create/open/clone/preflight/mappings remains unchanged
- [ ] Offline / empty / degraded dialog states stay honest (Stub where unfinished; no fake success)
- [ ] Vitest covers observable dialog/wizard chrome behavior in the funnel

## Blocked by

- PLACEHOLDER_BLOCKERS
