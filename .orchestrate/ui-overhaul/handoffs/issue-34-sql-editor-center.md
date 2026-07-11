<!-- orchestrate handoff
task: issue-34-sql-editor-center
branch: orch/ui-overhaul/issue-34-sql-editor-center
agentId: bc-acddc0a6-c04f-4737-bf27-d59b60e0343b
runId: run-6619bcce-2547-438f-88d7-857466c32b76
resultStatus: finished
finishedAt: 2026-07-11T22:02:13.018Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-34-sql-editor-center`

## What I did
- Added failing-then-green Vitest coverage in `frontend/src/App.test.tsx` (SQL Editor only in center workspace tabs; absent from Inspector) and `frontend/src/SqlSheet.test.tsx` (allow / prompt / block explainability + `/sql/run`-only path).
- Updated `frontend/src/IdeWorkspace.tsx` so the Mission region hosts **Center workspace tabs** (Mission + SQL Editor); removed SQL from the Inspector tab strip; Schema / Mappings / file previews stay in Inspector.
- Adjusted `frontend/src/prefs.ts` for `mission` tab kind, dual active-tab ids, and Inspector `rightTools` without SQL; nested Mission composer via `frontend/src/MissionComposer.tsx` + `styles.css`.
- Draft PR: https://github.com/xamdxlonewolf/apex_pilot/pull/52
- UI recording: `/tmp/cursor/artifacts/issue-34-sql-editor-center/issue-34-sql-editor-center.mp4`

## Measurements
- `frontend vitest suite: 31 passing → 36 passing`
- `frontend typecheck errors: 0 == 0`
- `SQL Editor hosted in center workspace tabs: 0 → 1`
- `SQL editable from Inspector/right pane: 1 → 0`
- `SqlSheet explainability tests (allow/prompt/block + /sql/run-only): 0 → 4 passing`

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Center column keeps region `aria-label="Mission"` (existing chrome tests) and now contains a center tab strip; Mission remains the default active center tab.
- Saved project tabs migrate: SQL moves to center; Mission/SQL/Schema/Mappings are ensured if missing from older localStorage state.
- No backend / APEX / `f*.sql` changes; SQL still goes only through existing `runSql` façade.
- Live UI recording captured against Vite + mocked backend routes; strongest automated evidence remains Vitest.

## Suggested follow-ups
- Issue #33 (Mission enhancements) can layer on the new center tab host without relocating SQL again.
- Issue #35+ center editor kinds can extend `CENTER_TAB_KINDS` / `WorkspaceTabKind` beside SQL/Mission.