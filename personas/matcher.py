"""Role-based task matching for personas."""

from typing import List, Optional, Dict, Set

from plan.models import ProjectPlan, Task, TaskStatus, Persona
from .models import PersonaConfig, AgentInstance


class PersonaMatcher:
    """Matches tasks to personas based on roles and capabilities."""

    def __init__(self, plan: ProjectPlan):
        self.plan = plan
        self._role_to_persona: Dict[str, Persona] = {
            p.role: p for p in plan.personas
        }

    def get_persona_for_role(self, role: str) -> Optional[Persona]:
        """Get the persona for a given role."""
        return self._role_to_persona.get(role)

    def get_all_roles(self) -> List[str]:
        """Get all roles defined in the plan."""
        return list(self._role_to_persona.keys())

    def get_claimable_tasks(self, persona: Persona) -> List[Task]:
        """
        Get all tasks that a persona can claim.
        Tasks must:
        - Match the persona's role
        - Be in AVAILABLE status
        - Have all dependencies satisfied
        """
        return self.plan.get_available_tasks_for_role(persona.role)

    def get_claimable_tasks_for_role(self, role: str) -> List[Task]:
        """Get all claimable tasks for a role."""
        persona = self.get_persona_for_role(role)
        if not persona:
            return []
        return self.get_claimable_tasks(persona)

    def get_blocked_tasks_for_role(self, role: str) -> List[Task]:
        """Get tasks for a role that are blocked by dependencies."""
        completed_ids = {
            t.id for t in self.plan.get_all_tasks()
            if t.status == TaskStatus.COMPLETE
        }

        blocked = []
        for task in self.plan.get_tasks_by_role(role):
            if task.status == TaskStatus.AVAILABLE:
                blocking = task.is_blocked_by(completed_ids)
                if blocking:
                    blocked.append(task)

        return blocked

    def get_blocking_tasks(self, task: Task) -> List[Task]:
        """Get the tasks that are blocking a given task."""
        completed_ids = {
            t.id for t in self.plan.get_all_tasks()
            if t.status == TaskStatus.COMPLETE
        }

        blocking_ids = task.is_blocked_by(completed_ids)
        return [
            self.plan.get_task_by_id(tid)
            for tid in blocking_ids
            if self.plan.get_task_by_id(tid)
        ]

    def get_tasks_blocked_by(self, task_id: str) -> List[Task]:
        """Get all tasks that are blocked by a given task."""
        blocked = []
        for t in self.plan.get_all_tasks():
            if task_id in t.dependencies:
                blocked.append(t)
        return blocked

    def claim_task(self, task: Task, agent_id: str) -> bool:
        """
        Attempt to claim a task for an agent.
        Returns True if successful, False if task is not available.
        """
        if task.status != TaskStatus.AVAILABLE:
            return False

        # Verify no unmet dependencies
        completed_ids = {
            t.id for t in self.plan.get_all_tasks()
            if t.status == TaskStatus.COMPLETE
        }
        if task.is_blocked_by(completed_ids):
            return False

        task.status = TaskStatus.CLAIMED
        task.assigned_agent = agent_id
        return True

    def start_task(self, task: Task) -> bool:
        """Mark a task as in progress."""
        if task.status != TaskStatus.CLAIMED:
            return False

        task.status = TaskStatus.IN_PROGRESS
        return True

    def complete_task(self, task: Task) -> bool:
        """Mark a task as complete."""
        if task.status not in (TaskStatus.IN_PROGRESS, TaskStatus.CLAIMED):
            return False

        task.status = TaskStatus.COMPLETE
        return True

    def get_role_workload(self) -> Dict[str, Dict[str, int]]:
        """
        Get workload statistics per role.
        Returns dict of role -> {available, blocked, in_progress, complete}
        """
        workload: Dict[str, Dict[str, int]] = {}

        for role in self.get_all_roles():
            workload[role] = {
                "available": 0,
                "blocked": 0,
                "in_progress": 0,
                "complete": 0,
            }

        completed_ids = {
            t.id for t in self.plan.get_all_tasks()
            if t.status == TaskStatus.COMPLETE
        }

        for task in self.plan.get_all_tasks():
            role = task.role
            if role not in workload:
                workload[role] = {
                    "available": 0,
                    "blocked": 0,
                    "in_progress": 0,
                    "complete": 0,
                }

            if task.status == TaskStatus.COMPLETE:
                workload[role]["complete"] += 1
            elif task.status == TaskStatus.IN_PROGRESS:
                workload[role]["in_progress"] += 1
            elif task.status == TaskStatus.AVAILABLE:
                if task.is_blocked_by(completed_ids):
                    workload[role]["blocked"] += 1
                else:
                    workload[role]["available"] += 1

        return workload

    def should_spawn_agent(self, role: str, active_agents: List[AgentInstance]) -> bool:
        """
        Determine if a new agent should be spawned for a role.
        Spawn if:
        - There are claimable tasks for this role
        - There is no active agent for this role
        """
        # Check if there's an active agent for this role
        for agent in active_agents:
            if agent.role == role and agent.is_active():
                return False

        # Check if there are claimable tasks
        claimable = self.get_claimable_tasks_for_role(role)
        return len(claimable) > 0

    def get_next_task_for_agent(self, agent: AgentInstance) -> Optional[Task]:
        """Get the next task for an agent after completing one."""
        claimable = self.get_claimable_tasks_for_role(agent.role)
        if claimable:
            return claimable[0]
        return None
