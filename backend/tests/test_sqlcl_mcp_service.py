"""Tests for SQLcl MCP process lifecycle management."""

import asyncio
from collections.abc import Mapping, Sequence
from pathlib import Path

import pytest

from apex_pilot.mcp import (
    SqlclMcpConfig,
    SqlclMcpService,
    SqlclMcpServiceError,
    SqlclPreflightResult,
)


class FakeProcess:
    """Small controllable process double for service lifecycle tests."""

    def __init__(self, *, returncode: int | None = None) -> None:
        self.returncode = returncode
        self.terminated = False
        self.killed = False
        self._wait_event = asyncio.Event()

        if returncode is not None:
            self._wait_event.set()

    def terminate(self) -> None:
        """Record a graceful termination request."""
        self.terminated = True
        self.returncode = 0
        self._wait_event.set()

    def kill(self) -> None:
        """Record a forced termination request."""
        self.killed = True
        self.returncode = -9
        self._wait_event.set()

    async def wait(self) -> int:
        """Wait until the fake process exits."""
        await self._wait_event.wait()
        assert self.returncode is not None
        return self.returncode


class HangingFakeProcess(FakeProcess):
    """Fake process that ignores graceful termination."""

    def terminate(self) -> None:
        """Ignore terminate so the service exercises kill fallback."""
        self.terminated = True


def make_preflight(tmp_path: Path) -> SqlclPreflightResult:
    """Build a preflight result for fake service tests."""
    return SqlclPreflightResult(
        sqlcl_path=tmp_path / "sql",
        sqlcl_version=(25, 2, 0),
        java_path=tmp_path / "java",
        java_major_version=21,
        environment={"TNS_ADMIN": str(tmp_path / "tns")},
    )


def test_sqlcl_mcp_service_starts_with_mcp_command(tmp_path: Path) -> None:
    """Service starts SQLcl in MCP mode with the configured restrict level."""

    async def run_test() -> None:
        preflight = make_preflight(tmp_path)
        process = FakeProcess()
        captured: dict[str, object] = {}

        async def process_factory(args: Sequence[str], environment: Mapping[str, str]) -> FakeProcess:
            captured["args"] = tuple(args)
            captured["environment"] = dict(environment)
            return process

        service = SqlclMcpService(
            SqlclMcpConfig(restrict_level=3),
            preflight=preflight,
            process_factory=process_factory,
        )

        await service.start()

        assert service.is_running
        assert captured["args"] == (str(preflight.sqlcl_path), "-R", "3", "-mcp")
        assert captured["environment"] == {"TNS_ADMIN": str(tmp_path / "tns")}

        await service.stop()
        assert not service.is_running
        assert process.terminated

    asyncio.run(run_test())


def test_sqlcl_mcp_service_rejects_double_start(tmp_path: Path) -> None:
    """A single service object owns at most one live SQLcl MCP process."""

    async def run_test() -> None:
        process = FakeProcess()

        async def process_factory(_args: Sequence[str], _environment: Mapping[str, str]) -> FakeProcess:
            return process

        service = SqlclMcpService(
            SqlclMcpConfig(),
            preflight=make_preflight(tmp_path),
            process_factory=process_factory,
        )

        await service.start()

        with pytest.raises(SqlclMcpServiceError, match="already running"):
            await service.start()

        await service.stop()

    asyncio.run(run_test())


def test_sqlcl_mcp_service_rejects_process_that_exits_during_startup(tmp_path: Path) -> None:
    """A process that exits immediately during startup is treated as a failure."""

    async def run_test() -> None:
        async def process_factory(_args: Sequence[str], _environment: Mapping[str, str]) -> FakeProcess:
            return FakeProcess(returncode=1)

        service = SqlclMcpService(
            SqlclMcpConfig(),
            preflight=make_preflight(tmp_path),
            process_factory=process_factory,
        )

        with pytest.raises(SqlclMcpServiceError, match="exited during startup"):
            await service.start()

    asyncio.run(run_test())


def test_sqlcl_mcp_service_kills_process_after_stop_timeout(tmp_path: Path) -> None:
    """Stop falls back to kill when SQLcl does not exit after terminate."""

    async def run_test() -> None:
        process = HangingFakeProcess()

        async def process_factory(_args: Sequence[str], _environment: Mapping[str, str]) -> HangingFakeProcess:
            return process

        service = SqlclMcpService(
            SqlclMcpConfig(),
            preflight=make_preflight(tmp_path),
            process_factory=process_factory,
        )

        await service.start()
        await service.stop(timeout_seconds=0.01)

        assert process.terminated
        assert process.killed
        assert not service.is_running

    asyncio.run(run_test())
