"""Application runtime composition for PR 8 backend routes."""

from __future__ import annotations

from apex_pilot.events import ToolActivityEntry, ToolActivityLog
from apex_pilot.mcp import (
    SqlclConnectionManager,
    SqlclMcpConfig,
    SqlclMcpSdkClient,
    SqlclMcpToolClient,
    SqlclSavedConnection,
    ToolActivityMcpClient,
)
from apex_pilot.schema import SchemaIntelligenceService, SchemaSummary
from apex_pilot.settings import BackendSettings


class ApexPilotRuntime:
    """App-scoped façade over MCP connections, schema intelligence, and activity."""

    def __init__(
        self,
        tool_client: SqlclMcpToolClient,
        *,
        managed_client: SqlclMcpSdkClient | None = None,
        activity_log: ToolActivityLog | None = None,
    ) -> None:
        self._managed_client = managed_client
        self._activity_log = activity_log or ToolActivityLog()
        activity_client = ToolActivityMcpClient(tool_client, self._activity_log)
        self._connection_manager = SqlclConnectionManager(activity_client)
        self._schema_service = SchemaIntelligenceService(self._connection_manager.primary_session)

    @classmethod
    def live(cls, settings: BackendSettings) -> ApexPilotRuntime:
        """Create a runtime backed by a live SQLcl MCP SDK client."""
        client = SqlclMcpSdkClient(
            SqlclMcpConfig(
                sqlcl_path=settings.sqlcl_path,
                restrict_level=settings.restrict_level,
                tns_admin=settings.tns_admin,
                java_home=settings.java_home,
            ),
        )
        return cls(client, managed_client=client)

    async def start(self) -> None:
        """Start any owned runtime resources."""
        if self._managed_client is not None:
            await self._managed_client.start()

    async def stop(self) -> None:
        """Stop any owned runtime resources."""
        if self._managed_client is not None:
            await self._managed_client.stop()

    async def list_saved_connections(self) -> tuple[SqlclSavedConnection, ...]:
        """List saved SQLcl connections through MCP."""
        return await self._connection_manager.list_saved_connections()

    async def connect(self, connection_name: str) -> str:
        """Connect the primary MCP session by saved connection name."""
        return await self._connection_manager.connect(connection_name)

    async def summarize_schema(self, schema_name: str, *, refresh: bool = False) -> SchemaSummary:
        """Return a schema summary through guarded MCP dictionary queries."""
        return await self._schema_service.summarize_schema(schema_name, refresh=refresh)

    def activity_entries(self) -> tuple[ToolActivityEntry, ...]:
        """Return recorded MCP tool activity."""
        return self._activity_log.entries()
