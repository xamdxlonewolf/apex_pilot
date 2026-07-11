# Orchestrate handoff — issues 29–42

## Progress update (root planner run, agent bc-177fa387…e356)

Root-planner workspace lives at `.orchestrate/ui-overhaul/` (`plan.json` +
`state.json` + `handoffs/`). `CURSOR_API_KEY` **was** present this run.

**Wave A complete and merged to `main`:**

| Issue | PR | Status |
|-------|----|--------|
| #30 Explorer project files | #51 | merged |
| #32 Mission composer Stub | #49 | merged |
| #37 Developer Console scaffold | #48 | merged |
| #41 Density modes + motion | #50 | merged |

All four handed off `success` / `unit-test-verified`; merged sequentially into
`main` (one trivial import conflict in `IdeWorkspace.tsx` resolved). Merged tree
is green: `cd frontend && pnpm test` → 31 passing, `pnpm typecheck` → clean.

**BLOCKED — Cursor account spend limit.** Round 2 (#34←#32, #31←#30, #38←#37)
failed at spawn with:

```
[usage_limit_exceeded] Usage-based pricing required. Background Agent requires
at least $2 remaining until your hard limit. Enable usage-based pricing and set
a Spend Limit.
```

Wave A consumed the remaining budget. This is a deterministic account/billing
gate (not transient); no code fix applies. **Action for Michael:** enable
usage-based pricing / raise the Spend Limit for the account behind
`CURSOR_API_KEY` at https://cursor.com/dashboard (Billing / Integrations).

**Resume after billing is fixed** (from repo root, `bun` on PATH):

```bash
CLI=<orchestrate>/scripts/cli.ts
# reset the three billing-failed tasks, then run the loop
for t in issue-34-sql-editor-center issue-31-explorer-multi-section issue-38-mcp-activity-console; do
  bun $CLI respawn .orchestrate/ui-overhaul "$t" --source local-cli
done
bun $CLI run --root .orchestrate/ui-overhaul
```

Then merge each PR into `main` after `cd frontend && pnpm test && pnpm typecheck`
pass, and stage the remaining rounds in `plan.json`:
- R2b: #33 (←#32,#34, serialized after #34 to avoid center-region conflict)
- R3: #35 (←#34), #36 (←#31,#34), #42 (←#30,#31)
- R4: #39 (←#36)
- R5: #40 (←#39)

Set `"model": "gpt-5.3-codex-high-fast"` on every worker: the orchestrate
skill's `MODEL_CATALOG` default (`gpt-5.5` with `reasoning=high;fast=true`) is
stale — the backend `/v1/models` requires a `context` param, so the default is
rejected as `invalid_model`. Validated slugs: `gpt-5.3-codex-high-fast`,
`claude-opus-4-8`.

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
