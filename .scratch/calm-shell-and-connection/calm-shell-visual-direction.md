# Calm shell visual direction

Resolution asset for
[Grilling: Calm shell visual direction](https://github.com/xamdxlonewolf/apex_pilot/issues/114)
(map: [Wayfinder: Ship calm Focus shell](https://github.com/xamdxlonewolf/apex_pilot/issues/113)).

## Decision

**Targeted polish, no rebrand.** Deliver calm Focus via IA (hide/drawers/rail/tree/splitters) plus local craft on those surfaces. Keep the Spec token system and Inter / JetBrains Mono from the figure-matching polish pass.

## AFK bounds (A3–A6)

| In bounds | Out of bounds |
| --- | --- |
| Spacing / row height on rail, file tree, splitters, drawers (modest Cursor-like calm) | Global density-mode redesign; body/type scale change |
| Hover / selected / active states on those surfaces | Drive-by restyle of Product Header, App Menu, status bar |
| Splitter and drawer chrome within existing semantic tokens | New parallel palette or “AI purple” look |
| Subtle file-type icon differentiation (folder / SQL / code / generic) using Spec colors | Loud multicolor VS Code-style icon packs |
| Short restrained **slide** for drawers (must read as sliding, not blink in/out); quiet hover/active | Bounce, long theatrical motion, glow effects |
| Reuse existing motion tokens/durations where they fit | Inventing a new motion system |

**Stop and grill** if a craft change needs a new design token or a global type / radius shift.

**Reduced motion:** honor `prefers-reduced-motion` (instant or reduced slide).

## Explicit no-rebrand bound

Tasks [Activity Rail ~1.5x + icons/labels mode](https://github.com/xamdxlonewolf/apex_pilot/issues/117),
[File tree explorer + type icons](https://github.com/xamdxlonewolf/apex_pilot/issues/118),
[Uniform splitters for visible peers](https://github.com/xamdxlonewolf/apex_pilot/issues/119), and
[Wire Focus hide + slide-out drawers](https://github.com/xamdxlonewolf/apex_pilot/issues/120)
must not rebrand the shell. Visual language stays Spec-aligned Mission Control with Cursor-calm density/motion on touched surfaces only.

## Related

- Prior polish gate: `.scratch/ui-overhaul/visual-polish-design-skills-gate.md`
- File-tree craft reference: `.scratch/calm-shell-and-connection/file-tree-visual-reference.png` (explorer semantics / density inspiration, not chat-list IA)
