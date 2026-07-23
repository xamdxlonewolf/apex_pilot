"""Application runtime composition for backend routes."""

from __future__ import annotations

import asyncio
import time
from collections.abc import Awaitable, Callable
from typing import TypeVar

from apex_pilot.api.sql_sheet import SqlSheetRunResult, SqlSheetService
from apex_pilot.events import ToolActivityEntry, ToolActivityLog
from apex_pilot.interactive import (
    DedicatedSessionPin,
    InteractiveBrowseService,
    InteractiveDriverBinding,
    InteractiveOraclePool,
    InteractivePoolState,
    InteractivePoolStatus,
    InteractiveSessionService,
    OraclePoolDriver,
)
from apex_pilot.interactive.source import (
    CompareResult,
    CompileRequest,
    CompileResult,
    DatabaseSourceService,
    FetchedSourceDocument,
    OracleUnitType,
    ParseSuccess,
    SourceFingerprint,
)
from apex_pilot.mcp import (
    RUN_SQLCL_TOOL,
    SqlclConnectionDetails,
    SqlclConnectionManager,
    SqlclMcpConfig,
    SqlclMcpError,
    SqlclMcpSdkClient,
    SqlclMcpToolClient,
    SqlclSavedConnection,
    ToolActivityMcpClient,
    build_connmgr_show_command,
    connection_details_from_mcp_payload,
)
from apex_pilot.mcp.connmgr import assert_connmgr_show_allowed, connmgr_show_access
from apex_pilot.mcp.connections import normalize_saved_connection_name
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

# Distinct from interactive pool idle: stop SQLcl process 5 minutes after the
# final MCP database session disconnects (ADR-0008).
SQLCL_MCP_IDLE_STOP_SECONDS = 5 * 60


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
        clock: Callable[[], float] | None = None,
        mcp_idle_stop_seconds: int = SQLCL_MCP_IDLE_STOP_SECONDS,
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
        self._interactive_browse = InteractiveBrowseService(self._interactive_pool)
        self._interactive_sessions = InteractiveSessionService(self._interactive_pool)
        self._database_source = DatabaseSourceService(self._interactive_pool)
        self._clock = clock or time.monotonic
        self._mcp_idle_stop_seconds = max(1, int(mcp_idle_stop_seconds))
        self._mcp_idle_since: float | None = None
        self._mcp_process_stopped_for_idle = False

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
            self._mcp_process_stopped_for_idle = False

    async def stop(self) -> None:
        """Stop any owned runtime resources."""
        self._interactive_browse.clear_cache()
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
        self._interactive_browse.clear_cache()
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
        """Return interactive driver binding status after applying idle policy."""
        return self._interactive_pool.evaluate_idle_policy()

    def interactive_browse_available(self) -> bool:
        """True when Database Drawer / session-context should use borrow leases."""
        return self._interactive_pool.status().state is InteractivePoolState.CONNECTED

    def open_interactive_pool(
        self,
        binding: InteractiveDriverBinding,
        *,
        password: str,
        working_schema: str | None = None,
        wallet_password: str | None = None,
    ) -> InteractivePoolStatus:
        """Open or keep the interactive pool for the selected Connection Profile."""
        prior = self._interactive_pool.status()
        if prior.profile_id and prior.profile_id != binding.profile_id:
            self._interactive_browse.clear_cache()
        if working_schema is not None:
            self._interactive_pool.set_working_schema(working_schema)
        self._interactive_pool.open(
            binding,
            password=password,
            wallet_password=wallet_password,
        )
        return self._interactive_pool.status()

    def reconnect_interactive_pool(self) -> InteractivePoolStatus:
        """Lazy reconnect using the retained session-only password."""
        return self._interactive_pool.reconnect()

    def touch_interactive_activity(self) -> InteractivePoolStatus:
        """Reset the interactive idle clock (Keep connected)."""
        return self._interactive_pool.touch_activity()

    def dismiss_interactive_idle_prompt(self) -> InteractivePoolStatus:
        """Cancel reconnect UX — Unconnected until manual reconnect."""
        return self._interactive_pool.dismiss_idle_prompt()

    def set_interactive_working_schema(self, schema_name: str | None) -> InteractivePoolStatus:
        """Persist Working Schema for interactive reconnect verification."""
        self._interactive_pool.set_working_schema(schema_name)
        return self._interactive_pool.status()

    def disconnect_interactive_pool(self) -> InteractivePoolStatus:
        """Explicitly disconnect the interactive pool and clear session credentials."""
        self._interactive_browse.clear_cache()
        self._interactive_pool.close()
        return self._interactive_pool.status()

    def mcp_process_status(self) -> str:
        """Honest SQLcl MCP process state (independent of Connection Profile)."""
        if self._managed_client is None:
            return "unmanaged"
        if self._mcp_process_stopped_for_idle:
            return "stopped"
        if getattr(self._managed_client, "is_running", False):
            return "running"
        return "stopped"

    def acquire_dedicated_session(self, document_id: str) -> DedicatedSessionPin:
        """Pin a dedicated interactive session for one SQL/PLSQL editor document."""
        return self._interactive_sessions.acquire(document_id)

    def release_dedicated_session(self, document_id: str) -> DedicatedSessionPin | None:
        """Release a dedicated editor pin on tab close/detach (idempotent)."""
        return self._interactive_sessions.release(document_id)

    def clear_interactive_browse_cache(self) -> None:
        """Invalidate browse caches (Refresh / Working Schema change)."""
        self._interactive_browse.clear_cache()

    def parse_database_source(
        self,
        source_text: str,
        *,
        expected_owner: str | None = None,
        expected_name: str | None = None,
        expected_unit_types: tuple[OracleUnitType, ...] | None = None,
    ) -> ParseSuccess:
        """Parse a Database Source Document without database access."""
        return self._database_source.parse(
            source_text,
            expected_owner=expected_owner,
            expected_name=expected_name,
            expected_unit_types=expected_unit_types,
        )

    def fetch_database_source(
        self,
        *,
        owner: str,
        name: str,
        unit_type: OracleUnitType,
        combined: bool = False,
        working_schema: str | None = None,
    ) -> FetchedSourceDocument:
        """Fetch editable CREATE OR REPLACE source through an isolated lease."""
        return self._database_source.fetch(
            owner=owner,
            name=name,
            unit_type=unit_type,
            combined=combined,
            working_schema=working_schema,
        )

    def compare_database_source(
        self,
        source_text: str,
        *,
        owner: str,
        name: str,
        unit_types: tuple[OracleUnitType, ...] | None = None,
    ) -> CompareResult:
        """Compare local buffer source with current database stored source."""
        return self._database_source.compare(
            source_text,
            owner=owner,
            name=name,
            unit_types=unit_types,
        )

    def compile_database_source(self, request: CompileRequest) -> CompileResult:
        """Compile on a short-lived isolated lease; never uses dedicated editor pins."""
        return self._database_source.compile(request)

    def reconcile_database_source(
        self,
        *,
        owner: str,
        name: str,
        unit_types: tuple[OracleUnitType, ...],
    ) -> tuple[SourceFingerprint, ...]:
        """Re-read fingerprints/status after an unknown DDL outcome."""
        return self._database_source.reconcile(
            owner=owner,
            name=name,
            unit_types=unit_types,
        )

    async def list_saved_connections(self) -> tuple[SqlclSavedConnection, ...]:
        """List saved SQLcl connections through MCP."""
        return await self._with_mcp_recovery(self._connection_manager.list_saved_connections)

    async def describe_saved_connection(self, connection_name: str) -> SqlclConnectionDetails:
        """Return username/DSN metadata from local SQLcl `CONNMGR SHOW` (no password)."""
        normalized = normalize_saved_connection_name(connection_name)
        command = build_connmgr_show_command(normalized)
        assert_connmgr_show_allowed(command)

        async def _describe() -> SqlclConnectionDetails:
            payload = await self._connection_manager.primary_session.call_tool(
                RUN_SQLCL_TOOL,
                {"command": command},
                access=connmgr_show_access(),
            )
            return connection_details_from_mcp_payload(normalized, payload)

        return await self._with_mcp_recovery(_describe)

    async def connect(self, connection_name: str) -> str:
        """Connect the primary MCP session by saved connection name."""
        self._activity_log.set_active_connection(connection_name)
        async with self._mcp_lock:
            connected = await self._with_mcp_recovery(
                lambda: self._connection_manager.connect(connection_name),
            )
            self._mcp_idle_since = None
            return connected

    async def disconnect_mcp_sessions(self) -> None:
        """Disconnect MCP database sessions; start the process-idle clock."""
        async with self._mcp_lock:
            await self._with_mcp_recovery(self._connection_manager.disconnect)
            if not self._connection_manager.has_connected_session():
                self._mcp_idle_since = self._clock()

    async def evaluate_mcp_idle_stop(self) -> str:
        """Stop the SQLcl MCP process 5 minutes after the final session disconnect."""
        if self._managed_client is None:
            return self.mcp_process_status()
        if self._connection_manager.has_connected_session():
            self._mcp_idle_since = None
            return self.mcp_process_status()
        if self._mcp_idle_since is None:
            return self.mcp_process_status()
        if self._clock() - self._mcp_idle_since < self._mcp_idle_stop_seconds:
            return self.mcp_process_status()
        if getattr(self._managed_client, "is_running", True):
            await self._managed_client.stop()
        self._mcp_process_stopped_for_idle = True
        self._mcp_idle_since = None
        return self.mcp_process_status()

    async def summarize_schema(self, schema_name: str, *, refresh: bool = False) -> SchemaSummary:
        """Return a schema summary via interactive borrow when connected, else MCP."""
        if self.interactive_browse_available():
            if refresh:
                self._interactive_browse.clear_cache()
            return await asyncio.to_thread(
                self._interactive_browse.summarize_schema,
                schema_name,
                refresh=refresh,
            )
        return await self._schema_service.summarize_schema(schema_name, refresh=refresh)

    async def fetch_database_context(self) -> DatabaseContext:
        """Return session context via interactive borrow when connected, else MCP."""
        if self.interactive_browse_available():
            return await asyncio.to_thread(self._interactive_browse.fetch_database_context)
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

    async def _ensure_mcp_started(self) -> None:
        if self._managed_client is None:
            return
        if self._mcp_process_stopped_for_idle:
            await self._managed_client.start()
            self._mcp_process_stopped_for_idle = False
            return
        # Production SDK client exposes is_running. Test doubles without the
        # attribute are assumed already available (do not break MCP connect).
        is_running = getattr(self._managed_client, "is_running", None)
        if is_running is False:
            await self._managed_client.start()
            self._mcp_process_stopped_for_idle = False

    async def _with_mcp_recovery(self, operation: Callable[[], Awaitable[_T]]) -> _T:
        """Run an MCP operation once, restarting a dead/stopped managed client on demand."""
        await self.evaluate_mcp_idle_stop()
        await self._ensure_mcp_started()
        try:
            return await operation()
        except SqlclMcpError as error:
            if self._managed_client is None or not _looks_like_dead_mcp_session(error):
                raise
            await self._managed_client.stop()
            await self._managed_client.start()
            self._mcp_process_stopped_for_idle = False
            return await operation()


def _looks_like_dead_mcp_session(error: Exception) -> bool:
    message = str(error).casefold()
    return any(marker in message for marker in _MCP_SESSION_DEAD_MARKERS)
