# Gap-scan vault pass — PR Roadmap + Apex Pilot note

Amendment to [`.scratch/ui-overhaul/roadmap-gap-scan.md`](./roadmap-gap-scan.md)
(Wayfinder #17), now that vault notes are copied into the repo.

**Canonical copies:** [`docs/design/`](../../docs/design/README.md)

| Note | Repo path |
| --- | --- |
| Design Spec | `docs/design/Apex Pilot Desktop Design Spec.txt` |
| Figures | `docs/design/figures/figure_1.png`, `figure_2.png` |
| PR Roadmap | `docs/design/Apex Pilot PR Roadmap.md` |
| Product note | `docs/design/Apex Pilot.md` |

---

## Verdict vs proxy gap-scan

The vault *Apex Pilot PR Roadmap* **confirms** the proxy orphan list. It does
**not** add named epics for Mission, Inspector, in-shell Developer Console,
multi-section Explorer, design system, or Spec toolbar/context bar.

Proxy `UI-0`…`UI-9` proposals remain the right gap-fill set for grilling #18.

---

## Vault Roadmap — what it actually plans

Dependency spine (from the note’s mermaid + sections):

`… → 9A → 9B → 9B.1 → (Agent Core / PR 9 ∥ 9D) → 9C → 10 → 11 → 11A → 12 → 12A → 13 → 13A → 13B`

| Slice | Vault status text | Repo reality | Spec alignment |
| --- | --- | --- | --- |
| 9A Storage | planned in note body; Current State implies done | Merged (#10) | Align (persistence) |
| 9B Wizard | complete / merged | Merged (#11) | Partial (forms vs Spec wizards) |
| **9B.1 Shell** | “in progress” on `pr9b.1-desktop-shell-ux` | **Merged (#12)** — status stale | **Misaligned** — locks chat, right tool tabs, **floating MCP** |
| 9D CLI launcher | planned after 9B.1 | Not shipped | Neutral / shell-session |
| Agent Core (PR 9) | after 9B.1; read-only NL SQL; memory search | Not shipped | Partial — still “chat” framing |
| 9C Context compression | after Agent Core | Not shipped | Chat-context; rename with Mission |
| 10–11 Skills | planned | Not shipped | Edge UI only |
| 11A Slash commands | planned | Not shipped | Mission composer affordance later |
| 12 Approval | planned | Not shipped | Inspector/workflow moments |
| 12A Application Mode | planned | Not shipped | Policy, not layout |
| 13 / 13A / 13B APEXLang | planned | Not shipped | Explorer/APEX/workspace edges |

### 9B.1 scope that conflicts with Design Spec (quote-level)

Vault Roadmap § PR 9B.1 still commits to:

- Center **chat** (send disabled until Agent Core)
- Right shared tab strip for schema/files/SQL sheets
- **MCP Activity floating window**
- Locked details → `[[Apex Pilot Desktop UX]]` (**file missing** in vault)

Design Spec + figures require Explorer | Mission | Inspector | bottom MCP/console
Activity — see `docs/design/figures/`.

---

## Product note (*Apex Pilot.md*) — realignment required

Confirmed (no longer inferred):

| Topic | Vault product note says | Design Spec / figures | Action |
| --- | --- | --- | --- |
| Product shape | “chat-first desktop app” | Professional Mission Control IDE | Rewrite framing |
| Center | Chat always present; send disabled until Agent Core | Mission workspace | Glossary + UX bullets |
| Right | Tool tabs (schema/files/SQL) | Inspector | Replace |
| Observability | MCP Activity separate floating window | In-shell activity / console (figures) | Replace |
| Authority pointer | Locked UX in `[[Apex Pilot Desktop UX]]` | Design Spec wins (map #14) | Point at Design Spec; mark Desktop UX missing/superseded |
| Sequence | 9B → 9B.1 → Agent Core / 9D | Need UI overhaul epic after/alongside 9B.1 | Add UI-0… items to Roadmap |
| Invariants | SQLcl MCP-only, guarded façades, no password/result rows | Same | **Keep** |

Many locked decisions (storage, safety, skills, local-first) remain valid and
should survive the UI vocabulary rewrite.

---

## Missing vault file

`Apex Pilot Desktop UX` is wiki-linked from Roadmap + product note and named in
ADR-0007, but **no file** exists in the vault programming folder. Options for
grilling #18:

1. Recover from backup / another vault path, or
2. Explicitly supersede it with Design Spec + ADR-0007 rewrite, and remove dead
   wiki links when editing vault/repo copies.

---

## Suggested vault Roadmap edits (do not apply in this ticket)

1. Mark 9B.1 **complete/merged**; note it shipped the *interim* IDE shell.  
2. Add **UI overhaul epic** (`UI-0`…`UI-9` from proxy gap-scan) after 9B.1,
   before or interleaved with Agent Core UI reliance.  
3. Reframe Agent Core from “enable chat send” → power **Mission** + workflow.  
4. Retarget MCP Activity from floating window → **Developer Console** tab
   (Design Spec / figures).  
5. Update Related links: Design Spec + figures; drop or supersede Desktop UX.

Suggested product-note edits: same glossary/framing table above; keep design
invariants and non-UI locked decisions.

---

## Citation

- “Vault pass confirms orphan: **DS-INSPECTOR-*** — absent from *Apex Pilot PR Roadmap* body.”  
- “Vault 9B.1 still locks floating MCP — conflicts **DS-CONSOLE-mcp** / figure_2.”  
- “Product note chat-first + Desktop UX link — realign to Design Spec authority.”
