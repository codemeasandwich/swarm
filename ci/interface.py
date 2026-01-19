"""Abstract CI provider interface."""

from abc import ABC, abstractmethod
from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import Optional, Callable, Awaitable, Dict, Any, List


class BuildStatusType(Enum):
    """Status of a CI build."""
    PENDING = "pending"
    RUNNING = "running"
    SUCCESS = "success"
    FAILURE = "failure"
    CANCELLED = "cancelled"


class PRStatusType(Enum):
    """Status of a pull request."""
    OPEN = "open"
    MERGED = "merged"
    CLOSED = "closed"


@dataclass
class BuildStatus:
    """Status of a CI build."""
    run_id: str
    status: BuildStatusType
    branch: str
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    url: Optional[str] = None
    logs_url: Optional[str] = None
    error_message: Optional[str] = None

    def is_complete(self) -> bool:
        return self.status in (
            BuildStatusType.SUCCESS,
            BuildStatusType.FAILURE,
            BuildStatusType.CANCELLED,
        )

    def is_success(self) -> bool:
        return self.status == BuildStatusType.SUCCESS

    def to_dict(self) -> dict:
        return {
            "run_id": self.run_id,
            "status": self.status.value,
            "branch": self.branch,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "finished_at": self.finished_at.isoformat() if self.finished_at else None,
            "url": self.url,
            "logs_url": self.logs_url,
            "error_message": self.error_message,
        }


@dataclass
class PRInfo:
    """Information about a pull request."""
    pr_number: int
    url: str
    title: str
    source_branch: str
    target_branch: str
    status: PRStatusType = PRStatusType.OPEN
    created_at: Optional[datetime] = None
    merged_at: Optional[datetime] = None
    checks_passed: bool = False

    def is_merged(self) -> bool:
        return self.status == PRStatusType.MERGED

    def to_dict(self) -> dict:
        return {
            "pr_number": self.pr_number,
            "url": self.url,
            "title": self.title,
            "source_branch": self.source_branch,
            "target_branch": self.target_branch,
            "status": self.status.value,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "merged_at": self.merged_at.isoformat() if self.merged_at else None,
            "checks_passed": self.checks_passed,
        }


@dataclass
class CIEvent:
    """An event from the CI system."""
    event_id: str
    event_type: str  # build_success, build_failure, pr_merged, etc.
    branch: str
    timestamp: datetime = field(default_factory=datetime.now)
    agent_id: Optional[str] = None
    run_id: Optional[str] = None
    pr_number: Optional[int] = None
    payload: Dict[str, Any] = field(default_factory=dict)

    def to_dict(self) -> dict:
        return {
            "event_id": self.event_id,
            "event_type": self.event_type,
            "branch": self.branch,
            "timestamp": self.timestamp.isoformat(),
            "agent_id": self.agent_id,
            "run_id": self.run_id,
            "pr_number": self.pr_number,
            "payload": self.payload,
        }


class CIProvider(ABC):
    """
    Abstract base class for CI providers.

    Implementations can be for GitHub Actions, GitLab CI,
    Jenkins, or local testing.
    """

    @abstractmethod
    async def trigger_build(
        self,
        branch: str,
        config: Optional[Dict[str, Any]] = None
    ) -> str:
        """
        Trigger a CI build for a branch.

        Args:
            branch: The branch to build
            config: Optional build configuration

        Returns:
            The run ID for tracking
        """
        pass

    @abstractmethod
    async def get_build_status(self, run_id: str) -> BuildStatus:
        """
        Get the status of a build.

        Args:
            run_id: The build run ID

        Returns:
            BuildStatus with current state
        """
        pass

    @abstractmethod
    async def cancel_build(self, run_id: str) -> bool:
        """
        Cancel a running build.

        Args:
            run_id: The build run ID

        Returns:
            True if cancelled successfully
        """
        pass

    @abstractmethod
    async def create_pr(
        self,
        source_branch: str,
        target_branch: str,
        title: str,
        body: str = "",
    ) -> PRInfo:
        """
        Create a pull request.

        Args:
            source_branch: The source branch
            target_branch: The target branch
            title: PR title
            body: PR description

        Returns:
            PRInfo with the created PR details
        """
        pass

    @abstractmethod
    async def get_pr_status(self, pr_number: int) -> PRInfo:
        """
        Get the status of a pull request.

        Args:
            pr_number: The PR number

        Returns:
            PRInfo with current state
        """
        pass

    @abstractmethod
    async def merge_pr(self, pr_number: int) -> bool:
        """
        Merge a pull request.

        Args:
            pr_number: The PR number

        Returns:
            True if merged successfully
        """
        pass

    @abstractmethod
    async def subscribe(
        self,
        callback: Callable[[CIEvent], Awaitable[None]]
    ):
        """
        Subscribe to CI events.

        Args:
            callback: Async function to call when events occur
        """
        pass

    @abstractmethod
    async def unsubscribe(
        self,
        callback: Callable[[CIEvent], Awaitable[None]]
    ):
        """
        Unsubscribe from CI events.

        Args:
            callback: The callback to remove
        """
        pass

    # Optional convenience methods with default implementations

    async def wait_for_build(
        self,
        run_id: str,
        timeout: float = 300,
        poll_interval: float = 5,
    ) -> BuildStatus:
        """
        Wait for a build to complete.

        Args:
            run_id: The build run ID
            timeout: Maximum time to wait in seconds
            poll_interval: Time between status checks

        Returns:
            Final BuildStatus
        """
        import asyncio
        start_time = datetime.now()

        while True:
            status = await self.get_build_status(run_id)
            if status.is_complete():
                return status

            elapsed = (datetime.now() - start_time).total_seconds()
            if elapsed >= timeout:
                raise TimeoutError(f"Build {run_id} did not complete within {timeout}s")

            await asyncio.sleep(poll_interval)

    async def wait_for_pr_merge(
        self,
        pr_number: int,
        timeout: float = 600,
        poll_interval: float = 10,
    ) -> PRInfo:
        """
        Wait for a PR to be merged.

        Args:
            pr_number: The PR number
            timeout: Maximum time to wait in seconds
            poll_interval: Time between status checks

        Returns:
            Final PRInfo
        """
        import asyncio
        start_time = datetime.now()

        while True:
            pr_info = await self.get_pr_status(pr_number)
            if pr_info.is_merged():
                return pr_info

            if pr_info.status == PRStatusType.CLOSED:
                raise RuntimeError(f"PR {pr_number} was closed without merging")

            elapsed = (datetime.now() - start_time).total_seconds()
            if elapsed >= timeout:
                raise TimeoutError(f"PR {pr_number} was not merged within {timeout}s")

            await asyncio.sleep(poll_interval)
