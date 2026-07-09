"""SQLite schema migrations for local metadata storage."""

from __future__ import annotations

import sqlite3
from collections.abc import Sequence
from dataclasses import dataclass
from datetime import UTC, datetime


@dataclass(frozen=True)
class Migration:
    """One numbered SQLite schema migration."""

    version: int
    name: str
    statements: Sequence[str]


MIGRATIONS: tuple[Migration, ...] = (
    Migration(
        version=1,
        name="initial_local_metadata",
        statements=(
            """
            CREATE TABLE app_meta (
                key TEXT PRIMARY KEY,
                value TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE profiles (
                profile_id TEXT PRIMARY KEY,
                display_name TEXT NOT NULL,
                email TEXT,
                username TEXT,
                identity_hash TEXT NOT NULL,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (identity_hash, display_name)
            )
            """,
            """
            CREATE INDEX idx_profiles_identity_hash
            ON profiles (identity_hash)
            """,
            """
            CREATE TABLE projects (
                project_id TEXT PRIMARY KEY,
                profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
                name TEXT NOT NULL,
                root_path TEXT NOT NULL,
                retention_days INTEGER,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL,
                UNIQUE (profile_id, root_path)
            )
            """,
            """
            CREATE TABLE environment_mappings (
                project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
                environment_name TEXT NOT NULL,
                sqlcl_connection_name TEXT NOT NULL,
                PRIMARY KEY (project_id, environment_name)
            )
            """,
            """
            CREATE TABLE apex_workspace_mappings (
                project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
                sqlcl_connection_name TEXT NOT NULL,
                workspace_name TEXT NOT NULL,
                PRIMARY KEY (project_id, sqlcl_connection_name)
            )
            """,
            """
            CREATE TABLE chat_threads (
                thread_id TEXT PRIMARY KEY,
                project_id TEXT NOT NULL REFERENCES projects(project_id) ON DELETE CASCADE,
                profile_id TEXT NOT NULL REFERENCES profiles(profile_id),
                title TEXT,
                created_at TEXT NOT NULL,
                updated_at TEXT NOT NULL
            )
            """,
            """
            CREATE TABLE chat_messages (
                message_id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
                role TEXT NOT NULL,
                content TEXT NOT NULL,
                sql_text TEXT,
                sql_classification_json TEXT,
                approval_metadata_json TEXT,
                model_profile TEXT,
                created_at TEXT NOT NULL,
                CHECK (role IN ('user', 'assistant', 'system', 'tool'))
            )
            """,
            """
            CREATE INDEX idx_chat_messages_thread_created
            ON chat_messages (thread_id, created_at DESC)
            """,
            """
            CREATE TABLE tool_activity (
                activity_id TEXT PRIMARY KEY,
                thread_id TEXT NOT NULL REFERENCES chat_threads(thread_id) ON DELETE CASCADE,
                message_id TEXT REFERENCES chat_messages(message_id) ON DELETE SET NULL,
                tool_name TEXT NOT NULL,
                arguments_json TEXT NOT NULL,
                status TEXT NOT NULL,
                message TEXT,
                created_at TEXT NOT NULL,
                CHECK (status IN ('succeeded', 'failed'))
            )
            """,
            """
            CREATE INDEX idx_tool_activity_thread_created
            ON tool_activity (thread_id, created_at DESC)
            """,
            """
            CREATE VIRTUAL TABLE memory_fts USING fts5(
                content,
                sql_text,
                tool_name,
                source_type UNINDEXED,
                source_id UNINDEXED,
                project_id UNINDEXED,
                thread_id UNINDEXED,
                created_at UNINDEXED
            )
            """,
        ),
    ),
)


def ensure_migrations_table(connection: sqlite3.Connection) -> None:
    """Create the schema_migrations bookkeeping table when missing."""
    connection.execute(
        """
        CREATE TABLE IF NOT EXISTS schema_migrations (
            version INTEGER PRIMARY KEY,
            name TEXT NOT NULL,
            applied_at TEXT NOT NULL
        )
        """
    )


def current_schema_version(connection: sqlite3.Connection) -> int:
    """Return the highest applied migration version, or 0 when none exist."""
    ensure_migrations_table(connection)
    version_row = connection.execute("SELECT COALESCE(MAX(version), 0) FROM schema_migrations").fetchone()
    return int(version_row[0]) if version_row else 0


def apply_migrations(connection: sqlite3.Connection) -> int:
    """Apply pending migrations and return the resulting schema version."""
    ensure_migrations_table(connection)
    applied = current_schema_version(connection)
    for migration in MIGRATIONS:
        if migration.version <= applied:
            continue
        connection.execute("BEGIN")
        try:
            for statement in migration.statements:
                connection.execute(statement)
            connection.execute(
                """
                INSERT INTO schema_migrations (version, name, applied_at)
                VALUES (?, ?, ?)
                """,
                (migration.version, migration.name, _utc_now_iso()),
            )
            connection.execute("COMMIT")
        except Exception:
            connection.execute("ROLLBACK")
            raise
        applied = migration.version
    return applied


def _utc_now_iso() -> str:
    return datetime.now(UTC).isoformat()
