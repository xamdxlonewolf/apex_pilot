"""Tests for local project storage and apex-pilot.json manifests."""

from __future__ import annotations

import json
import sqlite3
from collections.abc import Iterator
from datetime import UTC, datetime, timedelta
from pathlib import Path

import pytest

from apex_pilot.storage import (
    DEFAULT_RETENTION_DAYS,
    MANIFEST_FILENAME,
    LocalMetadataStore,
    ManifestError,
    NullVectorMemoryAdapter,
    ProfileConflictError,
    ProfileCreateRequest,
    ProjectManifest,
    RetentionPolicy,
    StorageCapabilityError,
    assert_no_saved_connection_names,
    chat_window_bounds,
    compute_identity_hash,
    load_project_manifest,
    parse_project_manifest,
    probe_sqlite_capabilities,
    require_sqlite_capabilities,
    write_project_manifest,
)
from apex_pilot.storage.manifest import ManifestEnvironment


@pytest.fixture
def store(tmp_path: Path) -> Iterator[LocalMetadataStore]:
    db_path = tmp_path / "apex-pilot-metadata.sqlite3"
    with LocalMetadataStore.open(db_path) as opened:
        yield opened


def test_migrations_create_expected_tables(store: LocalMetadataStore) -> None:
    """Opening a store applies the initial schema migration."""
    assert store.schema_version == 1
    assert store.schema_version_value() == 1
    assert "profile_id" in store.raw_table_columns("profiles")
    assert "retention_days" in store.raw_table_columns("projects")
    assert store.capabilities.json_supported is True
    assert store.capabilities.fts5_supported is True


def test_require_capabilities_fails_when_json_missing(monkeypatch: pytest.MonkeyPatch) -> None:
    """Capability checks fail clearly when JSON support is unavailable."""
    connection = sqlite3.connect(":memory:")

    def fake_probe(_connection: sqlite3.Connection):
        from apex_pilot.storage.capabilities import SqliteCapabilities

        return SqliteCapabilities(json_supported=False, fts5_supported=True, sqlite_version="3.0.0")

    monkeypatch.setattr("apex_pilot.storage.capabilities.probe_sqlite_capabilities", fake_probe)
    with pytest.raises(StorageCapabilityError, match="JSON"):
        require_sqlite_capabilities(connection)


def test_manifest_round_trip_rejects_saved_connection_fields(tmp_path: Path) -> None:
    """Committed manifests store logical environments, not SQLcl connection names."""
    manifest = ProjectManifest(
        schema_version=1,
        name="demo",
        description="Demo project",
        environments=(
            ManifestEnvironment(
                name="dev",
                default_schema="APP",
                apex_workspace_hint="DEMO",
                apex_app_id=100,
            ),
            ManifestEnvironment(name="test"),
        ),
        default_environment="dev",
    )
    path = tmp_path / MANIFEST_FILENAME
    write_project_manifest(path, manifest)

    loaded = load_project_manifest(path)
    assert loaded.name == "demo"
    assert loaded.environment_names() == frozenset({"dev", "test"})
    assert_no_saved_connection_names(loaded)

    with pytest.raises(ManifestError, match="saved connection"):
        parse_project_manifest(
            {
                "schemaVersion": 1,
                "name": "bad",
                "environments": [{"name": "dev", "sqlcl_connection_name": "local_dev"}],
            }
        )


def test_manifest_parse_requires_unique_environments() -> None:
    """Manifest environments must be unique and defaultEnvironment must exist."""
    with pytest.raises(ManifestError, match="unique"):
        parse_project_manifest(
            {
                "schemaVersion": 1,
                "name": "demo",
                "environments": [{"name": "dev"}, {"name": "dev"}],
            }
        )

    with pytest.raises(ManifestError, match="defaultEnvironment"):
        parse_project_manifest(
            {
                "schemaVersion": 1,
                "name": "demo",
                "defaultEnvironment": "prod",
                "environments": [{"name": "dev"}],
            }
        )


def test_profile_duplicate_detection(store: LocalMetadataStore) -> None:
    """Duplicate email/username identities are detected and can force a distinct profile."""
    first = store.create_profile(ProfileCreateRequest(display_name="Mike", email="mike@example.com", username="mike"))
    assert first.identity_hash == compute_identity_hash(email="mike@example.com", username="mike")

    with pytest.raises(ProfileConflictError, match="already exists"):
        store.create_profile(ProfileCreateRequest(display_name="Mike", email="mike@example.com", username="mike"))

    second = store.create_profile(
        ProfileCreateRequest(display_name="Mike Work", email="mike@example.com", username="mike"),
        force_new=True,
    )
    matches = store.find_profiles_for_identity(email="mike@example.com", username="mike")
    assert {profile.profile_id for profile in matches} == {first.profile_id, second.profile_id}


def test_environment_mappings_stay_local(store: LocalMetadataStore, tmp_path: Path) -> None:
    """Logical environments map to SQLcl saved connections only in local SQLite."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Mike"))
    project = store.register_project(
        profile_id=profile.profile_id,
        name="demo",
        root_path=tmp_path / "demo",
    )
    mapping = store.set_environment_mapping(
        project_id=project.project_id,
        environment_name="dev",
        sqlcl_connection_name="mcobb_test_oracle_db",
    )
    assert mapping.sqlcl_connection_name == "mcobb_test_oracle_db"
    assert store.list_environment_mappings(project.project_id) == (mapping,)


def test_chat_window_and_retention(store: LocalMetadataStore, tmp_path: Path) -> None:
    """Chat windows are latest-relative and retention prunes only on explicit maintenance."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Mike"))
    project = store.register_project(
        profile_id=profile.profile_id,
        name="demo",
        root_path=tmp_path / "demo",
        retention=RetentionPolicy.days_policy(30),
    )
    assert project.retention_days == 30
    assert DEFAULT_RETENTION_DAYS == 365

    thread = store.create_chat_thread(project_id=project.project_id, profile_id=profile.profile_id)
    latest = datetime(2026, 7, 9, 12, 0, tzinfo=UTC)
    store.add_chat_message(
        thread_id=thread.thread_id,
        role="user",
        content="old message",
        created_at=latest - timedelta(days=20),
    )
    store.add_chat_message(
        thread_id=thread.thread_id,
        role="assistant",
        content="recent message about employees",
        created_at=latest,
    )

    recent = store.list_chat_messages_window(thread.thread_id, windows_back=0)
    assert [message.content for message in recent] == ["recent message about employees"]

    older = store.list_chat_messages_window(thread.thread_id, windows_back=1)
    assert [message.content for message in older] == ["old message"]

    start, end = chat_window_bounds(latest_message_at=latest, windows_back=0)
    assert end == latest
    assert start == latest - timedelta(days=14)

    assert store.count_chat_messages(thread.thread_id) == 2
    deleted = store.apply_retention(project.project_id, now=latest)
    assert deleted == 0
    assert store.count_chat_messages(thread.thread_id) == 2

    deleted = store.apply_retention(project.project_id, now=latest + timedelta(days=40))
    assert deleted == 2
    assert store.count_chat_messages(thread.thread_id) == 0


def test_fts_search_indexes_chat_and_tool_activity(store: LocalMetadataStore, tmp_path: Path) -> None:
    """FTS5 indexes chat content and tool names for project memory search."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Mike"))
    project = store.register_project(
        profile_id=profile.profile_id,
        name="demo",
        root_path=tmp_path / "demo",
    )
    thread = store.create_chat_thread(project_id=project.project_id, profile_id=profile.profile_id)
    store.add_chat_message(
        thread_id=thread.thread_id,
        role="user",
        content="Please summarize the EMPLOYEES table",
        sql_text="SELECT * FROM employees",
    )
    store.add_tool_activity(
        thread_id=thread.thread_id,
        tool_name="schema_information",
        arguments={"schema": "APP"},
        status="succeeded",
        message="schema summary ready",
    )

    hits = store.search_memory(project_id=project.project_id, query="employees")
    assert hits
    assert any(hit.source_type == "chat_message" for hit in hits)

    tool_hits = store.search_memory(project_id=project.project_id, query="schema_information")
    assert tool_hits
    assert tool_hits[0].source_type == "tool_activity"


def test_sql_result_rows_are_not_persisted(store: LocalMetadataStore, tmp_path: Path) -> None:
    """SQL result row payloads are stripped before persistence."""
    profile = store.create_profile(ProfileCreateRequest(display_name="Mike"))
    project = store.register_project(
        profile_id=profile.profile_id,
        name="demo",
        root_path=tmp_path / "demo",
    )
    thread = store.create_chat_thread(project_id=project.project_id, profile_id=profile.profile_id)
    message = store.add_chat_message(
        thread_id=thread.thread_id,
        role="assistant",
        content="query complete",
        sql_text="SELECT 1 FROM dual",
        sql_classification={
            "decision": "allow",
            "result_rows": [{"ID": 1}],
            "rows": [{"ID": 1}],
        },
        approval_metadata={"approval_id": "a1", "resultRows": [{"ID": 1}]},
    )
    activity = store.add_tool_activity(
        thread_id=thread.thread_id,
        tool_name="sql_run",
        arguments={
            "sql": "SELECT 1 FROM dual",
            "result_rows": [{"ID": 1}],
            "nested": {"sqlResultRows": [{"ID": 1}], "ok": True},
        },
        status="succeeded",
    )

    assert message.sql_classification_json is not None
    classification = json.loads(message.sql_classification_json)
    assert "result_rows" not in classification
    assert "rows" not in classification
    assert classification["decision"] == "allow"

    assert message.approval_metadata_json is not None
    approval = json.loads(message.approval_metadata_json)
    assert "resultRows" not in approval
    assert approval["approval_id"] == "a1"

    arguments = json.loads(activity.arguments_json)
    assert "result_rows" not in arguments
    assert "sqlResultRows" not in arguments["nested"]
    assert arguments["nested"]["ok"] is True
    assert "result_rows" not in store.raw_table_columns("chat_messages")


def test_null_vector_adapter_is_available(store: LocalMetadataStore) -> None:
    """Phase 1 exposes a no-op vector adapter boundary without requiring a backend."""
    assert isinstance(store.vector_adapter, NullVectorMemoryAdapter)
    assert store.vector_adapter.search(project_id="p", query="hello") == ()


def test_probe_capabilities_on_memory_db() -> None:
    """Capability probing works against an in-memory SQLite connection."""
    connection = sqlite3.connect(":memory:")
    capabilities = probe_sqlite_capabilities(connection)
    assert capabilities.ready is True
