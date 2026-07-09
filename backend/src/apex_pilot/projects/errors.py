"""Errors for project initialization and preflight."""

from __future__ import annotations


class ProjectError(RuntimeError):
    """Base error for project open/create/import failures."""


class ProjectGitError(ProjectError):
    """Raised when an installed-Git operation fails."""


class ProjectPreflightError(ProjectError):
    """Raised when project preflight cannot complete."""
