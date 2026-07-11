<!-- orchestrate handoff
task: issue-40-dialog-wizard-chrome
branch: orch/ui-overhaul/issue-40-dialog-wizard-chrome
agentId: bc-6ad503d3-7bea-42be-9246-edad76dfd550
runId: run-61762147-f229-47fe-ac03-94d4b2a34940
resultStatus: finished
finishedAt: 2026-07-11T23:33:08.448Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-40-dialog-wizard-chrome`

## What I did
- Added Spec chrome primitives: `DialogChrome.tsx` (title / description / content / secondary+primary footer) and `WizardChrome.tsx` (visible steps + Back/Next/Finish/Cancel).
- Refactored `StartupFunnel.tsx` to use Spec chrome for New Project (multi-step), Open/Clone dialogs, preflight/profile/picker, plus a Stub-honest `ConnectionWizard.tsx` (Finish disabled; no fake success).
- Wrapped Settings in dialog chrome (`AppSettings.tsx`); added honest empty-connection / empty-environment copy in `ProjectMappings.tsx`.
- Added Vitest coverage in `DialogWizardChrome.test.tsx`; styled chrome in `styles.css`.
- Draft PR: https://github.com/xamdxlonewolf/apex_pilot/pull/60
- UI artifact: `/opt/cursor/artifacts/issue-40-dialog-wizard-chrome/issue-40-dialog-wizard-chrome.mp4` (mirrored under `/workspace/artifacts/issue40/`)

## Measurements
- `pnpm test (frontend): 65 passing → 70 passing`
- `pnpm typecheck (frontend): exit 0 == exit 0`
- `DialogChrome + WizardChrome components: 0 → 2`
- `Connection wizard Stub surface: 0 → 1`
- `Vitest dialog/wizard chrome coverage tests: 0 → 5`

## Verification
live-ui-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Builds on merged #39 on `main`; no `backend/` edits; ADR-0006 create/open/clone/preflight/mappings ownership unchanged (still uses existing frontend API helpers).
- Connection create/import has no backend API yet, so the Connection wizard is intentionally Stub-honest through Finish.
- Project Creation wizard Connection step is also Stub-honest; mappings remain post-open preferences UX.
- Preferences stay non-wizard (Spec §248) but use DialogChrome layout.
- `.orchestrate/` left intact; `artifacts/` untracked and not in the PR.

## Suggested follow-ups
- Wire real SQLcl connection create/import when a backend contract exists; keep Finish Stub until then.
- Optionally deep-link Settings → mappings when opened from Context Bar (#39 follow-up).
- Next wave items per orchestrate plan after #40 merges.