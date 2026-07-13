"""Patch Wayfinder #61 after Grilling: Focus Mode visual primacy cues (#93)."""
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
    body = body.replace("\r\n", "\n").replace("\r", "\n")

    decision = (
        "- [Grilling: Focus Mode visual primacy cues]"
        "(https://github.com/xamdxlonewolf/apex_pilot/issues/93) — "
        "Dim secondary + header accent on primacy; Agent light dim / Review stronger "
        "dim + Mission `Review` meta; SQL/Files slightly stronger editor-forward ratio; "
        "secondary stays interactive. Asset: `.scratch/ui-overhaul/focus-mode-visual-primacy.md`. "
        "Implement: [Task: Focus Mode visual primacy cues (H2)]"
        "(https://github.com/xamdxlonewolf/apex_pilot/issues/106)\n"
    )

    marker = "## Not yet specified"
    if "issues/93" not in body:
        if marker not in body:
            print("missing Not yet specified", file=sys.stderr)
            sys.exit(1)
        body = body.replace(marker, decision + "\n" + marker, 1)

    new_nys = (
        "## Not yet specified\n"
        "\n"
        "- UX review polish P2 status-bar truncate / P3 Files actionable empty line — "
        "ticket only if still fog after open Tasks (B1 #102, H1+M4 #104, H2 #106, "
        "Mission empty-state #97, CTA/schema #96).\n"
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

    out = Path(__file__).with_name("map-61-body-focus-primacy.md")
    out.write_text(body, encoding="utf-8")
    print(f"wrote {out} ({len(body)} chars)")

    # Apply to GitHub issue
    subprocess.check_call(
        ["gh", "issue", "edit", "61", "--body-file", str(out)],
        cwd=ROOT,
    )
    print("updated issue #61")


if __name__ == "__main__":
    main()
