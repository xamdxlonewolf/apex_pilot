# Design & product notes (vault sync)

Copies of Obsidian vault notes used as UI/UX and product planning authority
for Apex Pilot. Synced so cloud/remote agents can read them without a local
vault mount.

**Source vault folder:**
`C:\Users\mikec\Documents\programming\obsidian_vault\programming\`

**Authority (Wayfinder map #14):** *Apex Pilot Desktop Design Spec* (+ figures)
wins over conflicting UI ADRs. Update ADRs and these notes when decisions lock.

## Contents

| File | Role |
| --- | --- |
| [`Apex Pilot Desktop Design Spec.txt`](./Apex%20Pilot%20Desktop%20Design%20Spec.txt) | Authoritative desktop UI/UX specification |
| [`figures/figure_1.png`](./figures/figure_1.png) | Mission Control layout (conceptual) |
| [`figures/figure_2.png`](./figures/figure_2.png) | Annotated layout + Inspector stages |
| [`Apex Pilot PR Roadmap.md`](./Apex%20Pilot%20PR%20Roadmap.md) | PR sequencing / addendum plan |
| [`Apex Pilot.md`](./Apex%20Pilot.md) | Product overview + locked decisions |

## Not present in vault (as of this sync)

- `Apex Pilot Desktop UX` — wiki-linked from the Roadmap and product note, and
  named in ADR-0007, but **no file** was found beside the other notes. Treat
  Design Spec + ADR-0007 as the interim UX paper trail until that note is
  recovered or explicitly superseded.

## Sync policy

- These are **working copies** for the repo. Prefer editing the vault originals
  when doing human authoring in Obsidian; re-copy into `docs/design/` when the
  notes change in a way agents need.
- Do not treat this folder as an Oracle APEX export. It is documentation only.
- Research scratch under `.scratch/ui-overhaul/` cites `DS-*` inventories derived
  from the Design Spec; prefer linking here for full body text going forward.

## Related

- Wayfinder map: GitHub issue #14
- Research assets: `.scratch/ui-overhaul/`
- Shell ADR: `docs/adr/0007-desktop-shell-and-workspace-ux.md`
