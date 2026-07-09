"""Domain models for local metadata storage."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import datetime
from typing import Literal

ChatRole = Literal["user", "assistant", "system", "tool"]
ToolActivityStatus = Literal["succeeded", "failed"]
MemorySourceType = Literal["chat_message", "tool_activity"]


@dataclass(frozen=True)
class LocalProfile:
    """A local Apex Pilot user profile."""

    profile_id: str
    display_name: str
    email: str | None
    username: str | None
    identity_hash: str
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class LocalProject:
    """A locally registered Apex Pilot project."""

    project_id: str
    profile_id: str
    name: str
    root_path: str
    retention_days: int | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class EnvironmentMapping:
    """Maps a portable logical environment to a local SQLcl connection."""

    project_id: str
    environment_name: str
    sqlcl_connection_name: str


@dataclass(frozen=True)
class ApexWorkspaceMapping:
    """Maps a local SQLcl connection to an APEX workspace name."""

    project_id: str
    sqlcl_connection_name: str
    workspace_name: str


@dataclass(frozen=True)
class ChatThread:
    """A chat thread scoped to a project and profile."""

    thread_id: str
    project_id: str
    profile_id: str
    title: str | None
    created_at: datetime
    updated_at: datetime


@dataclass(frozen=True)
class ChatMessage:
    """One persisted chat message without SQL result rows."""

    message_id: str
    thread_id: str
    role: ChatRole
    content: str
    sql_text: str | None
    sql_classification_json: str | None
    approval_metadata_json: str | None
    model_profile: str | None
    created_at: datetime


@dataclass(frozen=True)
class ToolActivityRecord:
    """Persisted MCP/tool activity metadata."""

    activity_id: str
    thread_id: str
    message_id: str | None
    tool_name: str
    arguments_json: str
    status: ToolActivityStatus
    message: str | None
    created_at: datetime


@dataclass(frozen=True)
class MemorySearchHit:
    """One FTS5 memory search hit."""

    source_type: MemorySourceType
    source_id: str
    project_id: str
    thread_id: str
    snippet: str
    created_at: datetime
    rank: float
