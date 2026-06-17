"""HTTP routes for the local backend."""

from typing import Literal

from fastapi import APIRouter, Depends, HTTPException, Query, Request, status
from pydantic import BaseModel, ConfigDict

from apex_pilot import __version__
from apex_pilot.api.auth import require_bearer_token
from apex_pilot.api.runtime import ApexPilotRuntime
from apex_pilot.mcp import SqlclConnectionError, SqlclMcpError
from apex_pilot.schema import SchemaIntelligenceError

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


class ActivityResponse(BaseModel):
    """MCP tool activity response."""

    model_config = ConfigDict(frozen=True)

    entries: list[ActivityEntryResponse]


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
def list_activity(request: Request) -> ActivityResponse:
    """Return MCP tool activity for the current local backend session."""
    runtime = _runtime_from_request(request)
    return ActivityResponse(
        entries=[ActivityEntryResponse.model_validate(entry.to_dict()) for entry in runtime.activity_entries()],
    )


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
