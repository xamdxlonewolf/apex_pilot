# Implementation order — Calm shell, then connection durability

Living checklist. Cook **Map A completely (or daily-usable)** before Map B unless a Map B blocker is declared.

Related prompt: [NEW-CHAT-PROMPT.md](./NEW-CHAT-PROMPT.md)

## Maps

| Map | Issue | Status |
| --- | --- | --- |
| **A — Calm Focus shell** | [Wayfinder: Ship calm Focus shell](https://github.com/xamdxlonewolf/apex_pilot/issues/113) | Charted — cook first |
| **B — Durable connection** | [Wayfinder: Durable dual-path Oracle connection](https://github.com/xamdxlonewolf/apex_pilot/issues/121) | Charted — cook after A |

## Cook rules

- One Wayfinder ticket per chat/session.
- Claim (`gh issue edit N --add-assignee "@me"`) before work.
- Branch + PR + merge pattern as prior Mission Control map.
- Refer to tickets **by name**, not bare numbers.
- Do not start Map B implementation until Map A’s hide/focus path is usable day-to-day (user call). Map B **grilling/research** may run earlier if desired; AFK pool tasks wait on ADR.

---

## Map A — UI calming (do first)

### Destination

Ship a calm Focus shell: primary work surface + hideable/slide-out secondary tools, larger Activity Rail with optional labels, left-aligned iconed file tree, and uniform resize — Cursor-light, not everything-on-one-page.

### Charted tickets

| # | Run order | Ticket (name + link) | Type | Blocked by | Status |
| --- | --- | --- | --- | --- | --- |
| A0 | 1 | [Grilling: Calm shell visual direction](https://github.com/xamdxlonewolf/apex_pilot/issues/114) | grilling | — | ☑ |
| A1 | 2 | [Grilling: Focus Mode hide/show + slide-out ownership](https://github.com/xamdxlonewolf/apex_pilot/issues/115) | grilling | — | ☑ |
| A2 | 3 | [Grilling: Activity Rail density + labels preference](https://github.com/xamdxlonewolf/apex_pilot/issues/116) | grilling | — | ☑ |
| A3 | 4 | [Task: Activity Rail ~1.5x + icons/labels mode](https://github.com/xamdxlonewolf/apex_pilot/issues/117) | task | A0 + A2 | ☑ |
| A4 | 5 | [Task: File tree explorer + type icons](https://github.com/xamdxlonewolf/apex_pilot/issues/118) | task | A0 | ☐ |
| A5 | 6 | [Task: Uniform splitters for visible peers](https://github.com/xamdxlonewolf/apex_pilot/issues/119) | task | A0 | ☐ |
| A6 | 7 | [Task: Wire Focus hide + slide-out drawers](https://github.com/xamdxlonewolf/apex_pilot/issues/120) | task | A0 + A1 | ☑ |
| A6b | 7b | [Task: Dock drawers + console dismiss + rail open semantics](https://github.com/xamdxlonewolf/apex_pilot/issues/129) | task | A6 | ☑ |

### Suggested `/wayfinder` invocations (Map A)

```text
/wayfinder on Wayfinder: Ship calm Focus shell — take first frontier
/wayfinder on Grilling: Calm shell visual direction
/wayfinder on Grilling: Focus Mode hide/show + slide-out ownership
/wayfinder on Grilling: Activity Rail density + labels preference
/wayfinder on Task: Activity Rail ~1.5x + icons/labels mode
/wayfinder on Task: File tree explorer + type icons
/wayfinder on Task: Uniform splitters for visible peers
/wayfinder on Task: Wire Focus hide + slide-out drawers
/wayfinder on Task: Dock drawers + console dismiss + rail open semantics
```

### Map A acceptance (when “done enough”)

- [x] Files Focus: Mission not stealing unusable space (hidden or equivalent)
- [x] Secondary tools slide out and dismiss
- [x] Activity Rail ~1.5× and labels mode (+ user preference)
- [ ] File tree left-aligned with folder/file-type icons
- [ ] Visible peers share consistent drag-resize
- [x] Visual direction decided and AFK tasks respect it

---

## Map B — Connection durability (do second)

### Destination

Make the project’s chosen Oracle connection durable for the app session: app-owned python-oracledb pool for interactive UI; SQLcl MCP for agents/skills; eliminate remount thrash; idle/reconnect UX; supersede ADR-0002.

### Charted tickets

| # | Run order | Ticket (name + link) | Type | Blocked by | Status |
| --- | --- | --- | --- | --- | --- |
| B1 | 1 | [Grilling: Durable dual-path project connection session](https://github.com/xamdxlonewolf/apex_pilot/issues/122) | grilling | — | ☐ |
| B2 | 2 | [Research: Oracle idle lifetime + saved connections + keyring](https://github.com/xamdxlonewolf/apex_pilot/issues/123) | research | — | ☐ |
| B4 | 3 | [Grilling: ADR supersede ADR-0002 + secrets policy](https://github.com/xamdxlonewolf/apex_pilot/issues/124) | grilling | **B1** | ☐ |
| B3 | 4 | [Task: App-owned oracledb pool + stop remount thrash](https://github.com/xamdxlonewolf/apex_pilot/issues/125) | task | **B1 + B4** | ☐ |
| B5 | 5 | [Task: Wire SQL/PLSQL + DB browse to pool sessions](https://github.com/xamdxlonewolf/apex_pilot/issues/126) | task | **B3** | ☐ |
| B6 | 6 | [Task: Idle timer + reconnect prompt UX](https://github.com/xamdxlonewolf/apex_pilot/issues/127) | task | **B2 + B3** | ☐ |

### Suggested `/wayfinder` invocations (Map B)

```text
/wayfinder on Wayfinder: Durable dual-path Oracle connection — take first frontier
/wayfinder on Grilling: Durable dual-path project connection session
/wayfinder on Research: Oracle idle lifetime + saved connections + keyring   # can parallel after B1 starts / separate chat
/wayfinder on Grilling: ADR supersede ADR-0002 + secrets policy
/wayfinder on Task: App-owned oracledb pool + stop remount thrash
/wayfinder on Task: Wire SQL/PLSQL + DB browse to pool sessions
/wayfinder on Task: Idle timer + reconnect prompt UX
```

### Map B acceptance (when “done enough”)

- [ ] Closing dialogs / toggling panels does **not** force reconnect
- [ ] Interactive surfaces use oracledb pool (borrow/dedicated); agents stay on MCP
- [ ] Connected / reconnecting / dead is honest and single-homed
- [ ] Idle timer + reconnect prompt/auto; cancel → manual reconnect
- [ ] ADR-0002 superseded; secrets via keyring (encrypted file fallback only if needed)

---

## Fast cook checklist

**Charting chat**

- [x] Map A created
- [x] Map B created
- [x] This file updated with real links
- [x] First ticket named for next chat

**Map A cook**

- [x] A0 visual direction
- [x] A1 focus/drawers
- [x] A6b dock/console/rail fix
- [ ] A2 rail preference
- [ ] A3 rail task
- [ ] A4 file tree
- [ ] A5 splitters
- [x] A6 drawers wire

**Map B cook**

- [ ] B1
- [ ] B2
- [ ] B4 ADR
- [ ] B3 pool
- [ ] B5 wire
- [ ] B6 idle UX

---

## Out of scope reminders (both maps)

- Fake Agent Core Execute success / demo Missions
- Multi-project concurrent open
- Turning Apex Pilot into VS Code
- Touching APEX export folders / root `f*.sql`
- Persisting Oracle passwords in plaintext / as primary home-file store
