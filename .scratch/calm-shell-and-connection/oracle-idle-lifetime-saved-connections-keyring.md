# Oracle idle lifetime, saved connections, and OS keyring

Research date: 2026-07-16. Scope: inputs for the connection-lifetime and
credential-ownership ADR under issue #121/#123. External claims below use
Oracle, python-oracledb, Python keyring/backend, Microsoft, Apple, and
freedesktop primary sources. “Recommendation” and “Inference” are product
judgments, not claims made by those sources.

## Decision summary

- **Recommendation — lifetime:** use separate clocks for an Oracle session, a
  borrowed pooled connection, and the FastAPI-owned SQLcl MCP process. Default
  the primary interactive/session idle deadline to **15 minutes**, configurable
  in a bounded **10–30 minute** product range, with a **60-second warning**.
  Retire an idle read-only pool member after **5 minutes** without a user
  warning. Once every database session is disconnected, stop the SQLcl MCP
  process after a further **5 minutes** and restart it on demand.
- **Caveat:** 15 minutes is a resource-hygiene default, not a promise to beat
  every Oracle profile, Resource Manager policy, firewall, proxy, or cloud
  service limit. No universal “common kill” value exists. If the administrator
  supplies a known external idle ceiling, configure Apex Pilot below it; if the
  ceiling is unknown, validate on use and reconnect cleanly rather than sending
  keepalive SQL to defeat policy.
- **Recommendation — credentials:** retain **SQLcl ownership by default**.
  A `Connection Profile`/`Environment` `Mapping` stores only the SQLcl saved
  name. Add Apex Pilot-owned OS-keyring credentials only if the ADR introduces
  a separate python-oracledb interactive path. Do **not** adopt a generic
  encrypted home-file fallback: without an independently protected
  key-encryption key (KEK), it only moves the secret.
- **Recommendation — reconnect:** validate before borrowing/reusing a connection
  that has crossed the trust interval, reconnect by saved identity, then
  re-establish and verify the `Working Schema`. Retry connection establishment
  once; never automatically replay a database-changing statement whose outcome
  is unknown.

## Three different lifetimes

1. **Oracle server session policy.** This is externally administered. A profile
   `IDLE_TIME` is continuous inactive time in minutes; long-running operations
   are not idle. When exceeded, Oracle rolls back the current transaction,
   ends the session, and reports the error on the client’s next call. Profile
   resource limits require `RESOURCE_LIMIT` to be enabled.[S1] The instance
   parameters `MAX_IDLE_TIME` and `MAX_IDLE_BLOCKER_TIME` are also in minutes;
   both default to `0` (no limit), and the latter applies to idle blockers.[S2][S3]
   Resource Manager can impose additional consumer-group/PDB limits and checks
   idle limits periodically rather than at an exact wall-clock instant.[S4]

2. **Network path lifetime.** `SQLNET.EXPIRE_TIME` sends probes to determine
   whether client/server connections are alive after abnormal loss; it is dead
   connection detection, **not** a policy that disconnects a healthy but idle
   user.[S5] Oracle’s JDBC guidance says a firewall can sever an idle
   connection and recommends configuring a pool inactivity timeout below the
   *known firewall timeout*.[S6] That dependency on local configuration, plus
   Oracle’s unlimited defaults and arbitrary profile limits, means there is no
   defensible universal firewall/Oracle timeout. A historical Oracle cloud
   service documented a 30-minute idle timeout, but that is evidence for that
   service only, not an Oracle-wide default.[S7]

3. **Application resource lifetime.** Apex Pilot can deliberately disconnect
   an Oracle session, retire a read-only pool member, or stop its child SQLcl MCP
   process. These controls conserve resources but cannot weaken or predict the
   two external limits above. Process idleness must mean “no MCP call in flight
   and no connected session,” not merely “no UI event.”

**Recommendation:** do not issue periodic `SELECT` calls solely to keep a
session alive. That would blur application idleness, consume resources, and
work against an administrator’s idle policy. Before an application-initiated
disconnect, require no in-flight call and no unresolved transaction. If
transaction state is unknown, warn and require explicit user action rather
than silently risking rollback; Oracle itself rolls back a transaction when
`IDLE_TIME` ends the session.[S1]

## Practical controls

### SQLcl MCP (the current execution boundary)

Oracle SQLcl 25.4 documents MCP tools to list saved connections, connect by
name, disconnect the current active database connection, run SQL/SQLcl, and
inspect schema information.[S8] Therefore Apex Pilot can:

- call MCP `disconnect` to release the Oracle session while leaving the SQLcl
  process warm;
- close the MCP stdio client/process after all sessions are disconnected; and
- start a fresh process and `connect` by saved name on demand.

The repository currently starts one FastAPI-owned MCP process for backend
lifetime, tracks one primary session, and restarts/retries once on recognized
stdio transport death (`backend/src/apex_pilot/api/runtime.py`,
`backend/src/apex_pilot/mcp/client.py`). It has no adapter mapping or
application method for `disconnect`, despite the upstream tool now being
documented. The local read-only “pool” is Apex Pilot composition over multiple
MCP clients/sessions, not a documented SQLcl connection-pool API
(`backend/src/apex_pilot/mcp/connections.py`).

**Recommendation:** add `disconnect` behind the guarded facade and capability
detect it by SQLcl version/tool discovery. Disconnect read-only members after
5 idle minutes; disconnect the primary after the 15-minute warning unless an
operation/transaction blocks safe retirement. Stop the process 5 minutes after
the last session disconnects. Process stop needs no database API, but should be
reported separately from `Unconnected`.

On reconnect/borrow, first establish the named saved connection. If a connected
session is being reused after its trust interval, perform a bounded read-only
round trip; then verify target identity and reapply/verify `CURRENT_SCHEMA`.
Only after that should the UI leave `reconnecting`. A failed validation discards
that session and performs one fresh connect. This is consistent with Oracle
pool guidance that validates on borrow and treats a validation timeout as
invalid, while avoiding statement replay.[S9]

### python-oracledb (only if a future ADR permits a direct interactive path)

python-oracledb exposes distinct official pool controls:

- `timeout`: seconds an idle connection may remain in the pool before
  termination; `0` means no idle termination;
- `max_lifetime_session`: maximum pooled connection age; in-use connections
  become termination candidates only when released, and `0` means unlimited;
- `ping_interval`: after this unused interval, `acquire()` pings before
  returning the connection; a failed ping is discarded and replaced;
- `ping_timeout`: maximum milliseconds for that internal ping; and
- `ConnectionPool.reconfigure()` for changing several controls.[S10][S11]

These govern python-oracledb pool members, not SQLcl MCP and not Oracle server
policy. If introduced, use a 5-minute pool `timeout`, a finite
`max_lifetime_session` chosen by deployment policy rather than as a firewall
guess, and retain positive acquire-time pinging (the current documented default
`ping_interval` is 60 seconds and `ping_timeout` 5000 ms).[S11] Pool minimum
size must be chosen with care because idle shrink controls maintain the pool’s
configured floor.

## SQLcl saved connections: what Apex Pilot can safely rely on

- SQLcl stores persistent connection definitions by name. `CONNMGR LIST`
  lists names, `SHOW` exposes non-secret connection details, and `TEST` opens
  and closes a test connection using stored credentials.[S12]
- SQLcl MCP uses the connection store under `~/.dbtools`. Oracle states that an
  MCP-accessible connection must have its password saved with `-savepwd`; MCP
  `list-connections` discovers saved names and `connect` selects a named
  connection.[S8][S13]
- Oracle states that saved passwords are held in a “secure wallet.”[S14] This
  is enough to make SQLcl the credential owner, but not enough to assert a
  particular cipher, KEK source, OS-keyring binding, file-permission model, or
  recovery behavior. Oracle’s reviewed public SQLcl docs do not specify those
  properties. Treat them as **unknown**, not as guarantees.

**Recommendation:** a `Connection Profile` is the stable logical identity; an
`Environment` selects it; its local `Mapping` contains the SQLcl saved name and
optional non-secret metadata. Never treat the saved name as the whole profile.
MCP receives only that name. If `list-connections` no longer contains it, show
`Unconnected — saved connection unavailable`; do not solicit a password into
an MCP argument. Direct the user to recreate/rotate the SQLcl-owned saved
connection and test it in SQLcl.

For password rotation, use SQLcl’s documented `-save`, `-savepwd`, and
`-replace` connection workflow, then `CONNMGR TEST` before considering the
Mapping healthy.[S12][S14] Do not log connect strings, usernames beyond what
the user elects to display, password material, or wallet contents.

## Apex Pilot-owned OS keyring comparison

Python `keyring` supports macOS Keychain, freedesktop Secret Service
(`secretstorage` required), KDE KWallet (`dbus` required), and a Windows
backend it labels “Credential Locker.” It selects a backend automatically but
also permits explicit selection. Its API distinguishes missing credentials
(`get_password()` returns `None`) from initialization, set, and delete
failures; deletion of an absent entry raises an exception.[S15]

### Windows

- The current keyring implementation is `WinVaultKeyring`: its source says it
  stores generic credentials through **Windows Credential Manager** and
  requires `pywin32`.[S16] This implementation fact matters: Microsoft’s WinRT
  `PasswordVault`/Credential Locker documentation (including its per-app
  behavior and 20-credential limit) should not be assumed to describe
  `WinVaultKeyring`.
- Win32 `CredWrite` creates or replaces a credential in the current token’s
  user credential set. Network logon sessions may have no credential set and
  return `ERROR_NO_SUCH_LOGON_SESSION`.[S17] Generic credentials are readable
  and writable by user processes, so this is principally an OS-user boundary,
  not a guarantee that only Apex Pilot can read the item.[S18]
- **Packaging/service caveat:** bundle a compatible `pywin32`; run under the
  intended interactive user and loaded profile. A Windows service, network
  logon, impersonated process, or differently elevated account can see a
  different/unavailable credential set. Microsoft likewise notes DPAPI
  user-profile failures under impersonation when the profile is not loaded.[S19]
- **Prompt behavior gap:** Python keyring explicitly says it has not published
  a security analysis of this backend.[S15] Do not promise that Windows will
  prompt for each access.

### macOS

- keyring uses macOS Keychain; current compatibility guidance requires macOS
  11+ to use Python 3.8.7+ with a universal2 binary.[S15]
- Apple documents that generic-password retrieval decrypts the item, can prompt
  when the caller is not trusted, and automatically requests unlock if the
  keychain is locked.[S20] keyring notes that an item created through a given
  Python executable can normally be read by that same executable without a
  prompt; Keychain Access controls can change that.[S15]
- **Packaging caveat/inference:** use a stable, signed application identity and
  test packaged builds. Changing the executable/security identity can change
  trust and prompt behavior. Background/unattended calls must treat
  interaction-required or user-cancelled access as unavailable; Apple provides
  an API mode where operations return an error instead of showing UI.[S21]

### Linux: Secret Service and KWallet

- Secret Service requires `secretstorage` and a reachable Secret Service daemon
  over the user’s D-Bus session. Headless use is possible, but the keyring
  daemon must be started/unlocked and Apex Pilot must run in that same D-Bus
  session.[S15] This is often absent in SSH, systemd-service, minimal desktop,
  sandbox, and container sessions.
- A Secret Service collection/item may be locked; secrets cannot be read or
  modified until unlock. Unlock may return a user prompt, and dismissal cancels
  the operation.[S22] SecretStorage exposes locked, prompt-dismissed, and
  service-unavailable exceptions.[S23]
- KWallet requires Python D-Bus support. The keyring backend source raises
  `InitError` when it cannot establish D-Bus access and `KeyringLocked` when the
  user cancels unlock.[S24] Python `dbus` commonly needs a system package rather
  than a pure wheel, which is a desktop packaging risk.[S15]
- **Recommendation:** support Linux keyring only when a vetted Secret Service
  or KWallet backend passes a startup probe. Never make a desktop app/container
  privileged merely to make keyring work; treat a missing user session bus as
  an unavailable backend.

### Detection, failure, rotation, deletion

**Recommendation:** do not trust automatic backend choice for database
passwords. At startup and before “remember password”:

1. Explicitly allowlist the native backend expected for the OS; reject null,
   fail, plaintext/file, unknown third-party, or unexpected chained backends.
2. Run a non-secret canary `set → get → delete` under an Apex Pilot service
   namespace and catch the `keyring.errors.KeyringError` family. A missing
   actual credential (`None`) is not the same as an unavailable backend.[S15]
3. Surface `available`, `locked/interaction required`, `user cancelled`,
   `unavailable/missing dependency`, and `operation failed` separately. Never
   silently fall through to file storage.
4. Use a stable opaque Connection Profile ID as the keyring account key, not
   display name, Environment name, connect string, or Working Schema. Rotation
   overwrites through `set_password`, reads back for equality, validates a new
   database connection, and clears old in-memory values. Profile deletion calls
   `delete_password`; an absent entry is idempotent at the application layer,
   while other delete failures remain visible.[S15] On Secret Service,
   replacement and deletion are explicit backend operations.[S25]

## Why an encrypted home-path fallback is not justified

**Inference:** ciphertext needs a KEK. If Apex Pilot stores the KEK beside the
encrypted connection file, filesystem compromise yields both. If it stores the
KEK in the OS keyring, the “fallback” still fails when that keyring is
unavailable. If it derives the KEK from a user passphrase, the user must supply
another secret on each launch and recovery/rotation become product
responsibilities. Platform-specific protection such as Windows DPAPI binds
decryption to a user/machine context,[S19] but then Apex Pilot has created a
second platform credential subsystem instead of solving the cross-platform
fallback.

**Recommended fallback order:**

1. SQLcl-owned saved connection (current MCP path; Apex Pilot stores only name).
2. If a future direct interactive path is approved, a verified native OS
   keyring backend under the same interactive OS user.
3. If locked, request OS unlock/consent and retry once. If unavailable or
   cancelled, prompt again for that interactive session **without persistence**.
4. Environment variables only for explicit local development/test workflows,
   never as a desktop “remember password” feature.
5. Otherwise remain `Unconnected`. Do not create an encrypted home file.

For the current SQLcl MCP path, Oracle says MCP requires a saved password,[S13]
so “prompt without persistence” cannot be smuggled through MCP. The safe
fallback is to ask the user to create/repair the SQLcl saved connection, or
remain Unconnected.

## SQL Developer for VS Code inspiration

Oracle SQL Developer for VS Code separates a durable named connection from its
live session: it offers explicit `Reconnect`, `Disconnect`, and `Delete`
actions, and deleting a connection is distinct from disconnecting its current
session.[S26] A SQL file/worksheet can visibly attach or detach a connection,
and the attached connection name appears in editor chrome. By default, each
new worksheet gets a dedicated session so a long-running query does not block
other database requests.[S27]

**Recommendation:** borrow these semantics, not the product shape. Keep the
Connection Profile/Environment Mapping durable while the live state can be
`Unconnected`; show attachment and `Working Schema` per editor; make reconnect
explicit after cancellation; and keep primary versus read-only/dedicated
session ownership visible. The reviewed Oracle docs document manual reconnect,
not an automatic-reconnect guarantee.

## Product policy and observability

### Default policy

- Primary/interactive session: warn at **14:00**, disconnect at **15:00** of
  application-level database inactivity. User setting: **10–30 minutes** or an
  administrator-provided lower ceiling. Warning range: **30–120 seconds**,
  default **60 seconds**.
- Read-only pool member: retire at **5 minutes** idle, without interrupting the
  user. Validate on every borrow after a 60-second trust interval.
- SQLcl process: stop **5 minutes after the last session disconnects**. Starting
  the process is not itself “connected.”
- Known external ceiling: set the app deadline below it with at least
  `max(60 seconds, 10%)` headroom. This margin is a product heuristic, not an
  Oracle guarantee. Unknown ceiling: retain the default and rely on validation.
- No idle action while work is in flight. Never silently disconnect when an
  unresolved transaction is known or transaction state is unknown.

The 15-minute default is deliberately half of one documented 30-minute
service-specific timeout,[S7] but **is not derived as a universal Oracle
value**. A deployment with a 5-minute profile or middlebox limit will still
disconnect first. Configuration plus validation is the safety mechanism.

### Status and events

Expose independent dimensions rather than one green “connected” bit:

- backend: `healthy | unavailable`;
- SQLcl MCP process: `stopped | starting | running | restarting | failed`;
- Connection Profile: `Unconnected | connecting | connected | reconnecting |
  attention`;
- reason: `user`, `app idle`, `Oracle policy`, `network/transport`,
  `credential unavailable/locked`, or `validation failed`;
- identity: Environment, Connection Profile, Mapping availability, saved-name
  binding, and Working Schema; and
- timing: last successful database activity, idle deadline/warning countdown,
  last validation, and reconnect attempt count.

Record lifecycle transitions, reason, selected logical identities, validation
outcome/duration, and SQLcl MCP tool status. Do not persist passwords, keyring
values, wallet material, raw SQL result rows, or misleading “connected” state.
After timer expiry or failed validation, `Unconnected` remains until a
successful reconnect. If the user cancels/dismisses the warning, do not
auto-reconnect; offer manual reconnect from the Context Bar. An optional
auto-reconnect preference may reconnect **before the next safe operation**, but
must not replay an uncertain write.

## ADR inputs

### Options

1. **SQLcl owns all credentials and sessions.** Lowest trust-boundary change;
   uses named saved connections and MCP-only execution. No direct interactive
   python-oracledb pool.
2. **Split ownership:** SQLcl wallet for agent/MCP; OS keyring plus
   python-oracledb pool for a separately approved interactive path. More
   responsive pooling, but introduces a second credential and DB execution
   boundary that must supersede ADR-0002 explicitly.
3. **Split ownership plus encrypted home-file fallback.** Broadest apparent
   availability, but creates KEK bootstrap, crypto lifecycle, recovery,
   migration, and additional attack-surface obligations.

### Decision drivers

- Preserve SQLcl MCP-only execution unless deliberately superseded.
- Keep passwords out of project manifest, SQLite, logs, MCP arguments, and
  source control.
- Work on Windows, macOS, and Linux without silently weakening storage.
- Make external Oracle/network policy and local app lifecycle distinguishable.
- Preserve Connection Profile/Environment/Mapping while allowing honest
  `Unconnected` documents and explicit Working Schema attachment.
- Avoid replaying writes after ambiguous transport failure.

### Recommended option

Adopt **Option 1 now** with the separate idle clocks, upstream MCP `disconnect`,
validation, and status model above. If the interactive-path ADR proves a direct
driver is necessary, adopt **Option 2** only with explicit OS-backend
allowlisting and fail-closed behavior. Reject Option 3.

### Consequences

- Positive: one current credential owner and execution boundary; no app password
  persistence; sessions/processes can be retired without deleting mappings;
  stale sessions are detected before use.
- Negative: MCP-compatible SQLcl connections must save passwords; reconnect can
  incur startup latency; users on restrictive networks still need deployment
  configuration; a future direct pool duplicates credentials and safety work.
- Operational: packaging must include/test platform keyring dependencies only
  if Option 2 is chosen. Linux service/headless contexts may deliberately have
  no supported persistent credential backend.

### Unresolved questions

1. Will the ADR preserve SQLcl MCP-only database access, or authorize a guarded
   python-oracledb path for interactive SQL/browse?
2. Can SQLcl MCP tool capability discovery replace a hard minimum-version check
   for `disconnect`?
3. How will Apex Pilot prove “no unresolved transaction” before idle disconnect
   for every SQLcl operation?
4. May administrators set deadlines below the product’s 10-minute UI range?
   Recommendation: yes, through deployment policy.
5. Should a Connection Profile support both SQLcl and direct-driver bindings,
   each with independently reported availability?
6. What stable packaged executable identity and signing strategy will be used
   on macOS, and which Linux desktop/keyring combinations are in the support
   matrix?

## Source gaps

- Oracle publicly calls the SQLcl password store a secure wallet but the
  reviewed docs do not disclose its at-rest cipher, KEK custody, OS-user
  binding, ACL defaults, backup/recovery, or saved-password delete semantics.
- No reviewed SQLcl MCP document exposes a process idle timer, session
  max-lifetime setting, or pool API. `disconnect` is documented; the rest is
  application lifecycle management.
- Python keyring’s own security notes say no analysis has been published for
  its Windows, Secret Service, or KWallet backends.[S15] Native-store support is
  not equivalent to an app-isolation guarantee.
- No primary source defines a universal Oracle/network/firewall idle-kill value.
  Values are administrator, service, and path specific.
- Oracle SQL Developer for VS Code documents explicit reconnect/disconnect and
  per-worksheet sessions, but no reviewed guarantee of automatic reconnect or
  restoration of transaction/session state.

## Sources

- **[S1]** Oracle Database 26ai, [CREATE PROFILE](https://docs.oracle.com/en/database/oracle/oracle-database/26/sqlrf/CREATE-PROFILE.html)
- **[S2]** Oracle Database 26ai, [MAX_IDLE_TIME](https://docs.oracle.com/en/database/oracle/oracle-database/26/refrn/MAX_IDLE_TIME.html)
- **[S3]** Oracle Database 26ai, [MAX_IDLE_BLOCKER_TIME](https://docs.oracle.com/en/database/oracle/oracle-database/26/refrn/MAX_IDLE_BLOCKER_TIME.html)
- **[S4]** Oracle Database 26ai, [DBMS_RESOURCE_MANAGER](https://docs.oracle.com/en/database/oracle/oracle-database/26/arpls/DBMS_RESOURCE_MANAGER.html)
- **[S5]** Oracle Database 19c, [Configuring Profiles / SQLNET.EXPIRE_TIME](https://docs.oracle.com/en/database/oracle/oracle-database/19/netag/configuring-profiles.html)
- **[S6]** Oracle Database 18c JDBC, [Using JDBC with Firewalls](https://docs.oracle.com/en/database/oracle/oracle-database/18/jjdbc/JDBC-troubleshooting.html)
- **[S7]** Oracle Exadata Express Cloud, [Database Client Prerequisites](https://docs.oracle.com/en/cloud/paas/exadata-express-cloud/csdbp/database-client-prerequisites.html)
- **[S8]** Oracle SQLcl 25.4, [SQLcl MCP Server Tools](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/sqlcl-mcp-server-tools.html)
- **[S9]** Oracle UCP 21c, [Validating Connections](https://docs.oracle.com/en/database/oracle/oracle-database/21/jjucp/validating-ucp-connections.html)
- **[S10]** python-oracledb, [ConnectionPool API](https://python-oracledb.readthedocs.io/en/latest/api_manual/connection_pool.html)
- **[S11]** python-oracledb, [PoolParams API](https://python-oracledb.readthedocs.io/en/latest/api_manual/pool_params.html)
- **[S12]** Oracle SQLcl 25.4, [CONNMGR](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/connmgr.html)
- **[S13]** Oracle SQLcl 25.4, [Preparing the MCP Environment](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/preparing-your-environment.html)
- **[S14]** Oracle SQLcl 25.4, [Connecting to a Database](https://docs.oracle.com/en/database/oracle/sql-developer-command-line/25.4/sqcug/connecting-database.html)
- **[S15]** Python keyring, [official documentation](https://keyring.readthedocs.io/en/latest/)
- **[S16]** Python keyring, [Windows backend source](https://github.com/jaraco/keyring/blob/master/keyring/backends/Windows.py)
- **[S17]** Microsoft, [CredWriteW](https://learn.microsoft.com/en-us/windows/win32/api/wincred/nf-wincred-credwritew)
- **[S18]** Microsoft, [Kinds of Credentials](https://learn.microsoft.com/en-us/windows/win32/secauthn/kinds-of-credentials)
- **[S19]** Microsoft, [ProtectedData / DPAPI](https://learn.microsoft.com/en-us/dotnet/api/system.security.cryptography.protecteddata)
- **[S20]** Apple, [SecKeychainFindGenericPassword](https://developer.apple.com/documentation/security/seckeychainfindgenericpassword(_:_:_:_:_:_:_:_:))
- **[S21]** Apple, [SecKeychainSetUserInteractionAllowed](https://developer.apple.com/documentation/security/seckeychainsetuserinteractionallowed(_:))
- **[S22]** freedesktop.org, [Secret Service: locking and unlocking](https://specifications.freedesktop.org/secret-service/0.2/unlocking.html)
- **[S23]** SecretStorage, [possible exceptions](https://secretstorage.readthedocs.io/en/latest/exceptions.html)
- **[S24]** Python keyring, [KWallet backend source](https://github.com/jaraco/keyring/blob/master/keyring/backends/kwallet.py)
- **[S25]** Python keyring, [Secret Service backend source](https://github.com/jaraco/keyring/blob/master/keyring/backends/SecretService.py)
- **[S26]** Oracle SQL Developer for VS Code 26.1, [Connecting to Your Database](https://docs.oracle.com/en/database/oracle/sql-developer-vscode/26.1/sqdnx/connecting-your-database.html)
- **[S27]** Oracle SQL Developer for VS Code 25.3, [SQL Worksheet connection management](https://docs.oracle.com/en/database/oracle/sql-developer-vscode/25.3/sqdnx/using-sql-worksheet.html)
