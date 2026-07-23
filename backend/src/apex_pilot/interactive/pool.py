"""App-owned interactive Oracle connection pool (ADR-0008)."""

from __future__ import annotations

import time
from collections.abc import Callable, Iterator
from contextlib import contextmanager, suppress
from dataclasses import dataclass
from enum import StrEnum
from typing import Any, Protocol


class InteractivePoolError(Exception):
    """Base error for the interactive Oracle pool."""


class PoolNotOpenError(InteractivePoolError):
    """Raised when borrow/dedicated APIs are used before the pool is open."""


class DedicatedSessionLimitError(InteractivePoolError):
    """Raised when the dedicated editor pin limit is exhausted."""


class InteractivePoolState(StrEnum):
    """Honest interactive binding availability for Context Bar / status bar."""

    DISCONNECTED = "disconnected"
    CONNECTING = "connecting"
    CONNECTED = "connected"
    RECONNECTING = "reconnecting"
    DEAD = "dead"


class DisconnectReason(StrEnum):
    """Why the interactive binding left Connected (independent of SQLcl/backend)."""

    USER = "user"
    APP_IDLE = "app_idle"
    ORACLE_POLICY = "oracle_policy"
    NETWORK_TRANSPORT = "network_transport"
    VALIDATION_FAILED = "validation_failed"
    CREDENTIAL_UNAVAILABLE = "credential_unavailable"


@dataclass(frozen=True)
class InteractiveDriverBinding:
    """Non-secret interactive driver binding for a Connection Profile."""

    profile_id: str
    display_name: str
    username: str
    dsn: str
    # Autonomous / TCPS: directory with tnsnames.ora (+ ewallet.pem for Thin mTLS).
    config_dir: str | None = None
    wallet_location: str | None = None


@dataclass(frozen=True)
class InteractivePoolStatus:
    """Public status snapshot — never includes passwords or raw connections."""

    state: InteractivePoolState
    profile_id: str | None
    display_name: str | None
    dedicated_pinned: int
    dedicated_limit: int
    pool_min: int
    pool_max: int
    disconnect_reason: DisconnectReason | None = None
    idle_warning: bool = False
    seconds_until_idle_disconnect: float | None = None
    idle_timeout_seconds: int = 900
    warning_lead_seconds: int = 60
    has_session_password: bool = False
    working_schema: str | None = None
    reconnect_prompt_dismissed: bool = False


@dataclass(frozen=True)
class DedicatedSessionHandle:
    """Opaque handle for a pinned SQL/PLSQL editor session."""

    document_id: str
    profile_id: str
    connection: object


class OracleDriverPool(Protocol):
    """Minimal oracledb ConnectionPool surface used by InteractiveOraclePool."""

    def acquire(self) -> Any:
        """Acquire one connection from the pool."""
        ...

    def release(self, connection: Any) -> None:
        """Return a borrowed connection to the pool."""
        ...

    def close(self) -> None:
        """Close the underlying driver pool."""
        ...


class OraclePoolDriver(Protocol):
    """Factory seam for creating an oracledb pool (injectable in tests)."""

    def create_pool(
        self,
        *,
        user: str,
        password: str,
        dsn: str,
        min: int,
        max: int,
        timeout: int = 300,
        config_dir: str | None = None,
        wallet_location: str | None = None,
        wallet_password: str | None = None,
    ) -> OracleDriverPool:
        """Create a backend-owned Oracle connection pool."""
        ...


class OracledbPoolDriver:
    """Production driver that creates a real python-oracledb pool."""

    def create_pool(
        self,
        *,
        user: str,
        password: str,
        dsn: str,
        min: int,
        max: int,
        timeout: int = 300,
        config_dir: str | None = None,
        wallet_location: str | None = None,
        wallet_password: str | None = None,
    ) -> Any:
        import oracledb

        kwargs: dict[str, Any] = {
            "user": user,
            "password": password,
            "dsn": dsn,
            "min": min,
            "max": max,
            "timeout": timeout,
            # Fail fast instead of waiting out Autonomous retry_count loops.
            "tcp_connect_timeout": 20,
        }
        if config_dir:
            kwargs["config_dir"] = config_dir
        if wallet_location:
            kwargs["wallet_location"] = wallet_location
            # Always pass wallet_password when a wallet is used. Omitting it lets
            # OpenSSL prompt "Enter PEM pass phrase:" on the server stdin, which
            # hangs uvicorn. Empty string means "no passphrase" non-interactively.
            kwargs["wallet_password"] = wallet_password if wallet_password is not None else ""
        try:
            return oracledb.create_pool(**kwargs)
        except TypeError:
            # Older oracledb builds may not accept tcp_connect_timeout on pools.
            kwargs.pop("tcp_connect_timeout", None)
            return oracledb.create_pool(**kwargs)


DEFAULT_POOL_MIN = 1
DEFAULT_POOL_MAX = 6
DEFAULT_DEDICATED_LIMIT = 5
DEFAULT_IDLE_TIMEOUT_SECONDS = 15 * 60
DEFAULT_WARNING_LEAD_SECONDS = 60
MIN_IDLE_TIMEOUT_SECONDS = 10 * 60
MAX_IDLE_TIMEOUT_SECONDS = 30 * 60
READONLY_POOL_MEMBER_TIMEOUT_SECONDS = 5 * 60


def clamp_idle_timeout_seconds(value: int) -> int:
    """Clamp idle timeout into the ADR product range (10–30 minutes)."""
    return max(MIN_IDLE_TIMEOUT_SECONDS, min(MAX_IDLE_TIMEOUT_SECONDS, int(value)))


class InteractiveOraclePool:
    """Backend-owned interactive pool for one project's Connection Profile.

    React remounts, Settings, drawers, and Focus changes do not own this pool.
    It closes only on project close, confirmed profile change, explicit
    disconnect, or app exit. Application idle disconnect keeps the session-only
    password so lazy reconnect can reuse it.
    """

    def __init__(
        self,
        *,
        driver: OraclePoolDriver | None = None,
        pool_min: int = DEFAULT_POOL_MIN,
        pool_max: int = DEFAULT_POOL_MAX,
        dedicated_limit: int = DEFAULT_DEDICATED_LIMIT,
        idle_timeout_seconds: int = DEFAULT_IDLE_TIMEOUT_SECONDS,
        warning_lead_seconds: int = DEFAULT_WARNING_LEAD_SECONDS,
        readonly_member_timeout_seconds: int = READONLY_POOL_MEMBER_TIMEOUT_SECONDS,
        clock: Callable[[], float] | None = None,
    ) -> None:
        if pool_min < 0 or pool_max < 1 or pool_min > pool_max:
            msg = "Invalid interactive pool size bounds."
            raise InteractivePoolError(msg)
        if dedicated_limit < 1 or dedicated_limit >= pool_max:
            msg = "Dedicated editor limit must leave at least one pool slot free."
            raise InteractivePoolError(msg)
        if warning_lead_seconds < 1:
            msg = "Warning lead time must be at least one second."
            raise InteractivePoolError(msg)

        self._driver = driver or OracledbPoolDriver()
        self._pool_min = pool_min
        self._pool_max = pool_max
        self._dedicated_limit = dedicated_limit
        self._idle_timeout_seconds = clamp_idle_timeout_seconds(idle_timeout_seconds)
        self._warning_lead_seconds = min(warning_lead_seconds, self._idle_timeout_seconds)
        self._readonly_member_timeout_seconds = max(1, int(readonly_member_timeout_seconds))
        self._clock = clock or time.monotonic
        self._state = InteractivePoolState.DISCONNECTED
        self._binding: InteractiveDriverBinding | None = None
        self._password: str | None = None
        self._wallet_password: str | None = None
        self._pool: OracleDriverPool | None = None
        self._dedicated: dict[str, DedicatedSessionHandle] = {}
        self._last_activity_at = self._clock()
        self._in_flight = 0
        self._transaction_uncertain = False
        self._disconnect_reason: DisconnectReason | None = None
        self._working_schema: str | None = None
        self._reconnect_prompt_dismissed = False

    def status(self) -> InteractivePoolStatus:
        """Return a non-secret status snapshot for UI cues."""
        binding = self._binding
        idle_warning = False
        seconds_until: float | None = None
        if self._state is InteractivePoolState.CONNECTED and self._in_flight == 0 and not self._transaction_uncertain:
            remaining = self._idle_timeout_seconds - (self._clock() - self._last_activity_at)
            seconds_until = max(0.0, remaining)
            idle_warning = 0 < remaining <= self._warning_lead_seconds

        return InteractivePoolStatus(
            state=self._state,
            profile_id=binding.profile_id if binding else None,
            display_name=binding.display_name if binding else None,
            dedicated_pinned=len(self._dedicated),
            dedicated_limit=self._dedicated_limit,
            pool_min=self._pool_min,
            pool_max=self._pool_max,
            disconnect_reason=self._disconnect_reason,
            idle_warning=idle_warning,
            seconds_until_idle_disconnect=seconds_until,
            idle_timeout_seconds=self._idle_timeout_seconds,
            warning_lead_seconds=self._warning_lead_seconds,
            has_session_password=bool(self._password),
            working_schema=self._working_schema,
            reconnect_prompt_dismissed=self._reconnect_prompt_dismissed,
        )

    def evaluate_idle_policy(self) -> InteractivePoolStatus:
        """Apply warn/disconnect transitions for application-level DB inactivity."""
        if self._state is not InteractivePoolState.CONNECTED:
            return self.status()
        if self._in_flight > 0 or self._transaction_uncertain:
            return self.status()

        idle_for = self._clock() - self._last_activity_at
        if idle_for >= self._idle_timeout_seconds:
            self._teardown_pool_keep_credentials(DisconnectReason.APP_IDLE)
        return self.status()

    @property
    def binding(self) -> InteractiveDriverBinding | None:
        """Return the active non-secret profile binding, if connected."""
        return self._binding

    def open(
        self,
        binding: InteractiveDriverBinding,
        *,
        password: str,
        wallet_password: str | None = None,
    ) -> None:
        """Open or keep the pool for the given profile binding.

        Re-opening the same profile while connected is a no-op so UI remounts
        and dialog cycles cannot recreate the pool.
        """
        if not password:
            msg = "Interactive driver password cannot be empty."
            raise InteractivePoolError(msg)
        binding = _normalize_binding(binding)

        if (
            self._state is InteractivePoolState.CONNECTED
            and self._binding is not None
            and self._binding.profile_id == binding.profile_id
            and self._pool is not None
        ):
            return

        if self._pool is not None:
            self._teardown_pool_keep_credentials(None)
            self._password = None
            self._wallet_password = None
            self._binding = None

        self._state = InteractivePoolState.CONNECTING
        self._binding = binding
        self._password = password
        # Keep "" (no passphrase) distinct from None (wallet not used).
        self._wallet_password = wallet_password
        self._disconnect_reason = None
        self._reconnect_prompt_dismissed = False
        try:
            self._pool = self._create_driver_pool(binding, password, self._wallet_password)
            self._apply_working_schema_on_pool()
        except InteractivePoolError:
            self._binding = None
            self._password = None
            self._wallet_password = None
            self._pool = None
            self._state = InteractivePoolState.DEAD
            self._disconnect_reason = DisconnectReason.VALIDATION_FAILED
            raise
        except Exception as error:
            self._binding = None
            self._password = None
            self._wallet_password = None
            self._pool = None
            self._state = InteractivePoolState.DEAD
            self._disconnect_reason = DisconnectReason.VALIDATION_FAILED
            raise InteractivePoolError(_oracle_error_message(error)) from error

        self._state = InteractivePoolState.CONNECTED
        self.touch_activity()

    def reconnect(self) -> InteractivePoolStatus:
        """Reconnect using the retained session-only password after clean idle/expiry.

        Never replays uncertain writes — callers must start a fresh user action.
        """
        binding = self._binding
        password = self._password
        if binding is None or not password:
            msg = "Interactive reconnect requires a retained Connection Profile and session password."
            raise InteractivePoolError(msg)

        self._state = InteractivePoolState.RECONNECTING
        self._disconnect_reason = None
        self._reconnect_prompt_dismissed = False
        if self._pool is not None:
            self._teardown_pool_keep_credentials(None)

        try:
            self._pool = self._create_driver_pool(binding, password, self._wallet_password)
            self._apply_working_schema_on_pool()
        except InteractivePoolError:
            self._pool = None
            self._state = InteractivePoolState.DEAD
            self._disconnect_reason = DisconnectReason.VALIDATION_FAILED
            raise
        except Exception as error:
            self._pool = None
            self._state = InteractivePoolState.DEAD
            self._disconnect_reason = DisconnectReason.VALIDATION_FAILED
            raise InteractivePoolError(_oracle_error_message(error)) from error

        self._state = InteractivePoolState.CONNECTED
        self.touch_activity()
        return self.status()

    def touch_activity(self) -> InteractivePoolStatus:
        """Record application-level database activity and clear idle warning."""
        self._last_activity_at = self._clock()
        return self.status()

    def set_working_schema(self, schema_name: str | None) -> None:
        """Remember Working Schema for reconnect verification (non-secret)."""
        normalized = schema_name.strip() if schema_name else None
        self._working_schema = normalized.upper() if normalized else None

    def set_transaction_uncertain(self, uncertain: bool) -> None:
        """Block idle teardown while transaction outcome is active or unknown."""
        self._transaction_uncertain = uncertain

    def dismiss_idle_prompt(self) -> InteractivePoolStatus:
        """Cancel/dismiss reconnect UX — leave Unconnected until manual reconnect.

        Refuses teardown while a call is in flight or transaction state is
        uncertain (ADR-0008), matching automatic idle disconnect guards.
        """
        if self._in_flight > 0 or self._transaction_uncertain:
            msg = "Cannot dismiss idle reconnect while a database call is in flight or transaction state is uncertain."
            raise InteractivePoolError(msg)

        self._reconnect_prompt_dismissed = True
        if self._pool is not None or self._state is InteractivePoolState.CONNECTED:
            self._teardown_pool_keep_credentials(DisconnectReason.APP_IDLE)
        elif self._state is InteractivePoolState.DEAD:
            self._state = InteractivePoolState.DISCONNECTED
            if self._disconnect_reason is None:
                self._disconnect_reason = DisconnectReason.APP_IDLE
        else:
            self._state = InteractivePoolState.DISCONNECTED
            if self._disconnect_reason is None:
                self._disconnect_reason = DisconnectReason.APP_IDLE
        return self.status()

    @contextmanager
    def borrow_readonly(self) -> Iterator[object]:
        """Borrow a short-lived connection for browse/health reads."""
        with self.borrow_isolated() as connection:
            yield connection

    @contextmanager
    def borrow_isolated(self) -> Iterator[object]:
        """Borrow a short-lived isolated lease (browse/health/compile DDL).

        Isolated leases must never use a dedicated editor pin so Oracle DDL
        cannot implicitly commit or roll back an editor transaction.
        """
        pool = self._require_open_pool()
        self._in_flight += 1
        connection = pool.acquire()
        try:
            yield connection
            self.touch_activity()
        finally:
            self._in_flight = max(0, self._in_flight - 1)
            pool.release(connection)

    def acquire_dedicated(self, document_id: str) -> DedicatedSessionHandle:
        """Lazily pin a dedicated session for one SQL/PLSQL editor document."""
        normalized = document_id.strip()
        if not normalized:
            msg = "Dedicated session document id cannot be empty."
            raise InteractivePoolError(msg)

        existing = self._dedicated.get(normalized)
        if existing is not None:
            self.touch_activity()
            return existing

        if len(self._dedicated) >= self._dedicated_limit:
            msg = (
                f"Dedicated interactive session limit reached "
                f"({self._dedicated_limit}). Disconnect a connected tab, raise "
                "the configured limit, or cancel."
            )
            raise DedicatedSessionLimitError(msg)

        pool = self._require_open_pool()
        binding = self._binding
        assert binding is not None
        connection = pool.acquire()
        handle = DedicatedSessionHandle(
            document_id=normalized,
            profile_id=binding.profile_id,
            connection=connection,
        )
        self._dedicated[normalized] = handle
        self.touch_activity()
        return handle

    def release_dedicated(self, document_id: str) -> bool:
        """Release a pinned dedicated editor session back to the pool.

        Returns True when a pin existed and was released; False when already free.
        """
        handle = self._dedicated.pop(document_id.strip(), None)
        if handle is None:
            return False
        if self._pool is not None:
            self._pool.release(handle.connection)
        return True

    def is_dedicated_pinned(self, document_id: str) -> bool:
        """Return whether a document currently holds a dedicated pin."""
        return document_id.strip() in self._dedicated

    def close(self) -> None:
        """Close the pool and clear session-only credentials."""
        self._teardown_pool_keep_credentials(DisconnectReason.USER)
        self._password = None
        self._wallet_password = None
        self._binding = None
        self._working_schema = None
        self._disconnect_reason = DisconnectReason.USER
        self._state = InteractivePoolState.DISCONNECTED
        self._reconnect_prompt_dismissed = False
        self._transaction_uncertain = False

    def _create_driver_pool(
        self,
        binding: InteractiveDriverBinding,
        password: str,
        wallet_password: str | None = None,
    ) -> OracleDriverPool:
        return self._driver.create_pool(
            user=binding.username,
            password=password,
            dsn=binding.dsn,
            min=self._pool_min,
            max=self._pool_max,
            timeout=self._readonly_member_timeout_seconds,
            config_dir=binding.config_dir,
            wallet_location=binding.wallet_location,
            wallet_password=wallet_password,
        )

    def _apply_working_schema_on_pool(self) -> None:
        if self._pool is None or not self._working_schema:
            return
        connection = self._pool.acquire()
        try:
            cursor = getattr(connection, "cursor", None)
            if callable(cursor):
                active = cursor()
                execute = getattr(active, "execute", None)
                if callable(execute):
                    execute(f"ALTER SESSION SET CURRENT_SCHEMA = {self._working_schema}")
        finally:
            self._pool.release(connection)

    def _teardown_pool_keep_credentials(self, reason: DisconnectReason | None) -> None:
        if self._pool is not None:
            for handle in list(self._dedicated.values()):
                with suppress(Exception):
                    self._pool.release(handle.connection)
            self._dedicated.clear()
            try:
                self._pool.close()
            finally:
                self._pool = None
        if reason is not None:
            self._disconnect_reason = reason
            self._state = InteractivePoolState.DISCONNECTED

    def _require_open_pool(self) -> OracleDriverPool:
        if self._pool is None or self._state is not InteractivePoolState.CONNECTED:
            msg = "Interactive Oracle pool is not connected."
            raise PoolNotOpenError(msg)
        return self._pool


def _normalize_binding(binding: InteractiveDriverBinding) -> InteractiveDriverBinding:
    """Trim binding fields and collapse whitespace inside Easy Connect descriptors."""
    config_dir = binding.config_dir.strip() if binding.config_dir else None
    wallet_location = binding.wallet_location.strip() if binding.wallet_location else None
    # When only one wallet path is supplied, use it for both Thin-mode knobs.
    if wallet_location and not config_dir:
        config_dir = wallet_location
    if config_dir and not wallet_location:
        wallet_location = config_dir
    return InteractiveDriverBinding(
        profile_id=binding.profile_id.strip(),
        display_name=binding.display_name.strip(),
        username=_normalize_oracle_username(binding.username),
        dsn=" ".join(binding.dsn.split()),
        config_dir=config_dir or None,
        wallet_location=wallet_location or None,
    )


def _normalize_oracle_username(username: str) -> str:
    """Normalize unquoted Oracle usernames; keep proxy form USER[SCHEMA] uppercase."""
    trimmed = username.strip()
    if not trimmed:
        return trimmed
    # Quoted identifiers are left alone.
    if trimmed.startswith('"') and trimmed.endswith('"') and len(trimmed) >= 2:
        return trimmed
    if "[" in trimmed and trimmed.endswith("]"):
        proxy, _, schema = trimmed[:-1].partition("[")
        return f"{proxy.strip().upper()}[{schema.strip().upper()}]"
    return trimmed.upper()


def _oracle_error_message(error: BaseException) -> str:
    """Surface driver errors honestly without inventing a generic failure label."""
    text = str(error).strip()
    if not text:
        args = getattr(error, "args", None)
        if args:
            text = "; ".join(str(item) for item in args if str(item).strip())
    if not text:
        text = error.__class__.__name__
    # Prefer the driver text as-is when it already names Oracle/python-oracledb codes.
    if "DPY-" in text or "ORA-" in text or "TNS-" in text:
        return text
    return f"Interactive Oracle pool failed to open: {text}"
