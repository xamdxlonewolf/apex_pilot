# Visual polish — design skills gate

Asset for
[Task: Visual polish pass with design skills gate](https://github.com/xamdxlonewolf/apex_pilot/issues/72)
(map: [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61)).

North star: `docs/design/figures/figure_1.png` + `figure_2.png`. Tokens from
Design Spec §159–§179. Stack stays vanilla CSS (Tailwind skill informs token
hierarchy only — no framework migration).

## Skills applied

| Skill | How it gated this pass |
| --- | --- |
| **design-system-patterns** | Primitive → semantic surface tokens (`--window` / `--panel` / `--panel-2` / `--elevated` / `--input` / status / accent); density modes keep typography fixed (Spec §179). |
| **tailwind-design-system** | Same token hierarchy expressed as CSS custom properties; no Tailwind install (existing stack). |
| **frontend-design** | Subject-grounded IDE craft (Oracle Mission Control): restrained accent, dense chrome, one signature (blue accent bar on active rail / stage / tab). Avoided purple-AI / cream-serif defaults. Spec Inter + JetBrains Mono per §166. |
| **redesign-existing-projects** | Audit fixes: undefined `--fg`, hardcoded greys, missing status dots, weak active states, radius drift vs Spec §164. No rewrite of IA. |
| **web-design-guidelines** | `color-scheme: dark`; `:focus-visible` kept; `overscroll-behavior: contain` on dialogs/palette; `touch-action: manipulation`; ellipsis on health pills; `…` in Connecting; `tabular-nums` on status/health; `translate="no"` on env badge; decorative dots `aria-hidden`. |

## Delivered craft

- Spec palette + type scale (13px body) + radius tokens
- Bundled Inter / JetBrains Mono (`@fontsource/*`)
- Product Header: env badge, figure-like health copy + dots
- Activity Rail / Explorer / tabs / Inspector stages: accent active indicators
- Motion durations already Spec-aligned; reduced-motion preserved

## Explicitly not in this pass

- Fake Mission / Execute success content
- Console tab craft depth beyond IA (map fog)
- Updates inventory contents (map fog)
- DB/APEX open-to-view detail (map fog)
- Light theme (Spec allows; not figure north star for this map)
