<!-- orchestrate handoff
task: issue-32-mission-composer-stub
branch: orch/ui-overhaul/issue-32-mission-composer-stub
agentId: bc-584342b8-7880-4fe3-9d4a-e1c8b3d0d966
runId: run-0151f99d-db0d-46e7-8fec-0289413f1776
resultStatus: finished
finishedAt: 2026-07-11T21:47:55.905Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-32-mission-composer-stub`

## What I did
- Added `frontend/src/MissionComposer.tsx`:
  - New Mission-first center surface using `StubSurface` (badge `Stub`, primary copy `Not implemented yet`).
  - Added a Mission composer form (`aria-label="Mission composer"`) with textarea and `Send`.
  - Wired `Send` to `stubActionProps()` so it is explicitly disabled with honest stub treatment.
- Updated `frontend/src/IdeWorkspace.tsx`:
  - Replaced Mission region render from `<ChatPane .../>` to `<MissionComposer .../>`.
  - Kept Explorer / Inspector / Console structure unchanged.
- Updated `frontend/src/App.test.tsx` (TDD):
  - Replaced prior “interim Chat” assertions with Mission assertions:
    - Mission region is Mission (not Chat framing),
    - Stub treatment is present,
    - forbidden/fake copy is absent,
    - Mission composer is present,
    - Send is disabled with title `Not implemented yet`.
  - Verified red-to-green transition on this test path.
- Updated `frontend/src/styles.css`:
  - Extended composer styling selectors to include `.mission-composer` alongside existing composer styles.
- Captured UI artifact:
  - `/tmp/cursor/artifacts/issue-32-mission-composer-stub/issue-32-mission-composer-stub.mp4`

## Measurements
- `src/App.test.tsx (targeted run) failing tests: 1 → 0`
- `frontend vitest suite: 29 passing == 29 passing`
- `frontend typecheck errors: 0 == 0`

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Ran required verification commands successfully:
  - `cd frontend && pnpm install`
  - `cd frontend && pnpm test`
  - `cd frontend && pnpm typecheck`
- Mission region no longer uses Chat product framing and has no fake success/mock streaming copy.
- Screen recording artifact was generated from scripted Playwright-driven UI state and exported as MP4 at the path above.

## Suggested follow-ups
- Add a dedicated `MissionComposer.test.tsx` unit test to keep Mission-surface behavior isolated from broader `App.test.tsx` coverage as Mission evolves.