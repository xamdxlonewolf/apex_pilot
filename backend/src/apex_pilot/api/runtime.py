"""Application runtime composition for backend routes."""

from __future__ import annotations

from apex_pilot.api.sql_sheet import SqlSheetRunResult, SqlSheetService
from apex_pilot.events import ToolActivityEntry, ToolActivityLog
from apex_pilot.mcp import (
    SqlclConnectionManager,
    SqlclMcpConfig,
    SqlclMcpSdkClient,
    SqlclMcpToolClient,
    SqlclSavedConnection,
    ToolActivityMcpClient,
)
from apex_pilot.projects import OpenedProject, ProjectService
from apex_pilot.safety import SqlSafetyClassification
from apex_pilot.schema import SchemaIntelligenceService, SchemaSummary
from apex_pilot.settings import BackendSettings, default_metadata_db_path
from apex_pilot.storage import LocalMetadataStore


class ApexPilotRuntime:
    """App-scoped façade over MCP, schema intelligence, activity, and projects."""

    def __init__(
        self,
        tool_client: SqlclMcpToolClient,
        *,
        managed_client: SqlclMcpSdkClient | None = None,
        activity_log: ToolActivityLog | None = None,
        project_service: ProjectService | None = None,
        metadata_store: LocalMetadataStore | None = None,
        sqlcl_config: SqlclMcpConfig | None = None,
        owns_metadata_store: bool = False,
    ) -> None:
        self._managed_client = managed_client
        self._activity_log = activity_log or ToolActivityLog()
        activity_client = ToolActivityMcpClient(tool_client, self._activity_log)
        self._connection_manager = SqlclConnectionManager(activity_client)
        self._schema_service = SchemaIntelligenceService(self._connection_manager.primary_session)
        self._sql_sheet = SqlSheetService(self._connection_manager.primary_session)
        self._sqlcl_config = sqlcl_config or SqlclMcpConfig()
        self._metadata_store = metadata_store
        self._owns_metadata_store = owns_metadata_store
        self._project_service = project_service
        self._opened_project: OpenedProject | None = None

    @classmethod
    def live(cls, settings: BackendSettings) -> ApexPilotRuntime:
        """Create a runtime backed by a live SQLcl MCP SDK client and local metadata."""
        sqlcl_config = SqlclMcpConfig(
            sqlcl_path=settings.sqlcl_path,
            restrict_level=settings.restrict_level,
            tns_admin=settings.tns_admin,
            java_home=settings.java_home,
        )
        client = SqlclMcpSdkClient(sqlcl_config)
        metadata_path = settings.metadata_db_path or default_metadata_db_path()
        metadata_path.parent.mkdir(parents=True, exist_ok=True)
        store = LocalMetadataStore.open(metadata_path)
        project_service = ProjectService(store, sqlcl_config=sqlcl_config)
        return cls(
            client,
            managed_client=client,
            project_service=project_service,
            metadata_store=store,
            sqlcl_config=sqlcl_config,
            owns_metadata_store=True,
        )

    async def start(self) -> None:
        """Start any owned runtime resources."""
        if self._managed_client is not None:
            await self._managed_client.start()

    async def stop(self) -> None:
        """Stop any owned runtime resources."""
        if self._managed_client is not None:
            await self._managed_client.stop()
        if self._owns_metadata_store and self._metadata_store is not None:
            self._metadata_store.close()

    @property
    def projects(self) -> ProjectService:
        """Return the project wizard service."""
        if self._project_service is None:
            raise RuntimeError("Project service is not configured.")
        return self._project_service

    @property
    def opened_project(self) -> OpenedProject | None:
        """Return the currently opened project, if any."""
        return self._opened_project

    def set_opened_project(self, opened: OpenedProject | None) -> None:
        """Remember the currently opened project in this backend process."""
        self._opened_project = opened

    def close_project(self) -> None:
        """Clear the currently opened project without deleting local registration."""
        self._opened_project = None

    async def list_saved_connections(self) -> tuple[SqlclSavedConnection, ...]:
        """List saved SQLcl connections through MCP."""
        return await self._connection_manager.list_saved_connections()

    async def connect(self, connection_name: str) -> str:
        """Connect the primary MCP session by saved connection name."""
        # Tag future activity with this connection before the MCP connect call so
        # reconnects keep prior history for the same saved connection name.
        self._activity_log.set_active_connection(connection_name)
        return await self._connection_manager.connect(connection_name)

    async def summarize_schema(self, schema_name: str, *, refresh: bool = False) -> SchemaSummary:
        """Return a schema summary through guarded MCP dictionary queries."""
        return await self._schema_service.summarize_schema(schema_name, refresh=refresh)

    def classify_sql(self, sql_text: str) -> SqlSafetyClassification:
        """Classify SQL sheet text without executing it."""
        return self._sql_sheet.classify(sql_text)

    async def run_sql_sheet(
        self,
        sql_text: str,
        *,
        confirmed: bool = False,
        skip_destructive_prompt: bool = False,
    ) -> SqlSheetRunResult:
        """Classify and execute SQL sheet text through the primary MCP session."""
        return await self._sql_sheet.run(
            sql_text,
            confirmed=confirmed,
            skip_destructive_prompt=skip_destructive_prompt,
        )

    def activity_entries(self, *, connection_name: str | None = None) -> tuple[ToolActivityEntry, ...]:
        """Return recorded MCP tool activity, optionally filtered by connection."""
        return self._activity_log.entries(connection_name=connection_name)

    def active_activity_session_id(self) -> str | None:
        """Return the active MCP activity session id."""
        return self._activity_log.active_session_id

    def sqlcl_config(self) -> SqlclMcpConfig:
        """Return the SQLcl MCP configuration used by this runtime."""
        return self._sqlcl_config
