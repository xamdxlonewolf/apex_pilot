"""Chat/tool retention policy helpers."""

from __future__ import annotations

from dataclasses import dataclass
from datetime import UTC, datetime, timedelta
from typing import Literal

RetentionPolicyKind = Literal["days", "indefinite"]

DEFAULT_RETENTION_DAYS = 365
CHAT_DISPLAY_WINDOW = timedelta(days=14)


@dataclass(frozen=True)
class RetentionPolicy:
    """User-selected retention policy for chat and tool metadata."""

    kind: RetentionPolicyKind
    days: int | None = DEFAULT_RETENTION_DAYS

    def __post_init__(self) -> None:
        if self.kind == "indefinite":
            if self.days is not None:
                raise ValueError("indefinite retention must not set days")
            return
        if self.days is None or self.days <= 0:
            raise ValueError("days retention requires a positive day count")

    @classmethod
    def days_policy(cls, days: int = DEFAULT_RETENTION_DAYS) -> RetentionPolicy:
        """Build a fixed-day retention policy."""
        return cls(kind="days", days=days)

    @classmethod
    def indefinite(cls) -> RetentionPolicy:
        """Build an indefinite retention policy."""
        return cls(kind="indefinite", days=None)

    @classmethod
    def from_days(cls, days: int | None) -> RetentionPolicy:
        """Build a policy from a stored nullable day count."""
        if days is None:
            return cls.indefinite()
        return cls.days_policy(days)

    def cutoff(self, *, now: datetime | None = None) -> datetime | None:
        """Return the prune cutoff timestamp, or None when retention is indefinite."""
        if self.kind == "indefinite" or self.days is None:
            return None
        current = now or datetime.now(UTC)
        if current.tzinfo is None:
            current = current.replace(tzinfo=UTC)
        return current - timedelta(days=self.days)

    def to_days(self) -> int | None:
        """Return the nullable day count used in local project rows."""
        return None if self.kind == "indefinite" else self.days


def chat_window_bounds(
    *,
    latest_message_at: datetime,
    windows_back: int = 0,
    window: timedelta = CHAT_DISPLAY_WINDOW,
) -> tuple[datetime, datetime]:
    """Return inclusive-start/exclusive-end bounds for a latest-relative chat window.

    ``windows_back=0`` is the newest 2-week window ending at the latest message.
    ``windows_back=1`` loads the previous 2-week increment, and so on.
    """
    if windows_back < 0:
        raise ValueError("windows_back must be >= 0")
    if latest_message_at.tzinfo is None:
        latest_message_at = latest_message_at.replace(tzinfo=UTC)

    end = latest_message_at - (window * windows_back)
    start = end - window
    return start, end
