Part of #113

## Question

Lock Activity Rail density and label mode behavior for the calm Focus shell.

## Charting decisions already locked (confirm / refine only)

- Hit targets ~**1.5×** current size.
- **Breakpoint default:** icons-only on narrow widths; icons + labels on wider widths.
- **User preference** can force icons-only or icons+labels regardless of breakpoint.
- Prefer Cursor/Codex calm — not VS Code forever-icons-only dogma.

## Acceptance

- HITL lock: breakpoint threshold (or “match existing shell breakpoints”), preference storage location, and label copy for each rail item.
- Enough detail for [Task: Activity Rail ~1.5× + icons/labels mode] to implement AFK.
