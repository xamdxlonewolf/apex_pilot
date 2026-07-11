## Destination

A clear route to overhaul the Apex Pilot desktop UI against the Obsidian *Apex Pilot Desktop Design Spec* (including figure_1 / figure_2): open product/UX decisions resolved, conflicts with existing ADRs and the current shell reconciled, vault *Apex Pilot PR Roadmap* and *Apex Pilot* notes brought in line, and an agent-ready plan that uses visible UI stubs for unfinished backend plus a gap rule (orphan surfaces get marked and roadmap/PR items added). Ready for `/to-spec` → `/to-tickets` → `/implement` — not the full UI rewrite inside this map.

## Notes

- Domain: Apex Pilot desktop UI/UX overhaul; local-first Tauri + React shell.
- UI/UX authority: Obsidian vault note `Apex Pilot Desktop Design Spec` at `C:\Users\mikec\Documents\programming\obsidian_vault\programming\Apex Pilot Desktop Design Spec.txt` with `figure_1` / `figure_2` beside it. Design Spec wins over conflicting UI ADRs; update ADRs and vault alignment docs to match.
- Vault alignment set: Design Spec + figures; `Apex Pilot PR Roadmap`; `Apex Pilot` product note. Repo copies under `docs/design/`. Repo ADRs under `docs/adr/` (especially shell/UX such as ADR-0007). Glossary: root `CONTEXT.md`.
- Scope: full Design Spec (shell, Mission, Inspector, Explorer, workspace/editors, workflow, console, dialogs, design system, etc.). Implementation may still sequence later; planning covers the whole surface.
- Stub / gap policy: locked in ADR-0007 Decision §11; Roadmap UI-9 applies across layout. Visible stubs; honest `Not implemented yet`; Gap is planning-only.
- Hard boundaries (unchanged): no touching APEX export folders or root `f*.sql`; SQL via SQLcl MCP only; guarded façades only; no persisting Oracle passwords / SQL result rows by default.
- Skills: `/grilling`, `/domain-modeling`; research tickets may read vault + repo. Plan, don't ship UI in this map.
- Refer to tickets by **name** (title), not bare issue numbers.
- After map clears: hand off to `/to-spec` → `/to-tickets` (blocking edges / build order) → `/implement` one ticket at a time. ADRs are updated as decisions lock; they are not "implemented" as code.

## Decisions so far

- [Research: Digest Design Spec surfaces and figures](https://github.com/xamdxlonewolf/apex_pilot/issues/15) — Inventory of Design Spec surfaces/flows/component families with stable `DS-*` IDs. Asset: [`.scratch/ui-overhaul/design-spec-surface-inventory.md`](https://github.com/xamdxlonewolf/apex_pilot/blob/main/.scratch/ui-overhaul/design-spec-surface-inventory.md).
- [Research: Inventory current UI and ADR-0007 vs Design Spec](https://github.com/xamdxlonewolf/apex_pilot/issues/16) — Shipped shell vs Spec conflict matrix; priority shortlist for grilling. Asset: [`.scratch/ui-overhaul/current-ui-adr-vs-design-spec.md`](https://github.com/xamdxlonewolf/apex_pilot/blob/main/.scratch/ui-overhaul/current-ui-adr-vs-design-spec.md).
- [Research: Gap-scan PR Roadmap and Apex Pilot note vs Design Spec](https://github.com/xamdxlonewolf/apex_pilot/issues/17) — Orphans + proposed UI-0…UI-9; vault-pass amendment. Assets under `.scratch/ui-overhaul/`.
- **Vault sync into repo** — Design Spec, figures, PR Roadmap, and Apex Pilot note in [`docs/design/`](https://github.com/xamdxlonewolf/apex_pilot/blob/main/docs/design/README.md).
- [Grilling: Resolve Design Spec vs ADR conflicts](https://github.com/xamdxlonewolf/apex_pilot/issues/18) — Locked Spec shell as ADR target: Mission center, Inspector right, multi-section Explorer, in-shell Developer Console (MCP Activity as Console tab), toolbar/context bar; relocated SQL Editor / Schema / Mappings; ADR-0007 rewrite + light 0001/0005/0006; `CONTEXT.md`; product note + Roadmap UI-0…UI-9; screen/shell-first (tokens parallel; figure pixel-match not a gate).
- [Grilling: Lock stub copy and gap-marking conventions](https://github.com/xamdxlonewolf/apex_pilot/issues/19) — Locked ADR-0007 §11 / UI-9: `Not implemented yet` + optional secondary; `Stub` badge; disabled actions; no fake data; Gap = Roadmap `Gap:`+`DS-*` only; working interim ≠ Stub; `DS-*`/`UI-*` docs-only.

## Not yet specified

_(none — remaining open question is ticketed)_

## Out of scope

- Implementing the full UI rewrite inside this map (belongs after `/to-tickets`)
- Backend/Agent Core/MCP execution behavior beyond what UI stubs and roadmap gaps require
- Changing safety invariants (SQLcl MCP-only SQL, guarded façades, APEX/`f*.sql` nontouch, password/result persistence rules)
