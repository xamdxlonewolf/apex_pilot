# Activity Rail density + labels preference

Resolution asset for
[Grilling: Activity Rail density + labels preference](https://github.com/xamdxlonewolf/apex_pilot/issues/116)
(map: [Wayfinder: Ship calm Focus shell](https://github.com/xamdxlonewolf/apex_pilot/issues/113)).

## Decision

Ship a larger Activity Rail (~1.5× hit targets) with a three-way label mode
preference. Default follows viewport width; the user can force icons-only or
icons + labels. Stay Cursor-calm — not VS Code forever-icons-only. No rebrand
(see [calm-shell-visual-direction.md](./calm-shell-visual-direction.md)).

## Preference model

| Value | Behavior |
| --- | --- |
| `auto` (default) | Icons-only below **1100px** viewport width; icons + labels at/above **1100px** |
| `icons` | Always icons-only |
| `icons-labels` | Always icons + labels |

- Key: `activityRailLabels: "auto" | "icons" | "icons-labels"`
- Storage: profile-scoped `ProfileLayoutPrefs` (same surface as Density / drawer sides)
- Settings: control next to Density
- **Not** tied to global Density (`compact` / `default` / `comfortable`)
- No project-scoped override for this map

Breakpoint **1100px** reuses the existing shell workspace-body media query — do
not invent a rail-only breakpoint. Do not use **860px** (stacked layout).

## Label copy

Visible text matches glossary / existing `aria-label` strings:

| Rail id | Label |
| --- | --- |
| `files` | Files |
| `agent` | Agent |
| `code` | Code |
| `database` | Database |
| `apex` | APEX |
| `review` | Review |

No short aliases (e.g. “DB”).

## Layout

- **Icons + labels:** icon left, label right on one row
- Widen the rail column **only** in labels mode
- Icons-only stays a narrow strip
- Do **not** stack label under icon

## Sizing targets (AFK)

Baseline today ≈ 44px column / 34px button min-height.

| Mode | Target |
| --- | --- |
| Hit height (both) | ~**51px** min (≈1.5× 34) |
| Icons-only width | ~**66px** (≈1.5× 44) |
| Icons + labels width | ~**120–132px** (fit “Database”; not a second Explorer) |
| Glyph | Modest bump (~0.85–0.9rem), not literal 1.5× |

## Tooltips / a11y

- **Icons-only** (forced or Auto-narrow): keep `title` + accessible name
- **Icons + labels** (forced or Auto-wide): omit redundant `title`; visible label is the name

## AFK bounds

Implements
[Task: Activity Rail ~1.5x + icons/labels mode](https://github.com/xamdxlonewolf/apex_pilot/issues/117).

In bounds: rail column/button sizing, label mode + Settings control, Auto at
1100px, quiet craft within Spec tokens.

Out of bounds: rebrand; restyle Product Header / App Menu / status bar; coupling
rail size to Density knobs; new design tokens without a stop-and-grill.

## Related

- Visual direction: `.scratch/calm-shell-and-connection/calm-shell-visual-direction.md`
- Runbook: `.scratch/calm-shell-and-connection/IMPLEMENTATION-ORDER.md`
- Code touchpoints: `ActivityRail.tsx`, `focusMode.ts` (`ACTIVITY_RAIL_ITEMS`),
  `prefs.ts` / `AppSettings.tsx`, `styles.css` (`.activity-rail*`,
  `.explorer-with-rail`)
- Icon candidate (APEX rail / craft reference): `.scratch/calm-shell-and-connection/icons/apex-rail-candidate.png`
  — pencil+ruler art; AFK may use as inspiration or adapted monochrome/Spec-tinted
  glyph for APEX (or similar rail icons). Prefer quiet Spec-aligned treatment over
  dropping the full-color square into the rail as-is.
