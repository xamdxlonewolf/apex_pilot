<!-- orchestrate handoff
task: issue-31-explorer-multi-section
branch: orch/ui-overhaul/issue-31-explorer-multi-section
agentId: bc-024f7426-e19f-40fa-8c9c-39226bc680c0
runId: run-1fb40ab4-6cc7-42e2-b81e-3ea93268e5bd
resultStatus: finished
finishedAt: 2026-07-11T22:03:55.242Z
-->

## Status
success

## Branch
`orch/ui-overhaul/issue-31-explorer-multi-section`

## What I did
- Added `frontend/src/Explorer.tsx` with section nav for Files, Database, APEX, REST, Favorites, Pinned, Recent; Database hosts `SchemaBrowser`; unfinished sections use `StubSurface` + disabled Refresh/Open + Stub badges.
- Wired Explorer into `IdeWorkspace.tsx`; removed permanent Inspector Schema tab (default tabs now SQL Sheet + Mappings); strip legacy saved `schema` tabs on restore.
- Updated `FileTree.tsx` with `embedded` mode for Files section; adjusted `prefs.ts` so Inspector tools no longer include schema; added Explorer section styles in `styles.css`.
- TDD coverage in `Explorer.test.tsx` + shell assertions in `App.test.tsx` for multi-section presence and schema-home relocation.
- Draft PR: https://github.com/xamdxlonewolf/apex_pilot/pull/53
- UI artifact: `/workspace/artifacts/issue31/issue31-explorer-multi-section.mp4` (also `/opt/cursor/artifacts/issue31-explorer-multi-section.mp4`)

## Measurements
- `pnpm test (frontend): 31 passing → 34 passing`
- `pnpm typecheck (frontend): exit 0 == exit 0`
- `Explorer sections (Files/DB/APEX/REST/Favorites/Pinned/Recent): 1 → 7`
- `Permanent Inspector Schema tab: 1 → 0`
- `Schema browser under Explorer Database: 0 → 1`

## Verification
live-ui-verified

## Notes, concerns, deviations, findings, thoughts, feedback
- Schema home is Explorer → Database (in-panel `SchemaBrowser`), not an on-demand Inspector/object-viewer tab; matches ADR-0007 “under Explorer” for this ticket ahead of later object-viewer work (#36/#42).
- Default Inspector active surface is now SQL Sheet (was Schema); toolbar Run stub assertions scoped to the toolbar to avoid colliding with SqlSheet’s real Run.
- Stub section nav buttons keep visible Stub badges; Database/Files do not.
- Artifacts and `.orchestrate/` left untracked; `.orchestrate/` untouched for reconcile.
- No `apex/**`, `backend/**`, or root `f*.sql` changes.

## Suggested follow-ups
- Persist Explorer active-section expansion state across sessions (Spec §69).
- Replace Database stub object-tree (Tables/Views/…) once metadata integration lands; keep SchemaBrowser as schema home entry.
- Issue #36/#42 can deepen object viewers opened from Explorer nodes without restoring a permanent Inspector Schema tab.