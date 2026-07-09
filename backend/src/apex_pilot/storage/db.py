"""Local SQLite metadata store for Apex Pilot projects and chat memory."""

from __future__ import annotations

import json
import sqlite3
import uuid
from collections.abc import Mapping
from datetime import UTC, datetime
from pathlib import Path
from typing import Any

from apex_pilot.storage.capabilities import SqliteCapabilities, require_sqlite_capabilities
from apex_pilot.storage.errors import ProfileConflictError, RetentionError, StorageError
from apex_pilot.storage.migrations import apply_migrations, current_schema_version
from apex_pilot.storage.models import (
    ApexWorkspaceMapping,
    ChatMessage,
    ChatRole,
    ChatThread,
    EnvironmentMapping,
    LocalProfile,
    LocalProject,
    MemorySearchHit,
    ToolActivityRecord,
    ToolActivityStatus,
)
from apex_pilot.storage.profiles import ProfileCreateRequest, build_profile, compute_identity_hash
from apex_pilot.storage.retention import RetentionPolicy, chat_window_bounds
from apex_pilot.storage.vector import NullVectorMemoryAdapter, VectorMemoryAdapter

_RESULT_ROW_KEYS = frozenset(
    {
        "result_rows",
        "resultRows",
        "rows",
        "sql_result_rows",
        "sqlResultRows",
    }
)


class LocalMetadataStore:
    """SQLite-backed local metadata store.

    This store persists profiles, projects, environment mappings, chat metadata,
    and tool activity. It intentionally does not persist SQL result rows.
    """

    def __init__(
        self,
        path: Path | str,
        *,
        vector_adapter: VectorMemoryAdapter | None = None,
    ) -> None:
        self.path = Path(path)
        self._vector_adapter = vector_adapter or NullVectorMemoryAdapter()
        self._connection = self._open_connection(self.path)
        self.capabilities: SqliteCapabilities = require_sqlite_capabilities(self._connection)
        self.schema_version = apply_migrations(self._connection)

    @classmethod
    def open(
        cls,
        path: Path | str,
        *,
        vector_adapter: VectorMemoryAdapter | None = None,
    ) -> LocalMetadataStore:
        """Open or create a local metadata database."""
        return cls(path, vector_adapter=vector_adapter)

    def close(self) -> None:
        """Close the underlying SQLite connection."""
        self._connection.close()

    def __enter__(self) -> LocalMetadataStore:
        return self

    def __exit__(self, *_exc: object) -> None:
        self.close()

    @property
    def vector_adapter(self) -> VectorMemoryAdapter:
        """Return the optional vector-memory adapter."""
        return self._vector_adapter

    def create_profile(self, request: ProfileCreateRequest, *, force_new: bool = False) -> LocalProfile:
        """Create a local profile, detecting duplicate email/username identities."""
        identity_hash = compute_identity_hash(email=request.email, username=request.username)
        existing = self.find_profiles_for_identity(email=request.email, username=request.username)
        if existing and not force_new:
            raise ProfileConflictError(
                "A local profile with the same email and username already exists. "
                "Reuse the existing profile or create a separate profile with a different display name."
            )
        if existing and force_new:
            display_name = request.display_name.strip()
            if any(profile.display_name == display_name for profile in existing):
                raise ProfileConflictError(
                    "Creating a separate profile for the same identity requires a different display name."
                )

        profile = build_profile(request)
        try:
            self._connection.execute(
                """
                INSERT INTO profiles (
                    profile_id, display_name, email, username, identity_hash, created_at, updated_at
                ) VALUES (?, ?, ?, ?, ?, ?, ?)
                """,
                (
                    profile.profile_id,
                    profile.display_name,
                    profile.email,
                    profile.username,
                    identity_hash,
                    _to_iso(profile.created_at),
                    _to_iso(profile.updated_at),
                ),
            )
        except sqlite3.IntegrityError as exc:
            raise ProfileConflictError(
                "A local profile with the same identity and display name already exists."
            ) from exc
        self._connection.commit()
        stored = self.get_profile(profile.profile_id)
        assert stored is not None
        return stored

    def get_profile(self, profile_id: str) -> LocalProfile | None:
        """Return a profile by id."""
        row = self._connection.execute(
            """
            SELECT profile_id, display_name, email, username, identity_hash, created_at, updated_at
            FROM profiles
            WHERE profile_id = ?
            """,
            (profile_id,),
        ).fetchone()
        return _profile_from_row(row) if row else None

    def find_profiles_for_identity(self, *, email: str | None, username: str | None) -> tuple[LocalProfile, ...]:
        """Find profiles that match the same email and username identity."""
        identity_hash = compute_identity_hash(email=email, username=username)
        rows = self._connection.execute(
            """
            SELECT profile_id, display_name, email, username, identity_hash, created_at, updated_at
            FROM profiles
            WHERE identity_hash = ?
            ORDER BY created_at ASC
            """,
            (identity_hash,),
        ).fetchall()
        return tuple(_profile_from_row(row) for row in rows)

    def register_project(
        self,
        *,
        profile_id: str,
        name: str,
        root_path: Path | str,
        retention: RetentionPolicy | None = None,
    ) -> LocalProject:
        """Register a local project path for a profile."""
        if self.get_profile(profile_id) is None:
            raise StorageError(f"Unknown profile_id {profile_id!r}")
        policy = retention or RetentionPolicy.days_policy()
        now = datetime.now(UTC)
        project = LocalProject(
            project_id=str(uuid.uuid4()),
            profile_id=profile_id,
            name=name.strip(),
            root_path=str(Path(root_path).resolve()),
            retention_days=policy.to_days(),
            created_at=now,
            updated_at=now,
        )
        self._connection.execute(
            """
            INSERT INTO projects (
                project_id, profile_id, name, root_path, retention_days, created_at, updated_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?)
            """,
            (
                project.project_id,
                project.profile_id,
                project.name,
                project.root_path,
                project.retention_days,
                _to_iso(project.created_at),
                _to_iso(project.updated_at),
            ),
        )
        self._connection.commit()
        return project

    def get_project(self, project_id: str) -> LocalProject | None:
        """Return a registered project by id."""
        row = self._connection.execute(
            """
            SELECT project_id, profile_id, name, root_path, retention_days, created_at, updated_at
            FROM projects
            WHERE project_id = ?
            """,
            (project_id,),
        ).fetchone()
        return _project_from_row(row) if row else None

    def list_profiles(self) -> tuple[LocalProfile, ...]:
        """Return all local profiles ordered by display name."""
        rows = self._connection.execute(
            """
            SELECT profile_id, display_name, email, username, identity_hash, created_at, updated_at
            FROM profiles
            ORDER BY display_name COLLATE NOCASE ASC, created_at ASC
            """,
        ).fetchall()
        return tuple(_profile_from_row(row) for row in rows)

    def list_projects(self, *, profile_id: str | None = None, limit: int | None = None) -> tuple[LocalProject, ...]:
        """Return registered projects, newest first, optionally filtered by profile."""
        query = """
            SELECT project_id, profile_id, name, root_path, retention_days, created_at, updated_at
            FROM projects
        """
        params: list[object] = []
        if profile_id is not None:
            query += " WHERE profile_id = ?"
            params.append(profile_id)
        query += " ORDER BY updated_at DESC, created_at DESC"
        if limit is not None:
            if limit <= 0:
                raise StorageError("limit must be a positive integer")
            query += " LIMIT ?"
            params.append(limit)
        rows = self._connection.execute(query, params).fetchall()
        return tuple(_project_from_row(row) for row in rows)

    def find_project_by_root(self, root_path: Path | str) -> LocalProject | None:
        """Return a project registered at the resolved root path, if any."""
        resolved = str(Path(root_path).resolve())
        row = self._connection.execute(
            """
            SELECT project_id, profile_id, name, root_path, retention_days, created_at, updated_at
            FROM projects
            WHERE root_path = ?
            """,
            (resolved,),
        ).fetchone()
        return _project_from_row(row) if row else None

    def touch_project(self, project_id: str) -> LocalProject:
        """Bump updated_at so the project rises in recent lists."""
        project = self.get_project(project_id)
        if project is None:
            raise StorageError(f"Unknown project_id {project_id!r}")
        now = datetime.now(UTC)
        self._connection.execute(
            """
            UPDATE projects
            SET updated_at = ?
            WHERE project_id = ?
            """,
            (_to_iso(now), project_id),
        )
        self._connection.commit()
        updated = self.get_project(project_id)
        assert updated is not None
        return updated

    def set_project_retention(self, project_id: str, retention: RetentionPolicy) -> LocalProject:
        """Update the retention policy for a project."""
        project = self.get_project(project_id)
        if project is None:
            raise StorageError(f"Unknown project_id {project_id!r}")
        now = datetime.now(UTC)
        self._connection.execute(
            """
            UPDATE projects
            SET retention_days = ?, updated_at = ?
            WHERE project_id = ?
            """,
            (retention.to_days(), _to_iso(now), project_id),
        )
        self._connection.commit()
        updated = self.get_project(project_id)
        assert updated is not None
        return updated

    def set_environment_mapping(
        self,
        *,
        project_id: str,
        environment_name: str,
        sqlcl_connection_name: str,
    ) -> EnvironmentMapping:
        """Map a logical environment to a local SQLcl saved connection name."""
        if self.get_project(project_id) is None:
            raise StorageError(f"Unknown project_id {project_id!r}")
        mapping = EnvironmentMapping(
            project_id=project_id,
            environment_name=environment_name.strip(),
            sqlcl_connection_name=sqlcl_connection_name.strip(),
        )
        if not mapping.environment_name or not mapping.sqlcl_connection_name:
            raise StorageError("environment_name and sqlcl_connection_name are required")
        self._connection.execute(
            """
            INSERT INTO environment_mappings (project_id, environment_name, sqlcl_connection_name)
            VALUES (?, ?, ?)
            ON CONFLICT(project_id, environment_name) DO UPDATE SET
                sqlcl_connection_name = excluded.sqlcl_connection_name
            """,
            (mapping.project_id, mapping.environment_name, mapping.sqlcl_connection_name),
        )
        self._connection.commit()
        return mapping

    def list_environment_mappings(self, project_id: str) -> tuple[EnvironmentMapping, ...]:
        """List local environment mappings for a project."""
        rows = self._connection.execute(
            """
            SELECT project_id, environment_name, sqlcl_connection_name
            FROM environment_mappings
            WHERE project_id = ?
            ORDER BY environment_name
            """,
            (project_id,),
        ).fetchall()
        return tuple(
            EnvironmentMapping(
                project_id=row["project_id"],
                environment_name=row["environment_name"],
                sqlcl_connection_name=row["sqlcl_connection_name"],
            )
            for row in rows
        )

    def list_apex_workspace_mappings(self, project_id: str) -> tuple[ApexWorkspaceMapping, ...]:
        """List local APEX workspace mappings for a project."""
        rows = self._connection.execute(
            """
            SELECT project_id, sqlcl_connection_name, workspace_name
            FROM apex_workspace_mappings
            WHERE project_id = ?
            ORDER BY sqlcl_connection_name
            """,
            (project_id,),
        ).fetchall()
        return tuple(
            ApexWorkspaceMapping(
                project_id=row["project_id"],
                sqlcl_connection_name=row["sqlcl_connection_name"],
                workspace_name=row["workspace_name"],
            )
            for row in rows
        )

    def set_apex_workspace_mapping(
        self,
        *,
        project_id: str,
        sqlcl_connection_name: str,
        workspace_name: str,
    ) -> ApexWorkspaceMapping:
        """Map a local SQLcl connection to an APEX workspace name."""
        if self.get_project(project_id) is None:
            raise StorageError(f"Unknown project_id {project_id!r}")
        mapping = ApexWorkspaceMapping(
            project_id=project_id,
            sqlcl_connection_name=sqlcl_connection_name.strip(),
            workspace_name=workspace_name.strip(),
        )
        if not mapping.sqlcl_connection_name or not mapping.workspace_name:
            raise StorageError("sqlcl_connection_name and workspace_name are required")
        self._connection.execute(
            """
            INSERT INTO apex_workspace_mappings (project_id, sqlcl_connection_name, workspace_name)
            VALUES (?, ?, ?)
            ON CONFLICT(project_id, sqlcl_connection_name) DO UPDATE SET
                workspace_name = excluded.workspace_name
            """,
            (mapping.project_id, mapping.sqlcl_connection_name, mapping.workspace_name),
        )
        self._connection.commit()
        return mapping

    def create_chat_thread(
        self,
        *,
        project_id: str,
        profile_id: str,
        title: str | None = None,
    ) -> ChatThread:
        """Create a chat thread for a project and profile."""
        if self.get_project(project_id) is None:
            raise StorageError(f"Unknown project_id {project_id!r}")
        if self.get_profile(profile_id) is None:
            raise StorageError(f"Unknown profile_id {profile_id!r}")
        now = datetime.now(UTC)
        thread = ChatThread(
            thread_id=str(uuid.uuid4()),
            project_id=project_id,
            profile_id=profile_id,
            title=title,
            created_at=now,
            updated_at=now,
        )
        self._connection.execute(
            """
            INSERT INTO chat_threads (thread_id, project_id, profile_id, title, created_at, updated_at)
            VALUES (?, ?, ?, ?, ?, ?)
            """,
            (
                thread.thread_id,
                thread.project_id,
                thread.profile_id,
                thread.title,
                _to_iso(thread.created_at),
                _to_iso(thread.updated_at),
            ),
        )
        self._connection.commit()
        return thread

    def add_chat_message(
        self,
        *,
        thread_id: str,
        role: ChatRole,
        content: str,
        sql_text: str | None = None,
        sql_classification: Mapping[str, Any] | None = None,
        approval_metadata: Mapping[str, Any] | None = None,
        model_profile: str | None = None,
        created_at: datetime | None = None,
    ) -> ChatMessage:
        """Persist a chat message without SQL result rows."""
        thread = self._require_thread(thread_id)
        timestamp = created_at or datetime.now(UTC)
        message = ChatMessage(
            message_id=str(uuid.uuid4()),
            thread_id=thread_id,
            role=role,
            content=content,
            sql_text=sql_text,
            sql_classification_json=_dump_metadata_json(sql_classification),
            approval_metadata_json=_dump_metadata_json(approval_metadata),
            model_profile=model_profile,
            created_at=timestamp,
        )
        self._connection.execute(
            """
            INSERT INTO chat_messages (
                message_id, thread_id, role, content, sql_text,
                sql_classification_json, approval_metadata_json, model_profile, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                message.message_id,
                message.thread_id,
                message.role,
                message.content,
                message.sql_text,
                message.sql_classification_json,
                message.approval_metadata_json,
                message.model_profile,
                _to_iso(message.created_at),
            ),
        )
        self._connection.execute(
            """
            UPDATE chat_threads
            SET updated_at = ?
            WHERE thread_id = ?
            """,
            (_to_iso(timestamp), thread_id),
        )
        self._index_memory(
            source_type="chat_message",
            source_id=message.message_id,
            project_id=thread.project_id,
            thread_id=thread_id,
            content=message.content,
            sql_text=message.sql_text,
            tool_name=None,
            created_at=message.created_at,
        )
        self._connection.commit()
        self._vector_adapter.index_text(
            project_id=thread.project_id,
            thread_id=thread_id,
            source_type="chat_message",
            source_id=message.message_id,
            content=message.content,
        )
        return message

    def add_tool_activity(
        self,
        *,
        thread_id: str,
        tool_name: str,
        arguments: Mapping[str, Any],
        status: ToolActivityStatus,
        message: str | None = None,
        message_id: str | None = None,
        created_at: datetime | None = None,
    ) -> ToolActivityRecord:
        """Persist tool activity metadata without SQL result rows."""
        thread = self._require_thread(thread_id)
        timestamp = created_at or datetime.now(UTC)
        sanitized_arguments = _strip_result_rows(dict(arguments))
        record = ToolActivityRecord(
            activity_id=str(uuid.uuid4()),
            thread_id=thread_id,
            message_id=message_id,
            tool_name=tool_name,
            arguments_json=json.dumps(sanitized_arguments, sort_keys=True),
            status=status,
            message=message,
            created_at=timestamp,
        )
        self._connection.execute(
            """
            INSERT INTO tool_activity (
                activity_id, thread_id, message_id, tool_name, arguments_json, status, message, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                record.activity_id,
                record.thread_id,
                record.message_id,
                record.tool_name,
                record.arguments_json,
                record.status,
                record.message,
                _to_iso(record.created_at),
            ),
        )
        self._index_memory(
            source_type="tool_activity",
            source_id=record.activity_id,
            project_id=thread.project_id,
            thread_id=thread_id,
            content=record.message or "",
            sql_text=None,
            tool_name=record.tool_name,
            created_at=record.created_at,
        )
        self._connection.commit()
        return record

    def latest_message_at(self, thread_id: str) -> datetime | None:
        """Return the latest message timestamp for a thread."""
        row = self._connection.execute(
            """
            SELECT created_at
            FROM chat_messages
            WHERE thread_id = ?
            ORDER BY created_at DESC
            LIMIT 1
            """,
            (thread_id,),
        ).fetchone()
        return _parse_datetime(row["created_at"]) if row else None

    def list_chat_messages_window(
        self,
        thread_id: str,
        *,
        windows_back: int = 0,
    ) -> tuple[ChatMessage, ...]:
        """List chat messages in a latest-relative 2-week window, oldest-first."""
        latest = self.latest_message_at(thread_id)
        if latest is None:
            return ()
        start, end = chat_window_bounds(latest_message_at=latest, windows_back=windows_back)
        rows = self._connection.execute(
            """
            SELECT message_id, thread_id, role, content, sql_text,
                   sql_classification_json, approval_metadata_json, model_profile, created_at
            FROM chat_messages
            WHERE thread_id = ?
              AND created_at > ?
              AND created_at <= ?
            ORDER BY created_at ASC
            """,
            (thread_id, _to_iso(start), _to_iso(end)),
        ).fetchall()
        return tuple(_message_from_row(row) for row in rows)

    def search_memory(
        self,
        *,
        project_id: str,
        query: str,
        limit: int = 20,
    ) -> tuple[MemorySearchHit, ...]:
        """Search project memory with FTS5 keyword matching."""
        cleaned = query.strip()
        if not cleaned:
            return ()
        rows = self._connection.execute(
            """
            SELECT source_type, source_id, project_id, thread_id, created_at,
                   snippet(memory_fts, 0, '[', ']', '…', 12) AS snippet,
                   bm25(memory_fts) AS rank
            FROM memory_fts
            WHERE memory_fts MATCH ?
              AND project_id = ?
            ORDER BY rank
            LIMIT ?
            """,
            (cleaned, project_id, limit),
        ).fetchall()
        return tuple(
            MemorySearchHit(
                source_type=row["source_type"],
                source_id=row["source_id"],
                project_id=row["project_id"],
                thread_id=row["thread_id"],
                snippet=row["snippet"],
                created_at=_parse_datetime(row["created_at"]),
                rank=float(row["rank"]),
            )
            for row in rows
        )

    def apply_retention(self, project_id: str, *, now: datetime | None = None) -> int:
        """Delete chat/tool rows older than the project retention policy.

        Retention is an explicit maintenance action. It does not run on reads.
        """
        project = self.get_project(project_id)
        if project is None:
            raise RetentionError(f"Unknown project_id {project_id!r}")
        policy = RetentionPolicy.from_days(project.retention_days)
        cutoff = policy.cutoff(now=now)
        if cutoff is None:
            return 0

        thread_ids = [
            row["thread_id"]
            for row in self._connection.execute(
                "SELECT thread_id FROM chat_threads WHERE project_id = ?",
                (project_id,),
            ).fetchall()
        ]
        if not thread_ids:
            return 0

        placeholders = ",".join("?" for _ in thread_ids)
        cutoff_iso = _to_iso(cutoff)
        message_ids = [
            row["message_id"]
            for row in self._connection.execute(
                f"""
                SELECT message_id
                FROM chat_messages
                WHERE thread_id IN ({placeholders})
                  AND created_at < ?
                """,
                (*thread_ids, cutoff_iso),
            ).fetchall()
        ]
        activity_ids = [
            row["activity_id"]
            for row in self._connection.execute(
                f"""
                SELECT activity_id
                FROM tool_activity
                WHERE thread_id IN ({placeholders})
                  AND created_at < ?
                """,
                (*thread_ids, cutoff_iso),
            ).fetchall()
        ]

        deleted = 0
        if message_ids:
            msg_placeholders = ",".join("?" for _ in message_ids)
            self._connection.execute(
                f"DELETE FROM memory_fts WHERE source_type = 'chat_message' AND source_id IN ({msg_placeholders})",
                tuple(message_ids),
            )
            cursor = self._connection.execute(
                f"DELETE FROM chat_messages WHERE message_id IN ({msg_placeholders})",
                tuple(message_ids),
            )
            deleted += cursor.rowcount
        if activity_ids:
            act_placeholders = ",".join("?" for _ in activity_ids)
            self._connection.execute(
                f"DELETE FROM memory_fts WHERE source_type = 'tool_activity' AND source_id IN ({act_placeholders})",
                tuple(activity_ids),
            )
            cursor = self._connection.execute(
                f"DELETE FROM tool_activity WHERE activity_id IN ({act_placeholders})",
                tuple(activity_ids),
            )
            deleted += cursor.rowcount
        self._connection.commit()
        return deleted

    def count_chat_messages(self, thread_id: str) -> int:
        """Return the number of persisted chat messages in a thread."""
        row = self._connection.execute(
            "SELECT COUNT(*) AS count FROM chat_messages WHERE thread_id = ?",
            (thread_id,),
        ).fetchone()
        return int(row["count"]) if row else 0

    def raw_table_columns(self, table_name: str) -> tuple[str, ...]:
        """Return column names for a table. Intended for tests."""
        rows = self._connection.execute(f"PRAGMA table_info({table_name})").fetchall()
        return tuple(row["name"] for row in rows)

    def schema_version_value(self) -> int:
        """Return the applied schema version."""
        return current_schema_version(self._connection)

    def _require_thread(self, thread_id: str) -> ChatThread:
        row = self._connection.execute(
            """
            SELECT thread_id, project_id, profile_id, title, created_at, updated_at
            FROM chat_threads
            WHERE thread_id = ?
            """,
            (thread_id,),
        ).fetchone()
        if row is None:
            raise StorageError(f"Unknown thread_id {thread_id!r}")
        return ChatThread(
            thread_id=row["thread_id"],
            project_id=row["project_id"],
            profile_id=row["profile_id"],
            title=row["title"],
            created_at=_parse_datetime(row["created_at"]),
            updated_at=_parse_datetime(row["updated_at"]),
        )

    def _index_memory(
        self,
        *,
        source_type: str,
        source_id: str,
        project_id: str,
        thread_id: str,
        content: str,
        sql_text: str | None,
        tool_name: str | None,
        created_at: datetime,
    ) -> None:
        self._connection.execute(
            """
            INSERT INTO memory_fts (
                content, sql_text, tool_name, source_type, source_id, project_id, thread_id, created_at
            ) VALUES (?, ?, ?, ?, ?, ?, ?, ?)
            """,
            (
                content,
                sql_text or "",
                tool_name or "",
                source_type,
                source_id,
                project_id,
                thread_id,
                _to_iso(created_at),
            ),
        )

    @staticmethod
    def _open_connection(path: Path) -> sqlite3.Connection:
        path.parent.mkdir(parents=True, exist_ok=True)
        # FastAPI may run sync route handlers in a worker thread pool, so the
        # long-lived metadata connection must allow cross-thread use.
        connection = sqlite3.connect(path, check_same_thread=False)
        connection.row_factory = sqlite3.Row
        connection.execute("PRAGMA foreign_keys = ON")
        return connection


def _dump_metadata_json(payload: Mapping[str, Any] | None) -> str | None:
    if payload is None:
        return None
    sanitized = _strip_result_rows(dict(payload))
    return json.dumps(sanitized, sort_keys=True)


def _strip_result_rows(value: Any) -> Any:
    if isinstance(value, Mapping):
        return {key: _strip_result_rows(item) for key, item in value.items() if key not in _RESULT_ROW_KEYS}
    if isinstance(value, list):
        return [_strip_result_rows(item) for item in value]
    return value


def _to_iso(value: datetime) -> str:
    if value.tzinfo is None:
        value = value.replace(tzinfo=UTC)
    return value.astimezone(UTC).isoformat()


def _parse_datetime(value: str) -> datetime:
    parsed = datetime.fromisoformat(value)
    if parsed.tzinfo is None:
        return parsed.replace(tzinfo=UTC)
    return parsed.astimezone(UTC)


def _profile_from_row(row: sqlite3.Row) -> LocalProfile:
    return LocalProfile(
        profile_id=row["profile_id"],
        display_name=row["display_name"],
        email=row["email"],
        username=row["username"],
        identity_hash=row["identity_hash"],
        created_at=_parse_datetime(row["created_at"]),
        updated_at=_parse_datetime(row["updated_at"]),
    )


def _project_from_row(row: sqlite3.Row) -> LocalProject:
    return LocalProject(
        project_id=row["project_id"],
        profile_id=row["profile_id"],
        name=row["name"],
        root_path=row["root_path"],
        retention_days=row["retention_days"],
        created_at=_parse_datetime(row["created_at"]),
        updated_at=_parse_datetime(row["updated_at"]),
    )


def _message_from_row(row: sqlite3.Row) -> ChatMessage:
    return ChatMessage(
        message_id=row["message_id"],
        thread_id=row["thread_id"],
        role=row["role"],
        content=row["content"],
        sql_text=row["sql_text"],
        sql_classification_json=row["sql_classification_json"],
        approval_metadata_json=row["approval_metadata_json"],
        model_profile=row["model_profile"],
        created_at=_parse_datetime(row["created_at"]),
    )
