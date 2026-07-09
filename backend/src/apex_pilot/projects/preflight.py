"""First-launch and project-open prerequisite checks.

These checks guide users through missing tools. They never auto-install
dependencies from the app.
"""

from __future__ import annotations

import shutil
import subprocess
import sys
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Literal

from apex_pilot.mcp import (
    SQLCL_MINIMUM_VERSION,
    SUPPORTED_JAVA_MAJOR_VERSIONS,
    CommandResult,
    SqlclMcpConfig,
    SqlclPreflightError,
    run_sqlcl_preflight,
)
from apex_pilot.storage.manifest import MANIFEST_FILENAME, load_project_manifest

CheckStatus = Literal["ok", "warning", "missing", "failed"]
CommandRunner = Callable[[Sequence[str], Mapping[str, str]], CommandResult]
PathLookup = Callable[[str], str | None]


@dataclass(frozen=True)
class PrerequisiteGuide:
    """Human-readable install guidance for a missing prerequisite."""

    title: str
    summary: str
    steps: tuple[str, ...]
    docs_url: str | None = None


@dataclass(frozen=True)
class ProjectPreflightCheck:
    """One prerequisite check result."""

    id: str
    label: str
    status: CheckStatus
    detail: str
    guide: PrerequisiteGuide | None = None


@dataclass(frozen=True)
class ProjectPreflightReport:
    """Aggregate first-launch / project-open preflight status."""

    checks: tuple[ProjectPreflightCheck, ...]
    ready: bool
    blocking_ids: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable report payload."""
        return {
            "ready": self.ready,
            "blocking_ids": list(self.blocking_ids),
            "checks": [
                {
                    "id": check.id,
                    "label": check.label,
                    "status": check.status,
                    "detail": check.detail,
                    "guide": None
                    if check.guide is None
                    else {
                        "title": check.guide.title,
                        "summary": check.guide.summary,
                        "steps": list(check.guide.steps),
                        "docs_url": check.guide.docs_url,
                    },
                }
                for check in self.checks
            ],
        }


_GIT_GUIDE = PrerequisiteGuide(
    title="Install Git",
    summary=(
        "Apex Pilot uses the system Git client for clone and optional repo init. "
        "Credentials stay in OS helpers or SSH agent."
    ),
    steps=(
        "Install Git for your OS from https://git-scm.com/downloads",
        "Confirm `git --version` works in a terminal",
        "Configure OS credential helpers or SSH agent for remote repositories",
    ),
    docs_url="https://git-scm.com/downloads",
)

_SQLCL_GUIDE = PrerequisiteGuide(
    title="Install Oracle SQLcl 25.2+",
    summary="All database work goes through SQLcl MCP. Apex Pilot does not install SQLcl for you.",
    steps=(
        "Install Oracle SQLcl 25.2 or newer",
        "Ensure the `sql` binary is on PATH, or set APEX_PILOT_SQLCL_PATH",
        "Create SQLcl saved connections for your Oracle environments",
    ),
    docs_url="https://www.oracle.com/database/sqldeveloper/technologies/sqlcl/",
)

_JAVA_GUIDE = PrerequisiteGuide(
    title="Install a supported Java runtime",
    summary="SQLcl MCP requires Java 17 or 21.",
    steps=(
        "Install a JDK or JRE for Java 17 or 21",
        "Set JAVA_HOME to that runtime, or ensure `java` is on PATH",
        "Confirm `java -version` reports a supported major version",
    ),
    docs_url="https://www.oracle.com/java/technologies/downloads/",
)

_PYTHON_GUIDE = PrerequisiteGuide(
    title="Confirm Python 3.12+",
    summary="The local Apex Pilot backend runs on Python 3.12 or newer.",
    steps=(
        "Install Python 3.12+",
        "Confirm `python --version` or `python3 --version`",
        "Use the project backend tooling (`uv`) for development installs",
    ),
    docs_url="https://www.python.org/downloads/",
)

_MCP_GUIDE = PrerequisiteGuide(
    title="Verify SQLcl MCP readiness",
    summary="SQLcl must pass Apex Pilot's MCP preflight before live database work.",
    steps=(
        "Confirm SQLcl and Java preflight succeed",
        "Ensure TNS_ADMIN is set when your connections need a tnsnames.ora",
        "Retry the project preflight after fixing SQLcl or Java",
    ),
)

_MANIFEST_GUIDE = PrerequisiteGuide(
    title="Create or open an Apex Pilot project",
    summary="Projects are identified by a committed apex-pilot.json manifest.",
    steps=(
        "Use New Project to create a folder with apex-pilot.json",
        "Or Open Project / import an existing folder that already has the manifest",
        "Do not put SQLcl saved connection names in the committed manifest",
    ),
)


def run_project_preflight(
    *,
    project_root: Path | str | None = None,
    sqlcl_config: SqlclMcpConfig | None = None,
    command_runner: CommandRunner | None = None,
    path_lookup: PathLookup = shutil.which,
    python_version: tuple[int, int] | None = None,
) -> ProjectPreflightReport:
    """Run first-launch / project-open prerequisite checks."""
    runner = command_runner or _default_command_runner
    config = sqlcl_config or SqlclMcpConfig()
    checks: list[ProjectPreflightCheck] = [
        _check_git(path_lookup=path_lookup, command_runner=runner),
        _check_python(python_version=python_version or sys.version_info[:2]),
    ]
    checks.extend(_check_sqlcl_stack(config=config, command_runner=runner, path_lookup=path_lookup))
    checks.append(_check_manifest(project_root))

    blocking: list[str] = []
    for check in checks:
        if check.status not in {"missing", "failed"}:
            continue
        if check.id == "manifest" and project_root is None:
            continue
        blocking.append(check.id)

    return ProjectPreflightReport(
        checks=tuple(checks),
        ready=not blocking,
        blocking_ids=tuple(blocking),
    )


def _check_git(*, path_lookup: PathLookup, command_runner: CommandRunner) -> ProjectPreflightCheck:
    git_path = path_lookup("git")
    if not git_path:
        return ProjectPreflightCheck(
            id="git",
            label="Git",
            status="missing",
            detail="Git was not found on PATH.",
            guide=_GIT_GUIDE,
        )
    result = command_runner(("git", "--version"), {})
    if result.returncode != 0:
        return ProjectPreflightCheck(
            id="git",
            label="Git",
            status="failed",
            detail=(result.stderr or result.stdout or "git --version failed").strip(),
            guide=_GIT_GUIDE,
        )
    detail = (result.stdout or result.stderr or "Git is available").strip()
    return ProjectPreflightCheck(id="git", label="Git", status="ok", detail=detail)


def _check_python(*, python_version: tuple[int, int]) -> ProjectPreflightCheck:
    major, minor = python_version
    version_text = f"{major}.{minor}"
    if (major, minor) < (3, 12):
        return ProjectPreflightCheck(
            id="python",
            label="Python",
            status="failed",
            detail=f"Python {version_text} is below the required 3.12+.",
            guide=_PYTHON_GUIDE,
        )
    return ProjectPreflightCheck(
        id="python",
        label="Python",
        status="ok",
        detail=f"Python {version_text} meets the 3.12+ requirement.",
    )


def _check_sqlcl_stack(
    *,
    config: SqlclMcpConfig,
    command_runner: CommandRunner,
    path_lookup: PathLookup,
) -> tuple[ProjectPreflightCheck, ProjectPreflightCheck, ProjectPreflightCheck]:
    try:
        result = run_sqlcl_preflight(
            config,
            command_runner=command_runner,
            path_lookup=path_lookup,
        )
    except SqlclPreflightError as exc:
        message = str(exc)
        lower = message.lower()
        java_first = "java" in lower
        sqlcl_status: CheckStatus
        java_status: CheckStatus
        if java_first:
            sqlcl_status = "warning"
            java_status = "missing" if "not found" in lower or "does not exist" in lower else "failed"
            sqlcl_detail = "SQLcl check deferred because Java preflight failed first."
            java_detail = message
        else:
            sqlcl_status = "missing" if "not found" in lower or "does not exist" in lower else "failed"
            java_status = "warning"
            sqlcl_detail = message
            java_detail = "Java was not fully validated because SQLcl preflight failed first."
        return (
            ProjectPreflightCheck(
                id="sqlcl",
                label="SQLcl",
                status=sqlcl_status,
                detail=sqlcl_detail,
                guide=_SQLCL_GUIDE,
            ),
            ProjectPreflightCheck(
                id="java",
                label="Java / JRE",
                status=java_status,
                detail=java_detail,
                guide=_JAVA_GUIDE,
            ),
            ProjectPreflightCheck(
                id="sqlcl_mcp",
                label="SQLcl MCP smoke",
                status="failed",
                detail=message,
                guide=_MCP_GUIDE,
            ),
        )

    return (
        ProjectPreflightCheck(
            id="sqlcl",
            label="SQLcl",
            status="ok",
            detail=(
                f"SQLcl {result.sqlcl_version_text} at {result.sqlcl_path} "
                f"(minimum {'.'.join(str(part) for part in SQLCL_MINIMUM_VERSION)})."
            ),
        ),
        ProjectPreflightCheck(
            id="java",
            label="Java / JRE",
            status="ok",
            detail=(
                f"Java {result.java_major_version} at {result.java_path} "
                f"(supported: {', '.join(str(v) for v in sorted(SUPPORTED_JAVA_MAJOR_VERSIONS))})."
            ),
        ),
        ProjectPreflightCheck(
            id="sqlcl_mcp",
            label="SQLcl MCP smoke",
            status="ok",
            detail="SQLcl and Java passed MCP preflight. Live tool calls still require a saved connection.",
        ),
    )


def _check_manifest(project_root: Path | str | None) -> ProjectPreflightCheck:
    if project_root is None:
        return ProjectPreflightCheck(
            id="manifest",
            label="Project manifest",
            status="warning",
            detail=f"No project open yet. Create or open a folder with {MANIFEST_FILENAME}.",
            guide=_MANIFEST_GUIDE,
        )
    root = Path(project_root)
    manifest_path = root / MANIFEST_FILENAME
    if not manifest_path.exists():
        return ProjectPreflightCheck(
            id="manifest",
            label="Project manifest",
            status="missing",
            detail=f"{MANIFEST_FILENAME} was not found in {root}.",
            guide=_MANIFEST_GUIDE,
        )
    try:
        manifest = load_project_manifest(manifest_path)
    except Exception as exc:  # noqa: BLE001 - surface any load failure as preflight detail
        return ProjectPreflightCheck(
            id="manifest",
            label="Project manifest",
            status="failed",
            detail=str(exc),
            guide=_MANIFEST_GUIDE,
        )
    return ProjectPreflightCheck(
        id="manifest",
        label="Project manifest",
        status="ok",
        detail=f"Loaded {manifest.name} with {len(manifest.environments)} logical environment(s).",
    )


def _default_command_runner(args: Sequence[str], env: Mapping[str, str]) -> CommandResult:
    completed = subprocess.run(  # noqa: S603 - args come from controlled preflight callers
        list(args),
        capture_output=True,
        text=True,
        env=dict(env) if env else None,
        check=False,
    )
    return CommandResult(
        args=tuple(args),
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )
