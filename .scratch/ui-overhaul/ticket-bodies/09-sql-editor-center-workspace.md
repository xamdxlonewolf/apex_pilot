## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

SQL Editor lives only in center workspace tabs — never edited in the Inspector. Existing classify / prompt / block behavior and explainability remain beside Inspector evidence and Console activity once those exist. No new SQL execution paths.

## Acceptance criteria

- [ ] SQL Editor is hosted in center workspace tabs only
- [ ] SQL is not editable from the Inspector / right pane
- [ ] Classify / prompt / block explainability is preserved for SQL Editor paths
- [ ] No new SQL execution path; still through existing guarded façades
- [ ] Vitest asserts SQL Editor location and safety explainability that can run in jsdom

## Blocked by

- PLACEHOLDER_BLOCKERS
