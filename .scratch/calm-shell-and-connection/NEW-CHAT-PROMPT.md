# Prompt: Chart calm-shell + connection-durability maps, then cook

Paste this entire file into a **new** Cursor chat (new context window). Attach `/wayfinder` (and grilling/domain-modeling if prompted).

---

You are continuing Apex Pilot work after [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61) finished figure-matching IA. Product header density is improved; the remaining pain is **busy dual-primary chrome** and **connection reconnect thrash**.

## Hard rules

- Follow `/wayfinder` from `c:\Users\mikec\.agents\skills\wayfinder\SKILL.md` and `docs/agents/issue-tracker.md` (GitHub).
- Refer to maps and tickets **by name** (title wrapping the link), never bare `#nn` alone.
- **Never resolve more than one ticket per session.**
- Charting a map is one session’s work: destination → frontier grill → create map + tickets + blocking. Do **not** also resolve tickets in the same charting session unless the user explicitly overrides.
- Hard product boundaries unchanged: no APEX export / root `f*.sql` edits; no Oracle password persistence; Stub honesty (no fake Execute success). SQL-via-MCP is the **current** ADR ([ADR-0002](docs/adr/0002-sql-execution-through-sqlcl-mcp.md)) until the connection map explicitly supersedes it.
- Prefer Cursor / Codex-desktop calm focus over VS Code dashboard density. SQL Developer VS Code is inspiration for connection reuse only — we are **not** building VS Code.

## Order of work (mandatory)

1. **Chart Map A first** — UI calming / focus-hide shell.  
2. **Chart Map B second** — database connection durability (and dual-path grill if needed).  
3. **Implement Map A tickets** via `/wayfinder` (one ticket per session) until Map A frontier is clear.  
4. **Implement Map B tickets** the same way after Map A is done (or after Map A’s blocking path for “usable daily” is done — do not interleave casually).  
5. Maintain/update the runbook:  
   `.scratch/calm-shell-and-connection/IMPLEMENTATION-ORDER.md`  
   After both maps exist, replace placeholder ticket names with real GitHub issue titles + links and the true frontier order.

## User intent (source of truth)

### UI / calm shell

- Shell still feels too busy; keep the pieces, but make what matters more visible and allow hiding what isn’t needed.
- File tree: names are **centered** in the region — should be left-aligned; add **folder + file-type icons**.
- Activity Rail is too tiny — aim ~**1.5×** hit targets; on larger screens allow **icons + text** (not icons-only forever).
- In **Files** Focus Mode, Mission often shrinks unusable — consider **hiding Mission by default** in Files (bring back via Layout Chrome).
- Not all sections are drag-resizable (Explorer / Mission / SQL editor / Inspector) — **uniform splitters** for visible peers.
- Lean Cursor-agent / Codex-desktop: primary work surface + secondary tools as **slide-out drawers** (user choice of left/right), icon button to open, easy to dismiss — not everything permanent on one page.
- Focus Modes should hide/show chrome for crunch work (e.g. Agent + editor open; Inspector / DB browse available but off-stage until slid out).

### Connection durability

- Connection appears to **reconnect often** when closing dialogs/windows — big issue.
- First fix should prefer **app-owned session reuse / pooling** so SQL editor, schema browse, etc. borrow one project connection instead of each component reconnecting.
- Only if MCP reuse is insufficient: grill dual-path — interactive SQL/browse via robust **python-oracledb**; **SQLcl MCP** reserved for agent/skill DB work (SQL Developer VS Code as inspiration). That requires an **ADR supersede** of ADR-0002 — do not implement dual-path without that decision ticket resolving first.
- Short-term: stop remount/auto-connect thrash; one primary session for the project’s chosen connection; honest connected/reconnecting/dead cues in Context Bar + status bar.

## Session plan for THIS chat (charting only)

### Phase 1 — Chart Map A (UI calming)

1. Run grilling + domain-modeling to **name the destination** (1–2 lines). Suggested destination gist:  
   *Ship a calm Focus shell: primary work surface + hideable/slide-out secondary tools, larger Activity Rail with optional labels, left-aligned iconed file tree, and uniform resize — Cursor-light, not everything-on-one-page.*
2. Breadth-first grill the frontier (do not deep-implement). Cover at least:
   - Focus Mode hide defaults (esp. Files → Mission hidden)
   - Slide-out ownership (Explorer / Inspector / DB browse; side preference)
   - Activity Rail size + icons-only vs icons+labels
   - File tree alignment + icons
   - Uniform splitters
   - What stays out of scope (full visual rebrand, Agent Core fake demos, etc.)
3. Create map issue labeled `wayfinder:map`. Notes must name skills: grilling, domain-modeling, design-system-patterns, frontend-design, web-design-guidelines, redesign-existing-projects, and point at `.scratch/ui-overhaul/` + `CONTEXT.md` + ADR-0007.
4. Create child tickets (`wayfinder:grilling` / `wayfinder:task` / etc.), then wire GitHub native `blocked_by` edges.
5. Update `.scratch/calm-shell-and-connection/IMPLEMENTATION-ORDER.md` Map A section with real titles/links.
6. **Stop.** Do not resolve Map A tickets yet.

### Phase 2 — Chart Map B (connection durability)

1. Name destination. Suggested gist:  
   *Make the project’s chosen Oracle connection durable for the app session: one owned session reused by SQL/browse surfaces; eliminate reconnect thrash; decide MCP-only pooling vs oracledb+MCP dual-path with ADR if needed.*
2. Breadth-first grill:
   - Reproduce/classify reconnect causes (frontend auto-connect vs MCP lifecycle)
   - App-owned primary session + borrow API
   - Whether ADR-0002 stays or is superseded
   - What stays MCP-only regardless
3. Create second `wayfinder:map`, children, blocking edges.
4. Update IMPLEMENTATION-ORDER.md Map B section.
5. **Stop charting.** Hand the user the cook order below.

### Phase 3 — Tell the user how to cook (after both maps exist)

Print:

1. Exact `/wayfinder` invocation order (Map A tickets in frontier order, then Map B).
2. Reminder: one ticket per chat/session; claim before work; branch + PR pattern as prior map.
3. Point at IMPLEMENTATION-ORDER.md as the living checklist.

## Recommended ticket shapes (use when charting; refine in grill)

### Map A — expected tickets (adjust names after grill)

| Order | Type | Working title | Notes |
| --- | --- | --- | --- |
| A1 | grilling | Focus Mode hide/show + slide-out ownership | HITL — locks Files→Mission, drawers, sides |
| A2 | grilling | Activity Rail density + labels mode | HITL if trade-offs; else fold into task |
| A3 | task | Activity Rail ~1.5× + icons/labels mode | AFK after A2 if split |
| A4 | task | File tree left-align + folder/file-type icons | AFK |
| A5 | task | Uniform splitters for visible peers | AFK |
| A6 | task | Wire Focus hide + slide-out drawers | AFK — **blocked by A1** |

Suggested blocking: A6 blocked_by A1; A3 blocked_by A2 if A2 exists; A4/A5 can parallel after A1 if unblocked.

### Map B — expected tickets (adjust after grill)

| Order | Type | Working title | Notes |
| --- | --- | --- | --- |
| B1 | grilling | Durable project connection session | HITL — MCP reuse vs dual-path |
| B2 | research | SQLcl MCP session reuse + SQLDev VS Code patterns | AFK — optional if B1 needs evidence |
| B3 | task | Stop reconnect thrash + app-owned session borrow | AFK — **blocked by B1** (MCP-reuse path) |
| B4 | grilling/task | ADR supersede + oracledb interactive path | Only if B1 chooses dual-path |
| B5 | task | Wire SQL editor / schema browse to borrowed session | AFK — blocked by B3 (and B4 if dual-path) |

## Implementation cook order (user runs these as separate `/wayfinder` sessions)

After maps exist, replace this list in IMPLEMENTATION-ORDER.md with real links. Default cook sequence:

1. Map A grilling tickets in frontier order (usually A1, then A2 if present).  
2. Map A AFK tasks: rail → file tree → splitters → focus hide/drawers (respect blockers).  
3. Only when Map A destination is clear (or user says “good enough for daily”): start Map B.  
4. Map B: B1 (+ B2 if needed) → B3 → B5; B4 only if dual-path chosen.

## Assets / context to load when charting

- Map history: https://github.com/xamdxlonewolf/apex_pilot/issues/61  
- `.scratch/ui-overhaul/app-menu-vs-product-header-ownership.md`  
- `.scratch/ui-overhaul/product-header-connection-density.md`  
- `.scratch/ui-overhaul/focus-mode-visual-primacy.md`  
- `.scratch/ui-overhaul/figure-matching-gap-inventory.md`  
- `CONTEXT.md`, `docs/adr/0002-sql-execution-through-sqlcl-mcp.md`, `docs/adr/0007-desktop-shell-and-workspace-ux.md`  
- Frontend: `ActivityRail.tsx`, `FileTree.tsx`, `IdeWorkspace.tsx` (autoConnect), `App.tsx` (connectSelectedConnection), `styles.css` (`.activity-rail`, `.file-tree`)  
- Backend: `backend/README.md` MCP session ownership notes; `apex_pilot.mcp` package  

## Definition of done for THIS charting chat

- [ ] Map A created (`wayfinder:map`) with destination, notes, fog, children, blockers  
- [ ] Map B created the same way  
- [ ] IMPLEMENTATION-ORDER.md filled with real issue titles + URLs and cook order  
- [ ] User given the first frontier ticket name to open next (`/wayfinder` on Map A’s first grilling)  
- [ ] No implementation PRs in this charting chat unless user explicitly overrides  

Start now with Phase 1: name Map A’s destination via grilling (one question at a time).
