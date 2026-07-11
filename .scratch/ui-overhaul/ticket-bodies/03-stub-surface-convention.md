## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Unfinished Spec surfaces use a single Stub convention from ADR-0007 §11: chrome badge Stub, primary copy exactly Not implemented yet, optional secondary copy naming the missing dependency, disabled non-working actions, and no sample rows / fake SQL results / mock success timelines. Working interim paths are not Stub-badged. Gap markings and DS-* / UI-* IDs stay out of product UI. Apply the convention to unfinished shell surfaces already present so later tickets reuse it.

## Acceptance criteria

- [ ] Shared Stub presentation exists and is reusable by later Mission Control surfaces
- [ ] Unfinished shell surfaces show Stub badge and Not implemented yet (optional dependency secondary copy allowed)
- [ ] Non-working stubbed actions are disabled (no fake-successful runs)
- [ ] No fake success data on Stubs; real in-flight loading is not labeled Stub
- [ ] Working interim paths (e.g. floating MCP until Console migration) are not Stub-badged
- [ ] Product UI never shows Gap badge or DS-* / UI-* planning IDs
- [ ] Vitest asserts Stub badge, copy, disabled actions, and absence of fake success data

## Blocked by

- PLACEHOLDER_BLOCKERS
