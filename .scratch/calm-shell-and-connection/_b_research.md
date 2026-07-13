Part of #121

## Question

Research Oracle (and typical network/firewall) idle/session lifetime behavior, SQLcl saved-connection reuse, and OS keyring on Windows + macOS — enough evidence for idle timer + reconnect UX and secret-store implementation.

## Deliverable

Markdown asset under `.scratch/calm-shell-and-connection/` summarizing:

1. Typical Oracle idle kill / profile limits and practical app timer guidance (conservative, below common kills).
2. How SQLcl/MCP saved connections expose name + connect without Apex Pilot storing passwords.
3. Python `keyring` on Windows Credential Locker + macOS Keychain (deps, failure modes).
4. When an encrypted home-path fallback would be needed (if ever).
5. Any SQL Developer VS Code patterns relevant to durable interactive sessions (inspiration only — not “become VS Code”).

## Acceptance

- Linked research asset posted on resolution.
- Explicit recommendation for default idle timer range and reconnect warning lead time.
