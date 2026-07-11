#!/usr/bin/env python3
"""Wire GitHub issue blocked_by edges and sub-issues for UI overhaul tickets."""
from __future__ import annotations

import json
import subprocess
import tempfile
from pathlib import Path

REPO = "xamdxlonewolf/apex_pilot"

# issue number -> database id
IDS = {
    25: 4860821096,
    26: 4860865605,
    27: 4860865656,
    28: 4860865709,
    29: 4860865756,
    30: 4860865908,
    31: 4860866004,
    32: 4860866046,
    33: 4860866086,
    34: 4860866129,
    35: 4860866169,
    36: 4860866216,
    37: 4860866261,
    38: 4860866302,
    39: 4860866355,
    40: 4860866417,
    41: 4860866470,
    42: 4860866669,
}

# child number -> blocker numbers
EDGES = {
    27: [26],  # already linked; POST may 422 if duplicate — ignore
    28: [26],
    29: [26, 27],
    30: [26, 28],
    31: [30],
    32: [26, 28],
    33: [32],
    34: [26, 28],
    35: [34],
    36: [26, 28, 31, 34],
    37: [26, 28],
    38: [37],
    39: [26, 28, 36],
    40: [39],
    41: [26, 27],
    42: [30, 31],
}

TITLES = {
    26: "Mission Control chrome + region scaffold",
    27: "Panel layout controls",
    28: "Stub surface convention",
    29: "Minimal command palette",
    30: "Explorer - project files",
    31: "Explorer - multi-section + schema home",
    32: "Mission - composer Stub",
    33: "Mission - timeline and stage chrome",
    34: "SQL Editor to center workspace",
    35: "Center editor stubs + dirty Close Project",
    36: "Inspector panel",
    37: "Developer Console scaffold",
    38: "MCP Activity to Console + Tauri e2e smoke",
    39: "Preferences, layout persistence and Mapping home",
    40: "Dialog and wizard chrome",
    41: "Density modes + motion polish",
    42: "Quick Open",
}


def gh_api_json(method: str, path: str, payload: dict) -> tuple[int, str]:
    with tempfile.NamedTemporaryFile("w", suffix=".json", delete=False, encoding="utf-8") as f:
        json.dump(payload, f)
        tmp = f.name
    try:
        proc = subprocess.run(
            ["gh", "api", "--method", method, path, "--input", tmp],
            capture_output=True,
            text=True,
            check=False,
        )
        out = (proc.stdout or "") + (proc.stderr or "")
        return proc.returncode, out
    finally:
        Path(tmp).unlink(missing_ok=True)


def main() -> None:
    for child, blockers in EDGES.items():
        for blocker in blockers:
            code, out = gh_api_json(
                "POST",
                f"repos/{REPO}/issues/{child}/dependencies/blocked_by",
                {"issue_id": IDS[blocker]},
            )
            status = "ok" if code == 0 else f"rc={code}"
            print(f"blocked_by #{child} <- #{blocker}: {status}")
            if code != 0 and "already" not in out.lower() and "422" not in out:
                print(out[:500])

    for n in range(26, 43):
        code, out = gh_api_json(
            "POST",
            f"repos/{REPO}/issues/25/sub_issues",
            {"sub_issue_id": IDS[n]},
        )
        status = "ok" if code == 0 else f"rc={code}"
        print(f"sub_issue #{n} under #25: {status}")
        if code != 0:
            print(out[:400])

    state = [
        {
            "number": n,
            "title": TITLES[n],
            "url": f"https://github.com/{REPO}/issues/{n}",
            "blockers": EDGES.get(n, []),
        }
        for n in range(26, 43)
    ]
    out_path = Path(__file__).with_name("published-tickets.json")
    out_path.write_text(json.dumps(state, indent=2), encoding="utf-8")
    print(f"wrote {out_path}")


if __name__ == "__main__":
    main()
