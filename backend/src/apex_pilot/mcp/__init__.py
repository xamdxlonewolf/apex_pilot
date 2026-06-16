"""SQLcl MCP lifecycle and integration layer."""

from apex_pilot.mcp.sqlcl import (
    SQLCL_MINIMUM_VERSION,
    SUPPORTED_JAVA_MAJOR_VERSIONS,
    CommandResult,
    SqlclMcpConfig,
    SqlclMcpError,
    SqlclMcpService,
    SqlclMcpServiceError,
    SqlclPreflightError,
    SqlclPreflightResult,
    build_sqlcl_environment,
    find_sqlcl_binary,
    parse_java_major_version,
    parse_sqlcl_version,
    resolve_java_binary,
    run_sqlcl_preflight,
)

__all__ = [
    "SQLCL_MINIMUM_VERSION",
    "SUPPORTED_JAVA_MAJOR_VERSIONS",
    "CommandResult",
    "SqlclMcpConfig",
    "SqlclMcpError",
    "SqlclMcpService",
    "SqlclMcpServiceError",
    "SqlclPreflightError",
    "SqlclPreflightResult",
    "build_sqlcl_environment",
    "find_sqlcl_binary",
    "parse_java_major_version",
    "parse_sqlcl_version",
    "resolve_java_binary",
    "run_sqlcl_preflight",
]
