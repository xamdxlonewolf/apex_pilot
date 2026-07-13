"""Patch Wayfinder #61 after Grilling: Product Header connection density (#92)."""
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
        "- [Grilling: Product Header connection density]"
        "(https://github.com/xamdxlonewolf/apex_pilot/issues/92) — "
        "Context Bar select+Connect owns connection name; drop header connection/"
        "MCP health pills; status bar short `DB:`; Settings header-only; Backend "
        "health pill stays. Asset: `.scratch/ui-overhaul/product-header-connection-density.md`. "
        "Implement: [Task: Product Header connection density (H1+M4)]"
        "(https://github.com/xamdxlonewolf/apex_pilot/issues/104)\n"
    )

    # Insert after Browser App Menu decision (or before ## Not yet specified).
    marker = "## Not yet specified"
    if "issues/92" not in body:
        if marker not in body:
            print("missing Not yet specified", file=sys.stderr)
            sys.exit(1)
        body = body.replace(marker, decision + "\n" + marker, 1)

    new_nys = (
        "## Not yet specified\n"
        "\n"
        "- After Grilling on Focus Mode primacy: graduate implement Task for H2 "
        "(H1+M4 graduated with #92; B1 graduated as #102).\n"
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

    out = Path(__file__).with_name("map-61-body-connection-density.md")
    out.write_text(body, encoding="utf-8")
    print(f"wrote {out} ({len(body)} chars) — placeholder still needs issue number")


if __name__ == "__main__":
    main()
