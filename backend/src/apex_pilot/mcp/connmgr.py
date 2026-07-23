"""Parse SQLcl `CONNMGR SHOW` output for Interactive Connect autofill."""

from __future__ import annotations

import re
from collections.abc import Mapping, Sequence
from dataclasses import dataclass

from apex_pilot.mcp.connections import SqlclConnectionError, normalize_saved_connection_name
from apex_pilot.safety import SafetyDecision, SqlRequestAccess, classify_sqlcl_command

RUN_SQLCL_TOOL = "run-sqlcl"

_USERNAME_LABELS = (
    "user",
    "username",
    "user name",
)
_CONNECT_STRING_LABELS = (
    "url",
    "connect string",
    "connection url",
    "connection string",
    "connect_string",
    "connection_url",
)

_LABEL_VALUE_PATTERN = re.compile(
    r"^\s*(?P<label>[A-Za-z][A-Za-z0-9_ ]*?)\s*(?:=|:)\s*(?P<value>.+?)\s*$",
)


@dataclass(frozen=True)
class SqlclConnectionDetails:
    """Non-secret metadata from SQLcl saved-connection `CONNMGR SHOW`."""

    name: str
    username: str | None
    connect_string: str | None
    raw_text: str


def build_connmgr_show_command(connection_name: str) -> str:
    """Build a classifier-safe `CONNMGR SHOW` command for a saved name."""
    normalized = normalize_saved_connection_name(connection_name)
    if " " in normalized:
        escaped = normalized.replace('"', "")
        return f'CONNMGR SHOW "{escaped}"'
    return f"CONNMGR SHOW {normalized}"


def assert_connmgr_show_allowed(command: str) -> None:
    """Raise when `CONNMGR SHOW` is not ALLOW under safety policy."""
    classification = classify_sqlcl_command(command)
    if classification.decision is not SafetyDecision.ALLOW:
        msg = "CONNMGR SHOW is not allowed by safety policy: " + "; ".join(classification.reasons)
        raise SqlclConnectionError(msg)


def parse_connmgr_show_output(name: str, raw_text: str) -> SqlclConnectionDetails:
    """Parse username and connect string from CONNMGR SHOW text output."""
    username: str | None = None
    connect_string: str | None = None

    for line in raw_text.replace("\r\n", "\n").replace("\r", "\n").split("\n"):
        match = _LABEL_VALUE_PATTERN.match(line)
        if match is None:
            continue
        label = _normalize_label(match.group("label"))
        value = match.group("value").strip().strip("'\"")
        if not value:
            continue
        if label in _USERNAME_LABELS and username is None:
            username = value
            continue
        if label in _CONNECT_STRING_LABELS and connect_string is None:
            connect_string = value

    return SqlclConnectionDetails(
        name=normalize_saved_connection_name(name),
        username=username,
        connect_string=connect_string,
        raw_text=raw_text,
    )


def connection_details_from_mcp_payload(name: str, payload: object) -> SqlclConnectionDetails:
    """Extract CONNMGR SHOW text from an MCP tool payload and parse it."""
    raw_text = payload_text(payload) or ""
    return parse_connmgr_show_output(name, raw_text)


def payload_text(payload: object) -> str | None:
    """Extract textual content from common MCP tool payload shapes."""
    if isinstance(payload, str):
        return payload
    if isinstance(payload, Mapping):
        text = payload.get("text")
        if isinstance(text, str):
            return text
        result = payload.get("result")
        if isinstance(result, str):
            return result
        content = payload.get("content")
        if isinstance(content, Sequence) and not isinstance(content, str):
            parts: list[str] = []
            for item in content:
                if isinstance(item, Mapping):
                    item_text = item.get("text")
                    if isinstance(item_text, str):
                        parts.append(item_text)
            if parts:
                return "\n".join(parts)
    return None


def connmgr_show_access() -> SqlRequestAccess:
    """Return the access class for allowlisted CONNMGR SHOW calls."""
    return SqlRequestAccess.READ_ONLY


def _normalize_label(label: str) -> str:
    return " ".join(label.strip().casefold().split())
