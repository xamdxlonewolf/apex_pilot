"""Patch Wayfinder #61 after Task: Focus Mode visual primacy cues (H2) (#106)."""
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
    # Normalize mojibake / replacement chars around prior map edits
    body = body.replace("\ufffd", "—").replace("???", "—")

    decision = (
        "- [Task: Focus Mode visual primacy cues (H2)]"
        "(https://github.com/xamdxlonewolf/apex_pilot/issues/106) — "
        "Secondary dim (light Agent/SQL/Files, stronger Review) + primary header accent; "
        "Mission keeps title with quiet Review meta; SQL/Files stronger editor-forward ratio; "
        "secondary stays interactive. PR: https://github.com/xamdxlonewolf/apex_pilot/pull/108. "
        "Asset: `.scratch/ui-overhaul/focus-mode-visual-primacy.md`.\n"
    )

    marker = "## Not yet specified"
    if "pull/108" not in body:
        grilling_impl = (
            "[Task: Focus Mode visual primacy cues (H2)]"
            "(https://github.com/xamdxlonewolf/apex_pilot/issues/106)\n"
        )
        if grilling_impl in body:
            body = body.replace(grilling_impl, grilling_impl + "\n" + decision, 1)
        elif marker in body:
            body = body.replace(marker, decision + "\n" + marker, 1)

    if "pull/108" not in body:
        print("failed to insert decision for #106", file=sys.stderr)
        sys.exit(1)

    new_nys = (
        "## Not yet specified\n"
        "\n"
        "- UX review polish P2 status-bar truncate / P3 Files actionable empty line — "
        "ticket only if still fog after open Tasks (B1 #102, H1+M4 #104, "
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

    out = Path(__file__).with_name("map-61-body-focus-primacy-task.md")
    out.write_text(body, encoding="utf-8")
    print(f"wrote {out} ({len(body)} chars)")

    subprocess.check_call(
        ["gh", "issue", "edit", "61", "--body-file", str(out)],
        cwd=ROOT,
    )
    print("updated issue #61")


if __name__ == "__main__":
    main()
