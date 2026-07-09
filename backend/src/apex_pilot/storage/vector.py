"""Optional future vector-memory adapter boundary.

Phase 1 uses SQLite tables and FTS5 only. Concrete vector backends such as
sqlite-vec may implement this protocol later without changing the core storage
schema or introducing a required dependency.
"""

from __future__ import annotations

from typing import Protocol

from apex_pilot.storage.models import MemorySearchHit


class VectorMemoryAdapter(Protocol):
    """Optional semantic memory adapter for a later phase."""

    def index_text(
        self,
        *,
        project_id: str,
        thread_id: str,
        source_type: str,
        source_id: str,
        content: str,
    ) -> None: ...

    def search(
        self,
        *,
        project_id: str,
        query: str,
        limit: int = 20,
    ) -> tuple[MemorySearchHit, ...]: ...


class NullVectorMemoryAdapter:
    """No-op vector adapter used until an optional backend is configured."""

    def index_text(
        self,
        *,
        project_id: str,
        thread_id: str,
        source_type: str,
        source_id: str,
        content: str,
    ) -> None:
        """Ignore indexing requests in phase 1."""

    def search(
        self,
        *,
        project_id: str,
        query: str,
        limit: int = 20,
    ) -> tuple[MemorySearchHit, ...]:
        """Return no semantic hits in phase 1."""
        return ()
