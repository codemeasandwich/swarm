"""Configuration management for the orchestration system.

This module centralizes configuration values that were previously
hardcoded throughout the codebase. Values can be overridden via
environment variables.
"""

from __future__ import annotations

import os
from dataclasses import dataclass
from pathlib import Path


def _get_env_float(name: str, default: float) -> float:
    """Get a float from environment variable with fallback."""
    value = os.environ.get(name)
    if value is not None:
        try:
            return float(value)
        except ValueError:
            pass
    return default


def _get_env_int(name: str, default: int) -> int:
    """Get an int from environment variable with fallback."""
    value = os.environ.get(name)
    if value is not None:
        try:
            return int(value)
        except ValueError:
            pass
    return default


def _get_env_str(name: str, default: str) -> str:
    """Get a string from environment variable with fallback."""
    return os.environ.get(name, default)


@dataclass(frozen=True)
class AgentConfig:
    """Configuration for agent communication and polling."""

    # File paths
    comm_file: str = _get_env_str("ORCHESTRATION_COMM_FILE", "communications.json")

    # Polling intervals (seconds)
    poll_interval: float = _get_env_float("ORCHESTRATION_POLL_INTERVAL", 0.5)
    breakpoint_check_interval: float = _get_env_float("ORCHESTRATION_BREAKPOINT_CHECK_INTERVAL", 2.0)

    # Retry configuration
    max_retries: int = _get_env_int("ORCHESTRATION_MAX_RETRIES", 100)
    retry_interval: float = _get_env_float("ORCHESTRATION_RETRY_INTERVAL", 30.0)

    # Timeouts (seconds)
    pr_merge_timeout: int = _get_env_int("ORCHESTRATION_PR_MERGE_TIMEOUT", 600)
    process_timeout: int = _get_env_int("ORCHESTRATION_PROCESS_TIMEOUT", 300)

    # Git configuration
    integration_branch: str = _get_env_str("ORCHESTRATION_INTEGRATION_BRANCH", "integration")


# Global singleton instance
_config: AgentConfig | None = None


def get_config() -> AgentConfig:
    """Get the global configuration instance."""
    global _config
    if _config is None:
        _config = AgentConfig()
    return _config


def reset_config() -> None:
    """Reset the configuration (useful for testing)."""
    global _config
    _config = None
