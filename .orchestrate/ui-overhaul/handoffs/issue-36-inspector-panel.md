<!-- orchestrate handoff
task: issue-36-inspector-panel
branch: orch/ui-overhaul/issue-36-inspector-panel
agentId: bc-9db80378-f8de-4728-b2cc-49cc457d4b9c
runId: run-941dfdb3-5f55-4855-b1b5-11595a207666
resultStatus: finished
finishedAt: 2026-07-11T22:45:03.613Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-36-inspector-panel`

## What I did
- Added `frontend/src/InspectorPanel.tsx` as a continuous right-pane Inspector with Stub chrome for Progress, Classification, Object summaries, and Checklist (plus a temporary Mappings prefs Stub until #39).
- Rewired `frontend/src/IdeWorkspace.tsx` so `ide-region--inspector` hosts only `InspectorPanel` (no Schema/SQL/Mappings tool tabs); file previews open in center workspace tabs.
- Updated `frontend/src/prefs.ts` to stop restoring mappings as Inspector tabs / `rightTools`.
- TDD: `InspectorPanel.test.tsx` + shell assertions in `App.test.tsx` for Inspector role, evidence chrome, and no SQL edit/run ownership on the right.
- Draft PR: https://github.com/xamdxlonewolf/apex_pilot/pull/55
- UI artifact: `/opt/cursor/artifacts/issue-36-inspector-panel/issue-36-inspector-panel.mp4` (also `inspector.png`; mirrored under `/workspace/artifacts/issue36/`)

## Measurements
- `pnpm test (frontend): 42 passing → 45 passing`
- `pnpm typecheck (frontend): exit 0 == exit 0`
- `Permanent Inspector tool tabs (Schema/SQL/Mappings): 1 → 0`
- `Inspector evidence sections (progress/classification/summaries/checklist Stub chrome): 0 → 4`
- `SQL edit ownership on right pane: 0 == 0`

## Verification
live-ui-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Builds on merged #31/#34 on `main`; Schema stays under Explorer Database and SQL stays in center tabs.
- Mappings remains only as a temporary Inspector Stub section (not a forever tab) until preferences/#39 relocates it.
- File open moved to center tabs so the right pane stays pure Inspector; #35/#42 can deepen center editors / object viewers without restoring tool tabs.
- `.orchestrate/` left intact; `artifacts/` untracked and not in the PR.

## Suggested follow-ups
- #39: move Mappings into connection/profile/preferences UX and remove the temporary Inspector Mappings Stub.
- #42: object viewers opened from Explorer without restoring a permanent Inspector Schema tab.
- Wire real Progress/Classification/Checklist evidence once Agent Core / Mission workflow lands.