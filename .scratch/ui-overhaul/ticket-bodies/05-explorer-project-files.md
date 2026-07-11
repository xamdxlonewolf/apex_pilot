## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Left Explorer hosts the project files section via Tauri FS with a browser fallback for Vite-only tests. Junk files are hidden by default. APEX export folders and root f*.sql are shown as protected so nontouch invariants stay visible.

## Acceptance criteria

- [ ] Explorer project-files section navigates local project files (Tauri FS; browser fallback in Vite-only tests)
- [ ] Junk files are hidden by default
- [ ] APEX export folders and root f*.sql are presented as protected
- [ ] Vitest covers Explorer files region behavior that can run under browser fallback

## Blocked by

- PLACEHOLDER_BLOCKERS
