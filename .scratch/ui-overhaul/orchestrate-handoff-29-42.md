# Orchestrate handoff — issues 29–42

## COMPLETE (root planner run, agent bc-177fa387…e356)

Root-planner workspace lives at `.orchestrate/ui-overhaul/` (`plan.json` +
`state.json` + `handoffs/`). **All of #30–#42 are implemented, tested, and
merged to `main`.** Final `main` frontend tree: `cd frontend && pnpm test` →
70 passing (14 files), `pnpm typecheck` → clean.

| Wave | Issues (PRs) |
|------|--------------|
| A | #30 (PR #51), #32 (#49), #37 (#48), #41 (#50) |
| B | #34 (#52), #31 (#53), #38 (#54) |
| C | #36 (#55), #35 (#56), #42 (#57) |
| D | #33 (#58), #39 (#59) |
| E | #40 (#60) |

All 13 PRs merged. Workers ran TDD; each opened its own draft PR against
`main`; the planner verified `pnpm test`/`pnpm typecheck` on each merged result
and resolved cross-branch conflicts in `IdeWorkspace.tsx` / `prefs.ts` /
`App.test.tsx` (center-tab + Inspector restructures were the hot spots).

### Notes for future orchestrate runs
- The orchestrate skill's `MODEL_CATALOG` default (`gpt-5.5`
  `reasoning=high;fast=true`) is **stale** — the live backend `/v1/models`
  requires a `context` param, so the bare default is rejected as
  `invalid_model`. Set `tasks[].model` explicitly. Validated slugs seen this
  run: `gpt-5.3-codex-high-fast`, `claude-opus-4-8`, and `grok-4.5` (bare slug
  → backend default `effort=high;fast=true`). Wave A used codex; waves B–E used
  `grok-4.5` per operator request.
- A mid-run `usage_limit_exceeded` spend-limit gate briefly blocked spawns after
  Wave A; resolved once usage-based pricing was enabled.

## Blocker for `/orchestrate`

This cloud session did **not** have `CURSOR_API_KEY` set
(`CLOUD_AGENT_ALL_SECRET_NAMES=GH_TOKEN` only). Kickoff failed with:

```text
CURSOR_API_KEY not set
```

**Next session:** export a personal Cursor API key (Dashboard → Integrations),
then from the orchestrate skill scripts dir:

```bash
export PATH="$HOME/.bun/bin:$PATH"
# bun install already done under the skill scripts/ once
bun cli.ts kickoff "Implement GitHub issues #30 through #42 for Apex Pilot Mission Control UI. Each issue is its own worker with openPR: true. Respect blocked-by deps. Merge each PR into main after tests pass before dependents. Use /implement + TDD. Repo https://github.com/xamdxlonewolf/apex_pilot. Issue #29 already merged (PR #46)." --repo https://github.com/xamdxlonewolf/apex_pilot --ref main --dispatcher-name "Michael"
```

Or act as root planner on `main` after ensuring the key is present.

## Done / on main

| Issue | Status | PR |
|-------|--------|----|
| #29 Minimal command palette | Merged / closed | https://github.com/xamdxlonewolf/apex_pilot/pull/46 |
| #30 partial (browser FS + FileTree tests + CommandPalette fix) | Merged to `main` (issue still open to finish) | https://github.com/xamdxlonewolf/apex_pilot/pull/47 |

**Start orchestrate from `main` (`5a74a46`+).** Finish #30 acceptance on a new worker branch off main, then continue #31–#42.

## Remaining (dependency order)

Wave A (after #26–#28, unblocked): **#30**, #32, #34, #37, #41  
Wave B: #31 ← #30; #33 ← #32; #35 ← #34; #38 ← #37  
Wave C: #36 ← #31+#34; #42 ← #30+#31  
Wave D: #39 ← #36; #40 ← #39  

Each issue should get its **own PR**, tests green, then merge to `main` before dependents.

## Verify

```bash
cd frontend && pnpm test && pnpm typecheck
```
