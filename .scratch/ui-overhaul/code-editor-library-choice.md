# Code editor library choice

**Ticket:** [Task: Real code editor for SQL and common languages](https://github.com/xamdxlonewolf/apex_pilot/issues/70)  
**Decision:** Monaco Editor via `@monaco-editor/react` (+ `monaco-editor`), bundled
locally for Tauri (Vite workers + `loader.config({ monaco })` — no CDN).

## Options considered

| Option | Fit | Notes |
|--------|-----|-------|
| **Monaco** | Chosen | Named in Design Spec tech stack; VS Code–class SQL/JS/TS/Python/CSS highlighting; shared models per tab path |
| CodeMirror 6 | Strong alt | Lighter bundle, simpler Vite/workers; would diverge from Spec stack naming |
| Ace | Rejected | Older ecosystem; weaker TS/React story for a new shell |

## Language pack (initial)

Monaco built-ins only (no custom Oracle PL/SQL grammar yet):

- **SQL / PL/SQL-ish files:** `.sql`, `.pls`, `.pck`, `.pks`, `.pkb`, … → `sql`
- **JS/TS:** `.js` / `.jsx` / `.ts` / `.tsx` (+ mjs/cjs/mts/cts)
- **Python, CSS/SCSS/Less, JSON, HTML, Markdown, YAML/XML, shell, and common systems languages** as mapped in `frontend/src/editorLanguages.ts`
- **Fallback:** `plaintext`

## Constraints preserved

- SQL remains editable only in the SQL Editor tab; execution still via guarded `/sql/run` → SQLcl MCP.
- Protected APEX / root `f*.sql` opens stay read-only.
- Mission composer stays a plain textarea (natural language, not code).
