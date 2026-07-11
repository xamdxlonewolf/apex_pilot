<!-- orchestrate handoff
task: issue-30-explorer-project-files
branch: orch/ui-overhaul/issue-30-explorer-project-files
agentId: bc-647ee49b-7f28-40e9-ad8b-0931cbd14235
runId: run-cd9c213d-2f17-49cb-bf13-86d466ee2b87
resultStatus: finished
finishedAt: 2026-07-11T21:50:36.932Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-30-explorer-project-files`

## What I did
- Completed issue #30 Explorer files behavior in frontend with TDD, building on the existing partial work from PR #47.
- Updated `frontend/src/projectFs.ts`:
  - Expanded junk detection to hide dot-clutter and common build/cache artifacts by default (e.g. `.env`, `.cache`, `.next`, `.nuxt`, `.turbo`, `out`, `tmp`, etc.).
  - Kept protected-entry logic intact so APEX export folders and root `f*.sql` remain visible even when junk is hidden.
- Updated `frontend/src/FileTree.tsx`:
  - Added explicit protected/read-only markers for protected items in the files region (including APEX export folders and root `f*.sql` files).
  - Preserved browser-fallback compatibility used in Vite/jsdom tests.
- Extended `frontend/src/FileTree.test.tsx`:
  - Added/expanded failing-first tests for dot-clutter junk filtering, protected visibility, read-only markers, and show-junk toggle behavior under browser fallback.
  - Verified behavior through browser-fallback fixtures (`installBrowserProjectFs`).
- Ran required verification from `frontend/`: `pnpm install`, `pnpm test`, `pnpm typecheck` (all passing).
- Captured UI artifact for the interactive fix: `/workspace/artifacts/issue30/issue30-explorer-before-after.mp4` (plus source frames in same folder).
- Committed and pushed changes; opened draft PR to `main` (PR #51).

## Measurements
- `FileTree.test.tsx (targeted TDD run): 3 failing → 3 passing`
- `pnpm test (frontend): 29 passing == 29 passing`
- `pnpm typecheck (frontend): exit 0 == exit 0`
- `Explorer fixture visible entries with junk hidden vs shown: 3 → 7`

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- No files under `apex/**`, `backend/**`, or root `f*.sql` were modified.
- `.orchestrate/` was not modified.
- Recording artifact files are left untracked under `artifacts/` and were not added to the commit.
- Draft PR created: https://github.com/xamdxlonewolf/apex_pilot/pull/51

## Suggested follow-ups
- Consider adding a dedicated shared helper/test utility for Explorer fixture trees so upcoming UI-overhaul issues can reuse consistent protected/junk scenarios.
- Consider documenting the protected marker copy/style contract (e.g., “protected” + “read-only”) in the UI spec to keep issue-to-issue behavior consistent.