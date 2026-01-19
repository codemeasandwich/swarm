"""Git branch management for agent isolation."""

import subprocess
from dataclasses import dataclass
from pathlib import Path
from typing import Optional, List
import logging

logger = logging.getLogger(__name__)


@dataclass
class BranchInfo:
    """Information about a git branch."""
    name: str
    agent_id: str
    task_id: Optional[str]
    created_at: str
    base_branch: str


class BranchManager:
    """Manages git branches for agent isolation."""

    def __init__(self, repo_dir: Path, integration_branch: str = "integration"):
        self.repo_dir = Path(repo_dir)
        self.integration_branch = integration_branch
        self._branches: dict[str, BranchInfo] = {}

    def _run_git(self, *args, check: bool = True) -> subprocess.CompletedProcess:
        """Run a git command."""
        cmd = ["git", *args]
        logger.debug(f"Running: {' '.join(cmd)}")
        return subprocess.run(
            cmd,
            cwd=str(self.repo_dir),
            capture_output=True,
            text=True,
            check=check,
        )

    def create_agent_branch(
        self,
        agent_id: str,
        task_id: Optional[str] = None,
        base_branch: Optional[str] = None,
    ) -> str:
        """
        Create a branch for an agent.

        Args:
            agent_id: The agent's unique identifier
            task_id: Optional task ID for the branch name
            base_branch: Branch to create from (default: integration)

        Returns:
            The created branch name
        """
        base = base_branch or self.integration_branch
        suffix = f"-{task_id}" if task_id else ""
        branch_name = f"agent/{agent_id}{suffix}"

        # Ensure we're on the base branch first
        self._run_git("checkout", base)
        self._run_git("pull", "--ff-only", check=False)  # Pull latest, don't fail if no remote

        # Create and checkout the new branch
        self._run_git("checkout", "-b", branch_name)

        logger.info(f"Created branch {branch_name} from {base}")

        # Record branch info
        result = self._run_git("log", "-1", "--format=%ci")
        self._branches[agent_id] = BranchInfo(
            name=branch_name,
            agent_id=agent_id,
            task_id=task_id,
            created_at=result.stdout.strip(),
            base_branch=base,
        )

        return branch_name

    def checkout_branch(self, branch_name: str):
        """Checkout an existing branch."""
        self._run_git("checkout", branch_name)
        logger.info(f"Checked out branch {branch_name}")

    def get_current_branch(self) -> str:
        """Get the current branch name."""
        result = self._run_git("rev-parse", "--abbrev-ref", "HEAD")
        return result.stdout.strip()

    def get_agent_branch(self, agent_id: str) -> Optional[str]:
        """Get the branch name for an agent."""
        info = self._branches.get(agent_id)
        return info.name if info else None

    def branch_exists(self, branch_name: str) -> bool:
        """Check if a branch exists."""
        result = self._run_git(
            "show-ref", "--verify", f"refs/heads/{branch_name}",
            check=False
        )
        return result.returncode == 0

    def setup_sparse_checkout(self, paths: List[str]):
        """
        Setup sparse checkout for specific paths.

        Args:
            paths: List of paths to include (e.g., ["sandbox/"])
        """
        # Enable sparse checkout
        self._run_git("config", "core.sparseCheckout", "true")

        # Write sparse-checkout file
        sparse_file = self.repo_dir / ".git" / "info" / "sparse-checkout"
        sparse_file.parent.mkdir(parents=True, exist_ok=True)
        sparse_file.write_text("\n".join(paths) + "\n")

        # Update working tree
        self._run_git("read-tree", "-mu", "HEAD")

        logger.info(f"Setup sparse checkout for: {paths}")

    def get_uncommitted_changes(self) -> List[str]:
        """Get list of files with uncommitted changes."""
        result = self._run_git("status", "--porcelain")
        changes = []
        for line in result.stdout.splitlines():
            if line.strip():
                # Format is "XY filename"
                changes.append(line[3:].strip())
        return changes

    def commit_changes(self, message: str, paths: Optional[List[str]] = None) -> Optional[str]:
        """
        Commit changes to the current branch.

        Args:
            message: Commit message
            paths: Specific paths to commit (default: all changes)

        Returns:
            Commit hash, or None if no changes
        """
        # Check if there are changes
        if not self.get_uncommitted_changes():
            logger.info("No changes to commit")
            return None

        # Stage changes
        if paths:
            for path in paths:
                self._run_git("add", path)
        else:
            self._run_git("add", "-A")

        # Commit
        self._run_git("commit", "-m", message)

        # Get commit hash
        result = self._run_git("rev-parse", "HEAD")
        commit_hash = result.stdout.strip()

        logger.info(f"Committed changes: {commit_hash[:8]}")
        return commit_hash

    def push_branch(self, branch_name: Optional[str] = None, set_upstream: bool = True) -> bool:
        """
        Push branch to remote.

        Args:
            branch_name: Branch to push (default: current branch)
            set_upstream: Set upstream tracking

        Returns:
            True if successful
        """
        branch = branch_name or self.get_current_branch()

        cmd = ["push"]
        if set_upstream:
            cmd.extend(["-u", "origin", branch])
        else:
            cmd.append(branch)

        result = self._run_git(*cmd, check=False)
        if result.returncode != 0:
            logger.error(f"Failed to push {branch}: {result.stderr}")
            return False

        logger.info(f"Pushed branch {branch}")
        return True

    def get_commits_since_base(self, base_branch: Optional[str] = None) -> List[str]:
        """Get list of commits since branching from base."""
        base = base_branch or self.integration_branch
        result = self._run_git("log", f"{base}..HEAD", "--oneline")
        return [line for line in result.stdout.splitlines() if line.strip()]

    def merge_to_integration(self, branch_name: str) -> bool:
        """
        Merge a branch into integration.

        Args:
            branch_name: Branch to merge

        Returns:
            True if successful
        """
        current = self.get_current_branch()

        try:
            self._run_git("checkout", self.integration_branch)
            self._run_git("merge", branch_name, "--no-ff", "-m", f"Merge {branch_name}")
            logger.info(f"Merged {branch_name} into {self.integration_branch}")
            return True
        except subprocess.CalledProcessError as e:
            logger.error(f"Merge failed: {e.stderr}")
            # Abort merge on failure
            self._run_git("merge", "--abort", check=False)
            return False
        finally:
            # Return to original branch
            self._run_git("checkout", current, check=False)

    def delete_branch(self, branch_name: str, force: bool = False):
        """Delete a branch."""
        flag = "-D" if force else "-d"
        self._run_git("branch", flag, branch_name)
        logger.info(f"Deleted branch {branch_name}")

    def get_diff_from_base(self, base_branch: Optional[str] = None) -> str:
        """Get diff of current branch from base."""
        base = base_branch or self.integration_branch
        result = self._run_git("diff", f"{base}...HEAD")
        return result.stdout

    def reset_to_base(self, base_branch: Optional[str] = None):
        """Reset current branch to base."""
        base = base_branch or self.integration_branch
        self._run_git("reset", "--hard", base)
        logger.info(f"Reset to {base}")

    def stash_changes(self) -> bool:
        """Stash any uncommitted changes."""
        if not self.get_uncommitted_changes():
            return False
        self._run_git("stash", "push", "-m", "auto-stash before reset")
        logger.info("Stashed changes")
        return True

    def pop_stash(self) -> bool:
        """Pop the most recent stash."""
        result = self._run_git("stash", "pop", check=False)
        if result.returncode != 0:
            logger.warning(f"Failed to pop stash: {result.stderr}")
            return False
        logger.info("Popped stash")
        return True
