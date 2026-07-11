## Parent

Part of #25 (Spec: Apex Pilot desktop UI overhaul — Mission Control).

## What to build

Panel regions resize and collapse per Spec layout rules. View menu and core keyboard shortcuts show/hide Explorer, Inspector, Mission, and Developer Console. Shell chrome has always-visible keyboard focus and Tab/arrow traversal so the dense IDE is operable without a pointer.

## Acceptance criteria

- [ ] Explorer, Inspector, Mission, and Developer Console can be shown/hidden from the View menu
- [ ] Core panel-toggle shortcuts work for those four regions
- [ ] Panels resize and collapse according to Spec layout rules without losing chrome identity
- [ ] Keyboard focus is always visible; Tab/arrow traversal covers shell chrome
- [ ] Vitest covers panel visibility after menu and shortcut toggles

## Blocked by

- PLACEHOLDER_BLOCKERS
