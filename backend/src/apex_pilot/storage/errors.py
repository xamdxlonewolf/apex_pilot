"""Local metadata storage errors."""

from __future__ import annotations


class StorageError(RuntimeError):
    """Base error for local metadata storage failures."""


class StorageCapabilityError(StorageError):
    """Raised when required SQLite capabilities are unavailable."""


class ManifestError(StorageError):
    """Raised when an Apex Pilot project manifest is invalid."""


class ProfileConflictError(StorageError):
    """Raised when a profile identity hash already exists."""


class RetentionError(StorageError):
    """Raised when retention policy maintenance cannot proceed."""
