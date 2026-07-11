# Design Spec surface inventory

Research asset for Wayfinder ticket
[Research: Digest Design Spec surfaces and figures](https://github.com/xamdxlonewolf/apex_pilot/issues/15)
(map: [Wayfinder: Apex Pilot desktop UI overhaul](https://github.com/xamdxlonewolf/apex_pilot/issues/14)).

## Sources

| Artifact | Location | Status in this digest |
| --- | --- | --- |
| Design Spec | Vault `…/obsidian_vault/programming/Apex Pilot Desktop Design Spec.txt` (~93KB, ~4.3k–8.5k lines depending on measure) | **Heading TOC complete** (300 headings, §§1–265). Body text only sampled at head (§§1–3.1) and §7–8. |
| Figure 1 | Expected beside the Design Spec as `figure_1` | Described in §7 only; **image not loaded** in this session. |
| Figure 2 | Expected beside the Design Spec as `figure_2` | Described in §7 only; **image not loaded** in this session. |

Companion files in this folder:

- `design-spec-heading-toc.md` — full heading list with source line numbers
- `design-spec-body-fragments.md` — recovered body fragments only

**Caveat:** This inventory is structured from the Design Spec’s own section map plus the recovered philosophy/identity/figure captions. Per-section interaction rules, exact copy, token values, and shortcut tables live in the vault body and were not available to this cloud session. Later tickets that need body-level detail should re-read the vault file on a machine that mounts it (or copy the spec into the repo).

---

## Product framing (must account for)

From §§1–8 (fragments + TOC):

- **Product shape:** professional desktop IDE (JetBrains / VS Code / DataGrip / SQL Developer / DBeaver / Postman feel) — not a dashboard, web app, or SaaS shell.
- **Core principles:** Developer First; Trust Before Automation; Context Never Disappears; Explainability; Progressive Disclosure; Local First.
- **Product identity:** AI is navigator; SQLcl executes; Oracle does work; Apex Pilot orchestrates; user stays in control.
- **Figures (conceptual, not pixel-perfect):**
  - **Figure 1 — Mission Control layout:** window composition, panel hierarchy, density, visual style, overall proportions.
  - **Figure 2 — annotated layout:** conversation workspace, Inspector, MCP Activity, primary interaction zones.

---

## Surface families

Stable IDs (`DS-*`) are for later conflict/gap/grilling tickets to cite without re-reading the vault.

### DS-SHELL — Window shell & chrome (§§9–25)

| ID | Surface / concern | Spec §§ |
| --- | --- | --- |
| DS-SHELL-window | Window shell purpose | 9 |
| DS-SHELL-arch | Shell architecture | 10 |
| DS-SHELL-panels | Panel philosophy | 11 |
| DS-SHELL-menu | Menu bar | 12 |
| DS-SHELL-toolbar | Toolbar | 13 |
| DS-SHELL-context | Context bar + context rules | 14–15 |
| DS-SHELL-health | Health indicators | 16 |
| DS-SHELL-layout | Layout proportions, resizing, docking | 17–19 |
| DS-SHELL-startup | Startup layout | 20 |
| DS-SHELL-session | Restoring sessions | 21 |
| DS-SHELL-empty | Empty workspace | 22 |
| DS-SHELL-offline | Offline mode | 23 |
| DS-SHELL-weight | Visual weight | 24 |
| DS-SHELL-motion | Shell motion | 25 |

### DS-MISSION — Mission workspace / conversation (§§26–46)

Primary “Mission Control” center surface (Figure 1/2 conversation workspace).

| ID | Surface / concern | Spec §§ |
| --- | --- | --- |
| DS-MISSION-purpose | Mission workspace purpose + design philosophy | 26–27 |
| DS-MISSION-layout | Workspace layout | 28 |
| DS-MISSION-timeline | Timeline, mission card, timeline events | 29–31 |
| DS-MISSION-ai | AI responses | 32 |
| DS-MISSION-plan | Planning stage + plan display | 33–34 |
| DS-MISSION-sql | SQL generation | 35 |
| DS-MISSION-review | Review stage | 36 |
| DS-MISSION-exec | Execution + completion | 37–38 |
| DS-MISSION-composer | Prompt composer + suggested prompts | 39–40 |
| DS-MISSION-history | Mission history | 41 |
| DS-MISSION-stream | Streaming | 42 |
| DS-MISSION-status | Mission status | 43 |
| DS-MISSION-hierarchy | Visual hierarchy | 44 |
| DS-MISSION-empty | Empty state | 45 |
| DS-MISSION-rules | Mission rules | 46 |

### DS-INSPECTOR — Inspector (§§47–66)

Right-side (or docked) workflow/context inspector (Figure 2).

| ID | Surface / concern | Spec §§ |
| --- | --- | --- |
| DS-INSPECTOR-purpose | Purpose + design philosophy | 47–48 |
| DS-INSPECTOR-layout | Inspector layout | 49 |
| DS-INSPECTOR-progress | Workflow progress | 50 |
| DS-INSPECTOR-header | Inspector header | 51 |
| DS-INSPECTOR-context | Context section | 52 |
| DS-INSPECTOR-planning | Planning state + checklist | 53–54 |
| DS-INSPECTOR-sql | SQL generated state + SQL viewer | 55–56 |
| DS-INSPECTOR-class | Classification | 57 |
| DS-INSPECTOR-objects | Object summary + dependency analysis | 58–59 |
| DS-INSPECTOR-exec | Execution stage + completion | 60–61 |
| DS-INSPECTOR-error | Error + offline states | 62–63 |
| DS-INSPECTOR-actions | Actions | 64 |
| DS-INSPECTOR-rules | Rules + future enhancements | 65–66 |

### DS-EXPLORER — Project Explorer (§§67–88)

| ID | Surface / concern | Spec §§ |
| --- | --- | --- |
| DS-EXPLORER-purpose | Purpose + design philosophy + layout | 67–69 |
| DS-EXPLORER-search | Search | 70 |
| DS-EXPLORER-project | Project section | 71 |
| DS-EXPLORER-favorites | Favorites | 72 |
| DS-EXPLORER-db | Database section | 73 |
| DS-EXPLORER-apex | APEX section | 74 |
| DS-EXPLORER-rest | REST section | 75 |
| DS-EXPLORER-recent | Recent | 76 |
| DS-EXPLORER-pinned | Pinned | 77 |
| DS-EXPLORER-nodes | Object nodes | 78 |
| DS-EXPLORER-menu | Context menu | 79 |
| DS-EXPLORER-click | Single / double click | 80–81 |
| DS-EXPLORER-dnd | Drag and drop | 82 |
| DS-EXPLORER-filter | Filtering + badges | 83–84 |
| DS-EXPLORER-width | Explorer width | 85 |
| DS-EXPLORER-empty | Empty states | 86 |
| DS-EXPLORER-perf | Performance + rules | 87–88 |

### DS-WORKSPACE — Editors & workspace tabs (§§89–110)

| ID | Surface / concern | Spec §§ |
| --- | --- | --- |
| DS-WORKSPACE-purpose | Purpose + design philosophy + layout | 89–91 |
| DS-WORKSPACE-types | Workspace types | 92 |
| DS-WORKSPACE-tabs | Tabs + tab icons | 93–94 |
| DS-WORKSPACE-sql | SQL editor / header / toolbar | 95–97 |
| DS-WORKSPACE-object | Object viewer | 98 |
| DS-WORKSPACE-package | Package viewer | 99 |
| DS-WORKSPACE-apex | APEX viewer | 100 |
| DS-WORKSPACE-rest | REST viewer | 101 |
| DS-WORKSPACE-diff | Diff viewer | 102 |
| DS-WORKSPACE-split | Split editors | 103 |
| DS-WORKSPACE-crumb | Breadcrumb | 104 |
| DS-WORKSPACE-dirty | Unsaved changes | 105 |
| DS-WORKSPACE-ro | Read-only | 106 |
| DS-WORKSPACE-search | Search | 107 |
| DS-WORKSPACE-nav | Navigation | 108 |
| DS-WORKSPACE-perf | Performance + rules | 109–110 |

### DS-WORKFLOW — Workflow engine / mission lifecycle (§§111–130)

Cross-cutting flow that Mission + Inspector must reflect.

| ID | Flow / state | Spec §§ |
| --- | --- | --- |
| DS-WORKFLOW-standard | Standard workflow | 112 |
| DS-WORKFLOW-states | Workflow states | 113 |
| DS-WORKFLOW-intent | Intent | 114 |
| DS-WORKFLOW-planning | Planning | 115 |
| DS-WORKFLOW-plan-review | Plan review | 116 |
| DS-WORKFLOW-sql-gen | SQL generation | 117 |
| DS-WORKFLOW-sql-review | SQL review | 118 |
| DS-WORKFLOW-class | Classification | 119 |
| DS-WORKFLOW-exec-review | Execution review | 120 |
| DS-WORKFLOW-exec | Execution | 121 |
| DS-WORKFLOW-done | Completion | 122 |
| DS-WORKFLOW-fail | Failure | 123 |
| DS-WORKFLOW-cancel | Cancellation | 124 |
| DS-WORKFLOW-offline | Offline | 125 |
| DS-WORKFLOW-audit | Audit | 126 |
| DS-WORKFLOW-version | Versioning | 127 |
| DS-WORKFLOW-long | Long-running operations | 128 |
| DS-WORKFLOW-multi | Multiple missions | 129 |
| DS-WORKFLOW-rules | Workflow rules | 130 |

**Canonical happy path (from TOC order):** Intent → Planning → Plan Review → SQL Generation → SQL Review → Classification → Execution Review → Execution → Completion (with Failure / Cancellation / Offline branches).

### DS-INTERACT — Interaction principles (§§131–156)

| ID | Concern | Spec §§ |
| --- | --- | --- |
| DS-INTERACT-hierarchy | Interaction hierarchy | 132 |
| DS-INTERACT-nav | Navigation | 133 |
| DS-INTERACT-inspect | Inspection | 134 |
| DS-INTERACT-edit | Editing | 135 |
| DS-INTERACT-exec | Execution | 136 |
| DS-INTERACT-select | Selection | 137 |
| DS-INTERACT-menus | Context menus | 138 |
| DS-INTERACT-buttons | Primary / secondary / dangerous actions | 139–141 |
| DS-INTERACT-dialogs | Dialog philosophy + confirmations | 142–143 |
| DS-INTERACT-progress | Progress | 144 |
| DS-INTERACT-toast | Toast notifications | 145 |
| DS-INTERACT-errors | Error presentation | 146 |
| DS-INTERACT-hover | Hover | 147 |
| DS-INTERACT-focus | Focus | 148 |
| DS-INTERACT-kbd | Keyboard navigation | 149 |
| DS-INTERACT-dnd | Drag and drop | 150 |
| DS-INTERACT-inline | Inline editing | 151 |
| DS-INTERACT-empty | Empty states | 152 |
| DS-INTERACT-loading | Loading | 153 |
| DS-INTERACT-offline | Offline behavior | 154 |
| DS-INTERACT-undo | Undo | 155 |
| DS-INTERACT-rules | Interaction rules | 156 |

### DS-DESIGN — Design system / tokens (§§157–182, 264–265)

| ID | Concern | Spec §§ |
| --- | --- | --- |
| DS-DESIGN-personality | Visual personality | 158 |
| DS-DESIGN-color | Color philosophy, theme, palette | 159–161 |
| DS-DESIGN-surfaces | Surface hierarchy | 162 |
| DS-DESIGN-borders | Borders, corner radius, shadows | 163–165 |
| DS-DESIGN-type | Typography, type scale, font weight | 166–168 |
| DS-DESIGN-icons | Icons | 169 |
| DS-DESIGN-space | Spacing system + component spacing | 170–171 |
| DS-DESIGN-controls | Buttons, inputs, lists, tree, scrollbars | 172–176 |
| DS-DESIGN-motion | Motion | 177 |
| DS-DESIGN-focus | Focus | 178 |
| DS-DESIGN-density | Density modes | 179 |
| DS-DESIGN-states | Empty + loading states | 180–181 |
| DS-DESIGN-rules | Visual rules | 182 |
| DS-DESIGN-tokens | Design tokens | 264 |
| DS-DESIGN-icon-cat | Icon catalogue | 265 |

**Palette slots named in TOC:** window background, primary / secondary / elevated surface, border, accent, success, warning, error, information, text primary / secondary / disabled.

### DS-COMPONENTS — Component library (§§183–216)

Reusable building blocks (not screens): Panel, Panel Header, Section, Accordion, Card, Tree, Timeline, Timeline Event, Badge, Status Pill, Button, Split Button, Icon Button, Search Box, Command Palette, Tabs, Data Table, Property Grid, Key/Value Block, Code Block, Code Editor, Notification, Dialog, Wizard, Context Menu, Toolbar, Breadcrumb, Divider, Empty State, Loading Placeholder, Tooltip (+ rules).

### DS-CONSOLE — Developer Console (§§217–237)

In-shell console (Figure 2 MCP Activity lives here in the Design Spec).

| ID | Surface / concern | Spec §§ |
| --- | --- | --- |
| DS-CONSOLE-purpose | Purpose + design philosophy + layout | 217–219 |
| DS-CONSOLE-tabs | Console tabs | 220 |
| DS-CONSOLE-problems | Problems | 221 |
| DS-CONSOLE-output | Output | 222 |
| DS-CONSOLE-mcp | MCP Activity | 223 |
| DS-CONSOLE-mcp-detail | MCP Details | 224 |
| DS-CONSOLE-sql-hist | SQL History | 225 |
| DS-CONSOLE-oracle | Oracle Messages | 226 |
| DS-CONSOLE-tasks | Tasks | 227 |
| DS-CONSOLE-downloads | Downloads | 228 |
| DS-CONSOLE-notif | Notifications | 229 |
| DS-CONSOLE-filter | Filtering | 230 |
| DS-CONSOLE-toolbar | Console toolbar | 231 |
| DS-CONSOLE-autoscroll | Auto scroll | 232 |
| DS-CONSOLE-status | Console status | 233 |
| DS-CONSOLE-context | Context integration | 234 |
| DS-CONSOLE-persist | Persistence | 235 |
| DS-CONSOLE-perf | Performance + rules | 236–237 |

### DS-DIALOGS — Dialogs & wizards (§§238–249)

| ID | Surface | Spec §§ |
| --- | --- | --- |
| DS-DIALOGS-types | Dialog types + layout | 239–240 |
| DS-DIALOGS-confirm | Confirmation dialogs | 241 |
| DS-DIALOGS-wizard | Wizard philosophy / layout / navigation | 242–244 |
| DS-DIALOGS-project | Project creation wizard | 245 |
| DS-DIALOGS-connection | Connection wizard | 246 |
| DS-DIALOGS-import | Import wizard | 247 |
| DS-DIALOGS-prefs | Preferences | 248 |
| DS-DIALOGS-alerts | System alerts | 249 |

### DS-CONN — Connection & profile management (§§250–260)

| ID | Concern | Spec §§ |
| --- | --- | --- |
| DS-CONN-terms | Terminology | 251 |
| DS-CONN-context | Context bar (connection-facing) | 252 |
| DS-CONN-switcher | Connection switcher | 253 |
| DS-CONN-profile | Profile structure | 254 |
| DS-CONN-auth | Authentication | 255 |
| DS-CONN-validate | Validation | 256 |
| DS-CONN-env | Environment identity | 257 |
| DS-CONN-schema | Working schema selection | 258 |
| DS-CONN-history | Connection history | 259 |
| DS-CONN-safety | Safety | 260 |

### DS-PLATFORM — Cross-cutting platform (§§261–263)

| ID | Concern | Spec §§ |
| --- | --- | --- |
| DS-PLATFORM-shortcuts | Keyboard shortcuts | 261 |
| DS-PLATFORM-motion | Animation & motion | 262 |
| DS-PLATFORM-arch | React / Tauri architecture | 263 |

---

## Flows (for gap / grilling tickets)

1. **Startup / session:** empty workspace → startup layout → restore session (DS-SHELL-*).
2. **Connection/profile:** switcher, validation, environment identity, working schema (DS-CONN-*).
3. **Mission happy path:** Intent → … → Completion (DS-WORKFLOW-* mirrored in DS-MISSION-* + DS-INSPECTOR-*).
4. **Mission failure / cancel / offline:** DS-WORKFLOW-fail/cancel/offline + Inspector error/offline.
5. **Explore → open editor:** Explorer click/DnD → workspace tab/viewer (DS-EXPLORER-* → DS-WORKSPACE-*).
6. **SQL sheet path:** SQL editor + classification + execution review (DS-WORKSPACE-sql + DS-WORKFLOW-class/exec-review).
7. **Console observability:** Problems / Output / MCP Activity / SQL History / Oracle Messages (DS-CONSOLE-*).
8. **Wizards:** project creation, connection, import, preferences (DS-DIALOGS-*).

---

## Component families (rollup)

| Family | Members (from TOC) |
| --- | --- |
| Chrome | Menu bar, toolbar, context bar, health indicators, panels |
| Mission | Timeline, mission card, timeline events, prompt composer, suggested prompts |
| Inspector | Progress, header, context, checklists, SQL viewer, classification, object/dependency blocks |
| Explorer | Tree sections (project/favorites/db/APEX/REST/recent/pinned), badges, context menus |
| Editors | SQL / object / package / APEX / REST / diff viewers, tabs, breadcrumb, split |
| Console | Tabbed console including MCP Activity + details |
| Overlays | Dialogs, wizards, toasts, notifications, command palette, tooltips |
| Primitives | Panel, section, accordion, card, tree, timeline, badge, status pill, buttons, inputs, tables, property grid, code block/editor, empty/loading |

---

## Figure-driven layout anchors

Until figure images are attached to the repo or re-read from the vault:

| Figure | Must-account-for regions |
| --- | --- |
| Figure 1 | Full Mission Control composition: shell chrome + panel hierarchy + density/proportions |
| Figure 2 | Conversation/Mission workspace, Inspector, MCP Activity, primary interaction zones |

**Known fog (already on the map):** how closely tokens/theme must match figures vs design intent; MCP Activity as Design Spec console tab vs ADR-0007 floating Tauri window.

---

## Suggested citation pattern for later tickets

- Conflict list: “ADR-0007 floating MCP Activity vs **DS-CONSOLE-mcp** (§223) / Figure 2.”
- Gap scan: “**DS-EXPLORER-apex** (§74) — no PR Roadmap path?”
- Stub conventions: apply to any `DS-*` surface present in layout before backend exists.

---

## Follow-ups for this research asset

1. On a vault-mounted machine, re-read the Design Spec body and enrich each `DS-*` row with one-line behavioral gist (optional second pass; not required to unblock inventory-based tickets).
2. Copy or link `figure_1` / `figure_2` into `.scratch/ui-overhaul/figures/` so AFK agents can see them.
3. Vault notes *Apex Pilot PR Roadmap* and *Apex Pilot* are **out of scope for this ticket** — owned by [Research: Gap-scan PR Roadmap and Apex Pilot note vs Design Spec](https://github.com/xamdxlonewolf/apex_pilot/issues/17).
