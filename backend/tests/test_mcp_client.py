"""Tests for SQLcl MCP SDK client compatibility helpers."""

from apex_pilot.mcp.client import _payload_from_result, _translate_tool_call


def test_live_sqlcl_tool_names_are_translated_from_logical_contract() -> None:
    """The app contract stays stable across SQLcl MCP tool-name variants."""
    tool_name, arguments = _translate_tool_call("list-connections", {})

    assert tool_name == "connections_list"
    assert arguments["definition_type"] == "ALL"

    tool_name, arguments = _translate_tool_call("connect", {"name": "dev"})

    assert tool_name == "connect"
    assert arguments["connection_name"] == "dev"


def test_sql_run_binds_are_inlined_for_current_sqlcl_schema() -> None:
    """Current SQLcl `sql_run` accepts SQL text but not a separate binds object."""
    tool_name, arguments = _translate_tool_call(
        "run-sql",
        {
            "sql": "select * from all_objects where owner = :schema_name",
            "binds": {"schema_name": "APP"},
        },
    )

    assert tool_name == "sql_run"
    assert arguments["sql"] == "select * from all_objects where owner = 'APP'"


def test_connections_list_text_payload_is_parsed_as_connection_names() -> None:
    """Current SQLcl returns saved connections as text content."""
    payload = _payload_from_result(
        "connections_list",
        {
            "content": [
                {
                    "type": "text",
                    "text": "dev\nprod\n",
                },
            ],
        },
    )

    assert payload == ["dev", "prod"]


def test_sql_run_csv_text_payload_is_parsed_as_rows() -> None:
    """Current SQLcl returns `sql_run` rows as CSV text content."""
    payload = _payload_from_result(
        "sql_run",
        {
            "content": [
                {
                    "type": "text",
                    "text": '"CURRENT_USER","DB_NAME"\r\n"ADMIN","FREE"\r\n',
                },
            ],
        },
    )

    assert payload == [{"CURRENT_USER": "ADMIN", "DB_NAME": "FREE"}]
