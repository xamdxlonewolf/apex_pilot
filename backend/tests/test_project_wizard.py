"""Tests for project preflight and wizard service flows."""

from __future__ import annotations

import os
from collections.abc import Iterator, Mapping, Sequence
from pathlib import Path

import pytest

from apex_pilot.mcp import CommandResult, SqlclMcpConfig
from apex_pilot.projects import (
    CreateProjectRequest,
    ImportProjectRequest,
    ProjectError,
    ProjectService,
    run_project_preflight,
)
from apex_pilot.storage import LocalMetadataStore, ProfileCreateRequest, RetentionPolicy


@pytest.fixture
def store(tmp_path: Path) -> Iterator[LocalMetadataStore]:
    with LocalMetadataStore.open(tmp_path / "metadata.sqlite3") as opened:
        yield opened


def _make_sqlcl_java(tmp_path: Path) -> tuple[Path, Path, Path]:
    tmp_path.mkdir(parents=True, exist_ok=True)
    sqlcl_path = tmp_path / "sql"
    java_home = tmp_path / "java-home"
    java_bin = java_home / "bin"
    java_path = java_bin / ("java.exe" if os.name == "nt" else "java")
    sqlcl_path.write_text("", encoding="utf-8")
    java_bin.mkdir(parents=True, exist_ok=True)
    java_path.write_text("", encoding="utf-8")
    return sqlcl_path, java_home, java_path


def _ok_runner(sqlcl_path: Path, java_path: Path):
    def runner(args: Sequence[str], _env: Mapping[str, str]) -> CommandResult:
        if args and Path(args[0]).name.startswith("git") and "--version" in args:
            return CommandResult(args=tuple(args), returncode=0, stdout="git version 2.45.0\n")
        if args and args[0] == "git" and "init" in args:
            root = Path(args[args.index("-C") + 1]) if "-C" in args else Path.cwd()
            (root / ".git").mkdir(parents=True, exist_ok=True)
            return CommandResult(args=tuple(args), returncode=0, stdout="Initialized empty Git repository\n")
        if args and args[0] == "git" and "clone" in args:
            target = Path(args[-1])
            target.mkdir(parents=True, exist_ok=True)
            (target / "apex-pilot.json").write_text(
                '{\n  "schemaVersion": 1,\n  "name": "cloned",\n  "environments": [{"name": "dev"}]\n}\n',
                encoding="utf-8",
            )
            return CommandResult(args=tuple(args), returncode=0, stdout="Cloning...\n")
        if args == [str(sqlcl_path), "-V"]:
            return CommandResult(args=tuple(args), returncode=0, stdout="SQLcl: Release 25.2.0\n")
        if args == [str(java_path), "-version"]:
            return CommandResult(args=tuple(args), returncode=0, stderr='openjdk version "21.0.2"\n')
        raise AssertionError(f"Unexpected command: {args}")

    return runner


def test_project_preflight_reports_ready_when_tools_present(tmp_path: Path) -> None:
    """Preflight is ready when Git/Python/SQLcl/Java pass and no project is required."""
    sqlcl_path, java_home, java_path = _make_sqlcl_java(tmp_path)

    report = run_project_preflight(
        sqlcl_config=SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
        command_runner=_ok_runner(sqlcl_path, java_path),
        path_lookup=lambda name: "C:/fake/git.exe" if name == "git" else None,
        python_version=(3, 12),
    )

    assert report.ready is True
    assert report.blocking_ids == ()
    statuses = {check.id: check.status for check in report.checks}
    assert statuses["git"] == "ok"
    assert statuses["sqlcl"] == "ok"
    assert statuses["java"] == "ok"
    assert statuses["sqlcl_mcp"] == "ok"
    assert statuses["manifest"] == "warning"


def test_project_preflight_guides_missing_git(tmp_path: Path) -> None:
    """Missing Git is a blocking check with install guidance."""
    sqlcl_path, java_home, java_path = _make_sqlcl_java(tmp_path)

    report = run_project_preflight(
        sqlcl_config=SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
        command_runner=_ok_runner(sqlcl_path, java_path),
        path_lookup=lambda _name: None,
        python_version=(3, 12),
    )

    git_check = next(check for check in report.checks if check.id == "git")
    assert git_check.status == "missing"
    assert git_check.guide is not None
    assert "git-scm.com" in (git_check.guide.docs_url or "")
    assert "git" in report.blocking_ids


def test_create_and_open_project_writes_manifest_and_registers(store: LocalMetadataStore, tmp_path: Path) -> None:
    """New Project creates apex-pilot.json, optional README/Git, and opens the project."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Ada", email="ada@example.com"))
    root = tmp_path / "demo-project"
    sqlcl_path, java_home, java_path = _make_sqlcl_java(tmp_path / "tools")
    service = ProjectService(
        store,
        sqlcl_config=SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
        command_runner=_ok_runner(sqlcl_path, java_path),
        path_lookup=lambda name: "git" if name == "git" else None,
    )

    opened = service.create_project(
        CreateProjectRequest(
            profile_id=profile.profile_id,
            name="Demo",
            root_path=root,
            retention=RetentionPolicy.days_policy(90),
            init_git=True,
            write_readme=True,
            apex_workspace_hint="DEMO",
            apex_app_id=100,
        )
    )

    assert (root / "apex-pilot.json").exists()
    assert (root / "README.md").exists()
    assert (root / ".git").exists()
    assert opened.project.name == "Demo"
    assert opened.project.retention_days == 90
    assert opened.manifest.environments[0].apex_workspace_hint == "DEMO"
    assert opened.unmapped_environments == ("dev", "test")
    assert store.list_projects(limit=5)[0].project_id == opened.project.project_id


def test_import_existing_path_and_map_environment(store: LocalMetadataStore, tmp_path: Path) -> None:
    """Importing an existing manifest path registers and maps local environments."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Ada"))
    root = tmp_path / "existing"
    root.mkdir()
    (root / "apex-pilot.json").write_text(
        '{\n  "schemaVersion": 1,\n  "name": "Existing",\n  "environments": [{"name": "dev"}]\n}\n',
        encoding="utf-8",
    )
    sqlcl_path, java_home, java_path = _make_sqlcl_java(tmp_path / "tools")
    service = ProjectService(
        store,
        sqlcl_config=SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
        command_runner=_ok_runner(sqlcl_path, java_path),
        path_lookup=lambda _name: None,
    )

    opened = service.import_project(
        ImportProjectRequest(profile_id=profile.profile_id, root_path=root, retention=RetentionPolicy.indefinite())
    )
    mapping = service.set_environment_mapping(
        project_id=opened.project.project_id,
        environment_name="dev",
        sqlcl_connection_name="local_dev",
    )
    reopened = service.open_project(opened.project.project_id)

    assert opened.project.retention_days is None
    assert mapping.sqlcl_connection_name == "local_dev"
    assert reopened.unmapped_environments == ()
    assert reopened.environment_mappings[0].sqlcl_connection_name == "local_dev"


def test_import_rejects_folder_without_manifest(store: LocalMetadataStore, tmp_path: Path) -> None:
    """Folders without apex-pilot.json cannot be imported as projects."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Ada"))
    root = tmp_path / "empty"
    root.mkdir()
    service = ProjectService(store)

    with pytest.raises(ProjectError, match="apex-pilot.json"):
        service.import_project(ImportProjectRequest(profile_id=profile.profile_id, root_path=root))


def test_clone_remote_uses_system_git_only(store: LocalMetadataStore, tmp_path: Path) -> None:
    """Remote import clones through installed Git and then opens the manifest."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Ada"))
    parent = tmp_path / "clones"
    sqlcl_path, java_home, java_path = _make_sqlcl_java(tmp_path / "tools")
    service = ProjectService(
        store,
        sqlcl_config=SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
        command_runner=_ok_runner(sqlcl_path, java_path),
        path_lookup=lambda name: "git" if name == "git" else None,
    )

    opened = service.import_project(
        ImportProjectRequest(
            profile_id=profile.profile_id,
            remote_url="https://example.com/org/demo.git",
            clone_parent=parent,
        )
    )

    assert opened.manifest.name == "cloned"
    assert Path(opened.project.root_path).name == "demo"
