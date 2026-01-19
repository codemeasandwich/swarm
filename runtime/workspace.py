"""Workspace setup and management for agent environments."""

from __future__ import annotations

import logging
import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List

logger = logging.getLogger(__name__)


@dataclass
class WorkspaceConfig:
    """Configuration for a workspace environment."""
    base_path: Path
    agent_id: str
    copy_files: list[str] = None  # Files to copy into workspace
    create_dirs: list[str] = None  # Directories to create


class WorkspaceManager:
    """Manages workspace directories for agent isolation."""

    def __init__(self, base_workspace_dir: Path):
        self.base_workspace_dir = Path(base_workspace_dir)
        self.base_workspace_dir.mkdir(parents=True, exist_ok=True)
        self._workspaces: dict[str, Path] = {}

    def create_sandbox(
        self,
        agent_id: str,
        subdirectory: Optional[str] = None,
    ) -> Path:
        """
        Create a workspace directory for an agent.

        The workspace is the working directory where the agent
        operates. In the shared repo model, this is just the
        sandbox/ subdirectory that agents are scoped to.

        Args:
            agent_id: The agent's unique identifier
            subdirectory: Optional subdirectory within workspace

        Returns:
            Path to the workspace directory
        """
        if subdirectory:
            workspace_path = self.base_workspace_dir / subdirectory
        else:
            workspace_path = self.base_workspace_dir

        workspace_path.mkdir(parents=True, exist_ok=True)
        self._workspaces[agent_id] = workspace_path

        logger.info(f"Created workspace for {agent_id} at {workspace_path}")
        return workspace_path

    def get_sandbox(self, agent_id: str) -> Optional[Path]:
        """Get the workspace path for an agent."""
        return self._workspaces.get(agent_id)

    def inject_file(
        self,
        agent_id: str,
        filename: str,
        content: str,
    ) -> Path:
        """
        Inject a file into an agent's workspace.

        Args:
            agent_id: The agent's identifier
            filename: Name of the file to create
            content: Content to write

        Returns:
            Path to the created file
        """
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            raise ValueError(f"No workspace found for agent {agent_id}")

        file_path = workspace / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)

        logger.info(f"Injected {filename} into {agent_id}'s workspace")
        return file_path

    def inject_claude_md(
        self,
        agent_id: str,
        content: str,
    ) -> Path:
        """
        Inject the .claude.md file into an agent's workspace.

        Args:
            agent_id: The agent's identifier
            content: The .claude.md content

        Returns:
            Path to the created file
        """
        return self.inject_file(agent_id, ".claude.md", content)

    def copy_file_to_sandbox(
        self,
        agent_id: str,
        source_path: Path,
        dest_filename: Optional[str] = None,
    ) -> Path:
        """
        Copy a file into an agent's workspace.

        Args:
            agent_id: The agent's identifier
            source_path: Path to the source file
            dest_filename: Optional destination filename

        Returns:
            Path to the copied file
        """
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            raise ValueError(f"No workspace found for agent {agent_id}")

        source = Path(source_path)
        dest_name = dest_filename or source.name
        dest_path = workspace / dest_name

        shutil.copy2(source, dest_path)
        logger.info(f"Copied {source} to {dest_path}")

        return dest_path

    def list_files(self, agent_id: str) -> List[Path]:
        """List all files in an agent's workspace."""
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            return []

        return list(workspace.rglob("*"))

    def read_file(self, agent_id: str, filename: str) -> Optional[str]:
        """Read a file from an agent's workspace."""
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            return None

        file_path = workspace / filename
        if file_path.exists():
            return file_path.read_text()
        return None

    def file_exists(self, agent_id: str, filename: str) -> bool:
        """Check if a file exists in an agent's workspace."""
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            return False

        return (workspace / filename).exists()

    def get_file_path(self, agent_id: str, filename: str) -> Optional[Path]:
        """Get the full path to a file in an agent's workspace."""
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            return None

        return workspace / filename

    def cleanup_sandbox(self, agent_id: str):
        """Clean up an agent's workspace (remove generated files, keep tracked)."""
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            return

        # Only remove .claude.md and other injected files
        # Leave the actual work files intact (they're tracked by git)
        claude_md = workspace / ".claude.md"
        if claude_md.exists():
            claude_md.unlink()
            logger.info(f"Cleaned up .claude.md for {agent_id}")

    def remove_sandbox(self, agent_id: str):
        """
        Remove an agent's workspace entry.

        Note: This doesn't delete files since they're shared in the repo.
        It just removes the tracking entry.
        """
        if agent_id in self._workspaces:
            del self._workspaces[agent_id]
            logger.info(f"Removed workspace entry for {agent_id}")

    def get_sandbox_stats(self, agent_id: str) -> dict:
        """Get statistics about an agent's workspace."""
        workspace = self.get_sandbox(agent_id)
        if not workspace:
            return {}

        files = list(workspace.rglob("*"))
        file_count = sum(1 for f in files if f.is_file())
        dir_count = sum(1 for f in files if f.is_dir())
        total_size = sum(f.stat().st_size for f in files if f.is_file())

        return {
            "path": str(workspace),
            "file_count": file_count,
            "directory_count": dir_count,
            "total_size_bytes": total_size,
        }


# Backwards compatibility alias
SandboxManager = WorkspaceManager
