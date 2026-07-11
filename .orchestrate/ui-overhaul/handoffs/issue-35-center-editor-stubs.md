<!-- orchestrate handoff
task: issue-35-center-editor-stubs
branch: orch/ui-overhaul/issue-35-center-editor-stubs
agentId: bc-20ae318f-3f64-48ce-bf1a-4a1076ad302b
runId: run-eb0751c3-0afb-43fa-a60e-79930bde9747
resultStatus: finished
finishedAt: 2026-07-11T22:30:36.673Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-35-center-editor-stubs`

## What I did
- Added Vitest coverage in `frontend/src/App.test.tsx` for stub editor tab presence and dirty / cancelled / clean Close Project.
- Added `frontend/src/centerEditors.ts` catalog for object / package / APEX / REST / diff / file stub editors; extended `WorkspaceTabKind` + persistence in `frontend/src/prefs.ts`.
- Updated `frontend/src/IdeWorkspace.tsx` so center tabs host those stubs via `StubSurface` (Stub conventions); Explorer file previews move to center; Inspector keeps Mappings; command-palette-driven open requests supported.
- Fixed Close Project in `frontend/src/App.tsx` (previously dead while workspace was mounted): dirty SQL prompts, then returns to recent-projects picker; removed unused close effect from `StartupFunnel.tsx`.
- Draft PR: https://github.com/xamdxlonewolf/apex_pilot/pull/56
- UI recording: `/tmp/cursor/artifacts/issue-35-center-editor-stubs/issue-35-center-editor-stubs.mp4`

## Measurements
- `frontend vitest suite: 42 passing → 46 passing`
- `frontend typecheck errors: 0 == 0`
- `center stub editor kinds hosted (object/package/apex/rest/diff/file): 0 → 6`
- `Close Project returns to recent-projects picker when workspace open: 0 → 1`
- `dirty Close Project unsaved-work prompt tests: 0 → 2 passing`

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Close Project was broken on main after #34: close logic lived in `StartupFunnel`, which unmounts when a project is open; moved ownership to `App`.
- Stub file editor (`stub:file`) uses StubSurface; Explorer-opened files with content still show a real read-only preview in center (not fake success data).
- Command palette `Editor: …` actions open stubs for interactive use; Vitest seeds tabs via localStorage for presence assertions.
- No backend / APEX / `f*.sql` changes; `.orchestrate/` left untouched.

## Suggested follow-ups
- Issue #36 can build Inspector-only surfaces now that file editors are centered.
- Issue #33 Mission enhancements can keep using the same center tab host.