"""Dependency validation for project plans."""

from dataclasses import dataclass, field
from typing import List, Dict, Set, Optional

from .models import ProjectPlan, Task, Story, Epic, TaskStatus


@dataclass
class ValidationError:
    """A validation error in the plan."""
    level: str  # "error" or "warning"
    entity_type: str  # "task", "story", "epic", "milestone"
    entity_id: str
    message: str

    def __str__(self) -> str:
        return f"[{self.level.upper()}] {self.entity_type} {self.entity_id}: {self.message}"


@dataclass
class ValidationResult:
    """Result of plan validation."""
    is_valid: bool = True
    errors: List[ValidationError] = field(default_factory=list)
    warnings: List[ValidationError] = field(default_factory=list)

    def add_error(self, entity_type: str, entity_id: str, message: str):
        """Add an error."""
        self.errors.append(ValidationError("error", entity_type, entity_id, message))
        self.is_valid = False

    def add_warning(self, entity_type: str, entity_id: str, message: str):
        """Add a warning."""
        self.warnings.append(ValidationError("warning", entity_type, entity_id, message))


class PlanValidator:
    """Validates project plan integrity and dependencies."""

    def validate(self, plan: ProjectPlan) -> ValidationResult:
        """Run all validations on a project plan."""
        result = ValidationResult()

        self._validate_task_dependencies(plan, result)
        self._validate_story_dependencies(plan, result)
        self._validate_epic_dependencies(plan, result)
        self._validate_milestone_epics(plan, result)
        self._validate_task_roles(plan, result)
        self._validate_acceptance_criteria(plan, result)
        self._check_circular_dependencies(plan, result)

        return result

    def _validate_task_dependencies(self, plan: ProjectPlan, result: ValidationResult):
        """Validate that all task dependencies exist."""
        all_task_ids = {t.id for t in plan.get_all_tasks()}

        for task in plan.get_all_tasks():
            for dep_id in task.dependencies:
                if dep_id not in all_task_ids:
                    result.add_error(
                        "task", task.id,
                        f"Dependency '{dep_id}' does not exist"
                    )

    def _validate_story_dependencies(self, plan: ProjectPlan, result: ValidationResult):
        """Validate that all story dependencies exist."""
        all_story_ids = {s.id for s in plan.get_all_stories()}

        for story in plan.get_all_stories():
            for dep_id in story.dependencies:
                if dep_id not in all_story_ids:
                    result.add_error(
                        "story", story.id,
                        f"Dependency '{dep_id}' does not exist"
                    )

            for block_id in story.blocks:
                if block_id not in all_story_ids:
                    result.add_warning(
                        "story", story.id,
                        f"Blocks reference '{block_id}' does not exist"
                    )

    def _validate_epic_dependencies(self, plan: ProjectPlan, result: ValidationResult):
        """Validate that all epic dependencies exist."""
        all_epic_ids = {e.id for e in plan.epics}

        for epic in plan.epics:
            for dep_id in epic.dependencies:
                if dep_id not in all_epic_ids:
                    result.add_error(
                        "epic", epic.id,
                        f"Dependency '{dep_id}' does not exist"
                    )

    def _validate_milestone_epics(self, plan: ProjectPlan, result: ValidationResult):
        """Validate that all milestone epic references exist."""
        all_epic_ids = {e.id for e in plan.epics}

        for milestone in plan.milestones:
            for epic_id in milestone.epic_ids:
                if epic_id not in all_epic_ids:
                    result.add_error(
                        "milestone", milestone.id,
                        f"Epic reference '{epic_id}' does not exist"
                    )

    def _validate_task_roles(self, plan: ProjectPlan, result: ValidationResult):
        """Validate that all task roles have corresponding personas."""
        all_roles = {p.role for p in plan.personas}

        for task in plan.get_all_tasks():
            if task.role and task.role not in all_roles:
                result.add_warning(
                    "task", task.id,
                    f"Role '{task.role}' has no corresponding persona"
                )

    def _validate_acceptance_criteria(self, plan: ProjectPlan, result: ValidationResult):
        """Validate that stories have acceptance criteria."""
        for story in plan.get_all_stories():
            if not story.acceptance_criteria:
                result.add_warning(
                    "story", story.id,
                    "Story has no acceptance criteria"
                )

            # Check that test scenarios map to acceptance criteria
            ac_ids = {ac.id for ac in story.acceptance_criteria}
            for ts in story.test_scenarios:
                if ts.acceptance_criterion_id and ts.acceptance_criterion_id not in ac_ids:
                    result.add_warning(
                        "story", story.id,
                        f"Test scenario {ts.id} references non-existent acceptance criterion {ts.acceptance_criterion_id}"
                    )

    def _check_circular_dependencies(self, plan: ProjectPlan, result: ValidationResult):
        """Check for circular dependencies in tasks."""
        # Build dependency graph
        task_graph: Dict[str, Set[str]] = {}
        for task in plan.get_all_tasks():
            task_graph[task.id] = set(task.dependencies)

        # Check for cycles using DFS
        visited: Set[str] = set()
        rec_stack: Set[str] = set()

        def has_cycle(task_id: str, path: List[str]) -> Optional[List[str]]:
            visited.add(task_id)
            rec_stack.add(task_id)

            for dep_id in task_graph.get(task_id, set()):
                if dep_id not in visited:
                    cycle = has_cycle(dep_id, path + [task_id])
                    if cycle:
                        return cycle
                elif dep_id in rec_stack:
                    return path + [task_id, dep_id]

            rec_stack.remove(task_id)
            return None

        for task_id in task_graph:
            if task_id not in visited:
                cycle = has_cycle(task_id, [])
                if cycle:
                    cycle_str = " -> ".join(cycle)
                    result.add_error(
                        "task", task_id,
                        f"Circular dependency detected: {cycle_str}"
                    )

    def get_dependency_order(self, plan: ProjectPlan) -> List[Task]:
        """
        Return tasks in dependency order (topological sort).
        Tasks with no dependencies come first.
        """
        # Build dependency graph
        task_graph: Dict[str, Set[str]] = {}
        all_tasks = {t.id: t for t in plan.get_all_tasks()}

        for task_id, task in all_tasks.items():
            task_graph[task_id] = set(task.dependencies)

        # Topological sort using Kahn's algorithm
        in_degree: Dict[str, int] = {tid: 0 for tid in task_graph}
        for deps in task_graph.values():
            for dep in deps:
                if dep in in_degree:
                    in_degree[dep] += 1

        # Start with tasks that have no incoming edges (nothing depends on them)
        # Actually we want tasks with no dependencies first
        queue = [tid for tid, deps in task_graph.items() if not deps]
        result = []

        while queue:
            task_id = queue.pop(0)
            result.append(all_tasks[task_id])

            # Find tasks that depend on this one
            for tid, deps in task_graph.items():
                if task_id in deps:
                    deps.remove(task_id)
                    if not deps and tid not in result and tid not in queue:
                        queue.append(tid)

        return result

    def get_blocked_tasks(self, plan: ProjectPlan) -> Dict[str, List[str]]:
        """
        Return a dict of task_id -> list of blocking task IDs.
        Only includes tasks that are actually blocked.
        """
        completed_ids = {
            t.id for t in plan.get_all_tasks()
            if t.status == TaskStatus.COMPLETE
        }

        blocked = {}
        for task in plan.get_all_tasks():
            if task.status != TaskStatus.COMPLETE:
                blocking = [d for d in task.dependencies if d not in completed_ids]
                if blocking:
                    blocked[task.id] = blocking

        return blocked

    def get_available_tasks(self, plan: ProjectPlan) -> List[Task]:
        """Get all tasks that are available to work on (no blockers)."""
        blocked = self.get_blocked_tasks(plan)

        available = []
        for task in plan.get_all_tasks():
            if task.status == TaskStatus.AVAILABLE and task.id not in blocked:
                available.append(task)

        return available

    def get_available_tasks_for_role(self, plan: ProjectPlan, role: str) -> List[Task]:
        """Get available tasks for a specific role."""
        return [t for t in self.get_available_tasks(plan) if t.role == role]
