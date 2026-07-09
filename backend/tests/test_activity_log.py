"""Tests for connection-tagged MCP activity retention."""

from datetime import UTC, datetime, timedelta

from apex_pilot.events import ToolActivityLog


def test_activity_log_retains_entries_across_reconnect_with_new_session() -> None:
    """Reconnecting keeps prior activity and opens a new session bucket."""
    log = ToolActivityLog()
    first_session = log.set_active_connection("dev")
    log.record(tool_name="connect", arguments={"name": "dev"}, status="succeeded")
    log.record(tool_name="run-sql", arguments={"sql": "select 1 from dual"}, status="succeeded")

    second_session = log.set_active_connection("dev")
    log.record(tool_name="connect", arguments={"name": "dev"}, status="succeeded")

    entries = log.entries(connection_name="dev")
    assert [entry.tool_name for entry in entries] == ["connect", "run-sql", "connect"]
    assert all(entry.connection_name == "dev" for entry in entries)
    assert first_session != second_session
    assert [entry.session_id for entry in entries] == [first_session, first_session, second_session]
    assert log.active_session_id == second_session


def test_activity_log_filters_by_connection_and_prunes_old_entries() -> None:
    """Activity can be filtered by connection and drops entries older than retention."""
    log = ToolActivityLog(retention=timedelta(days=14))
    log.set_active_connection("dev")
    first = log.record(tool_name="connect", arguments={"name": "dev"}, status="succeeded")
    log.set_active_connection("prod")
    log.record(tool_name="connect", arguments={"name": "prod"}, status="succeeded")

    assert [entry.connection_name for entry in log.entries(connection_name="dev")] == ["dev"]
    assert [entry.connection_name for entry in log.entries(connection_name="prod")] == ["prod"]

    log._entries[0] = type(first)(
        sequence=first.sequence,
        timestamp=datetime.now(UTC) - timedelta(days=15),
        tool_name=first.tool_name,
        arguments=dict(first.arguments),
        status=first.status,
        message=first.message,
        connection_name=first.connection_name,
        session_id=first.session_id,
    )
    remaining = log.entries()
    assert [entry.connection_name for entry in remaining] == ["prod"]
