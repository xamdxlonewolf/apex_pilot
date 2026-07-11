<!-- orchestrate handoff
task: issue-33-mission-timeline-stage
branch: orch/ui-overhaul/issue-33-mission-timeline-stage
agentId: bc-6772248f-2dbe-4ca7-905c-3c3f1a475575
runId: run-539ca12d-d677-49b9-8673-2a985bcd0977
resultStatus: finished
finishedAt: 2026-07-11T23:22:26.969Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-33-mission-timeline-stage`

## What I did
- Extended `frontend/src/MissionComposer.tsx` with Spec Mission IA chrome: mission card, Plan/SQL/Review/Exec stage chrome on a timeline, history layout (Recent/Today/Yesterday/Earlier), and the existing docked composer with disabled Send — all Stub-honest (no fake success/streaming).
- Added TDD coverage in `frontend/src/MissionComposer.test.tsx` for stage chrome presence and Stub honesty.
- Styled the new Mission layout in `frontend/src/styles.css`.
- Draft PR: https://github.com/xamdxlonewolf/apex_pilot/pull/58
- UI recording: `/tmp/cursor/artifacts/issue-33-mission-timeline-stage/issue-33-mission-timeline-stage.mp4`

## Measurements
- `frontend vitest suite: 56 passing → 58 passing`
- `frontend typecheck errors: 0 == 0`
- `Mission timeline aria region: 0 → 1`
- `Mission card aria region: 0 → 1`
- `Mission history aria region: 0 → 1`
- `Plan/SQL/Review/Exec stage chrome labels: 0 → 4`
- `MissionComposer.test.tsx cases: 0 → 2 passing`

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Stage labels are short Spec-intent chrome (`Plan` / `SQL` / `Review` / `Exec`); statuses stay `Not started` / `Waiting for Agent Core` / `—` — no completed mock timeline events.
- History buckets render empty (“No missions yet”) under Stub badge + `Not implemented yet`.
- Did not touch Explorer/Inspector/Console or the center tab host; Mission remains the center `mission` tab content.
- `.orchestrate/` left untouched in the PR diff.
- Live UI recording captured against Vite + mocked `/projects/current`; strongest automated evidence remains Vitest.

## Suggested follow-ups
- When Agent Core lands, attach real mission identity to the card, stream events into the timeline stages, and hydrate history selection → timeline restore.
- Planner can merge PR #58 after verify, then continue dependents that assume Mission stage IA.