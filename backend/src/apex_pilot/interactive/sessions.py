"""Opaque dedicated editor session pin/release facades (ADR-0008)."""

from __future__ import annotations

from dataclasses import dataclass

from apex_pilot.interactive.pool import (
    DedicatedSessionLimitError,
    InteractiveOraclePool,
    InteractivePoolError,
    InteractivePoolState,
    PoolNotOpenError,
)


@dataclass(frozen=True)
class DedicatedSessionPin:
    """Typed pin result — never includes raw connections or cursors."""

    document_id: str
    profile_id: str
    dedicated_pinned: int
    dedicated_limit: int
    state: str = "pinned"


class InteractiveSessionService:
    """SQL/PLSQL editor attachment over acquire_dedicated / release_dedicated."""

    def __init__(self, pool: InteractiveOraclePool) -> None:
        self._pool = pool

    def acquire(self, document_id: str) -> DedicatedSessionPin:
        """Lazily pin a dedicated session for one editor document."""
        status = self._pool.status()
        if status.state is InteractivePoolState.DEAD:
            msg = "Interactive Oracle pool is dead; reconnect before attaching an editor."
            raise InteractivePoolError(msg)
        if status.state is not InteractivePoolState.CONNECTED:
            msg = "Interactive Oracle pool is not connected."
            raise PoolNotOpenError(msg)

        try:
            handle = self._pool.acquire_dedicated(document_id)
        except DedicatedSessionLimitError:
            raise
        except PoolNotOpenError:
            raise
        except Exception as error:
            msg = "Failed to acquire a dedicated interactive editor session."
            raise InteractivePoolError(msg) from error

        snapshot = self._pool.status()
        return DedicatedSessionPin(
            document_id=handle.document_id,
            profile_id=handle.profile_id,
            dedicated_pinned=snapshot.dedicated_pinned,
            dedicated_limit=snapshot.dedicated_limit,
        )

    def release(self, document_id: str) -> DedicatedSessionPin | None:
        """Release a pinned editor session. Idempotent when already released."""
        normalized = document_id.strip()
        if not normalized:
            msg = "Dedicated session document id cannot be empty."
            raise InteractivePoolError(msg)

        released = self._pool.release_dedicated(normalized)
        if not released:
            return None
        snapshot = self._pool.status()
        return DedicatedSessionPin(
            document_id=normalized,
            profile_id=snapshot.profile_id or "",
            dedicated_pinned=snapshot.dedicated_pinned,
            dedicated_limit=snapshot.dedicated_limit,
            state="released",
        )
