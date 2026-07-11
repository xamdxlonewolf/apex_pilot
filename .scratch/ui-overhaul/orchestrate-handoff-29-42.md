# Orchestrate handoff — issues 29–42

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

## Done

| Issue | Status | PR |
|-------|--------|----|
| #29 Minimal command palette | Merged / closed | https://github.com/xamdxlonewolf/apex_pilot/pull/46 |

## In progress

| Issue | Branch | Notes |
|-------|--------|-------|
| #30 Explorer project files | `cursor/30-explorer-project-files-d499` | Browser FS fallback + `FileTree.test.tsx` started; also fixes CommandPalette `inputRef` bug left on main from #46 |

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
