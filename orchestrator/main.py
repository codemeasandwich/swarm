"""Main orchestrator - coordinates all agents and manages the project lifecycle."""

from __future__ import annotations

import asyncio
import json
import logging
import threading
from dataclasses import dataclass
from datetime import datetime
from pathlib import Path
from typing import Optional, Any


class OrchestratorError(Exception):
    """Base exception for orchestrator errors."""
    pass


class PlanParseError(OrchestratorError):
    """Raised when plan parsing fails."""
    pass


class PlanValidationError(OrchestratorError):
    """Raised when plan validation fails."""
    pass


class AgentSpawnError(OrchestratorError):
    """Raised when agent spawning fails."""
    pass

from plan.models import ProjectPlan, Task, TaskStatus
from plan.parser import PlanParser
from plan.validator import PlanValidator
from personas.models import PersonaConfig, AgentInstance, LifecycleState
from personas.matcher import PersonaMatcher
from personas.generator import ClaudeMdGenerator
from runtime.process import TerminalManager
from runtime.branches import BranchManager
from runtime.workspace import WorkspaceManager
from ci.interface import CIProvider, CIEvent
from ci.local import LocalCIProvider
from ci.events import CIEventEmitter, CIEventType
from lifecycle.loop import AgentLifecycleLoop, LoopResult, LoopResultType
from communication.core import CommunicationsFile, EnhancedAgentStatus

logger = logging.getLogger(__name__)


@dataclass
class OrchestratorConfig:
    """Configuration for the orchestrator."""
    repo_dir: Path
    plan_dir: Path
    sandbox_dir: Optional[Path] = None
    integration_branch: str = "integration"
    max_retries: int = 100
    retry_interval: float = 30.0
    auto_spawn: bool = True
    auto_merge: bool = False  # Require human approval for milestone merges

    def __post_init__(self):
        self.repo_dir = Path(self.repo_dir)
        self.plan_dir = Path(self.plan_dir)
        if self.sandbox_dir:
            self.sandbox_dir = Path(self.sandbox_dir)
        else:
            self.sandbox_dir = self.repo_dir / "sandbox"


class Orchestrator:
    """
    Main orchestrator for multi-agent coordination.

    This is the entry point for the framework. It:
    - Parses and validates the project plan
    - Spawns agents for each role with available tasks
    - Manages agent lifecycles with Ralph Wiggum loops
    - Coordinates CI events for unblocking
    - Handles milestone completion and PR creation
    """

    def __init__(
        self,
        config: OrchestratorConfig,
        ci_provider: Optional[CIProvider] = None,
    ):
        self.config = config

        # Initialize components
        self.comm_file = CommunicationsFile(str(config.repo_dir / "communications.json"))
        self.terminal_manager = TerminalManager(config.repo_dir)
        self.branch_manager = BranchManager(config.repo_dir, config.integration_branch)
        self.workspace_manager = WorkspaceManager(config.sandbox_dir)

        # CI provider (default to local)
        self.event_emitter = CIEventEmitter()
        self.ci_provider = ci_provider or LocalCIProvider(
            config.repo_dir,
            event_emitter=self.event_emitter,
        )

        # State
        self.plan: Optional[ProjectPlan] = None
        self.persona_matcher: Optional[PersonaMatcher] = None
        self.agents: Dict[str, AgentInstance] = {}
        self._agent_loops: Dict[str, asyncio.Task] = {}
        self._running = False
        self._task_lock = threading.Lock()  # Lock for task claiming to prevent race conditions

    async def start(self, plan_dir: Optional[Path] = None) -> bool:
        """
        Start the orchestrator with a project plan.

        Args:
            plan_dir: Path to the plan directory (default: config.plan_dir)

        Returns:
            True if started successfully
        """
        plan_dir = Path(plan_dir) if plan_dir else self.config.plan_dir

        # Parse the plan
        parser = PlanParser()
        try:
            self.plan = parser.parse_plan(plan_dir)
        except FileNotFoundError as e:
            logger.error(f"Plan directory not found: {plan_dir}")
            raise PlanParseError(f"Plan directory not found: {plan_dir}") from e
        except json.JSONDecodeError as e:
            logger.error(f"Invalid JSON in plan files: {e}")
            raise PlanParseError(f"Invalid JSON in plan files: {e}") from e
        except Exception as e:
            logger.error(f"Failed to parse plan: {e}")
            raise PlanParseError(f"Failed to parse plan: {e}") from e

        # Validate the plan
        validator = PlanValidator()
        result = validator.validate(self.plan)
        if not result.is_valid:
            error_msg = "Plan validation failed: " + "; ".join(result.errors)
            logger.error(error_msg)
            raise PlanValidationError(error_msg)

        for warning in result.warnings:
            logger.warning(f"Plan warning: {warning}")

        # Initialize matcher
        self.persona_matcher = PersonaMatcher(self.plan)

        # Reset communications file
        self._reset_communications()

        self._running = True
        logger.info(f"Orchestrator started with plan: {self.plan.name}")

        # Spawn initial agents if auto_spawn enabled
        if self.config.auto_spawn:
            await self._spawn_initial_agents()

        return True

    def _reset_communications(self):
        """Reset communications.json to initial state."""
        comm_path = self.config.repo_dir / "communications.json"
        initial = {
            "_meta": {
                "version": "1.0",
                "last_updated": datetime.now().isoformat(),
                "last_updated_by": "orchestrator",
                "project": self.plan.name if self.plan else "unknown",
            }
        }
        comm_path.write_text(json.dumps(initial, indent=2))

    async def _spawn_initial_agents(self):
        """Spawn agents for roles with available tasks."""
        if not self.plan or not self.persona_matcher:
            return

        for persona in self.plan.personas:
            available_tasks = self.persona_matcher.get_claimable_tasks(persona)
            if available_tasks:
                await self.spawn_agent(persona.role, available_tasks[0])

    async def spawn_agent(self, role: str, task: Task) -> AgentInstance:
        """
        Spawn a new agent for a role and task.

        Args:
            role: The role for the agent
            task: The task to assign

        Returns:
            AgentInstance if successful

        Raises:
            AgentSpawnError: If agent spawning fails
        """
        if not self.plan:
            raise AgentSpawnError("No plan loaded")

        # Get persona for role
        persona = self.plan.get_persona_by_role(role)
        if not persona:
            raise AgentSpawnError(f"No persona found for role: {role}")

        # Create agent instance
        agent_id = f"{role}-{task.id}"

        try:
            branch_name = self.branch_manager.create_agent_branch(agent_id, task.id)
        except Exception as e:
            raise AgentSpawnError(f"Failed to create branch for agent {agent_id}: {e}") from e

        agent = AgentInstance(
            agent_id=agent_id,
            persona_config=PersonaConfig(persona=persona),
            branch=branch_name,
            sandbox_path=str(self.config.sandbox_dir),
            lifecycle_state=LifecycleState.IDLE,
            current_task=task,
            started_at=datetime.now(),
        )

        # Setup workspace
        try:
            self.workspace_manager.create_sandbox(agent_id)
        except Exception as e:
            raise AgentSpawnError(f"Failed to create workspace for agent {agent_id}: {e}") from e

        # Claim the task with lock to prevent race conditions
        if self.persona_matcher:
            with self._task_lock:
                if task.status != TaskStatus.NOT_STARTED:
                    raise AgentSpawnError(f"Task {task.id} is no longer available (status: {task.status})")
                self.persona_matcher.claim_task(task, agent_id)

        # Register agent
        self.agents[agent_id] = agent

        # Update communications
        status = EnhancedAgentStatus(
            agent_id=agent_id,
            role=role,
            branch=branch_name,
            lifecycle_state="working",
            current_task_id=task.id,
            mission=f"Complete task {task.id}: {task.description}",
            working_on=task.description,
        )
        self.comm_file.update_agent(agent_id, status)

        logger.info(f"Spawned agent {agent_id} for task {task.id}")

        # Start lifecycle loop
        loop = AgentLifecycleLoop(
            repo_dir=self.config.repo_dir,
            plan=self.plan,
            ci_provider=self.ci_provider,
            terminal_manager=self.terminal_manager,
            branch_manager=self.branch_manager,
            workspace_manager=self.workspace_manager,
            comm_file_path=self.config.repo_dir / "communications.json",
            max_retries=self.config.max_retries,
            retry_interval=self.config.retry_interval,
        )

        # Run loop in background
        loop_task = asyncio.create_task(
            self._run_agent_loop(agent, task, loop)
        )
        self._agent_loops[agent_id] = loop_task

        return agent

    async def _run_agent_loop(
        self,
        agent: AgentInstance,
        task: Task,
        loop: AgentLifecycleLoop,
    ):
        """Run the lifecycle loop for an agent."""
        try:
            result = await loop.run_agent_loop(agent, task)

            # Handle result
            if result.result_type == LoopResultType.TASK_COMPLETE:
                logger.info(f"Agent {agent.agent_id} completed all tasks")
                agent.lifecycle_state = LifecycleState.COMPLETE

            elif result.result_type == LoopResultType.MAX_RETRIES:
                logger.error(f"Agent {agent.agent_id} exceeded max retries")
                agent.lifecycle_state = LifecycleState.FAILED

            elif result.result_type == LoopResultType.ERROR:
                logger.error(f"Agent {agent.agent_id} failed: {result.error}")
                agent.lifecycle_state = LifecycleState.FAILED

            # Check if milestone is complete
            await self._check_milestone_completion()

        except asyncio.CancelledError:
            logger.info(f"Agent loop for {agent.agent_id} was cancelled")
            raise
        except Exception as e:
            logger.exception(f"Error in agent loop for {agent.agent_id}: {e}")
            agent.lifecycle_state = LifecycleState.FAILED
        finally:
            # Clean up the loop reference to prevent memory leaks
            if agent.agent_id in self._agent_loops:
                del self._agent_loops[agent.agent_id]

    async def _check_milestone_completion(self):
        """Check if any milestones are complete and create PRs."""
        if not self.plan:
            return

        for milestone in self.plan.milestones:
            if milestone.completed:
                continue

            if self.plan.is_milestone_complete(milestone.id):
                logger.info(f"Milestone {milestone.id} is complete!")

                if self.config.auto_merge:
                    # Create PR to main
                    pr_info = await self.ci_provider.create_pr(
                        source_branch=self.config.integration_branch,
                        target_branch="main",
                        title=f"Milestone: {milestone.name}",
                        body=self._generate_milestone_summary(milestone.id),
                    )
                    milestone.pr_url = pr_info.url
                    logger.info(f"Created milestone PR: {pr_info.url}")

                milestone.completed = True

    def _generate_milestone_summary(self, milestone_id: str) -> str:
        """Generate a summary for a milestone PR."""
        if not self.plan:
            return ""

        milestone = self.plan.get_milestone_by_id(milestone_id)
        if not milestone:
            return ""

        lines = [
            f"## Milestone: {milestone.name}",
            "",
            milestone.description,
            "",
            "### Completed Epics",
            "",
        ]

        for epic_id in milestone.epic_ids:
            epic = self.plan.get_epic_by_id(epic_id)
            if epic:
                lines.append(f"- **{epic.id}**: {epic.title}")
                for story in epic.stories:
                    lines.append(f"  - {story.id}: {story.title}")

        lines.extend([
            "",
            "---",
            "Generated by Multi-Agent Orchestration Framework",
        ])

        return "\n".join(lines)

    def status(self) -> Dict[str, Any]:
        """Get current orchestrator status."""
        agent_status = {}
        for agent_id, agent in self.agents.items():
            agent_status[agent_id] = {
                "role": agent.role,
                "lifecycle_state": agent.lifecycle_state.value,
                "current_task": agent.current_task.id if agent.current_task else None,
                "branch": agent.branch,
                "spawn_count": agent.spawn_count,
                "retry_count": agent.retry_count,
            }

        return {
            "running": self._running,
            "project": self.plan.name if self.plan else None,
            "agents": agent_status,
            "active_loops": list(self._agent_loops.keys()),
        }

    def get_milestone_pr(self, milestone_id: str) -> Optional[str]:
        """Get the PR URL for a milestone."""
        if not self.plan:
            return None
        milestone = self.plan.get_milestone_by_id(milestone_id)
        return milestone.pr_url if milestone else None

    async def stop(self):
        """Stop the orchestrator and all agents."""
        self._running = False

        # Cancel all agent loops
        for agent_id, loop_task in self._agent_loops.items():
            loop_task.cancel()
            try:
                await loop_task
            except asyncio.CancelledError:
                pass

        # Terminate all terminal processes
        self.terminal_manager.terminate_all()

        logger.info("Orchestrator stopped")

    async def wait_for_completion(self, timeout: Optional[float] = None) -> bool:
        """
        Wait for all agents to complete.

        Args:
            timeout: Maximum time to wait in seconds

        Returns:
            True if all agents completed, False on timeout
        """
        if not self._agent_loops:
            return True

        try:
            await asyncio.wait_for(
                asyncio.gather(*self._agent_loops.values(), return_exceptions=True),
                timeout=timeout,
            )
            return True
        except asyncio.TimeoutError:
            return False


# Convenience function for simple usage
async def run_orchestration(plan_dir: str, repo_dir: Optional[str] = None) -> Dict[str, Any]:
    """
    Run orchestration on a project plan.

    Args:
        plan_dir: Path to the plan directory
        repo_dir: Path to the repository (default: current directory)

    Returns:
        Final status dict

    Raises:
        PlanParseError: If plan parsing fails
        PlanValidationError: If plan validation fails
    """
    repo_dir = Path(repo_dir) if repo_dir else Path.cwd()
    plan_dir = Path(plan_dir)

    config = OrchestratorConfig(
        repo_dir=repo_dir,
        plan_dir=plan_dir,
    )

    orchestrator = Orchestrator(config)

    try:
        await orchestrator.start()
        await orchestrator.wait_for_completion()
        return orchestrator.status()

    finally:
        await orchestrator.stop()
