"""Application runtime composition for backend routes."""

from __future__ import annotations

import asyncio
from collections.abc import Awaitable, Callable
from typing import TypeVar

from apex_pilot.api.sql_sheet import SqlSheetRunResult, SqlSheetService
from apex_pilot.events import ToolActivityEntry, ToolActivityLog
from apex_pilot.interactive import (
    InteractiveDriverBinding,
    InteractiveOraclePool,
    InteractivePoolStatus,
    OraclePoolDriver,
)
from apex_pilot.mcp import (
    SqlclConnectionManager,
    SqlclMcpConfig,
    SqlclMcpError,
    SqlclMcpSdkClient,
    SqlclMcpToolClient,
    SqlclSavedConnection,
    ToolActivityMcpClient,
)
from apex_pilot.projects import OpenedProject, ProjectService
from apex_pilot.safety import SqlSafetyClassification
from apex_pilot.schema import (
    DatabaseContext,
    SchemaIntelligenceService,
    SchemaSummary,
    normalize_dictionary_identifier,
    suggested_schema_from_context,
)
from apex_pilot.settings import BackendSettings, default_metadata_db_path
from apex_pilot.storage import LocalMetadataStore

_T = TypeVar("_T")

_MCP_SESSION_DEAD_MARKERS = (
    "connection closed",
    "broken pipe",
    "closedresourceerror",
)


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
        interactive_pool: InteractiveOraclePool | None = None,
        interactive_driver: OraclePoolDriver | None = None,
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
        self._mcp_lock = asyncio.Lock()
        self._interactive_pool = interactive_pool or InteractiveOraclePool(driver=interactive_driver)

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
        self._interactive_pool.close()
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
        self._interactive_pool.close()
        self._opened_project = None

    def opened_connection_name(self) -> str | None:
        """Return the active primary MCP connection name, if any."""
        return self._connection_manager.primary_session.connection_name

    @property
    def interactive_pool(self) -> InteractiveOraclePool:
        """Return the app-owned interactive Oracle pool (never expose to agents/skills)."""
        return self._interactive_pool

    def interactive_status(self) -> InteractivePoolStatus:
        """Return interactive driver binding status for Context Bar / status bar."""
        return self._interactive_pool.status()

    def open_interactive_pool(
        self,
        binding: InteractiveDriverBinding,
        *,
        password: str,
    ) -> InteractivePoolStatus:
        """Open or keep the interactive pool for the selected Connection Profile."""
        self._interactive_pool.open(binding, password=password)
        return self._interactive_pool.status()

    def disconnect_interactive_pool(self) -> InteractivePoolStatus:
        """Explicitly disconnect the interactive pool and clear session credentials."""
        self._interactive_pool.close()
        return self._interactive_pool.status()

    async def list_saved_connections(self) -> tuple[SqlclSavedConnection, ...]:
        """List saved SQLcl connections through MCP."""
        return await self._with_mcp_recovery(self._connection_manager.list_saved_connections)

    async def connect(self, connection_name: str) -> str:
        """Connect the primary MCP session by saved connection name."""
        # Tag future activity with this connection before the MCP connect call so
        # reconnects keep prior history for the same saved connection name.
        self._activity_log.set_active_connection(connection_name)
        async with self._mcp_lock:
            return await self._with_mcp_recovery(
                lambda: self._connection_manager.connect(connection_name),
            )

    async def summarize_schema(self, schema_name: str, *, refresh: bool = False) -> SchemaSummary:
        """Return a schema summary through guarded MCP dictionary queries."""
        return await self._schema_service.summarize_schema(schema_name, refresh=refresh)

    async def fetch_database_context(self) -> DatabaseContext:
        """Return live Oracle session context for the connected MCP session."""
        return await self._schema_service.fetch_database_context()

    async def set_current_schema(self, schema_name: str) -> str:
        """Set CURRENT_SCHEMA on the primary MCP session."""
        return await self._schema_service.set_current_schema(schema_name)

    def suggested_schema(self, context: DatabaseContext) -> str | None:
        """Derive the preferred working schema from session context."""
        return suggested_schema_from_context(context)

    def classify_sql(self, sql_text: str) -> SqlSafetyClassification:
        """Classify SQL sheet text without executing it."""
        return self._sql_sheet.classify(sql_text)

    async def run_sql_sheet(
        self,
        sql_text: str,
        *,
        schema_name: str | None = None,
        confirmed: bool = False,
        skip_destructive_prompt: bool = False,
    ) -> SqlSheetRunResult:
        """Classify and execute SQL sheet text through the primary MCP session."""
        active_schema: str | None = None
        executable_sql = sql_text
        if schema_name:
            # Qualify unqualified objects with the working schema. SQLcl MCP
            # sql_run often executes only the first statement, so ALTER SESSION
            # prefixes are unreliable for DDL.
            active_schema = normalize_dictionary_identifier(schema_name)
            executable_sql = self._schema_service.sql_with_current_schema(
                active_schema,
                sql_text,
            )
        result = await self._sql_sheet.run(
            executable_sql,
            confirmed=confirmed,
            skip_destructive_prompt=skip_destructive_prompt,
            classify_sql_text=sql_text,
        )
        if active_schema is None:
            return result
        return SqlSheetRunResult(
            classification=result.classification,
            connection_name=result.connection_name,
            rows=result.rows,
            raw_text=result.raw_text,
            executed=result.executed,
            schema_name=active_schema,
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

    async def _with_mcp_recovery(self, operation: Callable[[], Awaitable[_T]]) -> _T:
        """Run an MCP operation once, restarting a dead managed client on transport failure."""
        try:
            return await operation()
        except SqlclMcpError as error:
            if self._managed_client is None or not _looks_like_dead_mcp_session(error):
                raise
            await self._managed_client.stop()
            await self._managed_client.start()
            return await operation()


def _looks_like_dead_mcp_session(error: Exception) -> bool:
    message = str(error).casefold()
    return any(marker in message for marker in _MCP_SESSION_DEAD_MARKERS)
