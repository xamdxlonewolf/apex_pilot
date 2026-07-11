## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Environment → SQLcl / APEX workspace Mappings live in connection / profile / preferences UX — not a forever Inspector tab. Profile-scoped layout prefs and project-scoped open tabs / session restore follow Spec intent (local desktop storage OK initially; UX contract stable if later moved to SQLite). Backend ownership of create/open/clone/preflight/mappings from ADR-0006 is unchanged.

## Acceptance criteria

- [ ] Mappings are reachable from connection / profile / preferences UX
- [ ] Mappings are not a permanent Inspector tab
- [ ] Profile-scoped layout prefs persist across sessions
- [ ] Project-scoped open tabs / Mission Control arrangement restore per Spec intent
- [ ] No change to ADR-0006 backend ownership of create/open/clone/preflight/mappings
- [ ] Vitest covers observable prefs/Mapping-home behavior in the shell

## Blocked by

- PLACEHOLDER_BLOCKERS
