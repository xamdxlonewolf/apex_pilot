<!-- orchestrate handoff
task: issue-39-preferences-layout-mapping-home
branch: orch/ui-overhaul/issue-39-preferences-layout-mapping-home
agentId: bc-2e4eb6a7-075e-4a6c-8480-ee1a0a7e1496
runId: run-af97716b-19fb-4fa4-ad1e-0948b4aa3b7c
resultStatus: finished
finishedAt: 2026-07-11T23:24:28.722Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-39-preferences-layout-mapping-home`

## What I did
- Extracted `ProjectMappings` to `frontend/src/ProjectMappings.tsx` and hosted it under Settings → **Environment mappings** (`AppSettings.tsx` + `StartupFunnel.tsx` wiring).
- Added Context Bar **Mappings** button and a command-palette “Project: Environment mappings” action that open preferences (`IdeWorkspace.tsx`, `App.tsx`).
- Removed the temporary Inspector Mappings Stub from `InspectorPanel.tsx`.
- Added/extended Vitest coverage: `prefs.test.ts` (profile layout + project tab restore), shell Mapping-home assertions in `App.test.tsx`, Inspector “no mappings” assertions.
- Draft PR: https://github.com/xamdxlonewolf/apex_pilot/pull/59
- UI artifact: `/opt/cursor/artifacts/issue-39-preferences-layout-mapping-home/issue-39-preferences-layout-mapping-home.mp4` (mirrored under `/workspace/artifacts/issue39/`)

## Measurements
- `pnpm test (frontend): 56 passing → 63 passing`
- `pnpm typecheck (frontend): exit 0 == exit 0`
- `Inspector Mappings stub sections: 1 → 0`
- `Settings Environment mappings section: 0 → 1`
- `Context Bar Mappings affordance: 0 → 1`
- `Vitest prefs/Mapping-home coverage tests: 0 → 7`

## Verification
live-ui-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Builds on merged #36 on `main`; no `backend/` edits; ADR-0006 create/open/clone/preflight/mappings ownership unchanged (still uses existing frontend API helpers).
- Prefs remain localStorage (`prefs.ts`) with the same profile/project key contract for a later SQLite move.
- Opening Mappings/Settings still swaps the workspace for the settings funnel (existing shell pattern); mappings are no longer an Inspector surface.
- `.orchestrate/` left intact; `artifacts/` untracked and not in the PR.

## Suggested follow-ups
- #40 (depends on #39): next preferences/session UX wave per orchestrate plan.
- Optionally deep-link Settings to scroll/focus the mappings section when opened from Context Bar.
- Wire real Progress/Classification/Checklist evidence once Agent Core / Mission workflow lands.