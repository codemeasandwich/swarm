"""Ralph Wiggum loop - continuous retry with context reset."""

import asyncio
from dataclasses import dataclass
from datetime import datetime
from enum import Enum
from pathlib import Path
from typing import Optional, Callable, Awaitable, List
import logging

from plan.models import Task, TaskStatus, ProjectPlan
from personas.models import AgentInstance, PersonaConfig, LifecycleState
from personas.generator import ClaudeMdGenerator
from spawner.terminal import TerminalManager, AgentProcess
from spawner.branch_manager import BranchManager
from spawner.sandbox import SandboxManager
from ci.interface import CIProvider, CIEvent
from ci.events import CIEventType

from .context import ContextSnapshot, ContextBuilder

logger = logging.getLogger(__name__)


class LoopResultType(Enum):
    """Result type from a Ralph Wiggum loop iteration."""
    TASK_COMPLETE = "task_complete"
    BLOCKED = "blocked"
    PR_CREATED = "pr_created"
    MAX_RETRIES = "max_retries"
    ERROR = "error"
    SHUTDOWN = "shutdown"


@dataclass
class LoopResult:
    """Result of a loop iteration."""
    result_type: LoopResultType
    task_id: Optional[str] = None
    summary: str = ""
    blocked_on: List[str] = None
    pr_url: Optional[str] = None
    error: Optional[str] = None
    spawn_count: int = 0
    retry_count: int = 0

    def __post_init__(self):
        if self.blocked_on is None:
            self.blocked_on = []


class RalphWiggumLoop:
    """
    The Ralph Wiggum loop - continuous retry mechanism with context reset.

    Named after the lovably persistent Ralph Wiggum from The Simpsons,
    this approach embraces iterative improvement over single-shot perfection.

    Key features:
    - Agents work until they hit a natural breakpoint
    - At breakpoints (task complete, blocked, PR created), agents are terminated
    - Fresh agents are spawned with a context summary, preventing context rot
    - CI events trigger immediate retry checks for blocked agents
    """

    def __init__(
        self,
        repo_dir: Path,
        plan: ProjectPlan,
        ci_provider: CIProvider,
        terminal_manager: TerminalManager,
        branch_manager: BranchManager,
        sandbox_manager: SandboxManager,
        comm_file_path: Path,
        max_retries: int = 100,
        retry_interval: float = 30.0,
        snapshot_dir: Optional[Path] = None,
    ):
        self.repo_dir = Path(repo_dir)
        self.plan = plan
        self.ci_provider = ci_provider
        self.terminal_manager = terminal_manager
        self.branch_manager = branch_manager
        self.sandbox_manager = sandbox_manager
        self.comm_file_path = Path(comm_file_path)
        self.max_retries = max_retries
        self.retry_interval = retry_interval
        self.snapshot_dir = Path(snapshot_dir) if snapshot_dir else repo_dir / "running" / "snapshots"

        self.context_builder = ContextBuilder(repo_dir)
        self.claude_md_generator = ClaudeMdGenerator(plan)

        self._running = False
        self._ci_event_queue: asyncio.Queue[CIEvent] = asyncio.Queue()

    async def run_agent_loop(
        self,
        agent: AgentInstance,
        task: Task,
    ) -> LoopResult:
        """
        Run the Ralph Wiggum loop for an agent.

        This method keeps spawning fresh agents until:
        - All tasks are complete
        - Max retries exceeded
        - Shutdown requested
        - Unrecoverable error

        Args:
            agent: The agent instance to run
            task: The initial task

        Returns:
            LoopResult with the final state
        """
        self._running = True
        current_task = task

        # Subscribe to CI events for this agent
        await self.ci_provider.subscribe(self._on_ci_event)

        try:
            while self._running and agent.retry_count < self.max_retries:
                # 1. Capture snapshot (for context summary)
                snapshot = self.context_builder.capture_snapshot(
                    agent, current_task, self.comm_file_path
                )
                self.context_builder.save_snapshot(snapshot, self.snapshot_dir)

                # 2. Build context summary for fresh agent
                context_summary = self.context_builder.build_context_summary(snapshot)

                # 3. Spawn fresh agent with context
                agent_process = await self._spawn_fresh_agent(
                    agent, current_task, context_summary
                )
                agent.increment_spawn()

                # 4. Wait for breakpoint
                result = await self._wait_for_breakpoint(agent, agent_process)

                # 5. Handle breakpoint
                if result.result_type == LoopResultType.TASK_COMPLETE:
                    # Task done - get next task or finish
                    logger.info(f"Agent {agent.agent_id} completed task {result.task_id}")

                    next_task = self._get_next_task(agent)
                    if next_task:
                        current_task = next_task
                        agent.set_working(current_task)
                        continue
                    else:
                        # No more tasks
                        agent.lifecycle_state = LifecycleState.COMPLETE
                        return result

                elif result.result_type == LoopResultType.BLOCKED:
                    # Blocked - terminate and wait for unblock
                    logger.info(f"Agent {agent.agent_id} blocked on {result.blocked_on}")
                    agent.set_blocked(result.blocked_on, result.summary)

                    # Terminate agent
                    self.terminal_manager.terminate(agent.agent_id)

                    # Wait for unblock signal
                    unblocked = await self._wait_for_unblock(agent, result.blocked_on)
                    if not unblocked:
                        # Timeout or shutdown
                        return result

                    # Continue loop with fresh spawn
                    agent.lifecycle_state = LifecycleState.IDLE
                    continue

                elif result.result_type == LoopResultType.PR_CREATED:
                    # PR created - terminate and wait for merge
                    logger.info(f"Agent {agent.agent_id} created PR: {result.pr_url}")
                    agent.set_pr_pending(result.pr_url)

                    # Terminate agent
                    self.terminal_manager.terminate(agent.agent_id)

                    # Wait for PR merge
                    merged = await self._wait_for_pr_merge(result.pr_url)
                    if not merged:
                        return result

                    # Continue to next task
                    next_task = self._get_next_task(agent)
                    if next_task:
                        current_task = next_task
                        agent.set_working(current_task)
                        continue
                    else:
                        agent.lifecycle_state = LifecycleState.COMPLETE
                        return result

                elif result.result_type == LoopResultType.ERROR:
                    # Error - increment retry and try again
                    logger.error(f"Agent {agent.agent_id} error: {result.error}")
                    agent.increment_retry()
                    self.terminal_manager.terminate(agent.agent_id)
                    continue

                else:
                    # Shutdown or unknown
                    return result

            # Max retries exceeded
            return LoopResult(
                result_type=LoopResultType.MAX_RETRIES,
                task_id=current_task.id if current_task else None,
                spawn_count=agent.spawn_count,
                retry_count=agent.retry_count,
            )

        finally:
            await self.ci_provider.unsubscribe(self._on_ci_event)
            self.terminal_manager.terminate(agent.agent_id)

    async def _spawn_fresh_agent(
        self,
        agent: AgentInstance,
        task: Task,
        context_summary: str,
    ) -> AgentProcess:
        """Spawn a fresh agent with context summary."""
        # Generate .claude.md with context
        claude_md_content = self.claude_md_generator.generate(
            agent.persona_config,
            task,
            agent.branch,
            context_summary,
        )

        # Inject into sandbox
        sandbox_path = self.sandbox_manager.get_sandbox(agent.agent_id)
        if not sandbox_path:
            sandbox_path = self.sandbox_manager.create_sandbox(agent.agent_id)

        self.sandbox_manager.inject_claude_md(agent.agent_id, claude_md_content)

        # Build initial prompt
        prompt = self._build_agent_prompt(agent, task)

        # Spawn the agent
        return self.terminal_manager.spawn_claude_agent(
            agent_id=agent.agent_id,
            prompt=prompt,
            working_dir=sandbox_path,
        )

    def _build_agent_prompt(self, agent: AgentInstance, task: Task) -> str:
        """Build the initial prompt for a Claude agent."""
        return f"""You are agent "{agent.agent_id}" ({agent.role}).

Your current task is: {task.id} - {task.description}

IMPORTANT: Read your .claude.md file for full context and instructions.

When you reach a natural stopping point (task complete, blocked, or PR created),
update communications.json with your breakpoint status:

For task complete:
  lifecycle_state: "complete"
  breakpoint: {{"type": "task_complete", "task_id": "{task.id}", "summary": "..."}}

For blocked:
  lifecycle_state: "blocked"
  breakpoint: {{"type": "blocked", "blocked_on": ["T001"], "reason": "..."}}

For PR created:
  lifecycle_state: "pr_pending"
  breakpoint: {{"type": "pr_created", "pr_url": "..."}}

Start by reading .claude.md and the current state of communications.json.
"""

    async def _wait_for_breakpoint(
        self,
        agent: AgentInstance,
        process: AgentProcess,
    ) -> LoopResult:
        """Wait for an agent to reach a breakpoint."""
        check_interval = 2.0  # Check every 2 seconds

        while self._running and process.is_running:
            # Check communications.json for breakpoint
            breakpoint = self._check_for_breakpoint(agent.agent_id)
            if breakpoint:
                return self._breakpoint_to_result(breakpoint)

            await asyncio.sleep(check_interval)

        # Process ended without breakpoint
        if not self._running:
            return LoopResult(result_type=LoopResultType.SHUTDOWN)

        # Check one more time for breakpoint
        breakpoint = self._check_for_breakpoint(agent.agent_id)
        if breakpoint:
            return self._breakpoint_to_result(breakpoint)

        # Process ended without proper breakpoint - treat as error
        return LoopResult(
            result_type=LoopResultType.ERROR,
            error="Agent process ended without signaling breakpoint",
        )

    def _check_for_breakpoint(self, agent_id: str) -> Optional[dict]:
        """Check communications.json for a breakpoint from an agent."""
        try:
            import json
            data = json.loads(self.comm_file_path.read_text())
            agent_data = data.get(agent_id, {})

            lifecycle_state = agent_data.get("lifecycle_state", "")
            breakpoint = agent_data.get("breakpoint")

            if lifecycle_state in ("complete", "blocked", "pr_pending") and breakpoint:
                return breakpoint

            return None
        except (json.JSONDecodeError, FileNotFoundError):
            return None

    def _breakpoint_to_result(self, breakpoint: dict) -> LoopResult:
        """Convert a breakpoint dict to a LoopResult."""
        bp_type = breakpoint.get("type", "")

        if bp_type == "task_complete":
            return LoopResult(
                result_type=LoopResultType.TASK_COMPLETE,
                task_id=breakpoint.get("task_id"),
                summary=breakpoint.get("summary", ""),
            )
        elif bp_type == "blocked":
            return LoopResult(
                result_type=LoopResultType.BLOCKED,
                blocked_on=breakpoint.get("blocked_on", []),
                summary=breakpoint.get("reason", ""),
            )
        elif bp_type == "pr_created":
            return LoopResult(
                result_type=LoopResultType.PR_CREATED,
                pr_url=breakpoint.get("pr_url"),
                task_id=breakpoint.get("task_id"),
            )
        else:
            return LoopResult(
                result_type=LoopResultType.ERROR,
                error=f"Unknown breakpoint type: {bp_type}",
            )

    async def _wait_for_unblock(
        self,
        agent: AgentInstance,
        blocked_on: List[str],
    ) -> bool:
        """Wait for blocking dependencies to be resolved."""
        while self._running and agent.retry_count < self.max_retries:
            # Check if all blockers are resolved
            if self._are_blockers_resolved(blocked_on):
                return True

            # Wait for CI event or timeout
            try:
                event = await asyncio.wait_for(
                    self._ci_event_queue.get(),
                    timeout=self.retry_interval,
                )

                # Check if this event resolves our blockers
                if self._event_resolves_blockers(event, blocked_on):
                    return True

            except asyncio.TimeoutError:
                # Periodic check
                agent.increment_retry()
                continue

        return False

    def _are_blockers_resolved(self, blocked_on: List[str]) -> bool:
        """Check if all blocking tasks are complete."""
        for task_id in blocked_on:
            task = self.plan.get_task_by_id(task_id)
            if task and task.status != TaskStatus.COMPLETE:
                return False
        return True

    def _event_resolves_blockers(self, event: CIEvent, blocked_on: List[str]) -> bool:
        """Check if a CI event resolves our blockers."""
        # Build success or PR merge might resolve blockers
        if event.event_type in (
            CIEventType.BUILD_SUCCESS.value,
            CIEventType.PR_MERGED.value,
        ):
            # Re-check blockers after this event
            return self._are_blockers_resolved(blocked_on)
        return False

    async def _wait_for_pr_merge(self, pr_url: str) -> bool:
        """Wait for a PR to be merged."""
        # Extract PR number from URL (simplified)
        # In practice, you'd parse the URL properly
        try:
            pr_info = await self.ci_provider.wait_for_pr_merge(
                pr_number=1,  # Would need to extract from URL
                timeout=600,
            )
            return pr_info.is_merged()
        except (TimeoutError, RuntimeError):
            return False

    def _get_next_task(self, agent: AgentInstance) -> Optional[Task]:
        """Get the next available task for an agent."""
        available = self.plan.get_available_tasks_for_role(agent.role)
        return available[0] if available else None

    async def _on_ci_event(self, event: CIEvent):
        """Handle CI events."""
        await self._ci_event_queue.put(event)

    def stop(self):
        """Stop the loop."""
        self._running = False
