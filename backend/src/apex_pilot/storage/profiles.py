"""Local profile identity helpers."""

from __future__ import annotations

import hashlib
import hmac
import secrets
import uuid
from dataclasses import dataclass

from apex_pilot.storage.models import LocalProfile

# Application-local salt for duplicate detection hashes. This is not a password
# hash; it only reduces trivial cross-machine correlation of identity hashes.
_IDENTITY_HASH_SALT = b"apex-pilot-local-profile-v1"


@dataclass(frozen=True)
class ProfileCreateRequest:
    """Inputs required to create a local profile."""

    display_name: str
    email: str | None = None
    username: str | None = None


def new_profile_id() -> str:
    """Return a random local profile identifier."""
    return str(uuid.uuid4())


def normalize_identity_part(value: str | None) -> str:
    """Normalize an identity field for hashing."""
    if value is None:
        return ""
    return " ".join(value.strip().lower().split())


def compute_identity_hash(*, email: str | None, username: str | None) -> str:
    """Compute a stable salted hash of email and username for duplicate detection."""
    material = f"{normalize_identity_part(email)}\0{normalize_identity_part(username)}".encode()
    digest = hmac.new(_IDENTITY_HASH_SALT, material, hashlib.sha256).hexdigest()
    return digest


def build_profile(request: ProfileCreateRequest) -> LocalProfile:
    """Build a new in-memory profile record."""
    from datetime import UTC, datetime

    display_name = request.display_name.strip()
    if not display_name:
        raise ValueError("display_name is required")

    now = datetime.now(UTC)
    return LocalProfile(
        profile_id=new_profile_id(),
        display_name=display_name,
        email=request.email.strip() if request.email else None,
        username=request.username.strip() if request.username else None,
        identity_hash=compute_identity_hash(email=request.email, username=request.username),
        created_at=now,
        updated_at=now,
    )


def random_display_name_suffix() -> str:
    """Return a short suffix for creating a distinct display name."""
    return secrets.token_hex(2)
