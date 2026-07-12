# Database / APEX open-to-view contract

Resolved by [Grilling: Database/APEX open-to-view detail](https://github.com/xamdxlonewolf/apex_pilot/issues/85)
on [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61).

## Contract

| Action | Behavior |
| --- | --- |
| Open from Explorer (Database or APEX) | Read-only source viewer (table script, packages, APEX artifacts) |
| Save to project… | One flow; suggest path by object kind; replace confirm if exists; no silent write into protected `apex/` / `f*.sql` |
| After save | Open/focus file in editors + Files Focus Mode; viewer may stay open |
| Refresh | Reload viewer from DB only; never auto-overwrite project files |

## Non-goals (this decision)

- Compile / push FS → DB
- Rigid enterprise folder taxonomy
- Fake DDL or success metadata
