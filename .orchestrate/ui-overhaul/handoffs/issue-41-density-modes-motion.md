<!-- orchestrate handoff
task: issue-41-density-modes-motion
branch: orch/ui-overhaul/issue-41-density-modes-motion
agentId: bc-e38bcb2d-3b25-4191-807e-580572ecfae4
runId: run-bc418eef-0b14-4dd0-8678-4cbf606d274e
resultStatus: finished
finishedAt: 2026-07-11T21:50:17.586Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-41-density-modes-motion`

## What I did
- Added profile-persisted density preference in `frontend/src/prefs.ts`:
  - introduced `DensityMode` (`compact | default | comfortable`)
  - added `density` to `ProfileLayoutPrefs`
  - defaulted to `default`
  - sanitized persisted values on load
- Updated `frontend/src/AppSettings.tsx` to add a Density selector in the existing **App preferences** section (no new settings region).
- Updated `frontend/src/IdeWorkspace.tsx`:
  - wired shell root `data-density` to `layout.density`
  - added reduced-motion detection via `matchMedia("(prefers-reduced-motion: reduce)")`
  - exposed motion state as `data-motion="reduced|standard"` for CSS behavior
- Updated `frontend/src/styles.css` for density/motion/focus polish:
  - added density tokens for Compact/Default/Comfortable spacing/row-height variants
  - applied tokenized density values to toolbar/context/pane/list/tree shell surfaces
  - added Spec-aligned motion duration tokens (hover/expand/collapse/dialog/notification/resize)
  - added non-decorative choreography transitions (panel/timeline state surfaces) without animating resize dimensions
  - kept reduced-motion guard in place and added `data-motion="reduced"` token override to zero durations
  - polished focus token usage to explicit `:focus-visible` 2px accent outline (and suppressed non-visible focus outline)
- Updated `frontend/src/App.tsx` so returning from Settings reloads profile layout prefs, making density changes immediately observable in the shell.
- Added TDD coverage in `frontend/src/App.test.tsx`:
  - failing-then-passing test for shell-observable density switching + persistence
  - failing-then-passing test for reduced-motion shell signaling

## Measurements
- `density/reduced-motion shell assertions in App.test.tsx: 0 → 2`
- `cd frontend && pnpm test: 31 passing == 31 passing`
- `cd frontend && pnpm typecheck (tsc -b exit): 0 == 0`

## Verification
unit-test-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- `gh issue view 41 --repo xamdxlonewolf/apex_pilot` initially errored due a GitHub projectCards deprecation response in this environment; retrieved full issue content successfully with `gh issue view ... --json ...`.
- Captured UI recording artifact for the density switch flow at: `/tmp/cursor/artifacts/issue-41-density-switch.webm`.
- Temporary Playwright tooling was used only for artifact capture and fully reverted from repo files before handoff (no dependency diff committed).
- Draft PR was opened from this branch to `main`.

## Suggested follow-ups
- Add a small dedicated unit test for `loadProfileLayout` density sanitization edge cases (invalid persisted values).
- Consider adding one visual-regression snapshot test for `data-density="compact|default|comfortable"` shell spacing deltas to guard future CSS drift.