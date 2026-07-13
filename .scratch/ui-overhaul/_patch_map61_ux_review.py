"""Patch Wayfinder #61 body for UX-review follow-on wave."""
from __future__ import annotations

import json
import re
import subprocess
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parents[2]


def gh_json(*args: str) -> dict:
    raw = subprocess.check_output(["gh", *args], cwd=ROOT)
    return json.loads(raw.decode("utf-8"))


def main() -> None:
    body = gh_json("issue", "view", "61", "--json", "body")["body"]
    # Normalize the map's chaotic CR/LF history to LF for editing.
    body = body.replace("\r\n", "\n").replace("\r", "\n")

    new_nys = (
        "## Not yet specified\n"
        "\n"
        "- After Grillings on Browser App Menu / Product Header connection density / "
        "Focus Mode primacy: graduate implement Tasks for B1, H1+M4, H2 "
        "(not ticketed until decisions land).\n"
        "- UX review polish P2 status-bar truncate / P3 Files actionable empty line — "
        "ticket only if still fog after Tasks above.\n"
    )
    body2, n = re.subn(
        r"## Not yet specified\n\n.*?(?=\n## Out of scope)",
        new_nys.rstrip("\n"),
        body,
        count=1,
        flags=re.S,
    )
    if n != 1:
        print("failed to replace Not yet specified", n, file=sys.stderr)
        sys.exit(1)
    body = body2

    defer_block = (
        "\n"
        "- [Defer: Agent Core Mission / Inspector evidence]"
        "(https://github.com/xamdxlonewolf/apex_pilot/issues/98) — correctly Stub; "
        "do not fake figure checklist/SQL/success on this map (UX review Decision 8)\n"
        "- [Defer: APEX / Review Explorer bodies + Console craft]"
        "(https://github.com/xamdxlonewolf/apex_pilot/issues/99) — honest Stub / "
        "Partial craft; not IA blockers for this wave\n"
    )
    if "issues/98" not in body:
        # Insert before Made with Cursor if present, else append to Out of scope.
        if "\nMade with" in body:
            body = body.replace("\nMade with", defer_block + "\nMade with", 1)
        else:
            body = body.rstrip() + "\n" + defer_block

    note = (
        "- UX review follow-on (2026-07-12): canvas mission-control-ux-review "
        "section 4 tickets; Decisions 1–8 are acceptance criteria; Stub honesty "
        "unchanged.\n"
    )
    if "UX review follow-on" not in body:
        body = body.replace("## Decisions so far", note + "\n## Decisions so far", 1)

    out = Path(__file__).with_name("map-61-body-ux-review.md")
    out.write_text(body, encoding="utf-8")
    print(f"wrote {out} ({len(body)} chars)")

    subprocess.check_call(
        ["gh", "issue", "edit", "61", "--body-file", str(out)],
        cwd=ROOT,
    )
    print("updated issue 61")


if __name__ == "__main__":
    main()
