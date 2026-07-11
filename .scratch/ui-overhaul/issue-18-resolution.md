## Resolution

Locked the paper trail so Design Spec is UI/UX authority and ADRs/vault docs match.

### Decisions

1. **MCP Activity** → in-shell **Developer Console** tab. ADR-0007 floating-window target retired; floating/overlay allowed only as migration stub until Console ships.
2. **Center** → **Mission** (not Chat). ADR-0001 / product note drop “chat-first” framing. ADR-0005 may keep “chat threads/messages” as persistence vocabulary without a forced rename.
3. **Right pane** → **Inspector only**. Capabilities kept, hosts change:
   - SQL Sheet → center **SQL Editor**
   - Schema → Explorer/DB + object viewers
   - Mappings → connection / profile / preferences UX
4. **Shell composition** → full Spec target: menu + toolbar + context bar + status bar; Explorer | Mission/workspace | Inspector | bottom Developer Console. Interim Files|Chat|Tools is not the accepted ADR decision.
5. **Docs to update** (applied in working tree): ADR-0007 full rewrite; ADR-0001 / 0005 light; ADR-0006 wizard-chrome note; ADR-0002/0003 untouched; `CONTEXT.md` glossary; `docs/design/Apex Pilot.md`; `docs/design/Apex Pilot PR Roadmap.md` with UI-0…UI-9.
6. **Handoff strategy** → screen/shell-first; design tokens/components in parallel; exact figure_1/2 pixel-match is not a first-PR gate. Stub copy remains [Grilling: Lock stub copy and gap-marking conventions](https://github.com/xamdxlonewolf/apex_pilot/issues/19).

### Assets (local working tree; commit/PR as follow-up)

- `docs/adr/0007-desktop-shell-and-workspace-ux.md` (rewritten)
- `docs/adr/0001-*.md`, `0005-*.md`, `0006-*.md` (light)
- `CONTEXT.md` (new)
- `docs/design/Apex Pilot.md`, `docs/design/Apex Pilot PR Roadmap.md`
