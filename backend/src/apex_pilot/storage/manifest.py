"""Committed Apex Pilot project manifest parsing and validation."""

from __future__ import annotations

import json
from collections.abc import Mapping, Sequence
from dataclasses import dataclass
from pathlib import Path
from typing import Any

from apex_pilot.storage.errors import ManifestError

MANIFEST_FILENAME = "apex-pilot.json"
MANIFEST_SCHEMA_VERSION = 1

_FORBIDDEN_CONNECTION_KEYS = frozenset(
    {
        "connection",
        "connection_name",
        "connections",
        "sqlcl_connection",
        "sqlcl_connection_name",
        "sqlcl_connections",
        "saved_connection",
        "saved_connection_name",
        "saved_connections",
    }
)


@dataclass(frozen=True)
class ManifestEnvironment:
    """A portable logical environment declared in the project manifest."""

    name: str
    default_schema: str | None = None
    apex_workspace_hint: str | None = None
    apex_app_id: int | None = None


@dataclass(frozen=True)
class ProjectManifest:
    """Portable project facts stored in apex-pilot.json."""

    schema_version: int
    name: str
    description: str | None
    environments: tuple[ManifestEnvironment, ...]
    default_environment: str | None = None

    def environment_names(self) -> frozenset[str]:
        """Return declared logical environment names."""
        return frozenset(env.name for env in self.environments)

    def to_dict(self) -> dict[str, object]:
        """Return a JSON-serializable manifest payload."""
        payload: dict[str, object] = {
            "schemaVersion": self.schema_version,
            "name": self.name,
            "environments": [
                {
                    "name": env.name,
                    **({"defaultSchema": env.default_schema} if env.default_schema else {}),
                    **({"apexWorkspaceHint": env.apex_workspace_hint} if env.apex_workspace_hint else {}),
                    **({"apexAppId": env.apex_app_id} if env.apex_app_id is not None else {}),
                }
                for env in self.environments
            ],
        }
        if self.description is not None:
            payload["description"] = self.description
        if self.default_environment is not None:
            payload["defaultEnvironment"] = self.default_environment
        return payload


def manifest_path_for(project_root: Path) -> Path:
    """Return the expected manifest path for a project root."""
    return project_root / MANIFEST_FILENAME


def load_project_manifest(path: Path) -> ProjectManifest:
    """Load and validate a project manifest from disk."""
    try:
        raw_text = path.read_text(encoding="utf-8")
    except OSError as exc:
        raise ManifestError(f"Unable to read project manifest at {path}: {exc}") from exc
    try:
        payload = json.loads(raw_text)
    except json.JSONDecodeError as exc:
        raise ManifestError(f"Project manifest is not valid JSON: {exc}") from exc
    if not isinstance(payload, dict):
        raise ManifestError("Project manifest root must be a JSON object.")
    return parse_project_manifest(payload)


def parse_project_manifest(payload: Mapping[str, Any]) -> ProjectManifest:
    """Parse and validate a project manifest mapping."""
    _reject_forbidden_connection_fields(payload)

    schema_version = payload.get("schemaVersion", payload.get("schema_version"))
    if schema_version != MANIFEST_SCHEMA_VERSION:
        raise ManifestError(
            f"Unsupported manifest schemaVersion {schema_version!r}; expected {MANIFEST_SCHEMA_VERSION}."
        )

    name = payload.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ManifestError("Manifest field 'name' must be a non-empty string.")

    description = payload.get("description")
    if description is not None and not isinstance(description, str):
        raise ManifestError("Manifest field 'description' must be a string when present.")

    environments_raw = payload.get("environments")
    if not isinstance(environments_raw, list) or not environments_raw:
        raise ManifestError("Manifest field 'environments' must be a non-empty array.")

    environments = tuple(_parse_environment(item, index) for index, item in enumerate(environments_raw))
    names = [env.name for env in environments]
    if len(names) != len(set(names)):
        raise ManifestError("Manifest environments must have unique names.")

    default_environment = payload.get("defaultEnvironment", payload.get("default_environment"))
    if default_environment is not None:
        if not isinstance(default_environment, str) or not default_environment.strip():
            raise ManifestError("Manifest field 'defaultEnvironment' must be a non-empty string when present.")
        if default_environment not in names:
            raise ManifestError(f"defaultEnvironment {default_environment!r} is not declared in environments.")

    return ProjectManifest(
        schema_version=MANIFEST_SCHEMA_VERSION,
        name=name.strip(),
        description=description.strip() if isinstance(description, str) else None,
        environments=environments,
        default_environment=default_environment.strip() if isinstance(default_environment, str) else None,
    )


def write_project_manifest(path: Path, manifest: ProjectManifest) -> None:
    """Write a validated project manifest to disk."""
    path.parent.mkdir(parents=True, exist_ok=True)
    path.write_text(json.dumps(manifest.to_dict(), indent=2) + "\n", encoding="utf-8")


def assert_no_saved_connection_names(manifest: ProjectManifest) -> None:
    """Assert portable manifest data does not embed SQLcl saved connection names."""
    payload = manifest.to_dict()
    _reject_forbidden_connection_fields(payload)


def _parse_environment(item: object, index: int) -> ManifestEnvironment:
    if not isinstance(item, Mapping):
        raise ManifestError(f"environments[{index}] must be an object.")
    _reject_forbidden_connection_fields(item, prefix=f"environments[{index}]")

    name = item.get("name")
    if not isinstance(name, str) or not name.strip():
        raise ManifestError(f"environments[{index}].name must be a non-empty string.")

    default_schema = item.get("defaultSchema", item.get("default_schema"))
    if default_schema is not None and not isinstance(default_schema, str):
        raise ManifestError(f"environments[{index}].defaultSchema must be a string when present.")

    apex_workspace_hint = item.get("apexWorkspaceHint", item.get("apex_workspace_hint"))
    if apex_workspace_hint is not None and not isinstance(apex_workspace_hint, str):
        raise ManifestError(f"environments[{index}].apexWorkspaceHint must be a string when present.")

    apex_app_id = item.get("apexAppId", item.get("apex_app_id"))
    if apex_app_id is not None and not isinstance(apex_app_id, int):
        raise ManifestError(f"environments[{index}].apexAppId must be an integer when present.")

    return ManifestEnvironment(
        name=name.strip(),
        default_schema=default_schema.strip() if isinstance(default_schema, str) else None,
        apex_workspace_hint=apex_workspace_hint.strip() if isinstance(apex_workspace_hint, str) else None,
        apex_app_id=apex_app_id,
    )


def _reject_forbidden_connection_fields(payload: Mapping[str, Any], *, prefix: str = "manifest") -> None:
    for key in payload:
        normalized = str(key).strip().lower()
        if normalized in _FORBIDDEN_CONNECTION_KEYS:
            raise ManifestError(f"{prefix} must not contain local SQLcl saved connection fields such as '{key}'.")
        value = payload[key]
        if isinstance(value, Mapping):
            _reject_forbidden_connection_fields(value, prefix=f"{prefix}.{key}")
        elif isinstance(value, Sequence) and not isinstance(value, (str, bytes, bytearray)):
            for index, item in enumerate(value):
                if isinstance(item, Mapping):
                    _reject_forbidden_connection_fields(item, prefix=f"{prefix}.{key}[{index}]")
