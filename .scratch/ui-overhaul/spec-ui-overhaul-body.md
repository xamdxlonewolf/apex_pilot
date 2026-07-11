## Problem Statement

Apex Pilot’s shipped desktop UI is still the interim PR 9B.1 shell (Files | Chat | Tools, plus a floating MCP Activity window). That layout does not match the locked Mission Control product shape: Explorer, Mission, Inspector, Developer Console, toolbar, and Context Bar. Agent Core and later workflow work risk hardening against the wrong information architecture. Design Spec surfaces that are not live yet also lack a consistent Stub presentation, so unfinished capability can look like broken or fake success.

## Solution

Migrate the open-project desktop experience to the Design Spec Mission Control shell locked in ADR-0007, sequenced as Roadmap UI-0…UI-9. Ship screen/shell-first Spec layout with honest Stubs where backend or Agent Core is not ready, relocate SQL Editor / schema browsing / mappings to their Spec homes, move MCP Activity into the in-shell Developer Console, and adopt keyboard / density / motion rules split by concern. Exact pixel-match to figure_1 / figure_2 is not a gate. Startup funnel behavior from ADR-0006 stays in spirit.

Authority: `docs/design/Apex Pilot Desktop Design Spec` (+ figures). Paper trail: ADR-0007, `CONTEXT.md`, `docs/design/Apex Pilot PR Roadmap.md`, Wayfinder map #14 Decisions-so-far.

## User Stories

1. As an Oracle developer, I want a Mission Control IDE shell when a project is open, so that Apex Pilot feels like a professional desktop tool rather than a chat app or stacked-card wizard.
2. As an Oracle developer, I want Explorer on the left with multi-section navigation, so that I can reach project files, database objects, APEX, REST, favorites, pinned, and recent items from one place.
3. As an Oracle developer, I want Mission in the center as my primary interaction surface, so that I can state intent and follow plan / SQL / review / execution stages with the agent.
4. As an Oracle developer, I want Inspector on the right, so that I can see workflow progress, classification, object summaries, and checklists without leaving Mission.
5. As an Oracle developer, I want a bottom Developer Console, so that Problems, Output, MCP Activity, SQL History, Oracle Messages, and Tasks stay in-shell and explainable.
6. As an Oracle developer, I want an always-on toolbar, so that common actions are available without hunting through menus alone.
7. As an Oracle developer, I want a Context Bar showing connection, Working Schema, and Environment, so that I always know which Oracle context I am acting in.
8. As an Oracle developer, I want a menu bar and status bar that remain present, so that project lifecycle and health stay reachable.
9. As an Oracle developer, I want panel regions to resize and collapse according to Spec layout rules, so that I can focus on Mission or editors without losing chrome identity.
10. As an Oracle developer, I want core panel-toggle shortcuts (Explorer, Inspector, Mission, Developer Console), so that I can rearrange focus without the mouse.
11. As an Oracle developer, I want always-visible keyboard focus and Tab/arrow traversal of shell chrome, so that the dense IDE remains operable without a pointer.
12. As an Oracle developer, I want a minimal command palette soon after Spec shell IA, so that `Ctrl+Shift+P` can discover and run actions.
13. As an Oracle developer, I want Quick Open once file/object search exists, so that `Ctrl+P` jumps to files and objects quickly.
14. As an Oracle developer, I want surface-specific shortcuts to ship with their owning features, so that Mission, SQL Editor, Explorer, Inspector, and Console each feel complete when they land.
15. As an Oracle developer, I want Default density in early shell work, so that layout PRs stay consistent before Compact/Comfortable modes exist.
16. As an Oracle developer, I want Compact and Comfortable density modes with a preference switcher (UI-7), so that I can match Spec typography-stable density preferences.
17. As an Oracle developer, I want motion that respects Spec hard rules (no decorative animation, immediate resize, skeletons preferred, `prefers-reduced-motion`), so that the shell stays calm and accessible.
18. As an Oracle developer, I want Spec motion durations and panel/timeline choreography in UI-7 polish, so that later motion feels intentional rather than noisy.
19. As an Oracle developer, I want unfinished Spec surfaces marked with a `Stub` badge, so that I can tell real capability from placeholders.
20. As an Oracle developer, I want unfinished surfaces to say exactly `Not implemented yet`, so that copy is honest and consistent.
21. As an Oracle developer, I want optional secondary stub copy that names the missing dependency when helpful, so that I understand why something is disabled without fake dates or progress.
22. As an Oracle developer, I want stubbed actions disabled rather than fake-successful, so that I never trust a run that did not happen.
23. As an Oracle developer, I want no sample rows, fake SQL results, or mock success timelines on Stubs, so that trust before automation is preserved.
24. As a planner, I want Gap markings only in Roadmap / PR docs (`Gap:` + `DS-*`), so that product UI never shows a Gap badge.
25. As a planner, I want `DS-*` / `UI-*` IDs kept out of user-visible stub UI, so that agent planning vocabulary does not leak into the product.
26. As an Oracle developer, I want working interim migration paths (for example floating MCP until Console lands) not badged as Stub, so that still-functional chrome is not labeled unfinished.
27. As an Oracle developer, I want Mission composer present even before Agent Core, with send disabled and honest Stub treatment, so that the center surface is ready for Agent Core without inventing chat-app behavior.
28. As an Oracle developer, I want Mission timeline, mission card, plan/SQL/review/exec stage chrome, and history layout per Spec (stubbed where needed), so that Agent Core can attach to the right IA.
29. As an Oracle developer, I want SQL Editor only in center workspace tabs, so that SQL is never edited in the Inspector.
30. As an Oracle developer, I want SQL Editor to keep classify/prompt/block behavior, so that safety invariants remain explainable beside Inspector evidence and Console activity.
31. As an Oracle developer, I want schema browsing under Explorer / object viewers, so that Schema is not a permanent right-pane tool tab.
32. As an Oracle developer, I want Environment → SQLcl / APEX workspace mappings in connection / profile / preferences UX, so that Mapping is not a forever Inspector tab.
33. As an Oracle developer, I want MCP Activity as a Developer Console tab, so that observability lives with Problems/Output/History rather than a floating product target.
34. As an Oracle developer, I want a temporary floating/overlay MCP path only as migration until Console ships, so that existing activity viewing does not break mid-migration.
35. As an Oracle developer, I want Explorer project files via Tauri FS (browser fallback for Vite-only tests), so that local-first file navigation works in desktop and test environments.
36. As an Oracle developer, I want junk files hidden by default in Explorer, so that noise does not dominate the tree.
37. As an Oracle developer, I want APEX export folders and root `f*.sql` shown as protected, so that hard nontouch invariants remain visible in the UI.
38. As an Oracle developer, I want center workspace editor tabs for object / package / APEX / REST / diff / file editors (stubbed as needed), so that Mission is not the only center content type.
39. As an Oracle developer, I want Inspector to explain rather than initiate work or own execution, so that Mission and SQL Editor remain the action owners.
40. As an Oracle developer, I want health indicators in shell chrome, so that backend / MCP / connection health is glanceable.
41. As an Oracle developer, I want profile-scoped layout prefs and project-scoped open tabs remembered, so that my shell returns to a familiar arrangement.
42. As an Oracle developer, I want Close Project to return to the recent-projects picker with an unsaved-work prompt when editors are dirty, so that I do not lose SQL Editor or other dirty state.
43. As an Oracle developer, I want one project per window, so that Environment and Working Schema context stay unambiguous.
44. As an Oracle developer, I want the startup funnel (silent health → preflight when needed → profile when needed → picker → workspace) preserved, so that project open remains guided by ADR-0006.
45. As an Oracle developer, I want richer dialog/wizard chrome and connection wizard / preferences (UI-8) without changing backend ownership of create/open/clone/preflight/mappings, so that Spec dialogs improve UX without rewriting ADR-0006 contracts.
46. As an Oracle developer, I want design tokens and shared components to grow as screens need them, so that UI-7 can parallelize without blocking first Spec-shell IA.
47. As an Oracle developer, I want figure_1 / figure_2 treated as visual intent, not a pixel-acceptance gate, so that early PRs can land IA without design-lock paralysis.
48. As an Agent Core implementer, I want Mission + Inspector Stubs in place before heavy agent UI reliance, so that streaming and stages attach to Spec surfaces instead of interim Chat framing.
49. As a maintainer, I want Roadmap UI-0…UI-9 to track Spec surface ownership, so that implementation tickets have clear homes and Gap orphans can be claimed.
50. As a maintainer, I want UI-9 to apply ADR-0007 §11 Stub conventions across layout rather than invent a second policy, so that stub language stays single-sourced.
51. As a maintainer, I want UI-7 to own Compact/Comfortable, Spec motion duration table/choreography, and focus token polish, so that shell PRs are not blocked on full design-system completion.
52. As a maintainer, I want configurable shortcuts to remain Spec Future, so that early keyboard work stays scoped to core toggles and surface-owned shortcuts.
53. As a developer using Vite-only frontend tests, I want browser FS fallback behavior preserved, so that shell tests do not require a packaged Tauri binary.
54. As a developer running packaged desktop, I want Tauri e2e coverage for native shell paths, so that window chrome, FS pickers, and desktop-only wiring are verified beyond jsdom.
55. As an Oracle developer, I want offline / empty workspace Spec states represented honestly (Stub where unfinished), so that empty and degraded modes do not look like success.
56. As an Oracle developer, I want session restore of layout/tabs per Spec intent, so that reopening a project restores Mission Control arrangement without inventing new persistence product rules.
57. As an Oracle developer, I want View/menu actions to show/hide Explorer, Inspector, Mission, and Developer Console, so that mouse users have the same panel control as keyboard users.
58. As an Oracle developer, I want status bar copy to reflect shell phase and connection/context honestly, so that chrome never claims a live agent or SQL success that did not occur.
59. As an Oracle developer, I want real in-flight loading (spinners/skeletons) distinguished from Stubs, so that waiting on a live request is not labeled unfinished.
60. As a contributor, I want domain glossary terms (Mission, Inspector, Explorer, Developer Console, SQL Editor, Context Bar, Stub, Gap, Working Schema, Environment, Mapping) used in tickets and UI labels, so that Chat / Tools pane / SQL Sheet naming does not re-enter the target product.

## Implementation Decisions

- **Authority:** Design Spec in `docs/design/` (+ figures) wins over conflicting interim UI. ADR-0007 is the accepted shell decision; Roadmap UI-0…UI-9 is the sequencing checklist; `CONTEXT.md` is glossary authority.
- **Target composition (ADR-0007):** menu bar + toolbar + Context Bar + status bar; when a project is open: Explorer | Mission / workspace editors | Inspector | bottom Developer Console.
- **Relocations (capabilities kept, hosts change):** SQL Sheet → center SQL Editor; Schema → Explorer/DB + object viewers; Mappings → connection/profile/preferences UX; right pane → Inspector only; MCP Activity → Developer Console tab (floating/overlay migration-only).
- **Startup funnel:** unchanged in spirit from ADR-0006 / 9B.1 (silent health → preflight when first-time/unhealthy → profile when needed → picker → workspace).
- **Implementation strategy:** screen/shell-first Spec layout; tokens/components grow as screens need them; figure pixel-match is not a first-PR gate.
- **Stub / Gap policy:** ADR-0007 Decision §11; UI-9 applies across layout. Primary copy `Not implemented yet`; chrome badge `Stub`; disable non-working actions; no fake data; Gap is docs-only; working interim ≠ Stub; `DS-*`/`UI-*` docs/comments only.
- **Keyboard / density / motion:** ADR-0007 Decision §12. Shell/early: focus + core panel toggles + Default density + motion hard rules. Minimal command palette soon after Spec shell IA (does not block first IA PR). Quick Open trails file/object search. UI-7: Compact/Comfortable + switcher, Spec motion durations/choreography, focus token polish. Configurable shortcuts remain Future.
- **Modules / surfaces to build or migrate:** desktop shell chrome; Explorer multi-section; Mission workspace; Inspector; center workspace editors including SQL Editor; Developer Console; dialog/wizard chrome and connection/preferences (UI-8); design-system density/motion/focus polish (UI-7); stub convention application (UI-9).
- **Backend contracts:** do not invent new SQL execution paths. SQL Editor continues through existing classify/run façades. No raw MCP to the frontend or PydanticAI tools. Native pickers/FS remain Tauri-owned; MCP/metadata remain backend-owned.
- **Persistence UX contract:** profile-scoped layout prefs and project-scoped tabs may start in local desktop storage and later move to SQLite without changing the UX contract (ADR-0007 §8).
- **Agent Core interleave:** land Spec shell Stubs before heavy Agent Core UI reliance; Mission send stays disabled until Agent Core; product framing is Mission + workflow, not chat-app enablement.
- **Hard boundaries unchanged:** no touching APEX export folders or root `f*.sql`; SQL via SQLcl MCP only; guarded façades only; no persisting Oracle passwords or SQL result rows by default.
- **Roadmap ownership:** UI-0 epic/composition; UI-1 chrome + core shortcuts + early palette; UI-2 Explorer; UI-3 Mission; UI-4 Inspector; UI-5 workspace editors/SQL Editor; UI-6 Developer Console/MCP migration; UI-7 tokens/density/motion/Quick Open; UI-8 dialogs/connection/preferences; UI-9 stub conventions across layout.
- **Docs already locked by Wayfinder map #14:** ADR-0007 rewrite; light ADR-0001/0005/0006; glossary; design notes sync. Further ADR updates only if implementation discovers a new decision conflict.
- **Testing seams (confirmed):**
  1. **Vitest + Testing Library** against the open-project Mission Control shell (extend today’s App-level pattern: stubbed runtime config + `fetch`, query by accessible name/role). Owns IA regions, panel toggles, Stub copy/badge/disabled behavior, Default vs later density modes, funnel→workspace handoff, and façade-backed SQL/Explorer/Console behavior that can run in jsdom/browser fallback.
  2. **Tauri e2e** for native desktop paths jsdom cannot prove (packaged/dev window shell, native folder pickers / FS-backed Explorer, desktop-only chrome wiring, migration behavior of MCP Activity toward Developer Console in the real shell). Introduce the lightest Tauri-capable e2e harness the repo can sustain; do not require standalone Playwright or figure pixel-match suites for this epic.

## Testing Decisions

- Good tests assert external behavior users (or the desktop shell) can observe: region presence and names, panel visibility after toggles/menus/shortcuts, Stub badge and `Not implemented yet` copy, disabled actions, absence of fake success data, Context Bar identity fields, Console tab hosting MCP Activity, SQL Editor living in center workspace, Inspector not owning SQL edit/execution, protected APEX/`f*.sql` presentation, and unsaved close-project prompting when dirty.
- Do not assert implementation details such as internal React component trees, CSS class names as the primary contract, or exact figure_1/figure_2 pixel layouts.
- **Seam 1 — Vitest/Testing Library Mission Control shell:** primary seam for most overhaul behavior; prefer one high App/workspace-root render with stubbed backend over many shallow panel unit trees. Extend existing frontend App integration and backend helper test prior art.
- **Seam 2 — Tauri e2e:** cover native desktop paths called out above; keep scenarios few and high-value; gate or document any machine-local prerequisites clearly so CI policy stays explicit.
- Out of testing scope for this epic: standalone Playwright browser e2e as a second web harness, visual regression / pixel-match to Design Spec figures.
- Prior art: frontend App integration tests with stubbed `__APEX_PILOT__` + `fetch` and aria-label queries; frontend backend helper unit tests; CONTRIBUTING frontend checks (`lint`, `typecheck`, `test`, `build`). No Tauri e2e harness exists yet — adding it is part of making Seam 2 real.
- Safety-related UI still must preserve classify/prompt/block explainability when SQL Editor paths are exercised; do not weaken those assertions while relocating the editor.

## Out of Scope

- Implementing Agent Core Mission send/streaming/stages beyond Stub-ready chrome (belongs to Agent Core / PR 9 interleaved work).
- Changing SQL execution, safety classification, guarded façade, or MCP pool invariants.
- Persisting Oracle passwords or SQL result rows by default.
- Touching APEX export folders or root `f*.sql` export files.
- Making all Spec shortcuts user-configurable (Spec Future).
- Exact pixel-perfect reproduction of figure_1 / figure_2 as an acceptance gate.
- Standalone Playwright suites and visual regression pipelines.
- Backend/Agent Core/MCP execution behavior beyond what UI Stubs and Roadmap gaps require.
- Full CLI launcher / multi-window product work except preserving one-project-per-window UX already locked (PR 9D remains its own track).
- Replacing ADR-0006 backend ownership of create/open/clone/preflight/mappings.
- Vector memory, Application Mode, APEXLang import flows, and later roadmap items not required to present Spec shell Stubs.

## Further Notes

- Wayfinder map: #14 — decision tickets complete; this spec is the `/to-spec` handoff before `/to-tickets` → `/implement`.
- Research/grilling assets under `.scratch/ui-overhaul/` and synced design notes under `docs/design/` are the citation set for `DS-*` / UI-* planning IDs.
- Prefer glossary terms from `CONTEXT.md`; avoid Chat (as product surface), Tools pane, SQL Sheet (as target name), floating MCP Activity (as product target), and Gap-as-UI-badge.
- Suggested build order for later ticketing: UI-0/UI-1 shell IA → UI-9 stub conventions early enough to apply as surfaces land → UI-2…UI-6 regions → UI-8 dialogs as needed → UI-7 density/motion/Quick Open polish; interleave Agent Core against Mission/Inspector Stubs rather than interim Chat framing.
- Refer to follow-on tickets by name/title, not bare numbers, when updating the map’s Decisions-so-far.
