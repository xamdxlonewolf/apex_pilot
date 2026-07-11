# Apex Pilot

Apex Pilot is a local-first Oracle development automation platform. The first product shape is a Mission Control desktop IDE that runs a local backend, uses Oracle SQLcl MCP for all database execution, and uses skills for Oracle/APEX intelligence and transformations.

## Core Architecture

- Frontend: React + Tauri desktop app.
- Backend: FastAPI local service.
- Agent layer: PydanticAI with LiteLLM model abstraction.
- Execution layer: Oracle SQLcl MCP only.
- Skill layer: Oracle `db` and `apex` skills plus shared/user extensions.
- Persistence: local SQLite metadata database, with secrets stored in OS keyring or environment variables.

## Locked Decisions

- Deployment model is local desktop first, with clear extension points for a future hosted or team server.
- Repository shape should be a monorepo with `backend/` for Python, `frontend/` for Tauri/React, and root docs/architecture guidance.
- Backend Python package name should be `apex_pilot`.
- Backend top-level modules should use explicit layers: `api`, `agent`, `mcp`, `skills`, `safety`, `schema`, `settings`, `storage`, and `events`.
- Backend quality stack should use `uv`, Ruff, Pyright, and Pytest.
- Frontend quality stack should use `pnpm`, Vite React TypeScript, ESLint, Prettier, and Vitest.
- First project artifacts should be repo guidance: expanded `README.md`, `AGENTS.md`, `CONTRIBUTING.md`, architecture docs/ADRs, contribution workflow, and Cursor project rules.
- Oracle connections should use SQLcl saved connection names only. Apex Pilot should discover connections via SQLcl MCP and should not store Oracle passwords.
- MCP execution should use a small process pool, but pooled sessions are read-only for discovery/comparison. Data-changing work must go through one explicit primary session.
- SQL safety policy: `SELECT` is allowed; `INSERT`, `UPDATE`, and constructive DDL are allowed; `DELETE` requires prompt and preview; destructive or security-sensitive SQL requires prompt or blocking depending on risk.
- SQL risk classification should use deterministic parsing/tokenization where possible, with conservative fallback for PL/SQL, SQLcl commands, and unknown syntax.
- SQLcl-specific `run-sqlcl` commands should use an allowlist by category. Safe metadata/formatting commands may proceed; Liquibase, import, script-style, or unknown commands need stronger approval.
- System skills come from `https://github.com/oracle/skills.git` by sparse checkout of only `apex/` and `db/`.
- System skills track upstream `main` with auto-update, but Apex Pilot must record installed commits, snapshot previous versions, expose update history, and support rollback.
- User skills may run with user consent, but Apex Pilot should make no hard sandbox claim for them.
- Same-name user skills should be additive add-ons to system skills, not replacements. Add-ons may contribute templates, examples, prompts, validation rules, or extra actions, but cannot override core system skill actions or safety policy.
- Skill execution should be manifest-driven through explicit Node and Python adapters. Apex Pilot should not execute arbitrary manifest-declared programs by default.
- If upstream Oracle skills do not contain Apex Pilot's desired manifest format, Apex Pilot should create adapter manifests/metadata alongside the sparse checkout and leave upstream files untouched.
- LLM support should be multi-provider through LiteLLM profiles, including remote LiteLLM proxy servers, direct OpenAI/Anthropic APIs, and local model options.
- Local persistence should default to metadata only. SQL result rows should not be persisted unless the user opts in.
- FastAPI should bind to loopback on a dynamic available port and require a per-run bearer token passed to Tauri at startup.
- Tauri should own the FastAPI backend as a sidecar process in packaged mode. Development mode may run frontend and backend separately.
- Backend/frontend API contracts should be driven by FastAPI OpenAPI, with generated TypeScript client/types where practical.
- Chat streaming and tool activity should use a WebSocket per Mission session with typed event envelopes. Persistence may still use chat-thread vocabulary (ADR-0005); the product surface is Mission.
- Approvals should pause the agent run, emit a structured approval request with an `approval_id`, and resume only if the user approves that exact request.
- PydanticAI tools should expose only guarded app facades such as SQL request, object description, skill execution, schema context, and approval request APIs. The agent should not receive raw MCP client access.
- Schema metadata should be cached per connection/schema/Mission session with visible age and manual refresh, not persisted in detail by default.
- APEX/APEXLang should default to check-only. After successful validation, the UI should offer an explicit `Import to APEX` action showing target connection and workspace.
- APEX workspace names should be stored as non-secret local metadata mapped to SQLcl saved connection names, with target confirmation before live import.
- UI should be built alongside backend slices so each capability can be tested through the desktop experience.
- First vertical slice: desktop app starts backend, lists SQLcl saved connections, connects via MCP, runs a safe schema summary, and shows tool activity (historical chat UI; target observability is Developer Console).
- PR 8 live smoke proved the first UI vertical slice in Tauri dev mode: FastAPI health, SQLcl saved connection discovery, connect, schema summary, and MCP tool activity worked against saved connection `mcobb_test_oracle_db`.
- SQLcl MCP live tool names can differ from the public hyphenated examples. SQLcl 25.x advertised `connections_list`, `sql_run`, `sqlcl_run`, and `schema_information`, so Apex Pilot should keep an internal logical tool contract and translate to the live SQLcl tool schema at the MCP adapter boundary.
- SQLcl `sql_run` live responses returned CSV text content rather than JSON rows. Apex Pilot should parse MCP content shapes conservatively and keep result rows session-scoped/in-memory for schema summaries, not persisted by default.
- Local browser/Tauri dev mode needs CORS for loopback/Tauri origins when bearer-authenticated frontend requests use the `Authorization` header.
- PR 9 and later should use the addendum roadmap in [[Apex Pilot PR Roadmap]] rather than renumbering completed PRs.
- PR 9B (Project Initialization Wizard + Preflight) is complete and merged: wizard/preflight APIs plus interim UI. See [[Apex Pilot PR Roadmap]].
- PR 9B delivered: desktop project menu (New/Open/Recent/Close/Settings); preflight for Git, SQLcl, Java, Python, MCP smoke, and manifest; retention selection; local env→SQLcl mapping and optional APEX workspace mapping; guided install instructions with no auto-install; and remote clone via installed Git only.
- Next UX work after the merged PR 9B.1 interim shell is the Design Spec overhaul. Authoritative UI/UX: [[Apex Pilot Desktop Design Spec]] (+ figures). Design Spec wins over conflicting interim shell / ADR language.
- Sequence: PR 9B → PR 9B.1 (interim) → UI overhaul (UI-0…UI-9) interleaved with Agent Core / PR 9D as needed; land Spec shell stubs before heavy Agent Core UI reliance.
- Startup funnel: silent health check → full preflight if first-time or unhealthy → profile if needed → recent-projects picker → workspace.
- Shell target (ADR-0007): dense Mission Control chrome — menu, toolbar, context bar, status bar; Explorer | Mission / workspace editors | Inspector | bottom Developer Console when a project is open.
- Left — Explorer: multi-section (project / DB / APEX / REST / favorites / pinned / recent); junk hidden by default; respect APEX export folders and root `f*.sql` invariants.
- Center — Mission workspace (timeline, stages, composer, history); also hosts SQL Editor and other workspace editor tabs. Composer may ship with send disabled until Agent Core; stubs must be honest.
- Right — Inspector only (progress, classification, object summary, checklists). Not a general tool-tab host.
- SQL Editor lives in center workspace tabs (relocated from interim right-pane SQL Sheet). Schema browsing under Explorer / object viewers. Env→SQLcl / APEX mappings in connection / profile / preferences UX.
- Developer Console is in-shell; MCP Activity is a Console tab. Floating MCP window is migration-only, not the target.
- Close project returns to picker with unsaved prompt; one project per window (prefer new window for another project).
- Native folder pickers primary; Tauri FS for files; backend for MCP/metadata. Settings vs project split as in [[Apex Pilot Desktop Design Spec]] / ADR-0007.
- Implementation strategy: screen/shell-first Spec layout; design tokens/components grow as screens need them; exact figure pixel-match is not a first-PR gate.
- Project storage should use a committed JSON manifest, initially `apex-pilot.json`, for portable project facts.
- Local SQLite should store private/user/runtime facts such as local profiles, retention policy, logical environment to SQLcl saved connection mappings, and connection-to-APEX-workspace mappings.
- Project manifests should store logical environments, not actual SQLcl saved connection names.
- Local profiles should use random local profile IDs plus a stable salted hash of email and username for duplicate detection.
- Users should choose chat/tool retention policy during setup.
- Chat display should load from the latest message backward in 2-week windows.
- Phase 1 memory search should use SQLite tables and FTS5. Vector memory should be deferred behind a later optional adapter.
- Remote Git clone can be supported in the project wizard, but only through installed Git and OS credential helpers/SSH agent. Apex Pilot should not store Git credentials.
- The desktop app should provide normal project menu actions such as New Project, Open Project, Open Recent, Close Project, and Settings.
- A later CLI launcher should support developer terminal workflows such as `apex-pilot .` and `apex-pilot <path>`.
- Opening a folder through the CLI should not run Git or database actions automatically; it should enter the normal project preflight and manifest validation flow.
- The window model should be one active project per window, with new-window behavior for different projects when Tauri support is ready.
- First Agent Core natural-language SQL execution should be read-only only.
- Application Mode should be added after the approval workflow and must not auto-approve destructive DDL.
- APEXLang flows should keep core SQLcl MCP support at SQLcl 25.2+ while gating APEXLang-specific actions on detected command support.
- APEX Project Bootstrap should come after APEXLang check-only validation and should validate generated artifacts before offering approved import.
- Testing posture: unit tests with mocked MCP transport, protocol/contract tests with fake or recorded MCP messages, and optional live Oracle/SQLcl tests gated by environment variables.
- Initial CI should run backend lint/type/unit tests, frontend lint/type/build tests, and docs/link sanity where practical. Live Oracle tests are optional and not required for public CI.
- Git workflow: feature branches and PR-sized changes; keep `main` stable with CI before merge.

## Design Invariants

- SQL execution happens only through SQLcl MCP.
- Skills transform, inspect, validate, and generate. They do not directly access the database.
- The agent orchestrates reasoning and tool selection. It does not bypass safety classification or execution approval.
- System skills are trusted core behavior. User skills are local extensions executed with consent.
- Every database-changing action must be explainable through visible SQL, classification, approval state, selected connection, model profile, and MCP tool log.
- Local HTTP APIs must not be exposed as unauthenticated localhost endpoints.

## Open Questions

- Exact Tauri sidecar packaging and startup handshake implementation.
- Exact SQL safety parser/tokenizer library or implementation strategy.
- How rollback of auto-updated system skills should be surfaced to users.
- Which GitHub Actions workflows and branch protection settings to create first.
- Exact retention policy options to expose in the project wizard.
- Exact phase 2 ADR shape for Oracle-native shared storage and vector memory.

## Related

[[Oracle]]
[[Oracle APEX]]
[[SQLcl]]
[[MCP]]
[[PydanticAI]]
[[LiteLLM]]
[[Tauri]]
[[FastAPI]]
[[Agent Skills]]
[[Apex Pilot PR Roadmap]]
[[Apex Pilot Desktop Design Spec]]
