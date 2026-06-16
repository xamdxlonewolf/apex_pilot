"""Tests for SQLcl MCP preflight checks."""

import os
from collections.abc import Mapping, Sequence
from pathlib import Path

import pytest

from apex_pilot.mcp import (
    CommandResult,
    SqlclMcpConfig,
    SqlclPreflightError,
    build_sqlcl_environment,
    find_sqlcl_binary,
    parse_java_major_version,
    parse_sqlcl_version,
    run_sqlcl_preflight,
)


def test_parse_sqlcl_version_accepts_release_output() -> None:
    """SQLcl version parser handles Oracle release output."""
    assert parse_sqlcl_version("SQLcl: Release 25.2.0 Production") == (25, 2, 0)


def test_parse_java_major_version_accepts_openjdk_output() -> None:
    """Java parser reads modern Java version output."""
    assert parse_java_major_version('openjdk version "21.0.7" 2025-04-15') == 21


def test_find_sqlcl_binary_uses_explicit_existing_path(tmp_path: Path) -> None:
    """Explicit SQLcl path wins over PATH lookup."""
    sqlcl_path = tmp_path / "sql"
    sqlcl_path.write_text("", encoding="utf-8")

    assert find_sqlcl_binary(sqlcl_path) == sqlcl_path


def test_find_sqlcl_binary_reports_missing_path(tmp_path: Path) -> None:
    """Missing explicit SQLcl path fails with a preflight error."""
    with pytest.raises(SqlclPreflightError, match="does not exist"):
        find_sqlcl_binary(tmp_path / "missing-sql")


def test_build_sqlcl_environment_adds_tns_admin_and_java_home(tmp_path: Path) -> None:
    """SQLcl environment supports TNS_ADMIN and JAVA_HOME without secrets."""
    tns_admin = tmp_path / "tns"
    java_home = tmp_path / "java"
    tns_admin.mkdir()
    java_home.mkdir()

    environment = build_sqlcl_environment(
        SqlclMcpConfig(
            tns_admin=tns_admin,
            java_home=java_home,
            extra_env={"APEX_PILOT_TEST": "1"},
        ),
        base_env={"PATH": "test-path"},
    )

    assert environment["PATH"] == "test-path"
    assert environment["TNS_ADMIN"] == str(tns_admin)
    assert environment["JAVA_HOME"] == str(java_home)
    assert environment["APEX_PILOT_TEST"] == "1"


def test_build_sqlcl_environment_rejects_missing_tns_admin(tmp_path: Path) -> None:
    """Configured TNS_ADMIN must exist before SQLcl starts."""
    with pytest.raises(SqlclPreflightError, match="TNS_ADMIN"):
        build_sqlcl_environment(SqlclMcpConfig(tns_admin=tmp_path / "missing"))


def test_run_sqlcl_preflight_accepts_supported_sqlcl_and_java(tmp_path: Path) -> None:
    """Preflight succeeds with SQLcl 25.2+ and supported Java."""
    sqlcl_path = tmp_path / "sql"
    java_home = tmp_path / "java-home"
    java_bin = java_home / "bin"
    java_path = java_bin / ("java.exe" if os.name == "nt" else "java")
    sqlcl_path.write_text("", encoding="utf-8")
    java_bin.mkdir(parents=True)
    java_path.write_text("", encoding="utf-8")

    def runner(args: Sequence[str], _environment: Mapping[str, str]) -> CommandResult:
        if args == [str(sqlcl_path), "-V"]:
            return CommandResult(args=args, returncode=0, stdout="SQLcl: Release 25.2.1 Production")
        if args == [str(java_path), "-version"]:
            return CommandResult(args=args, returncode=0, stderr='openjdk version "17.0.12"')
        raise AssertionError(f"Unexpected command: {args}")

    result = run_sqlcl_preflight(
        SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
        command_runner=runner,
        base_env={},
    )

    assert result.sqlcl_path == sqlcl_path
    assert result.sqlcl_version == (25, 2, 1)
    assert result.java_path == java_path
    assert result.java_major_version == 17


def test_run_sqlcl_preflight_rejects_old_sqlcl(tmp_path: Path) -> None:
    """SQLcl older than 25.2 is rejected because MCP is unavailable."""
    sqlcl_path = tmp_path / "sql"
    java_home = tmp_path / "java-home"
    java_bin = java_home / "bin"
    java_path = java_bin / ("java.exe" if os.name == "nt" else "java")
    sqlcl_path.write_text("", encoding="utf-8")
    java_bin.mkdir(parents=True)
    java_path.write_text("", encoding="utf-8")

    def runner(args: Sequence[str], _environment: Mapping[str, str]) -> CommandResult:
        if args == [str(sqlcl_path), "-V"]:
            return CommandResult(args=args, returncode=0, stdout="SQLcl: Release 24.3.0 Production")
        if args == [str(java_path), "-version"]:
            return CommandResult(args=args, returncode=0, stderr='openjdk version "17.0.12"')
        raise AssertionError(f"Unexpected command: {args}")

    with pytest.raises(SqlclPreflightError, match="25.2 or newer"):
        run_sqlcl_preflight(
            SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
            command_runner=runner,
            base_env={},
        )


def test_run_sqlcl_preflight_rejects_unsupported_java(tmp_path: Path) -> None:
    """Java versions outside the SQLcl-supported set are rejected."""
    sqlcl_path = tmp_path / "sql"
    java_home = tmp_path / "java-home"
    java_bin = java_home / "bin"
    java_path = java_bin / ("java.exe" if os.name == "nt" else "java")
    sqlcl_path.write_text("", encoding="utf-8")
    java_bin.mkdir(parents=True)
    java_path.write_text("", encoding="utf-8")

    def runner(args: Sequence[str], _environment: Mapping[str, str]) -> CommandResult:
        if args == [str(sqlcl_path), "-V"]:
            return CommandResult(args=args, returncode=0, stdout="SQLcl: Release 25.2.0 Production")
        if args == [str(java_path), "-version"]:
            return CommandResult(args=args, returncode=0, stderr='openjdk version "11.0.23"')
        raise AssertionError(f"Unexpected command: {args}")

    with pytest.raises(SqlclPreflightError, match="JRE 17 or 21"):
        run_sqlcl_preflight(
            SqlclMcpConfig(sqlcl_path=sqlcl_path, java_home=java_home),
            command_runner=runner,
            base_env={},
        )


@pytest.mark.skipif(
    os.environ.get("APEX_PILOT_LIVE_SQLCL_PREFLIGHT") != "1",
    reason="Set APEX_PILOT_LIVE_SQLCL_PREFLIGHT=1 to run live SQLcl preflight.",
)
def test_live_sqlcl_preflight_from_environment() -> None:
    """Optionally validate a real SQLcl installation without connecting to Oracle."""
    configured_path = os.environ.get("APEX_PILOT_SQLCL_PATH")
    config = SqlclMcpConfig(sqlcl_path=Path(configured_path) if configured_path else None)

    result = run_sqlcl_preflight(config)

    assert result.sqlcl_version >= (25, 2)
    assert result.java_major_version in {17, 21}
