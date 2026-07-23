"""Tests for SQLcl CONNMGR SHOW parsing and describe wiring helpers."""

from apex_pilot.mcp.connmgr import (
    build_connmgr_show_command,
    connection_details_from_mcp_payload,
    parse_connmgr_show_output,
)
from apex_pilot.safety import SafetyDecision, classify_sqlcl_command


_SAMPLE_URL_STYLE = """
Name: MyConnection
User: HR
URL: localhost:1521/FREEPDB1
"""

_SAMPLE_CONNECT_STRING_STYLE = """
Connection: MyConnection
Username: SCOTT
Connect String: (DESCRIPTION=(ADDRESS=(PROTOCOL=TCP)(HOST=db.example.com)(PORT=1521))(CONNECT_DATA=(SERVICE_NAME=ORCL)))
Password: should-not-be-parsed
"""

_SAMPLE_EQUALS_STYLE = """
user = APP
connection string = db.example.com:1521/service
"""


def test_parse_connmgr_show_user_and_url() -> None:
    details = parse_connmgr_show_output("MyConnection", _SAMPLE_URL_STYLE)

    assert details.name == "MyConnection"
    assert details.username == "HR"
    assert details.connect_string == "localhost:1521/FREEPDB1"
    assert "HR" in details.raw_text


def test_parse_connmgr_show_connect_string_and_ignores_password() -> None:
    details = parse_connmgr_show_output("MyConnection", _SAMPLE_CONNECT_STRING_STYLE)

    assert details.username == "SCOTT"
    assert details.connect_string is not None
    assert "DESCRIPTION" in details.connect_string
    assert details.connect_string is not None
    assert "should-not-be-parsed" not in (details.username or "")
    assert details.connect_string != "should-not-be-parsed"


def test_parse_connmgr_show_equals_labels() -> None:
    details = parse_connmgr_show_output("dev", _SAMPLE_EQUALS_STYLE)

    assert details.username == "APP"
    assert details.connect_string == "db.example.com:1521/service"


def test_connection_details_from_mcp_content_payload() -> None:
    payload = {
        "content": [{"type": "text", "text": _SAMPLE_URL_STYLE}],
    }
    details = connection_details_from_mcp_payload("MyConnection", payload)

    assert details.username == "HR"
    assert details.connect_string == "localhost:1521/FREEPDB1"


def test_build_connmgr_show_command_is_allowlisted() -> None:
    command = build_connmgr_show_command("  MyConnection  ")

    assert command == "CONNMGR SHOW MyConnection"
    assert classify_sqlcl_command(command).decision is SafetyDecision.ALLOW
