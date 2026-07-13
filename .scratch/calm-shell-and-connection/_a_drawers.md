Part of #113

## Question

Wire Focus Mode hide defaults and slide-out drawers into the shell per the ownership grilling.

## Acceptance

- Follow `.scratch/calm-shell-and-connection/focus-mode-hide-slide-out-ownership.md` (and visual-direction bounds).
- Mission: hidden by default in SQL/Files; visible in Agent/Review; session per-Focus show/hide override; Layout Chrome / Focus controls can show and dismiss.
- Explorer: peer in Files Focus; drawer (closed on enter) in Agent/SQL/Review.
- Inspector: closed drawer in all Focus Modes.
- Dedicated Database Drawer (not Explorer tabs); default right; Activity Rail Database opens it; APEX stays Explorer posture.
- Default sides Explorer left / Inspector right / Database right; profile-persisted side prefs; session-only open/closed; same-side mutual exclusion Inspector↔Database.
- Dismiss: close control, Escape, toggle same affordance — no click-outside.
- Developer Console remains Layout Chrome only (not a drawer).
- Primary work surface stays calm; secondary tools off-stage until requested.

## Blocked by

- Grilling: Focus Mode hide/show + slide-out ownership
- Grilling: Calm shell visual direction
