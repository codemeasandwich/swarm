"""Local CI provider for testing without external CI systems."""

from __future__ import annotations

import asyncio
import logging
import subprocess
import uuid
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, Callable, Awaitable, Any

from .interface import (
    CIProvider,
    BuildStatus,
    BuildStatusType,
    PRInfo,
    PRStatusType,
    CIEvent,
)
from .events import CIEventEmitter, CIEventType

logger = logging.getLogger(__name__)


@dataclass
class LocalBuild:
    """Represents a local CI build."""
    run_id: str
    branch: str
    command: str
    status: BuildStatusType = BuildStatusType.PENDING
    started_at: Optional[datetime] = None
    finished_at: Optional[datetime] = None
    output: str = ""
    error: str = ""
    return_code: Optional[int] = None


@dataclass
class LocalPR:
    """Represents a local PR (simulated)."""
    pr_number: int
    source_branch: str
    target_branch: str
    title: str
    body: str = ""
    status: PRStatusType = PRStatusType.OPEN
    created_at: datetime = field(default_factory=datetime.now)
    merged_at: Optional[datetime] = None
    checks_passed: bool = False


class LocalCIProvider(CIProvider):
    """
    Local CI provider that runs tests locally.

    This is useful for:
    - Testing the orchestration system without external CI
    - Development and debugging
    - Environments without CI access
    """

    def __init__(
        self,
        repo_dir: Path,
        test_command: str = "pytest",
        build_command: str = "python -m py_compile",
        event_emitter: Optional[CIEventEmitter] = None,
    ):
        self.repo_dir = Path(repo_dir)
        self.test_command = test_command
        self.build_command = build_command
        self.event_emitter = event_emitter or CIEventEmitter()

        self._builds: Dict[str, LocalBuild] = {}
        self._prs: Dict[int, LocalPR] = {}
        self._next_pr_number = 1
        self._subscribers: List[Callable[[CIEvent], Awaitable[None]]] = []

    async def trigger_build(
        self,
        branch: str,
        config: Optional[Dict[str, Any]] = None
    ) -> str:
        """Trigger a local build/test run."""
        run_id = str(uuid.uuid4())[:8]

        # Determine command based on config
        command = config.get("command") if config else None
        if not command:
            command = self.test_command

        build = LocalBuild(
            run_id=run_id,
            branch=branch,
            command=command,
        )
        self._builds[run_id] = build

        # Run the build asynchronously
        asyncio.create_task(self._run_build(build))

        logger.info(f"Triggered local build {run_id} for {branch}")
        return run_id

    async def _run_build(self, build: LocalBuild):
        """Execute a build in the background."""
        build.status = BuildStatusType.RUNNING
        build.started_at = datetime.now()

        # Emit build started event
        await self.event_emitter.emit(CIEvent(
            event_id=str(uuid.uuid4()),
            event_type=CIEventType.BUILD_STARTED.value,
            branch=build.branch,
            run_id=build.run_id,
        ))

        try:
            # Run the command
            process = await asyncio.create_subprocess_shell(
                build.command,
                cwd=str(self.repo_dir),
                stdout=asyncio.subprocess.PIPE,
                stderr=asyncio.subprocess.PIPE,
            )

            stdout, stderr = await process.communicate()

            build.output = stdout.decode() if stdout else ""
            build.error = stderr.decode() if stderr else ""
            build.return_code = process.returncode
            build.finished_at = datetime.now()

            if process.returncode == 0:
                build.status = BuildStatusType.SUCCESS
                await self.event_emitter.emit_build_success(
                    branch=build.branch,
                    run_id=build.run_id,
                )
            else:
                build.status = BuildStatusType.FAILURE
                await self.event_emitter.emit_build_failure(
                    branch=build.branch,
                    run_id=build.run_id,
                    error_message=build.error[:500],
                )

        except Exception as e:
            build.status = BuildStatusType.FAILURE
            build.error = str(e)
            build.finished_at = datetime.now()

            await self.event_emitter.emit_build_failure(
                branch=build.branch,
                run_id=build.run_id,
                error_message=str(e),
            )

        logger.info(f"Build {build.run_id} completed with status {build.status.value}")

    async def get_build_status(self, run_id: str) -> BuildStatus:
        """Get status of a local build."""
        build = self._builds.get(run_id)
        if not build:
            raise ValueError(f"Unknown build: {run_id}")

        return BuildStatus(
            run_id=build.run_id,
            status=build.status,
            branch=build.branch,
            started_at=build.started_at,
            finished_at=build.finished_at,
            error_message=build.error[:500] if build.error else None,
        )

    async def cancel_build(self, run_id: str) -> bool:
        """Cancel a local build (best effort)."""
        build = self._builds.get(run_id)
        if not build:
            return False

        if build.status == BuildStatusType.RUNNING:
            build.status = BuildStatusType.CANCELLED
            build.finished_at = datetime.now()
            logger.info(f"Cancelled build {run_id}")
            return True

        return False

    async def create_pr(
        self,
        source_branch: str,
        target_branch: str,
        title: str,
        body: str = "",
    ) -> PRInfo:
        """Create a simulated PR."""
        pr_number = self._next_pr_number
        self._next_pr_number += 1

        pr = LocalPR(
            pr_number=pr_number,
            source_branch=source_branch,
            target_branch=target_branch,
            title=title,
            body=body,
        )
        self._prs[pr_number] = pr

        # Emit PR created event
        await self.event_emitter.emit(CIEvent(
            event_id=str(uuid.uuid4()),
            event_type=CIEventType.PR_CREATED.value,
            branch=source_branch,
            pr_number=pr_number,
        ))

        logger.info(f"Created local PR #{pr_number}: {title}")

        # Auto-run checks
        asyncio.create_task(self._run_pr_checks(pr))

        return PRInfo(
            pr_number=pr_number,
            url=f"local://pr/{pr_number}",
            title=title,
            source_branch=source_branch,
            target_branch=target_branch,
            status=pr.status,
            created_at=pr.created_at,
        )

    async def _run_pr_checks(self, pr: LocalPR):
        """Run checks on a PR."""
        # Trigger a build for the PR
        run_id = await self.trigger_build(pr.source_branch)

        # Wait for completion
        while True:
            status = await self.get_build_status(run_id)
            if status.is_complete():
                pr.checks_passed = status.is_success()

                event_type = (
                    CIEventType.PR_CHECKS_PASSED
                    if pr.checks_passed
                    else CIEventType.PR_CHECKS_FAILED
                )
                await self.event_emitter.emit(CIEvent(
                    event_id=str(uuid.uuid4()),
                    event_type=event_type.value,
                    branch=pr.source_branch,
                    pr_number=pr.pr_number,
                ))
                break

            await asyncio.sleep(1)

    async def get_pr_status(self, pr_number: int) -> PRInfo:
        """Get status of a PR."""
        pr = self._prs.get(pr_number)
        if not pr:
            raise ValueError(f"Unknown PR: {pr_number}")

        return PRInfo(
            pr_number=pr.pr_number,
            url=f"local://pr/{pr_number}",
            title=pr.title,
            source_branch=pr.source_branch,
            target_branch=pr.target_branch,
            status=pr.status,
            created_at=pr.created_at,
            merged_at=pr.merged_at,
            checks_passed=pr.checks_passed,
        )

    async def merge_pr(self, pr_number: int) -> bool:
        """Merge a PR locally."""
        pr = self._prs.get(pr_number)
        if not pr:
            return False

        if pr.status != PRStatusType.OPEN:
            logger.warning(f"PR {pr_number} is not open")
            return False

        if not pr.checks_passed:
            logger.warning(f"PR {pr_number} checks have not passed")
            return False

        # Perform local git merge
        try:
            # Checkout target and merge source
            subprocess.run(
                ["git", "checkout", pr.target_branch],
                cwd=str(self.repo_dir),
                check=True,
                capture_output=True,
            )
            subprocess.run(
                ["git", "merge", pr.source_branch, "--no-ff", "-m",
                 f"Merge PR #{pr_number}: {pr.title}"],
                cwd=str(self.repo_dir),
                check=True,
                capture_output=True,
            )

            pr.status = PRStatusType.MERGED
            pr.merged_at = datetime.now()

            # Emit merged event
            await self.event_emitter.emit_pr_merged(
                branch=pr.source_branch,
                pr_number=pr_number,
            )

            logger.info(f"Merged PR #{pr_number}")
            return True

        except subprocess.CalledProcessError as e:
            logger.error(f"Failed to merge PR {pr_number}: {e.stderr}")
            # Abort merge
            subprocess.run(
                ["git", "merge", "--abort"],
                cwd=str(self.repo_dir),
                check=False,
            )
            return False

    async def subscribe(
        self,
        callback: Callable[[CIEvent], Awaitable[None]]
    ):
        """Subscribe to CI events."""
        self._subscribers.append(callback)
        await self.event_emitter.subscribe(callback)

    async def unsubscribe(
        self,
        callback: Callable[[CIEvent], Awaitable[None]]
    ):
        """Unsubscribe from CI events."""
        if callback in self._subscribers:
            self._subscribers.remove(callback)
        await self.event_emitter.unsubscribe(callback)

    # Local-specific methods

    def get_all_builds(self) -> List[LocalBuild]:
        """Get all builds (local-specific)."""
        return list(self._builds.values())

    def get_all_prs(self) -> List[LocalPR]:
        """Get all PRs (local-specific)."""
        return list(self._prs.values())

    def get_build_output(self, run_id: str) -> Optional[str]:
        """Get full build output (local-specific)."""
        build = self._builds.get(run_id)
        return build.output if build else None

    def get_build_error(self, run_id: str) -> Optional[str]:
        """Get full build error output (local-specific)."""
        build = self._builds.get(run_id)
        return build.error if build else None
