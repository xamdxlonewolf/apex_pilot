# Gap-scan: PR Roadmap + Apex Pilot note vs Design Spec

Research asset for Wayfinder ticket
[Research: Gap-scan PR Roadmap and Apex Pilot note vs Design Spec](https://github.com/xamdxlonewolf/apex_pilot/issues/17)
(map: [Wayfinder: Apex Pilot desktop UI overhaul](https://github.com/xamdxlonewolf/apex_pilot/issues/14)).

Compared against:

- Design Spec inventory: [`design-spec-surface-inventory.md`](./design-spec-surface-inventory.md)
- Current UI / ADR matrix: [`current-ui-adr-vs-design-spec.md`](./current-ui-adr-vs-design-spec.md)

**Vault edit policy:** inventory only — do **not** edit vault notes in this ticket.
Suggested Roadmap / product-note updates below are proposals for grilling (#18)
and later vault alignment.

---

## Caveat — vault notes not readable in this session

Expected vault paths (from map Notes):

| Note | Expected location |
| --- | --- |
| *Apex Pilot PR Roadmap* | `…/obsidian_vault/programming/` (exact filename unknown) |
| *Apex Pilot* product note | same folder |
| *Apex Pilot Desktop Design Spec* | previously recovered TOC/fragments only |
| *Apex Pilot Desktop UX* (named in ADR-0007) | never opened |

Mount probes (`/mnt/c/…`, `/mnt/d/…`, workspace copies) all failed. Prior cloud
transcripts named these notes as alignment targets but **never read their
bodies**.

This gap-scan therefore uses a **repo roadmap proxy** (README Development
Roadmap + ADR PR numbering + merged PRs). Treat every “orphan” verdict as
**orphan relative to the proxy** until a vault-mounted pass confirms or
narrows the list.

**Follow-up (required for vault truth):** on a machine that mounts the Obsidian
vault, re-read *Apex Pilot PR Roadmap* and *Apex Pilot*, diff against §3–§5
here, and amend this asset (or a sibling `*-vault-pass.md`).

---

## 1. Repo roadmap proxy (what we can see)

### README Development Roadmap (items 1–13)

| # | Item | UI relevance |
| --- | --- | --- |
| 1–7 | Foundation → schema intelligence | Backend / contracts; little Spec shell |
| 8 | First desktop vertical slice | Early UI; superseded by 9B.1 |
| **9** | `9A` storage · `9B` wizard · `9B.1` desktop shell · **then agent core** | Primary UI path today |
| 10 | Skill installer | Mostly backend; possible future Explorer/settings surface |
| 11 | Skill runtime | Agent/tooling; Mission/Inspector consumers later |
| 12 | Approval workflow | Overlaps Spec review/approval moments |
| 13 | APEXLang check-only | Touches APEX surfaces lightly |

### ADR-named PR slices (beyond README wording)

| Slice | Source | Status (repo) |
| --- | --- | --- |
| **9A** Local project / SQLite | ADR-0005 / 0006 | Shipped (PR #10) |
| **9B** Project wizard + preflight | ADR-0006 | Shipped (PR #11) |
| **9B.1** Dense IDE shell (chat / tools / floating MCP) | ADR-0007 | Shipped (PR #12) |
| **9D** CLI launcher + multi-window | ADR-0006 | **Not shipped**; not a README numbered line |
| **Agent Core** | ADR-0005/0007 | **Next** after 9B.1; enables chat send — still “chat” vocabulary |
| Skills installer / runtime | ADR-0003/0004 · README 10–11 | Not shipped |
| Approval workflow | README 12 | Not shipped |

### What the proxy does **not** name

No roadmap line explicitly commits to: Mission Control layout, Mission
workspace, Inspector, Developer Console (in-shell), multi-section Explorer,
center workspace editors (object/package/APEX/REST/diff), design-system tokens /
component library, toolbar, context bar, Spec dialog/wizard chrome, density /
shortcuts / motion, or a dedicated UI-overhaul epic after 9B.1.

Agent Core is the only forward UI-ish bucket — and it is framed as enabling
**chat send**, not rebuilding shell IA to the Design Spec.

---

## 2. Coverage matrix — Design Spec families vs proxy roadmap

Legend:

- **Covered** — named path exists and roughly matches Spec intent
- **Misaligned** — named path exists but locks conflicting IA (needs rewrite, not a new orphan)
- **Partial** — some related work exists; Spec surface still mostly missing
- **Orphan** — no clear named implementation path on the proxy (gap rule applies)

| Family | Proxy path today | Verdict | Notes |
| --- | --- | --- | --- |
| DS-SHELL (chrome, layout) | 9B.1 | Misaligned | Shell shipped; wrong panel philosophy vs Spec |
| DS-SHELL-toolbar / context / health / motion | — | Orphan | Not in 9B.1 scope as Spec defines them |
| DS-MISSION | Agent Core (as “chat”) | Misaligned / Orphan | Agent Core enables send; no Mission timeline/stages epic |
| DS-INSPECTOR | — | **Orphan** | No PR names Inspector |
| DS-EXPLORER (beyond files) | 9B.1 file tree only | Partial / Orphan | DB/APEX/REST/favorites/pinned/recent absent |
| DS-WORKSPACE editors | 9B.1 right SQL/schema tabs | Misaligned / Orphan | SQL exists wrong host; object/package/APEX/REST/diff absent |
| DS-WORKFLOW lifecycle UI | Agent Core + Approval (12) | Partial / Orphan | Backend-ish; no Mission+Inspector workflow UI plan |
| DS-CONSOLE (in-shell) | 9B.1 floating MCP | **Misaligned → Orphan for Spec shape** | Floating window ≠ Spec console; other console tabs unnamed |
| DS-DIALOGS Spec chrome | 9B forms | Partial | Wizards exist as forms, not Spec wizard system |
| DS-CONN Spec UX | 9A/9B mappings + strip | Partial | No connection wizard / context-bar switcher epic |
| DS-DESIGN / DS-COMPONENTS | — | **Orphan** | No design-system PR |
| DS-INTERACT (palette, toasts, …) | — | Orphan | Scattered; no epic |
| DS-PLATFORM shortcuts / motion | — | Orphan | Arch (Tauri/React) Align via ADR-0001 |
| DS-DIALOGS-project / startup | 9B / 9B.1 funnel | Partial / Align-ish | Keep; upgrade chrome later |
| Hard boundaries / MCP SQL | 1–7, ADR-0002/3 | Align | Not UI orphans |

---

## 3. Orphan UI → suggested Roadmap / PR updates

Map gap rule: *if a Design Spec surface has no clear PR/roadmap path, mark the
gap and add/update PR Roadmap / PR plan items.*

Suggested **new / renamed** plan items for the vault *Apex Pilot PR Roadmap*
(and README when aligned). IDs are provisional (`UIx`) for grilling — not
committed numbering.

| ID | Suggested roadmap item | Covers `DS-*` | Depends on / notes |
| --- | --- | --- | --- |
| **UI-0** | **UI overhaul epic** (post-9B.1) — Mission Control shell composition; ADR-0007 rewrite | DS-SHELL-*, layout, panels | After grilling #18 locks conflicts |
| **UI-1** | Shell chrome: menu completeness, **toolbar**, **context bar**, health indicators | DS-SHELL-menu/toolbar/context/health | UI-0 |
| **UI-2** | **Explorer** multi-section (project/DB/APEX/REST/favorites/pinned/recent) | DS-EXPLORER-* | Schema APIs exist; APEX/REST mostly stub |
| **UI-3** | **Mission** workspace (replace Chat): timeline, stages, composer, history stubs→live | DS-MISSION-*, DS-WORKFLOW-* | Stubs before Agent Core; live with Agent Core |
| **UI-4** | **Inspector** panel (progress, classification, objects, actions) | DS-INSPECTOR-* | Pair with UI-3 |
| **UI-5** | **Workspace editors** center tabs; relocate SQL Sheet; object/package/APEX/REST/diff viewers | DS-WORKSPACE-* | SQL sheet already exists — move/host correctly |
| **UI-6** | **Developer Console** in-shell; migrate MCP Activity from floating window; Problems/Output/SQL History/Oracle Messages/… | DS-CONSOLE-* | Direct conflict with ADR-0007 §7 |
| **UI-7** | Design system tokens + component library (+ density/motion/focus) | DS-DESIGN-*, DS-COMPONENTS-*, DS-PLATFORM-motion/shortcuts | Map fog: design-system-first vs screen-first |
| **UI-8** | Dialog/wizard chrome + connection wizard + preferences | DS-DIALOGS-*, richer DS-CONN-* | Evolve 9B forms |
| **UI-9** | Stub / gap-marking conventions applied across layout | (policy) | Owned by grilling #19 |
| *(existing)* | **Agent Core** — retitle/reframe from “enable chat send” → power Mission + workflow | DS-MISSION/WORKFLOW live path | Keep as backend/agent PR; UI stubs land earlier via UI-3 |
| *(existing)* | **9D** CLI launcher / multi-window | DS-SHELL-session-ish | Already ADR-named; add to README if missing |
| *(existing)* | Approval workflow (12) | DS-WORKFLOW review/exec-review moments | Wire into Inspector, not a separate chat modal |
| *(existing)* | Skills 10–11 / APEXLang 13 | Explorer/skills/APEX edges | Keep; ensure UI stubs under UI-2/UI-5 |

### Orphan shortlist (highest gap priority)

Surfaces with **no** honest proxy path even stretching Agent Core:

1. **DS-INSPECTOR-*** — complete orphan  
2. **DS-CONSOLE-*** Spec shape (in-shell tabs beyond floating MCP)  
3. **DS-EXPLORER-db/apex/rest/favorites/pinned/recent**  
4. **DS-WORKSPACE-object/package/apex/rest/diff/split**  
5. **DS-DESIGN-*** / **DS-COMPONENTS-***  
6. **DS-SHELL-toolbar** / **DS-SHELL-context** (as Spec defines them)  
7. **DS-MISSION-*** as Mission (Agent Core only covers “chat send” today)

---

## 4. *Apex Pilot* product note — realignment checklist (inferred)

Body unread. Using Design Spec identity (§8 fragments) vs repo framing
(README + ADR-0001/0005/0007) as a **hypothesis list** for the vault note:

| Topic | Repo / interim language | Design Spec direction | Action when vault is editable |
| --- | --- | --- | --- |
| Product shape | “chat-first desktop application” (README, ADR-0001) | Professional desktop IDE / Mission Control (not dashboard/SaaS) | Replace chat-first framing |
| AI role | Chat composer centerpiece | AI is **navigator**; SQLcl executes; Oracle works; Apex Pilot orchestrates; user in control | Align identity paragraph |
| Primary workspace | Chat | **Mission** | Glossary rename |
| Context / explainability | MCP Activity float + SQL sheet prompts | Inspector + Developer Console + Mission timeline | Describe those surfaces |
| Trust | Classifier / approvals (good) | Trust Before Automation; progressive disclosure | Keep; name Spec surfaces |
| Local-first | Strong in ADR-0001 | Local First principle | Keep |
| Vocabulary | chat, tools, files, MCP Activity window | Mission, Inspector, Explorer, Developer Console, context bar | Full glossary pass (+ CONTEXT.md) |

Also check whether the product note still points at the interim **Apex Pilot
Desktop UX** note (ADR-0007) as authority — map says **Design Spec wins**.

---

## 5. README / ADR sync suggestions (repo side)

Not vault edits — candidates after grilling locks:

1. README item 9: after `9B.1`, insert **UI overhaul / Mission Control** (or point at vault Roadmap `UI-0…`) before or interleaved with Agent Core.  
2. README: rename “chat/tool metadata” → Mission / activity metadata when glossary locks.  
3. ADR-0007: supersede or rewrite for Spec shell (grilling #18).  
4. ADR-0001: drop or qualify “chat-first”.  
5. ADR-0005: persistence naming chat→Mission threads when ready.  
6. Document **9D** on README if it remains planned.

---

## 6. Relationship to other Wayfinder tickets

| Ticket | Uses this asset for |
| --- | --- |
| Grilling: Resolve Design Spec vs ADR conflicts (#18) | Which ADR + Roadmap edits to lock; UI-0…UI-8 proposals |
| Grilling: Stub copy and gap-marking (#19) | How orphans appear in layout until UI-* land |
| `/to-spec` → `/to-tickets` after map | Build order from UI-* + existing 9D / Agent Core / 10–13 |

---

## 7. Citation pattern

- “Orphan: **DS-INSPECTOR-*** — no proxy roadmap path; propose **UI-4**.”  
- “Misaligned: 9B.1 floating MCP vs **DS-CONSOLE-mcp**; propose **UI-6** (migrate).”  
- “Partial: FileTree under 9B.1 ≈ **DS-EXPLORER-project** only; propose **UI-2**.”  
- “Vault unread: confirm orphans against *Apex Pilot PR Roadmap* body before editing vault.”

---

## 8. Follow-ups

1. Vault-mounted re-read of *Apex Pilot PR Roadmap* + *Apex Pilot* → amend this file.  
2. Optionally recover *Apex Pilot Desktop UX* note and mark it superseded by Design Spec.  
3. Copy `figure_1` / `figure_2` into `.scratch/ui-overhaul/figures/` for layout proof.  
4. Do **not** implement UI or edit vault in this ticket.
