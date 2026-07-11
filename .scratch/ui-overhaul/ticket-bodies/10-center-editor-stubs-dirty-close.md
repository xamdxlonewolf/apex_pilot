## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Center workspace supports editor tabs for object / package / APEX / REST / diff / file editors (stubbed as needed) so Mission is not the only center content type. Close Project returns to the recent-projects picker with an unsaved-work prompt when editors are dirty. One project per window remains.

## Acceptance criteria

- [ ] Center workspace can host stubbed editor tabs for object / package / APEX / REST / diff / file editors
- [ ] Stub editor tabs follow Stub conventions (no fake success content)
- [ ] Close Project returns to the recent-projects picker
- [ ] Unsaved-work prompt appears when editors are dirty
- [ ] One-project-per-window UX is preserved
- [ ] Vitest covers dirty close-project prompting and stub editor tab presence

## Blocked by

- PLACEHOLDER_BLOCKERS
