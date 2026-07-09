"""HTTP routes for the local backend."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict, Field

from apex_pilot import __version__
from apex_pilot.api.auth import require_bearer_token
from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.mcp import SqlclConnectionError, SqlclMcpError
from apex_pilot.projects import (
    CreateProjectRequest,
    ImportProjectRequest,
    ProjectError,
    ProjectGitError,
)
from apex_pilot.schema import SchemaIntelligenceError
from apex_pilot.storage import (
    ManifestEnvironment,
    ProfileConflictError,
    ProfileCreateRequest,
    RetentionPolicy,
    StorageError,
)
from apex_pilot.storage.manifest import ManifestError

router = APIRouter()


class HealthResponse(BaseModel):
    """Health check response payload."""

    model_config = ConfigDict(frozen=True)

    status: Literal["ok"]
    service: str
    version: str


class SavedConnectionResponse(BaseModel):
    """SQLcl saved connection visible through MCP."""

    model_config = ConfigDict(frozen=True)

    name: str
    display_name: str | None = None


class SavedConnectionsResponse(BaseModel):
    """Saved connection list response."""

    model_config = ConfigDict(frozen=True)

    connections: list[SavedConnectionResponse]


class ConnectResponse(BaseModel):
    """Connection selection response."""

    model_config = ConfigDict(frozen=True)

    connection_name: str


class DatabaseContextResponse(BaseModel):
    """Current Oracle database/session context."""

    model_config = ConfigDict(frozen=True)

    current_user: str | None
    db_name: str | None
    container_name: str | None
    cdb_name: str | None
    host: str | None


class SchemaObjectCountResponse(BaseModel):
    """Count and validity summary for one Oracle object type."""

    model_config = ConfigDict(frozen=True)

    object_type: str
    object_count: int
    valid_count: int
    invalid_count: int


class SchemaTableResponse(BaseModel):
    """Visible table metadata for a schema summary."""

    model_config = ConfigDict(frozen=True)

    table_name: str
    num_rows: int | None
    last_analyzed: str | None
    partitioned: str | None
    iot_type: str | None


class SchemaSummaryResponse(BaseModel):
    """Structured schema summary for agent and UI use."""

    model_config = ConfigDict(frozen=True)

    connection_name: str | None
    schema_name: str
    captured_at: str
    cache_age_seconds: float
    database_context: DatabaseContextResponse
    object_counts: list[SchemaObjectCountResponse]
    tables: list[SchemaTableResponse]


class ActivityEntryResponse(BaseModel):
    """One MCP tool activity entry."""

    model_config = ConfigDict(frozen=True)

    sequence: int
    timestamp: str
    tool_name: str
    arguments: dict[str, object]
    status: Literal["succeeded", "failed"]
    message: str | None = None
    connection_name: str | None = None
    session_id: str | None = None


class ActivityResponse(BaseModel):
    """MCP tool activity response."""

    model_config = ConfigDict(frozen=True)

    entries: list[ActivityEntryResponse]
    active_session_id: str | None = None


class PrerequisiteGuideResponse(BaseModel):
    """Install guidance for a missing prerequisite."""

    model_config = ConfigDict(frozen=True)

    title: str
    summary: str
    steps: list[str]
    docs_url: str | None = None


class PreflightCheckResponse(BaseModel):
    """One project preflight check."""

    model_config = ConfigDict(frozen=True)

    id: str
    label: str
    status: Literal["ok", "warning", "missing", "failed"]
    detail: str
    guide: PrerequisiteGuideResponse | None = None


class PreflightResponse(BaseModel):
    """Project / first-launch preflight report."""

    model_config = ConfigDict(frozen=True)

    ready: bool
    blocking_ids: list[str]
    checks: list[PreflightCheckResponse]


class ProfileResponse(BaseModel):
    """Local profile payload."""

    model_config = ConfigDict(frozen=True)

    profile_id: str
    display_name: str
    email: str | None = None
    username: str | None = None
    created_at: str
    updated_at: str


class ProfilesResponse(BaseModel):
    """Local profile list."""

    model_config = ConfigDict(frozen=True)

    profiles: list[ProfileResponse]


class CreateProfileBody(BaseModel):
    """Create-profile request body."""

    model_config = ConfigDict(frozen=True)

    display_name: str
    email: str | None = None
    username: str | None = None
    force_new: bool = False


class ProjectSummaryResponse(BaseModel):
    """Registered local project summary."""

    model_config = ConfigDict(frozen=True)

    project_id: str
    profile_id: str
    name: str
    root_path: str
    retention_days: int | None
    created_at: str
    updated_at: str


class ProjectsResponse(BaseModel):
    """Recent project list."""

    model_config = ConfigDict(frozen=True)

    projects: list[ProjectSummaryResponse]


class ManifestEnvironmentBody(BaseModel):
    """Logical environment declared in a new project."""

    model_config = ConfigDict(frozen=True)

    name: str
    default_schema: str | None = None
    apex_workspace_hint: str | None = None
    apex_app_id: int | None = None


class CreateProjectBody(BaseModel):
    """Create-project request body."""

    model_config = ConfigDict(frozen=True)

    profile_id: str
    name: str
    root_path: str
    description: str | None = None
    environments: list[ManifestEnvironmentBody] = Field(
        default_factory=lambda: [
            ManifestEnvironmentBody(name="dev"),
            ManifestEnvironmentBody(name="test"),
        ]
    )
    default_environment: str | None = "dev"
    retention_days: int | None = 365
    retention_indefinite: bool = False
    init_git: bool = False
    write_readme: bool = True
    apex_workspace_hint: str | None = None
    apex_app_id: int | None = None


class ImportProjectBody(BaseModel):
    """Import or clone project request body."""

    model_config = ConfigDict(frozen=True)

    profile_id: str
    root_path: str | None = None
    remote_url: str | None = None
    clone_parent: str | None = None
    clone_directory_name: str | None = None
    retention_days: int | None = 365
    retention_indefinite: bool = False


class EnvironmentMappingBody(BaseModel):
    """Map a logical environment to a SQLcl saved connection."""

    model_config = ConfigDict(frozen=True)

    environment_name: str
    sqlcl_connection_name: str


class ApexWorkspaceMappingBody(BaseModel):
    """Optional APEX workspace mapping for a local connection."""

    model_config = ConfigDict(frozen=True)

    sqlcl_connection_name: str
    workspace_name: str


class RetentionBody(BaseModel):
    """Retention policy update body."""

    model_config = ConfigDict(frozen=True)

    retention_days: int | None = None
    retention_indefinite: bool = False


class EnvironmentMappingResponse(BaseModel):
    """Local environment mapping."""

    model_config = ConfigDict(frozen=True)

    environment_name: str
    sqlcl_connection_name: str


class ApexWorkspaceMappingResponse(BaseModel):
    """Local APEX workspace mapping."""

    model_config = ConfigDict(frozen=True)

    sqlcl_connection_name: str
    workspace_name: str


class OpenedProjectResponse(BaseModel):
    """Opened project payload."""

    model_config = ConfigDict(frozen=True)

    project: ProjectSummaryResponse
    manifest: dict[str, object]
    environment_mappings: list[EnvironmentMappingResponse]
    apex_workspace_mappings: list[ApexWorkspaceMappingResponse]
    unmapped_environments: list[str]
    preflight: PreflightResponse


@router.get("/health", response_model=HealthResponse, tags=["health"])
def health_check() -> HealthResponse:
    """Return backend health metadata."""
    return HealthResponse(
        status="ok",
        service="apex-pilot-backend",
        version=__version__,
    )


@router.get(
    "/connections",
    response_model=SavedConnectionsResponse,
    tags=["connections"],
    dependencies=[Depends(require_bearer_token)],
)
async def list_saved_connections(request: Request) -> SavedConnectionsResponse:
    """List SQLcl saved connections through MCP."""
    runtime = _runtime_from_request(request)
    try:
        connections = await runtime.list_saved_connections()
    except (SchemaIntelligenceError, SqlclConnectionError, SqlclMcpError) as error:
        raise _mcp_http_error(error) from error
    return SavedConnectionsResponse(
        connections=[
            SavedConnectionResponse(name=connection.name, display_name=connection.display_name)
            for connection in connections
        ],
    )


@router.post(
    "/connections/{connection_name}/connect",
    response_model=ConnectResponse,
    tags=["connections"],
    dependencies=[Depends(require_bearer_token)],
)
async def connect_saved_connection(connection_name: str, request: Request) -> ConnectResponse:
    """Connect the primary MCP session by SQLcl saved connection name."""
    runtime = _runtime_from_request(request)
    try:
        connected_name = await runtime.connect(connection_name)
    except (SchemaIntelligenceError, SqlclConnectionError, SqlclMcpError) as error:
        raise _mcp_http_error(error) from error
    return ConnectResponse(connection_name=connected_name)


@router.get(
    "/schema/summary",
    response_model=SchemaSummaryResponse,
    tags=["schema"],
    dependencies=[Depends(require_bearer_token)],
)
async def summarize_schema(
    request: Request,
    schema_name: str = Query(alias="schema"),
    refresh: bool = False,
) -> SchemaSummaryResponse:
    """Return a read-only schema summary for a selected Oracle schema."""
    runtime = _runtime_from_request(request)
    try:
        summary = await runtime.summarize_schema(schema_name, refresh=refresh)
    except (SchemaIntelligenceError, SqlclConnectionError, SqlclMcpError) as error:
        raise _mcp_http_error(error) from error
    return SchemaSummaryResponse.model_validate(summary.to_dict())


@router.get(
    "/activity",
    response_model=ActivityResponse,
    tags=["activity"],
    dependencies=[Depends(require_bearer_token)],
)
def list_activity(
    request: Request,
    connection: str | None = Query(default=None),
) -> ActivityResponse:
    """Return MCP tool activity, optionally filtered by saved connection name."""
    runtime = _runtime_from_request(request)
    return ActivityResponse(
        entries=[
            ActivityEntryResponse.model_validate(entry.to_dict())
            for entry in runtime.activity_entries(connection_name=connection)
        ],
        active_session_id=runtime.active_activity_session_id(),
    )


@router.get(
    "/preflight",
    response_model=PreflightResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def get_preflight(
    request: Request,
    project_root: str | None = Query(default=None),
) -> PreflightResponse:
    """Run first-launch or project-path prerequisite checks."""
    runtime = _runtime_from_request(request)
    try:
        report = runtime.projects.run_preflight(project_root)
    except (ProjectError, StorageError) as error:
        raise _project_http_error(error) from error
    return PreflightResponse.model_validate(report.to_dict())


@router.get(
    "/profiles",
    response_model=ProfilesResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def list_profiles(request: Request) -> ProfilesResponse:
    """List local profiles."""
    runtime = _runtime_from_request(request)
    profiles = runtime.projects.list_profiles()
    return ProfilesResponse(profiles=[_profile_response(profile) for profile in profiles])


@router.post(
    "/profiles",
    response_model=ProfileResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def create_profile(body: CreateProfileBody, request: Request) -> ProfileResponse:
    """Create a local profile."""
    runtime = _runtime_from_request(request)
    try:
        profile = runtime.projects.create_profile(
            ProfileCreateRequest(
                display_name=body.display_name,
                email=body.email,
                username=body.username,
            ),
            force_new=body.force_new,
        )
    except ProfileConflictError as error:
        raise HTTPException(status_code=status.HTTP_409_CONFLICT, detail=str(error)) from error
    except (ProjectError, StorageError, ValueError) as error:
        raise _project_http_error(error) from error
    return _profile_response(profile)


@router.get(
    "/projects",
    response_model=ProjectsResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def list_projects(
    request: Request,
    profile_id: str | None = Query(default=None),
    limit: int = Query(default=10, ge=1, le=50),
) -> ProjectsResponse:
    """List recently updated local projects."""
    runtime = _runtime_from_request(request)
    projects = runtime.projects.list_recent_projects(profile_id=profile_id, limit=limit)
    return ProjectsResponse(projects=[_project_summary(project) for project in projects])


@router.get(
    "/projects/current",
    response_model=OpenedProjectResponse | None,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def get_current_project(request: Request) -> OpenedProjectResponse | None:
    """Return the currently opened project for this backend process."""
    runtime = _runtime_from_request(request)
    opened = runtime.opened_project
    if opened is None:
        return None
    return _opened_project_response(opened)


@router.post(
    "/projects/close",
    status_code=status.HTTP_204_NO_CONTENT,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def close_current_project(request: Request) -> None:
    """Close the currently opened project without deleting local registration."""
    runtime = _runtime_from_request(request)
    runtime.close_project()


@router.post(
    "/projects",
    response_model=OpenedProjectResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def create_project(body: CreateProjectBody, request: Request) -> OpenedProjectResponse:
    """Create a new Apex Pilot project folder and open it."""
    runtime = _runtime_from_request(request)
    try:
        opened = runtime.projects.create_project(
            CreateProjectRequest(
                profile_id=body.profile_id,
                name=body.name,
                root_path=body.root_path,
                description=body.description,
                environments=tuple(
                    ManifestEnvironment(
                        name=env.name,
                        default_schema=env.default_schema,
                        apex_workspace_hint=env.apex_workspace_hint,
                        apex_app_id=env.apex_app_id,
                    )
                    for env in body.environments
                ),
                default_environment=body.default_environment,
                retention=_retention_from_body(body.retention_days, body.retention_indefinite),
                init_git=body.init_git,
                write_readme=body.write_readme,
                apex_workspace_hint=body.apex_workspace_hint,
                apex_app_id=body.apex_app_id,
            )
        )
    except (ProjectError, ProjectGitError, ManifestError, StorageError, ValueError) as error:
        raise _project_http_error(error) from error
    runtime.set_opened_project(opened)
    return _opened_project_response(opened)


@router.post(
    "/projects/import",
    response_model=OpenedProjectResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def import_project(body: ImportProjectBody, request: Request) -> OpenedProjectResponse:
    """Import an existing local path or clone a remote Git repository."""
    runtime = _runtime_from_request(request)
    try:
        opened = runtime.projects.import_project(
            ImportProjectRequest(
                profile_id=body.profile_id,
                root_path=body.root_path,
                remote_url=body.remote_url,
                clone_parent=body.clone_parent,
                clone_directory_name=body.clone_directory_name,
                retention=_retention_from_body(body.retention_days, body.retention_indefinite),
            )
        )
    except (ProjectError, ProjectGitError, ManifestError, StorageError, ValueError) as error:
        raise _project_http_error(error) from error
    runtime.set_opened_project(opened)
    return _opened_project_response(opened)


@router.post(
    "/projects/{project_id}/open",
    response_model=OpenedProjectResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def open_project(project_id: str, request: Request) -> OpenedProjectResponse:
    """Open a previously registered local project."""
    runtime = _runtime_from_request(request)
    try:
        opened = runtime.projects.open_project(project_id)
    except (ProjectError, ManifestError, StorageError) as error:
        raise _project_http_error(error) from error
    runtime.set_opened_project(opened)
    return _opened_project_response(opened)


@router.put(
    "/projects/{project_id}/environment-mappings",
    response_model=EnvironmentMappingResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def put_environment_mapping(
    project_id: str,
    body: EnvironmentMappingBody,
    request: Request,
) -> EnvironmentMappingResponse:
    """Map a logical environment to a local SQLcl saved connection name."""
    runtime = _runtime_from_request(request)
    try:
        mapping = runtime.projects.set_environment_mapping(
            project_id=project_id,
            environment_name=body.environment_name,
            sqlcl_connection_name=body.sqlcl_connection_name,
        )
        if runtime.opened_project and runtime.opened_project.project.project_id == project_id:
            runtime.set_opened_project(runtime.projects.open_project(project_id))
    except (ProjectError, ManifestError, StorageError) as error:
        raise _project_http_error(error) from error
    return EnvironmentMappingResponse(
        environment_name=mapping.environment_name,
        sqlcl_connection_name=mapping.sqlcl_connection_name,
    )


@router.put(
    "/projects/{project_id}/apex-workspace-mappings",
    response_model=ApexWorkspaceMappingResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def put_apex_workspace_mapping(
    project_id: str,
    body: ApexWorkspaceMappingBody,
    request: Request,
) -> ApexWorkspaceMappingResponse:
    """Store optional APEX workspace metadata for a local connection."""
    runtime = _runtime_from_request(request)
    try:
        mapping = runtime.projects.set_apex_workspace_mapping(
            project_id=project_id,
            sqlcl_connection_name=body.sqlcl_connection_name,
            workspace_name=body.workspace_name,
        )
        if runtime.opened_project and runtime.opened_project.project.project_id == project_id:
            runtime.set_opened_project(runtime.projects.open_project(project_id))
    except (ProjectError, StorageError) as error:
        raise _project_http_error(error) from error
    return ApexWorkspaceMappingResponse(
        sqlcl_connection_name=mapping.sqlcl_connection_name,
        workspace_name=mapping.workspace_name,
    )


@router.put(
    "/projects/{project_id}/retention",
    response_model=ProjectSummaryResponse,
    tags=["projects"],
    dependencies=[Depends(require_bearer_token)],
)
def put_retention(
    project_id: str,
    body: RetentionBody,
    request: Request,
) -> ProjectSummaryResponse:
    """Update chat/tool retention for a project."""
    runtime = _runtime_from_request(request)
    try:
        project = runtime.projects.set_retention(
            project_id,
            _retention_from_body(body.retention_days, body.retention_indefinite),
        )
        if runtime.opened_project and runtime.opened_project.project.project_id == project_id:
            runtime.set_opened_project(runtime.projects.open_project(project_id))
    except (ProjectError, StorageError, ValueError) as error:
        raise _project_http_error(error) from error
    return _project_summary(project)


def _runtime_from_request(request: Request) -> ApexPilotRuntime:
    runtime = getattr(request.app.state, "apex_pilot_runtime", None)
    if isinstance(runtime, ApexPilotRuntime):
        return runtime

    raise HTTPException(
        status_code=status.HTTP_503_SERVICE_UNAVAILABLE,
        detail="Apex Pilot runtime is not configured.",
    )


def _mcp_http_error(error: Exception) -> HTTPException:
    return HTTPException(
        status_code=status.HTTP_502_BAD_GATEWAY,
        detail=str(error),
    )


def _project_http_error(error: Exception) -> HTTPException:
    if isinstance(error, ProjectGitError):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    if isinstance(error, (ProjectError, ManifestError, StorageError, ValueError)):
        return HTTPException(status_code=status.HTTP_400_BAD_REQUEST, detail=str(error))
    return HTTPException(status_code=status.HTTP_500_INTERNAL_SERVER_ERROR, detail=str(error))


def _retention_from_body(retention_days: int | None, retention_indefinite: bool) -> RetentionPolicy:
    if retention_indefinite:
        return RetentionPolicy.indefinite()
    if retention_days is None:
        return RetentionPolicy.days_policy()
    return RetentionPolicy.days_policy(retention_days)


def _profile_response(profile: object) -> ProfileResponse:
    return ProfileResponse(
        profile_id=profile.profile_id,  # type: ignore[attr-defined]
        display_name=profile.display_name,  # type: ignore[attr-defined]
        email=profile.email,  # type: ignore[attr-defined]
        username=profile.username,  # type: ignore[attr-defined]
        created_at=profile.created_at.isoformat(),  # type: ignore[attr-defined]
        updated_at=profile.updated_at.isoformat(),  # type: ignore[attr-defined]
    )


def _project_summary(project: object) -> ProjectSummaryResponse:
    return ProjectSummaryResponse(
        project_id=project.project_id,  # type: ignore[attr-defined]
        profile_id=project.profile_id,  # type: ignore[attr-defined]
        name=project.name,  # type: ignore[attr-defined]
        root_path=project.root_path,  # type: ignore[attr-defined]
        retention_days=project.retention_days,  # type: ignore[attr-defined]
        created_at=project.created_at.isoformat(),  # type: ignore[attr-defined]
        updated_at=project.updated_at.isoformat(),  # type: ignore[attr-defined]
    )


def _opened_project_response(opened: object) -> OpenedProjectResponse:
    payload = opened.to_dict()  # type: ignore[attr-defined]
    return OpenedProjectResponse.model_validate(payload)
