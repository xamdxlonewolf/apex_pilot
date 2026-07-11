## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Right pane is Inspector only: workflow progress, classification, object summaries, and checklists. Inspector explains rather than initiates work or owns execution. Schema and SQL are no longer permanent right-pane tool tabs; Mappings is not a forever Inspector tab (temporary prefs/connection stub is OK until the preferences ticket).

## Acceptance criteria

- [ ] Right pane is Inspector (not a Tools pane with Schema/SQL/Mappings tabs)
- [ ] Inspector shows progress / classification / summaries / checklist chrome (Stub where unfinished)
- [ ] Inspector does not initiate work or own SQL edit/execution
- [ ] Schema and SQL are not permanent right-pane tool tabs
- [ ] Mappings is not a forever Inspector tab
- [ ] Vitest asserts Inspector role and absence of SQL edit ownership on the right

## Blocked by

- PLACEHOLDER_BLOCKERS
