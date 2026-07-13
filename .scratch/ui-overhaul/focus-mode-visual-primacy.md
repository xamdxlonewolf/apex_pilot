# Focus Mode visual primacy cues

Resolved by [Grilling: Focus Mode visual primacy cues](https://github.com/xamdxlonewolf/apex_pilot/issues/93)
on [Wayfinder: Ship figure-matching Mission Control UX](https://github.com/xamdxlonewolf/apex_pilot/issues/61).

UX review: Decision 3 / H2 (ratio alone is not enough; Review must not read as Agent + SQL).

Glossary: `CONTEXT.md` (Focus Mode, Workspace).

## Locked contract

| Rule | Decision |
| --- | --- |
| Primary cue | Dim the **secondary** Workspace peer + light **header accent/fill** on the **primacy** peer |
| Not enough alone | Mission↔Editors grid ratio |
| No permanent “Primary” label | Accent strip / stronger header fill only |
| Secondary interaction | Visual dim only — secondary stays fully clickable/editable |
| Agent | **Light** secondary dim (editors remain alive dual-primary peers); mild Mission-forward ratio |
| Review | **Stronger** secondary dim than Agent; same Mission-forward ratio as Agent; Mission header stays `Mission` with quiet `Review` meta |
| SQL / Files | Editor primacy: header accent on Editors peer; light dim on Mission; **slightly stronger** editor-forward ratio than today’s mild delta |

## Mode matrix

| Focus Mode | Primacy peer | Secondary treatment | Ratio |
| --- | --- | --- | --- |
| Agent | Mission (accent) | Light dim on Editors | Mild Mission-forward (keep current Agent ratio) |
| Review | Mission (accent + `Review` meta) | Stronger dim on Editors | Same as Agent |
| SQL | Editors (accent) | Light dim on Mission | Slightly stronger editor-forward |
| Files | Editors (accent) | Light dim on Mission | Slightly stronger editor-forward |

## Out of cue scope

- Disabling or pointer-blocking the secondary peer
- Replacing Mission title with `Review` while in Review
- A separate Review layout beyond dim + meta + shared Agent ratio
- Relying on Focus Mode control / rail alone to make Review readable in the Workspace

## Implement

Follow-on Task applies CSS/`data-primacy` (and Review Mission header meta) per this contract; keep existing Focus Mode IA and auto-switch behavior unchanged.
