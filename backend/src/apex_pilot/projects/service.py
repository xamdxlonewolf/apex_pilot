"""Project create/open/import service on top of local storage and manifests."""

from __future__ import annotations

import shutil
import subprocess
from collections.abc import Callable, Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path

from apex_pilot.mcp import CommandResult, SqlclMcpConfig
from apex_pilot.projects.errors import ProjectError, ProjectGitError
from apex_pilot.projects.preflight import ProjectPreflightReport, run_project_preflight
from apex_pilot.storage import (
    MANIFEST_FILENAME,
    LocalMetadataStore,
    LocalProfile,
    LocalProject,
    ManifestEnvironment,
    ManifestError,
    ProfileConflictError,
    ProfileCreateRequest,
    ProjectManifest,
    RetentionPolicy,
    load_project_manifest,
    manifest_path_for,
    write_project_manifest,
)
from apex_pilot.storage.models import ApexWorkspaceMapping, EnvironmentMapping

CommandRunner = Callable[[Sequence[str], Mapping[str, str]], CommandResult]
PathLookup = Callable[[str], str | None]


@dataclass(frozen=True)
class CreateProjectRequest:
    """Inputs for creating a new Apex Pilot project folder."""

    profile_id: str
    name: str
    root_path: Path | str
    description: str | None = None
    environments: tuple[ManifestEnvironment, ...] = (
        ManifestEnvironment(name="dev"),
        ManifestEnvironment(name="test"),
    )
    default_environment: str | None = "dev"
    retention: RetentionPolicy | None = None
    init_git: bool = False
    write_readme: bool = True
    apex_workspace_hint: str | None = None
    apex_app_id: int | None = None


@dataclass(frozen=True)
class ImportProjectRequest:
    """Inputs for importing an existing local path or cloning a remote repo."""

    profile_id: str
    root_path: Path | str | None = None
    remote_url: str | None = None
    clone_parent: Path | str | None = None
    clone_directory_name: str | None = None
    retention: RetentionPolicy | None = None


@dataclass(frozen=True)
class OpenedProject:
    """An opened project with portable manifest and local mappings."""

    project: LocalProject
    manifest: ProjectManifest
    environment_mappings: tuple[EnvironmentMapping, ...]
    apex_workspace_mappings: tuple[ApexWorkspaceMapping, ...]
    preflight: ProjectPreflightReport
    unmapped_environments: tuple[str, ...]

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable opened-project payload."""
        return {
            "project": {
                "project_id": self.project.project_id,
                "profile_id": self.project.profile_id,
                "name": self.project.name,
                "root_path": self.project.root_path,
                "retention_days": self.project.retention_days,
                "created_at": self.project.created_at.isoformat(),
                "updated_at": self.project.updated_at.isoformat(),
            },
            "manifest": self.manifest.to_dict(),
            "environment_mappings": [
                {
                    "environment_name": mapping.environment_name,
                    "sqlcl_connection_name": mapping.sqlcl_connection_name,
                }
                for mapping in self.environment_mappings
            ],
            "apex_workspace_mappings": [
                {
                    "sqlcl_connection_name": mapping.sqlcl_connection_name,
                    "workspace_name": mapping.workspace_name,
                }
                for mapping in self.apex_workspace_mappings
            ],
            "unmapped_environments": list(self.unmapped_environments),
            "preflight": self.preflight.to_dict(),
        }


class ProjectService:
    """Coordinates project wizard flows against local metadata storage."""

    def __init__(
        self,
        store: LocalMetadataStore,
        *,
        sqlcl_config: SqlclMcpConfig | None = None,
        command_runner: CommandRunner | None = None,
        path_lookup: PathLookup = shutil.which,
    ) -> None:
        self._store = store
        self._sqlcl_config = sqlcl_config or SqlclMcpConfig()
        self._command_runner = command_runner or _default_command_runner
        self._path_lookup = path_lookup

    @property
    def store(self) -> LocalMetadataStore:
        """Return the underlying metadata store."""
        return self._store

    def list_profiles(self) -> tuple[LocalProfile, ...]:
        """List local profiles."""
        return self._store.list_profiles()

    def create_profile(
        self,
        request: ProfileCreateRequest,
        *,
        force_new: bool = False,
    ) -> LocalProfile:
        """Create a local profile, optionally forcing a distinct display name."""
        try:
            return self._store.create_profile(request, force_new=force_new)
        except ProfileConflictError:
            raise

    def list_recent_projects(self, *, profile_id: str | None = None, limit: int = 10) -> tuple[LocalProject, ...]:
        """List recently updated projects."""
        return self._store.list_projects(profile_id=profile_id, limit=limit)

    def run_preflight(self, project_root: Path | str | None = None) -> ProjectPreflightReport:
        """Run first-launch or project-open preflight checks."""
        return run_project_preflight(
            project_root=project_root,
            sqlcl_config=self._sqlcl_config,
            command_runner=self._command_runner,
            path_lookup=self._path_lookup,
        )

    def create_project(self, request: CreateProjectRequest) -> OpenedProject:
        """Create a new project folder, manifest, and local registration."""
        root = Path(request.root_path).expanduser()
        if root.exists() and any(root.iterdir()):
            raise ProjectError(f"Project directory is not empty: {root}")
        root.mkdir(parents=True, exist_ok=True)

        environments = _with_optional_apex_metadata(
            request.environments,
            apex_workspace_hint=request.apex_workspace_hint,
            apex_app_id=request.apex_app_id,
        )
        manifest = ProjectManifest(
            schema_version=1,
            name=request.name.strip(),
            description=request.description.strip() if request.description else None,
            environments=environments,
            default_environment=request.default_environment,
        )
        write_project_manifest(manifest_path_for(root), manifest)

        if request.write_readme:
            readme = root / "README.md"
            if not readme.exists():
                readme.write_text(
                    f"# {manifest.name}\n\nApex Pilot project. Portable facts live in `{MANIFEST_FILENAME}`.\n",
                    encoding="utf-8",
                )

        if request.init_git:
            self._git_init(root)

        existing = self._store.find_project_by_root(root)
        if existing is not None:
            raise ProjectError(f"A local project is already registered at {root.resolve()}")

        project = self._store.register_project(
            profile_id=request.profile_id,
            name=manifest.name,
            root_path=root,
            retention=request.retention,
        )
        return self.open_project(project.project_id)

    def import_project(self, request: ImportProjectRequest) -> OpenedProject:
        """Import an existing local path or clone a remote Git repository."""
        if request.remote_url:
            root = self._clone_remote(
                remote_url=request.remote_url,
                clone_parent=request.clone_parent,
                clone_directory_name=request.clone_directory_name,
            )
        elif request.root_path:
            root = Path(request.root_path).expanduser().resolve()
            if not root.exists() or not root.is_dir():
                raise ProjectError(f"Project path does not exist or is not a directory: {root}")
        else:
            raise ProjectError("Provide either root_path or remote_url to import a project.")

        manifest_path = manifest_path_for(root)
        if not manifest_path.exists():
            raise ProjectError(
                f"{MANIFEST_FILENAME} was not found in {root}. "
                "Use New Project to create a manifest, or choose a folder that already has one."
            )
        try:
            manifest = load_project_manifest(manifest_path)
        except ManifestError as exc:
            raise ProjectError(str(exc)) from exc

        existing = self._store.find_project_by_root(root)
        if existing is not None:
            if request.retention is not None:
                self._store.set_project_retention(existing.project_id, request.retention)
            return self.open_project(existing.project_id)

        project = self._store.register_project(
            profile_id=request.profile_id,
            name=manifest.name,
            root_path=root,
            retention=request.retention,
        )
        return self.open_project(project.project_id)

    def open_project(self, project_id: str) -> OpenedProject:
        """Open a registered project, validate its manifest, and run preflight."""
        project = self._store.get_project(project_id)
        if project is None:
            raise ProjectError(f"Unknown project_id {project_id!r}")

        root = Path(project.root_path)
        try:
            manifest = load_project_manifest(manifest_path_for(root))
        except ManifestError as exc:
            raise ProjectError(str(exc)) from exc

        self._store.touch_project(project_id)
        project = self._store.get_project(project_id)
        assert project is not None

        mappings = self._store.list_environment_mappings(project_id)
        mapped_names = {mapping.environment_name for mapping in mappings}
        unmapped = tuple(sorted(name for name in manifest.environment_names() if name not in mapped_names))
        apex_mappings = self._store.list_apex_workspace_mappings(project_id)
        preflight = self.run_preflight(root)
        return OpenedProject(
            project=project,
            manifest=manifest,
            environment_mappings=mappings,
            apex_workspace_mappings=apex_mappings,
            preflight=preflight,
            unmapped_environments=unmapped,
        )

    def set_environment_mapping(
        self,
        *,
        project_id: str,
        environment_name: str,
        sqlcl_connection_name: str,
    ) -> EnvironmentMapping:
        """Map a logical environment to a local SQLcl saved connection."""
        project = self._store.get_project(project_id)
        if project is None:
            raise ProjectError(f"Unknown project_id {project_id!r}")
        manifest = load_project_manifest(manifest_path_for(Path(project.root_path)))
        if environment_name not in manifest.environment_names():
            raise ProjectError(f"Environment {environment_name!r} is not declared in {MANIFEST_FILENAME}.")
        return self._store.set_environment_mapping(
            project_id=project_id,
            environment_name=environment_name,
            sqlcl_connection_name=sqlcl_connection_name,
        )

    def set_apex_workspace_mapping(
        self,
        *,
        project_id: str,
        sqlcl_connection_name: str,
        workspace_name: str,
    ) -> ApexWorkspaceMapping:
        """Store optional APEX workspace metadata for a local connection."""
        return self._store.set_apex_workspace_mapping(
            project_id=project_id,
            sqlcl_connection_name=sqlcl_connection_name,
            workspace_name=workspace_name,
        )

    def set_retention(self, project_id: str, retention: RetentionPolicy) -> LocalProject:
        """Update chat/tool retention for a project."""
        return self._store.set_project_retention(project_id, retention)

    def _git_init(self, root: Path) -> None:
        if not self._path_lookup("git"):
            raise ProjectGitError("Git was not found on PATH. Install Git before initializing a repository.")
        if (root / ".git").exists():
            return
        result = self._command_runner(("git", "-C", str(root), "init"), {})
        if result.returncode != 0:
            raise ProjectGitError((result.stderr or result.stdout or "git init failed").strip())

    def _clone_remote(
        self,
        *,
        remote_url: str,
        clone_parent: Path | str | None,
        clone_directory_name: str | None,
    ) -> Path:
        if not self._path_lookup("git"):
            raise ProjectGitError(
                "Git was not found on PATH. Install Git and use OS credential helpers or SSH agent for remotes."
            )
        if not clone_parent:
            raise ProjectError("clone_parent is required when cloning a remote repository.")
        parent = Path(clone_parent).expanduser().resolve()
        parent.mkdir(parents=True, exist_ok=True)
        directory_name = clone_directory_name or _default_clone_directory_name(remote_url)
        target = parent / directory_name
        if target.exists():
            raise ProjectError(f"Clone target already exists: {target}")
        result = self._command_runner(("git", "clone", remote_url, str(target)), {})
        if result.returncode != 0:
            raise ProjectGitError(
                (result.stderr or result.stdout or "git clone failed").strip()
                + " Apex Pilot does not store Git credentials; use OS helpers or SSH agent."
            )
        return target.resolve()


def _with_optional_apex_metadata(
    environments: tuple[ManifestEnvironment, ...],
    *,
    apex_workspace_hint: str | None,
    apex_app_id: int | None,
) -> tuple[ManifestEnvironment, ...]:
    if not apex_workspace_hint and apex_app_id is None:
        return environments
    if not environments:
        raise ProjectError("At least one logical environment is required.")
    first, *rest = environments
    updated = ManifestEnvironment(
        name=first.name,
        default_schema=first.default_schema,
        apex_workspace_hint=apex_workspace_hint or first.apex_workspace_hint,
        apex_app_id=apex_app_id if apex_app_id is not None else first.apex_app_id,
    )
    return (updated, *rest)


def _default_clone_directory_name(remote_url: str) -> str:
    cleaned = remote_url.rstrip("/").rstrip(".git")
    name = cleaned.rsplit("/", 1)[-1]
    name = name.rsplit(":", 1)[-1]
    if name.endswith(".git"):
        name = name[: -len(".git")]
    if not name:
        raise ProjectError("Unable to derive a clone directory name from the remote URL.")
    return name


def _default_command_runner(args: Sequence[str], env: Mapping[str, str]) -> CommandResult:
    completed = subprocess.run(  # noqa: S603 - args come from controlled project service callers
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
