"""Canonical Database Source fingerprints (transport line endings only)."""

from __future__ import annotations

import hashlib
import re

_CRLF_RE = re.compile(r"\r\n|\r")


def normalize_source_text(text: str) -> str:
    """Normalize transport line endings only; preserve meaningful whitespace/case."""
    return _CRLF_RE.sub("\n", text)


def fingerprint_digest(text: str) -> str:
    """Return a stable SHA-256 digest for canonical source text."""
    normalized = normalize_source_text(text)
    return hashlib.sha256(normalized.encode("utf-8")).hexdigest()
