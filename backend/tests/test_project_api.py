"""API tests for project wizard and preflight routes."""

from __future__ import annotations

from collections.abc import Mapping, Sequence
from pathlib import Path

from fastapi.testclient import TestClient

from apex_pilot.api.app import create_app
from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.mcp import CommandResult, SqlclMcpConfig
from apex_pilot.projects import ProjectService
from apex_pilot.storage import LocalMetadataStore


class FakeToolClient:
    """Minimal MCP tool client for project-route tests."""

    def __init__(self) -> None:
        self.calls: list[tuple[str, dict[str, object]]] = []

    async def call_tool(self, tool_name: str, arguments: Mapping[str, object]) -> object:
        self.calls.append((tool_name, dict(arguments)))
        return {}


def _runner(sqlcl_path: Path, java_path: Path):
    def runner(args: Sequence[str], _env: Mapping[str, str]) -> CommandResult:
        if args and str(args[0]).endswith(("git", "git.exe")) and "--version" in args:
            return CommandResult(args=tuple(args), returncode=0, stdout="git version 2.45.0\n")
        if args and args[0] == "git" and "init" in args:
            root = Path(args[args.index("-C") + 1])
            (root / ".git").mkdir(parents=True, exist_ok=True)
            return CommandResult(args=tuple(args), returncode=0, stdout="ok\n")
        if args == [str(sqlcl_path), "-V"]:
            return CommandResult(args=tuple(args), returncode=0, stdout="SQLcl: Release 25.2.0\n")
        if args == [str(java_path), "-version"]:
            return CommandResult(args=tuple(args), returncode=0, stderr='openjdk version "21.0.2"\n')
        raise AssertionError(f"Unexpected command: {args}")

    return runner


def make_client(tmp_path: Path) -> TestClient:
    import os

    sqlcl_path = tmp_path / "sql"
    java_home = tmp_path / "java-home"
    java_bin = java_home / "bin"
    java_path = java_bin / ("java.exe" if os.name == "nt" else "java")
    sqlcl_path.write_text("", encoding="utf-8")
    java_bin.mkdir(parents=True)
    java_path.write_text("", encoding="utf-8")

    store = LocalMetadataStore.open(tmp_path / "metadata.sqlite3")
    service = ProjectService(
        store,
        sqlcl_config=SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
        command_runner=_runner(sqlcl_path, java_path),
        path_lookup=lambda name: str(tmp_path / "git.exe") if name == "git" else None,
    )
    (tmp_path / "git.exe").write_text("", encoding="utf-8")
    runtime = ApexPilotRuntime(
        FakeToolClient(),
        project_service=service,
        metadata_store=store,
        owns_metadata_store=True,
    )
    return TestClient(create_app(runtime=runtime, bearer_token="test-token"))


def auth_headers() -> dict[str, str]:
    return {"Authorization": "Bearer test-token"}


def test_project_routes_require_auth(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    assert client.get("/preflight").status_code == 401
    assert client.get("/profiles").status_code == 401
    assert client.get("/projects").status_code == 401


def test_create_profile_project_and_map_environment(tmp_path: Path) -> None:
    client = make_client(tmp_path)
    headers = auth_headers()

    preflight = client.get("/preflight", headers=headers)
    assert preflight.status_code == 200
    assert preflight.json()["ready"] is True

    profile_response = client.post(
        "/profiles",
        headers=headers,
        json={"display_name": "Ada", "email": "ada@example.com", "username": "ada"},
    )
    assert profile_response.status_code == 200
    profile_id = profile_response.json()["profile_id"]

    root = tmp_path / "wizard-project"
    create_response = client.post(
        "/projects",
        headers=headers,
        json={
            "profile_id": profile_id,
            "name": "Wizard Demo",
            "root_path": str(root),
            "retention_days": 90,
            "init_git": True,
            "apex_workspace_hint": "DEMO",
        },
    )
    assert create_response.status_code == 200
    payload = create_response.json()
    project_id = payload["project"]["project_id"]
    assert payload["project"]["name"] == "Wizard Demo"
    assert payload["unmapped_environments"] == ["dev", "test"]
    assert (root / "apex-pilot.json").exists()

    map_response = client.put(
        f"/projects/{project_id}/environment-mappings",
        headers=headers,
        json={"environment_name": "dev", "sqlcl_connection_name": "local_dev"},
    )
    assert map_response.status_code == 200
    assert map_response.json() == {
        "environment_name": "dev",
        "sqlcl_connection_name": "local_dev",
    }

    current = client.get("/projects/current", headers=headers)
    assert current.status_code == 200
    assert current.json()["project"]["project_id"] == project_id
    assert "dev" not in current.json()["unmapped_environments"]

    close_response = client.post("/projects/close", headers=headers)
    assert close_response.status_code == 204
    assert client.get("/projects/current", headers=headers).json() is None
