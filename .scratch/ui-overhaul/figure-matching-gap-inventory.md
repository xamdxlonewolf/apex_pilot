# Gap inventory: current open-project shell vs figure_1 / figure_2

Research asset for
[Research: Gap inventory current shell vs figure_1/2](https://github.com/xamdxlonewolf/apex_pilot/issues/62)
(map: [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61)).

**North star:** `docs/design/figures/figure_1.png` + `figure_2.png`, with product
language from root `CONTEXT.md` (Mission, not Conversation). Design Spec
supports; Cursor informs Explorer FS density/craft only.

**Authority for this inventory:** live `frontend/src/*` as of this ticket, plus
CONTEXT.md and map Notes. Prior assets under `.scratch/ui-overhaul/` (especially
`current-ui-adr-vs-design-spec.md`) describe the interim 9B.1 shell and are
**historical** for panel philosophy — do not treat them as current truth.

**Does not invent product intent** beyond CONTEXT.md and map Notes. Does not
choose Focus Mode names, App Menu ownership, or editor library — those remain
map fog / sibling tickets.

---

## Snapshot: what the open-project shell is today

| Region | Current implementation | Fidelity |
| --- | --- | --- |
| Always-on menubar | In-app `Project` / `View` button groups + trailing “Apex Pilot” brand (`App.tsx`) | Partial — not native App Menu; not figure Product Header |
| Toolbar | New SQL (stub), Run (stub), Connect, MCP Activity (`IdeWorkspace`) | Partial — actions present; progressive enablement incomplete |
| Context Bar | Project, Connection, Mappings, Working Schema, Environment, health pills | Partial — closest analogue to figure header identity strip |
| Left | Multi-section `Explorer` via in-panel section buttons | Partial — hybrid intent present; **no Activity Rail** |
| Center | Tab strip: Mission (`MissionComposer` stub), SQL (`SqlSheet` textarea), file preview / editor stubs | Partial — dual surfaces exist as tabs, not Focus Modes |
| Right | Pure `InspectorPanel` (four static Stub sections) | Partial — role correct; **not stage-driven** |
| Bottom | Docked `DeveloperConsole` (MCP Activity live; other tabs Stub) | Partial — IA correct; craft/tab depth vs figure TBD |
| Floating MCP | Still available when no project / migration path | Migration — not product target when project open |

Legacy `ChatPane.tsx` still exists but is **not** mounted in the open-project
workspace (`IdeWorkspace` uses `MissionComposer`).

---

## Gap matrix (figure north star → current → gap)

Legend:

- **Match** — current shell already matches figure/CONTEXT intent for this slice
- **Partial** — region or role exists; shape, naming, or depth wrong
- **Missing** — figure/CONTEXT requires it; shell lacks it
- **Deferred** — correctly Stub / Agent Core gated; honesty is intentional, not a
  figure-fidelity bug for this map’s IA path

### 1. Product Header + identity chrome

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| Dense top Product Header: brand, project, environment, health, connection/schema cues, utility actions | Split across menubar brand text + Toolbar + Context Bar health pills | **Partial** |
| Native App Menu owns OS-standard File/Edit/View/Help discoverability | In-app Project/View menubar only | **Missing** |
| “Conversation” label in figures | Product language is **Mission** (`CONTEXT.md`) | **Match** (naming policy) — implement Mission, do not revive Conversation |

**Gap:** Consolidate toward figure-dense Product Header without VS Code
menu-as-IA; move OS-standard actions to native Tauri App Menu. Ownership split
is a sibling grilling ticket, not resolved here.

### 2. Activity Rail + Explorer hybrid

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| Narrow left Activity Rail icons switching Explorer posture (Files, Agent/Mission, Code, Database, …) | No rail; Explorer section buttons inside the left pane | **Missing** (rail) |
| Files = real FS tree (local/git source of truth) | `FileTree` via Tauri FS; APEX/`f*.sql` protected | **Match** (capability) |
| Database / APEX postures with open-to-view objects | Database via `SchemaBrowser`; APEX/REST/favorites/pinned/recent Stub | **Partial** |
| Cursor-informed FS density/craft | Functional tree; not Cursor-grade density/craft | **Partial** (craft) |
| Recent files strip (figure_1) | Recent Explorer section is Stub; no figure-like recent strip | **Partial** / Stub |

**Gap:** Add Activity Rail as primary posture switch; keep hybrid Explorer
bodies; raise Files craft; deepen Database/APEX open-to-view (detail still fog).

### 3. Workspace dual-primary + Focus Modes

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| Dual-primary center: Mission peer with editors | Center tabs host Mission + SQL + file/stubs | **Partial** |
| Focus Modes switch primacy (Agent/Mission-forward vs editor-forward) without demoting the peer out of the product | Panel show/hide via View menu / shortcuts only (`showMission`, etc.) | **Missing** |
| Mission surface: intent, plan checklist, proposed changes (figures show rich running Mission) | `MissionComposer` honest Stub chrome (card, timeline labels, composer; Send stubbed) | **Deferred** for Agent Core content; **Partial** for chrome shape vs figure |
| Figure center labeled Conversation | Must ship as Mission | **Match** (policy) |

**Gap:** Introduce named Focus Modes and default landing (grilling sibling).
Layout Chrome (panel toggles) stays secondary. Do not fake Mission success data.

### 4. Stage-driven Inspector

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| Stages: Plan → SQL Generated → Review → Execute → Complete | Four always-visible Stub sections: Progress, Classification, Object summaries, Checklist | **Partial** / wrong model |
| Stage-specific evidence (plan summary, SQL preview, classification/PROMPT, execute progress, completion stats) | Stub copy only; no stage machine | **Missing** (stage chrome) |
| Inspector explains; does not own SQL edit/run | SQL lives in center `SqlSheet`; Inspector has no tool tabs | **Match** |
| Honest empty/stub evidence before Agent Core | Stub surfaces present | **Match** (honesty) |

**Gap:** Replace static accordion with stage-driven chrome. Empty/stub evidence
OK until Agent Core; never demo Approve & Execute success.

### 5. Progressive enablement (Toolbar / actions)

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| Actions enabled when real preconditions exist; stub only when capability missing | Connect gated on backend/connection; **New SQL** and **Run** always `stubActionProps` even when SQL Editor + connection exist | **Partial** — violates progressive enablement for New SQL / Run |
| Mission Send disabled until Agent Core | Send stubbed | **Match** |
| No fake successful Execute | No fake execute path in Inspector | **Match** |

**Gap:** Enable New SQL / Run when preconditions are real; keep Mission Send and
Inspector execute actions honest about missing Agent Core.

### 6. Editor fidelity

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| Real code-editor surface for SQL | `SqlSheet` uses `<textarea>` | **Missing** |
| Real editors for common languages (JS/TS/Python/CSS, …) | File open → read-only `<pre>` preview; File Editor Stub for full edit | **Missing** / Stub |
| SQL is the only place SQL may be edited | Center SQL tab only | **Match** |
| Object / package / APEX / REST / diff viewers | Center stub tabs | **Deferred** / Stub (open-to-view detail still fog) |

**Gap:** Replace textarea/preview with a real shared code-editor stack; language
pack / library choice remains fog for the editor ticket.

### 7. Developer Console (bottom chrome)

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| In-shell bottom console with MCP Activity prominent | Docked `DeveloperConsole`; MCP Activity tab live | **Match** (IA) |
| Adjacent tabs (Problems, Output, SQL History, Oracle Messages, Tasks, …) | Tabs present; non-MCP tabs Stub | **Partial** |
| Figure_1 detail richness (live call detail, request id, streaming lines) | Functional MCP list/panel; not figure-crafted | **Partial** (craft) |
| Floating MCP as product target | Still exist as migration / no-project path | Migration OK; not the open-project target |

**Gap:** How far first IA slices must visually match figure_1 bottom chrome
remains map fog; tab inventory already largely placed.

### 8. Density / motion / visual craft

| Figure / CONTEXT | Current | Verdict |
| --- | --- | --- |
| Dense Mission Control craft (figure dark IDE) | Working dark shell; density prefs (default/compact/comfortable) already in settings | **Partial** |
| ADR-0007 §12 density/motion gates | Keyboard toggles, reduced-motion attribute, density modes shipped ahead of earlier “Default-only” shell note | **Partial** — prefs exist; figure craft pass still owed |
| Visual polish gated by design skills | Not figure-matched | **Missing** (end-of-map polish ticket) |

**Gap:** Final craft pass after IA; reconcile density/motion carryover with
figure intent without inventing new product scope.

---

## Priority ordering (for the map, not new scope)

Already ticketed on the map; this inventory only ranks gap severity against the
figures:

1. **Activity Rail + Focus Modes + Workspace dual-primary** — largest IA delta
   vs figures (shell task after Focus Mode grilling).
2. **Stage-driven Inspector chrome** — right pane role is correct; model is wrong.
3. **Progressive enablement for New SQL / Run** — small, high-signal honesty fix.
4. **Hybrid Explorer deepen + FS craft** — Database/APEX browse and Files density.
5. **Real code editor** — SQL + common languages.
6. **Product Header + native App Menu** — after ownership grilling.
7. **Visual polish / density-motion craft** — last, design-skills gated.

---

## Reuse map (prior assets)

| Asset | Still valid? | Use for |
| --- | --- | --- |
| `docs/design/figures/figure_1.png`, `figure_2.png` | Yes | North star |
| `docs/design/Apex Pilot Desktop Design Spec.txt` | Yes (supports) | Detail when IA tickets need Spec IDs |
| `CONTEXT.md` | Yes | Glossary / Mission naming |
| `docs/adr/0007-…` | Partially stale vs live shell + this map’s destination | Amend ticket owns rewrite |
| `.scratch/ui-overhaul/current-ui-adr-vs-design-spec.md` | Historical for 9B.1 composition | Cite only as “was”; do not copy panel matrix |
| `.scratch/ui-overhaul/design-spec-surface-inventory.md` | Mostly valid as DS-* catalog | Cross-ref Spec IDs |
| `.scratch/ui-overhaul/roadmap-gap-scan*.md` | Stale roadmap proxy | Ignore for current shell gaps |

---

## Explicit non-gaps (do not ticket again)

- SQLcl MCP-only SQL, guarded façades, APEX/`f*.sql` nontouch, no password /
  result-row persistence — invariants, not UX gaps.
- Multi-project concurrent open — out of scope on the map.
- Fake demo Missions / Approve & Execute success — out of scope.
- Agent Core send/streaming content — Inspector/Mission stay honest Stub until
  Agent Core; not a figure-matching fake-data ticket.
