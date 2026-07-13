Part of #121

## Question

Implement idle/lifetime timer and reconnect UX: prompt with optional auto-reconnect; cancel stays disconnected until manual reconnect.

## Acceptance

- Timer informed by research asset (conservative below typical DB kill).
- Prompt before expiry/on death; Auto-reconnect toggle persisted as locked in grilling/ADR.
- Cancel/dismiss → disconnected until manual reconnect from Product Header / Context Bar.
- States: connected / reconnecting / dead only — no silent fake-connected.

## Blocked by

- Research: Oracle idle lifetime + saved connections + keyring
- Task: App-owned oracledb pool + stop remount thrash
