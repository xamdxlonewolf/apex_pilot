"""SQLcl MCP preflight checks and process lifecycle management.

This module owns SQLcl discovery, runtime validation, environment construction,
and stdio process lifecycle. It intentionally does not implement MCP protocol
framing; future tool-call clients should use a dedicated MCP client library.
"""

from __future__ import annotations

import asyncio
import os
import re
import shutil
import subprocess
from collections.abc import Awaitable, Callable, Mapping, Sequence
from dataclasses import dataclass, field
from pathlib import Path
from typing import Protocol, Self

SQLCL_MINIMUM_VERSION = (25, 2)
SUPPORTED_JAVA_MAJOR_VERSIONS = frozenset({17, 21})


class SqlclMcpError(RuntimeError):
    """Base error for SQLcl MCP lifecycle failures."""


class SqlclPreflightError(SqlclMcpError):
    """Raised when SQLcl or Java preflight validation fails."""


class SqlclMcpServiceError(SqlclMcpError):
    """Raised when the SQLcl MCP process lifecycle cannot be managed safely."""


@dataclass(frozen=True)
class CommandResult:
    """Small command result shape used by preflight checks."""

    args: Sequence[str]
    returncode: int
    stdout: str = ""
    stderr: str = ""


CommandRunner = Callable[[Sequence[str], Mapping[str, str]], CommandResult]
PathLookup = Callable[[str], str | None]


@dataclass(frozen=True)
class SqlclMcpConfig:
    """Configuration needed to start SQLcl in MCP mode."""

    sqlcl_path: Path | None = None
    restrict_level: int | None = None
    tns_admin: Path | None = None
    java_home: Path | None = None
    extra_env: Mapping[str, str] = field(default_factory=dict)

    def __post_init__(self) -> None:
        """Validate local configuration that does not need subprocess execution."""
        if self.restrict_level is not None and not 0 <= self.restrict_level <= 4:
            msg = "SQLcl restrict_level must be between 0 and 4."
            raise ValueError(msg)


@dataclass(frozen=True)
class SqlclPreflightResult:
    """Resolved SQLcl and Java runtime metadata."""

    sqlcl_path: Path
    sqlcl_version: tuple[int, ...]
    java_path: Path
    java_major_version: int
    environment: Mapping[str, str]

    @property
    def sqlcl_version_text(self) -> str:
        """Return the SQLcl version in dotted text form."""
        return ".".join(str(part) for part in self.sqlcl_version)


class ManagedProcess(Protocol):
    """Subset of asyncio subprocess behavior used by the service."""

    @property
    def returncode(self) -> int | None:
        """Return the process exit code, or None while running."""
        ...

    def terminate(self) -> None:
        """Ask the process to stop."""
        ...

    def kill(self) -> None:
        """Force the process to stop."""
        ...

    async def wait(self) -> int:
        """Wait for the process to exit."""
        ...


ProcessFactory = Callable[[Sequence[str], Mapping[str, str]], Awaitable[ManagedProcess]]


def find_sqlcl_binary(
    explicit_path: Path | None = None,
    *,
    path_lookup: PathLookup = shutil.which,
) -> Path:
    """Resolve the SQLcl executable path."""
    if explicit_path is not None:
        if explicit_path.exists():
            return explicit_path

        msg = f"SQLcl binary does not exist: {explicit_path}"
        raise SqlclPreflightError(msg)

    resolved = path_lookup("sql")
    if resolved:
        return Path(resolved)

    msg = "SQLcl binary was not found on PATH. Configure an absolute SQLcl path."
    raise SqlclPreflightError(msg)


def parse_sqlcl_version(output: str) -> tuple[int, ...]:
    """Parse SQLcl version output from `sql -V`."""
    match = re.search(r"(?:SQLcl:\s*)?(?:Release\s*)?(\d+(?:\.\d+)+)", output, re.IGNORECASE)
    if not match:
        msg = f"Could not parse SQLcl version from output: {output.strip()!r}"
        raise SqlclPreflightError(msg)

    return tuple(int(part) for part in match.group(1).split("."))


def parse_java_major_version(output: str) -> int:
    """Parse the Java major version from `java -version` output."""
    match = re.search(r'version\s+"(?P<version>[^"]+)"', output, re.IGNORECASE)
    if not match:
        msg = f"Could not parse Java version from output: {output.strip()!r}"
        raise SqlclPreflightError(msg)

    version_text = match.group("version")
    version_parts = version_text.split(".")

    if version_parts[0] == "1" and len(version_parts) > 1:
        return int(version_parts[1])

    return int(version_parts[0])


def build_sqlcl_environment(config: SqlclMcpConfig, *, base_env: Mapping[str, str] | None = None) -> dict[str, str]:
    """Build the environment used to run SQLcl MCP."""
    environment = dict(base_env or os.environ)
    environment.update(config.extra_env)

    if config.tns_admin is not None:
        if not config.tns_admin.is_dir():
            msg = f"TNS_ADMIN must point to an existing directory: {config.tns_admin}"
            raise SqlclPreflightError(msg)
        environment["TNS_ADMIN"] = str(config.tns_admin)

    if config.java_home is not None:
        if not config.java_home.is_dir():
            msg = f"JAVA_HOME must point to an existing directory: {config.java_home}"
            raise SqlclPreflightError(msg)
        environment["JAVA_HOME"] = str(config.java_home)

    return environment


def run_subprocess_command(args: Sequence[str], environment: Mapping[str, str]) -> CommandResult:
    """Run a short preflight command and capture output."""
    try:
        completed = subprocess.run(
            args,
            check=False,
            capture_output=True,
            env=dict(environment),
            text=True,
            timeout=15,
        )
    except FileNotFoundError as error:
        msg = f"Command was not found: {args[0]}"
        raise SqlclPreflightError(msg) from error
    except subprocess.TimeoutExpired as error:
        msg = f"Command timed out: {' '.join(args)}"
        raise SqlclPreflightError(msg) from error

    return CommandResult(
        args=args,
        returncode=completed.returncode,
        stdout=completed.stdout,
        stderr=completed.stderr,
    )


def resolve_java_binary(
    config: SqlclMcpConfig,
    *,
    path_lookup: PathLookup = shutil.which,
) -> Path:
    """Resolve the Java executable path from JAVA_HOME or PATH."""
    if config.java_home is not None:
        executable_name = "java.exe" if os.name == "nt" else "java"
        java_path = config.java_home / "bin" / executable_name

        if java_path.exists():
            return java_path

        msg = f"JAVA_HOME does not contain a Java executable: {java_path}"
        raise SqlclPreflightError(msg)

    resolved = path_lookup("java")
    if resolved:
        return Path(resolved)

    msg = "Java was not found on PATH. Install JRE 17 or 21, or configure JAVA_HOME."
    raise SqlclPreflightError(msg)


def run_sqlcl_preflight(
    config: SqlclMcpConfig,
    *,
    command_runner: CommandRunner = run_subprocess_command,
    path_lookup: PathLookup = shutil.which,
    base_env: Mapping[str, str] | None = None,
) -> SqlclPreflightResult:
    """Validate SQLcl, Java, and environment configuration before MCP startup."""
    environment = build_sqlcl_environment(config, base_env=base_env)
    sqlcl_path = find_sqlcl_binary(config.sqlcl_path, path_lookup=path_lookup)
    java_path = resolve_java_binary(config, path_lookup=path_lookup)

    sqlcl_version_result = command_runner([str(sqlcl_path), "-V"], environment)
    if sqlcl_version_result.returncode != 0:
        msg = f"SQLcl version check failed: {sqlcl_version_result.stderr.strip()}"
        raise SqlclPreflightError(msg)

    sqlcl_version = parse_sqlcl_version(sqlcl_version_result.stdout + sqlcl_version_result.stderr)
    if sqlcl_version < SQLCL_MINIMUM_VERSION:
        msg = f"SQLcl 25.2 or newer is required for MCP mode; found {'.'.join(str(part) for part in sqlcl_version)}."
        raise SqlclPreflightError(msg)

    java_version_result = command_runner([str(java_path), "-version"], environment)
    if java_version_result.returncode != 0:
        msg = f"Java version check failed: {java_version_result.stderr.strip()}"
        raise SqlclPreflightError(msg)

    java_major_version = parse_java_major_version(java_version_result.stdout + java_version_result.stderr)
    if java_major_version not in SUPPORTED_JAVA_MAJOR_VERSIONS:
        msg = f"JRE 17 or 21 is required for SQLcl MCP; found Java {java_major_version}."
        raise SqlclPreflightError(msg)

    return SqlclPreflightResult(
        sqlcl_path=sqlcl_path,
        sqlcl_version=sqlcl_version,
        java_path=java_path,
        java_major_version=java_major_version,
        environment=environment,
    )


class SqlclMcpService:
    """Own the lifecycle of one SQLcl MCP stdio process."""

    def __init__(
        self,
        config: SqlclMcpConfig,
        *,
        preflight: SqlclPreflightResult | None = None,
        process_factory: ProcessFactory | None = None,
    ) -> None:
        self._config = config
        self._preflight = preflight
        self._process_factory = process_factory or self._create_subprocess
        self._process: ManagedProcess | None = None

    @property
    def is_running(self) -> bool:
        """Return whether the managed SQLcl MCP process is still running."""
        return self._process is not None and self._process.returncode is None

    @property
    def command(self) -> tuple[str, ...]:
        """Return the command used to start SQLcl MCP."""
        if self._preflight is None:
            msg = "SQLcl MCP command is unavailable before preflight runs."
            raise SqlclMcpServiceError(msg)

        args = [str(self._preflight.sqlcl_path)]
        if self._config.restrict_level is not None:
            args.extend(("-R", str(self._config.restrict_level)))
        args.append("-mcp")
        return tuple(args)

    async def start(self) -> None:
        """Run preflight if needed and start SQLcl in MCP mode."""
        if self.is_running:
            msg = "SQLcl MCP service is already running."
            raise SqlclMcpServiceError(msg)

        if self._preflight is None:
            self._preflight = await asyncio.to_thread(run_sqlcl_preflight, self._config)

        self._process = await self._process_factory(self.command, self._preflight.environment)

        if self._process.returncode is not None:
            msg = f"SQLcl MCP process exited during startup with code {self._process.returncode}."
            raise SqlclMcpServiceError(msg)

    async def stop(self, *, timeout_seconds: float = 5.0) -> None:
        """Stop the managed SQLcl MCP process."""
        if self._process is None:
            return

        process = self._process
        if process.returncode is None:
            process.terminate()
            try:
                await asyncio.wait_for(process.wait(), timeout=timeout_seconds)
            except TimeoutError:
                process.kill()
                await process.wait()

        self._process = None

    async def __aenter__(self) -> Self:
        """Start the service when entering an async context manager."""
        await self.start()
        return self

    async def __aexit__(self, *_exc_info: object) -> None:
        """Stop the service when leaving an async context manager."""
        await self.stop()

    @staticmethod
    async def _create_subprocess(args: Sequence[str], environment: Mapping[str, str]) -> ManagedProcess:
        """Create the SQLcl MCP subprocess over stdio."""
        process = await asyncio.create_subprocess_exec(
            *args,
            stdin=asyncio.subprocess.PIPE,
            stdout=asyncio.subprocess.PIPE,
            stderr=asyncio.subprocess.PIPE,
            env=dict(environment),
        )
        return process
