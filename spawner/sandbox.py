"""Sandbox setup and management for agent workspaces."""

import shutil
from dataclasses import dataclass
from pathlib import Path
from typing import Optional
import logging

logger = logging.getLogger(__name__)


@dataclass
class SandboxConfig:
    """Configuration for a sandbox environment."""
    base_path: Path
    agent_id: str
    copy_files: list[str] = None  # Files to copy into sandbox
    create_dirs: list[str] = None  # Directories to create


class SandboxManager:
    """Manages sandbox directories for agent isolation."""

    def __init__(self, base_sandbox_dir: Path):
        self.base_sandbox_dir = Path(base_sandbox_dir)
        self.base_sandbox_dir.mkdir(parents=True, exist_ok=True)
        self._sandboxes: dict[str, Path] = {}

    def create_sandbox(
        self,
        agent_id: str,
        subdirectory: Optional[str] = None,
    ) -> Path:
        """
        Create a sandbox directory for an agent.

        The sandbox is the working directory where the agent
        operates. In the shared repo model, this is just the
        sandbox/ subdirectory that agents are scoped to.

        Args:
            agent_id: The agent's unique identifier
            subdirectory: Optional subdirectory within sandbox

        Returns:
            Path to the sandbox directory
        """
        if subdirectory:
            sandbox_path = self.base_sandbox_dir / subdirectory
        else:
            sandbox_path = self.base_sandbox_dir

        sandbox_path.mkdir(parents=True, exist_ok=True)
        self._sandboxes[agent_id] = sandbox_path

        logger.info(f"Created sandbox for {agent_id} at {sandbox_path}")
        return sandbox_path

    def get_sandbox(self, agent_id: str) -> Optional[Path]:
        """Get the sandbox path for an agent."""
        return self._sandboxes.get(agent_id)

    def inject_file(
        self,
        agent_id: str,
        filename: str,
        content: str,
    ) -> Path:
        """
        Inject a file into an agent's sandbox.

        Args:
            agent_id: The agent's identifier
            filename: Name of the file to create
            content: Content to write

        Returns:
            Path to the created file
        """
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            raise ValueError(f"No sandbox found for agent {agent_id}")

        file_path = sandbox / filename
        file_path.parent.mkdir(parents=True, exist_ok=True)
        file_path.write_text(content)

        logger.info(f"Injected {filename} into {agent_id}'s sandbox")
        return file_path

    def inject_claude_md(
        self,
        agent_id: str,
        content: str,
    ) -> Path:
        """
        Inject the .claude.md file into an agent's sandbox.

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
        Copy a file into an agent's sandbox.

        Args:
            agent_id: The agent's identifier
            source_path: Path to the source file
            dest_filename: Optional destination filename

        Returns:
            Path to the copied file
        """
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            raise ValueError(f"No sandbox found for agent {agent_id}")

        source = Path(source_path)
        dest_name = dest_filename or source.name
        dest_path = sandbox / dest_name

        shutil.copy2(source, dest_path)
        logger.info(f"Copied {source} to {dest_path}")

        return dest_path

    def list_files(self, agent_id: str) -> list[Path]:
        """List all files in an agent's sandbox."""
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            return []

        return list(sandbox.rglob("*"))

    def read_file(self, agent_id: str, filename: str) -> Optional[str]:
        """Read a file from an agent's sandbox."""
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            return None

        file_path = sandbox / filename
        if file_path.exists():
            return file_path.read_text()
        return None

    def file_exists(self, agent_id: str, filename: str) -> bool:
        """Check if a file exists in an agent's sandbox."""
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            return False

        return (sandbox / filename).exists()

    def get_file_path(self, agent_id: str, filename: str) -> Optional[Path]:
        """Get the full path to a file in an agent's sandbox."""
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            return None

        return sandbox / filename

    def cleanup_sandbox(self, agent_id: str):
        """Clean up an agent's sandbox (remove generated files, keep tracked)."""
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            return

        # Only remove .claude.md and other injected files
        # Leave the actual work files intact (they're tracked by git)
        claude_md = sandbox / ".claude.md"
        if claude_md.exists():
            claude_md.unlink()
            logger.info(f"Cleaned up .claude.md for {agent_id}")

    def remove_sandbox(self, agent_id: str):
        """
        Remove an agent's sandbox entry.

        Note: This doesn't delete files since they're shared in the repo.
        It just removes the tracking entry.
        """
        if agent_id in self._sandboxes:
            del self._sandboxes[agent_id]
            logger.info(f"Removed sandbox entry for {agent_id}")

    def get_sandbox_stats(self, agent_id: str) -> dict:
        """Get statistics about an agent's sandbox."""
        sandbox = self.get_sandbox(agent_id)
        if not sandbox:
            return {}

        files = list(sandbox.rglob("*"))
        file_count = sum(1 for f in files if f.is_file())
        dir_count = sum(1 for f in files if f.is_dir())
        total_size = sum(f.stat().st_size for f in files if f.is_file())

        return {
            "path": str(sandbox),
            "file_count": file_count,
            "directory_count": dir_count,
            "total_size_bytes": total_size,
        }
