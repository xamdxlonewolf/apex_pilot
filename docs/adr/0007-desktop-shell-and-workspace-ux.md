# ADR-0007: Desktop Shell and Workspace UX

## Status

Accepted

## Date

2026-07-09

## Context

PR 9B delivered project wizard and preflight APIs with an interim stacked-cards
UI. Agent Core and the CLI launcher need a dense IDE shell: startup funnel,
always-on chrome, project panes, schema/SQL tools against MCP, and a floating
MCP Activity window. Locked product decisions live in the Apex Pilot Desktop UX
note.

## Decision Drivers

- Replace marketing-style interim UI with IDE chrome before Agent Core leans on it.
- Keep native folder pickers and Tauri FS for local files; backend owns MCP and metadata.
- Preserve APEX export folder and root `f*.sql` invariants in the file tree.
- Make SQL sheet execution explainable through classification and MCP activity.
- Avoid inventing Agent Core chat send behavior early.

## Considered Options

### Option 1: Dense IDE Shell With Guarded SQL Sheet API

- Pros: Matches locked UX; reuses existing schema/activity routes; adds a thin
  classify/execute façade for the SQL sheet without exposing raw MCP to the UI.
- Cons: Requires frontend restructuring and Tauri FS/dialog/window permissions.

### Option 2: Keep Interim Cards Until Agent Core

- Pros: Smaller near-term diff.
- Cons: Agent Core would build against throwaway layout; violates PR sequencing.

### Option 3: Frontend-Only SQL Execution Via Raw MCP

- Pros: Fewer backend routes.
- Cons: Breaks guarded façade invariant and weakens classification/approval path.

## Decision

Apex Pilot will ship a dense desktop IDE shell as PR 9B.1:

1. Startup funnel: silent health → full preflight when first-time or unhealthy →
   profile setup when needed → recent-projects picker → project workspace.
2. Always-on native-style menus and bottom status bar; left/right panes only when
   a project is open.
3. Left project file tree via Tauri FS (browser fallback for Vite-only tests),
   junk hidden by default, APEX export folders and root `f*.sql` shown as
   protected (not treated as ordinary editable noise).
4. Center chat composer always present; send disabled until Agent Core.
5. Right shared tab strip for schema views, project files, and SQL sheets;
   profile-scoped layout prefs and project-scoped open tabs may start in local
   desktop storage and later move into SQLite without changing the UX contract.
6. Schema browser uses existing MCP-backed schema summary; SQL sheet classifies
   and executes through new guarded backend routes that call SQLcl MCP
   `run-sql` on the primary session only.
7. MCP Activity opens as a floating window when Tauri window APIs are available,
   otherwise as a floating overlay in browser/dev mode.
8. Close project returns to the picker with an unsaved-work prompt when the SQL
   sheet or other editors have dirty state. One project per window.

## Consequences

### Positive

- Desktop surface matches the locked UX before Agent Core.
- SQL sheet stays behind classification and MCP activity logging.
- File operations stay native; database work stays on the backend MCP boundary.

### Negative

- Larger frontend rewrite than incremental card polish.
- Layout/tab persistence starts client-side until a dedicated prefs migration.

### Risks

- Tauri plugin permissions must stay scoped to the project root for FS access.
- SQL sheet must never bypass `PROMPT`/`BLOCK` decisions from the classifier.

## Implementation Notes

- Add `POST /sql/classify` and `POST /sql/run` for the SQL sheet.
- Prefer `@tauri-apps/plugin-dialog` and `@tauri-apps/plugin-fs` for pickers and
  tree reads.
- Do not auto-install prerequisites; keep guided preflight from ADR-0006.
- Do not enable chat send until Agent Core.

## Related Decisions

- [ADR-0001](0001-local-first-desktop-architecture.md)
- [ADR-0002](0002-sql-execution-through-sqlcl-mcp.md)
- [ADR-0005](0005-local-project-manifest-and-sqlite-storage.md)
- [ADR-0006](0006-project-initialization-wizard-and-preflight.md)
