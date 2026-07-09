"""Local metadata storage layer."""

from apex_pilot.storage.capabilities import (
    SqliteCapabilities,
    probe_sqlite_capabilities,
    require_sqlite_capabilities,
)
from apex_pilot.storage.db import LocalMetadataStore
from apex_pilot.storage.errors import (
    ManifestError,
    ProfileConflictError,
    RetentionError,
    StorageCapabilityError,
    StorageError,
)
from apex_pilot.storage.manifest import (
    MANIFEST_FILENAME,
    MANIFEST_SCHEMA_VERSION,
    ManifestEnvironment,
    ProjectManifest,
    assert_no_saved_connection_names,
    load_project_manifest,
    manifest_path_for,
    parse_project_manifest,
    write_project_manifest,
)
from apex_pilot.storage.migrations import MIGRATIONS, apply_migrations, current_schema_version
from apex_pilot.storage.models import (
    ApexWorkspaceMapping,
    ChatMessage,
    ChatThread,
    EnvironmentMapping,
    LocalProfile,
    LocalProject,
    MemorySearchHit,
    ToolActivityRecord,
)
from apex_pilot.storage.profiles import (
    ProfileCreateRequest,
    compute_identity_hash,
    new_profile_id,
)
from apex_pilot.storage.retention import (
    CHAT_DISPLAY_WINDOW,
    DEFAULT_RETENTION_DAYS,
    RetentionPolicy,
    chat_window_bounds,
)
from apex_pilot.storage.vector import NullVectorMemoryAdapter, VectorMemoryAdapter

__all__ = [
    "CHAT_DISPLAY_WINDOW",
    "DEFAULT_RETENTION_DAYS",
    "MANIFEST_FILENAME",
    "MANIFEST_SCHEMA_VERSION",
    "MIGRATIONS",
    "ApexWorkspaceMapping",
    "ChatMessage",
    "ChatThread",
    "EnvironmentMapping",
    "LocalMetadataStore",
    "LocalProfile",
    "LocalProject",
    "ManifestEnvironment",
    "ManifestError",
    "MemorySearchHit",
    "NullVectorMemoryAdapter",
    "ProfileConflictError",
    "ProfileCreateRequest",
    "ProjectManifest",
    "RetentionError",
    "RetentionPolicy",
    "SqliteCapabilities",
    "StorageCapabilityError",
    "StorageError",
    "ToolActivityRecord",
    "VectorMemoryAdapter",
    "apply_migrations",
    "assert_no_saved_connection_names",
    "chat_window_bounds",
    "compute_identity_hash",
    "current_schema_version",
    "load_project_manifest",
    "manifest_path_for",
    "new_profile_id",
    "parse_project_manifest",
    "probe_sqlite_capabilities",
    "require_sqlite_capabilities",
    "write_project_manifest",
]
