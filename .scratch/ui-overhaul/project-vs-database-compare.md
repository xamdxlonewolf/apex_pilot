# Project vs database compare

Resolved by [Grilling: Project git vs DB file drift surface](https://github.com/xamdxlonewolf/apex_pilot/issues/87).

## Contract

- FS is source of truth; labels: "Database differs from project file"
- On-demand only (no permanent Explorer Drift list)
- Entry: Help → Compare project to database… (+ Command Palette)
- No git gate; needs project + connection
- Results: differing objects list → side-by-side Diff (file | DB, DB read-only)
- Generate report… optional via Agent Core later

## On-map next

Done: [Task: Help Compare project to database Stub entry](https://github.com/xamdxlonewolf/apex_pilot/issues/88) — Help/palette Stub entry.

Later (off this Stub): live scan, Diff viewer wiring, AI Generate report.
