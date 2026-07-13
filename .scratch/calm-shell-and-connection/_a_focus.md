Part of #113

## Question

Lock Focus Mode hide/show defaults and slide-out drawer ownership for the calm Focus shell.

## Charting decisions already locked (confirm / refine only)

- Files Focus → Mission **hidden by default** (restore via Layout Chrome / Focus controls).
- **Drawers:** Inspector, DB browse; Explorer as drawer in Agent/SQL-heavy Focus modes.
- **Peers when Focus shows them:** primary editor + Mission (when that Focus wants Mission) + Activity Rail.
- Default sides: Explorer **left**, Inspector **right**; user can flip side per drawer.
- Drawers: icon to open, easy dismiss — not permanent chrome.

## Acceptance

- HITL lock on hide defaults per Focus Mode (at least Files → Mission).
- HITL lock on which surfaces are drawers vs peers.
- HITL lock on default sides + whether side preference is persisted.
- Enough detail for [Task: Wire Focus hide + slide-out drawers] to implement without re-grilling.
