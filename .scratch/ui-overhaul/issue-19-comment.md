## Resolution

Locked stub copy and gap-marking conventions for all later implement tickets.

### Decisions

1. **Primary copy:** exactly `Not implemented yet`.
2. **Optional secondary:** one short line naming the missing dependency when helpful; no dates / fake progress.
3. **Chrome badge:** exactly `Stub`.
4. **Product UI vs planning:** user-visible UI is Stub only; **Gap** is docs/Roadmap only.
5. **Gap recipe:** `Gap:` + stable `DS-*` id + owning UI-*/PR item; keep under Roadmap **Gaps / orphans** until claimed; remove Gap line once a path exists.
6. **Controls:** keep Spec layout; disable unfinished actions; honest stub hint; never fake success.
7. **IDs:** `DS-*` / `UI-*` stay docs/agent-only — not in product stub UI.
8. **Migration:** working interim paths are not Stub-badged; unfinished Spec surfaces and dead placeholders use Stub conventions.
9. **Canonical home:** ADR-0007 Decision §11; Roadmap **UI-9** is the apply-across-layout pointer.
10. **Data:** no fake/sample success content; real in-flight loading is fine.

### Assets (working tree)

- `docs/adr/0007-desktop-shell-and-workspace-ux.md` (Decision §11)
- `docs/design/Apex Pilot PR Roadmap.md` (UI-9 + Gaps/orphans)
- `CONTEXT.md` (Stub / Gap terms)
- `.scratch/ui-overhaul/issue-19-resolution.md`
