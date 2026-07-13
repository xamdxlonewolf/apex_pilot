Part of #121

## Question

Wire SQL/PLSQL editor tabs and DB browser (and other interactive callers named in grilling) to the pool borrow/dedicated API.

## Acceptance

- Opening Settings (or equivalent) and returning does not force reconnect of open SQL/browse sessions.
- Each surface uses borrow or dedicated as locked.
- Failures surface honest dead/reconnect states — no fake success.

## Blocked by

- Task: App-owned oracledb pool + stop remount thrash
