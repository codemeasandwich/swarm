"""Data models for project plans - Epics, Stories, Tasks, Milestones."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any


class TaskStatus(Enum):
    """Status of a task in the plan."""
    AVAILABLE = "available"
    CLAIMED = "claimed"
    IN_PROGRESS = "in_progress"
    BLOCKED = "blocked"
    PR_PENDING = "pr_pending"
    COMPLETE = "complete"


class StoryStatus(Enum):
    """Status of a user story."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


class EpicStatus(Enum):
    """Status of an epic."""
    NOT_STARTED = "not_started"
    IN_PROGRESS = "in_progress"
    COMPLETE = "complete"


@dataclass
class AcceptanceCriterion:
    """An acceptance criterion that drives a test."""
    id: str
    description: str
    given: str = ""
    when: str = ""
    then: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "description": self.description,
            "given": self.given,
            "when": self.when,
            "then": self.then,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AcceptanceCriterion":
        return cls(
            id=data.get("id", ""),
            description=data.get("description", ""),
            given=data.get("given", ""),
            when=data.get("when", ""),
            then=data.get("then", ""),
        )


@dataclass
class TestScenario:
    """An E2E test scenario derived from acceptance criteria."""
    id: str
    name: str
    description: str
    acceptance_criterion_id: str
    test_function_name: str

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "acceptance_criterion_id": self.acceptance_criterion_id,
            "test_function_name": self.test_function_name,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "TestScenario":
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            acceptance_criterion_id=data.get("acceptance_criterion_id", ""),
            test_function_name=data.get("test_function_name", ""),
        )


@dataclass
class Task:
    """A task within a user story, assigned to a role."""
    id: str
    description: str
    role: str
    status: TaskStatus = TaskStatus.AVAILABLE
    dependencies: List[str] = field(default_factory=list)
    assigned_agent: Optional[str] = None
    branch: Optional[str] = None
    pr_url: Optional[str] = None
    created_at: Optional[datetime] = None
    claimed_at: Optional[datetime] = None
    completed_at: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "description": self.description,
            "role": self.role,
            "status": self.status.value,
            "dependencies": self.dependencies,
            "assigned_agent": self.assigned_agent,
            "branch": self.branch,
            "pr_url": self.pr_url,
            "created_at": self.created_at.isoformat() if self.created_at else None,
            "claimed_at": self.claimed_at.isoformat() if self.claimed_at else None,
            "completed_at": self.completed_at.isoformat() if self.completed_at else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Task":
        return cls(
            id=data.get("id", ""),
            description=data.get("description", ""),
            role=data.get("role", ""),
            status=TaskStatus(data.get("status", "available")),
            dependencies=data.get("dependencies", []),
            assigned_agent=data.get("assigned_agent"),
            branch=data.get("branch"),
            pr_url=data.get("pr_url"),
            created_at=datetime.fromisoformat(data["created_at"]) if data.get("created_at") else None,
            claimed_at=datetime.fromisoformat(data["claimed_at"]) if data.get("claimed_at") else None,
            completed_at=datetime.fromisoformat(data["completed_at"]) if data.get("completed_at") else None,
        )

    def is_blocked_by(self, completed_task_ids: set) -> List[str]:
        """Return list of dependencies not yet completed."""
        return [dep for dep in self.dependencies if dep not in completed_task_ids]


@dataclass
class Story:
    """A user story with acceptance criteria and tasks."""
    id: str
    title: str
    epic_id: str
    status: StoryStatus = StoryStatus.NOT_STARTED

    # User story format
    as_a: str = ""
    i_want: str = ""
    so_that: str = ""

    acceptance_criteria: List[AcceptanceCriterion] = field(default_factory=list)
    test_scenarios: List[TestScenario] = field(default_factory=list)
    tasks: List[Task] = field(default_factory=list)

    # Dependencies and blocking
    dependencies: List[str] = field(default_factory=list)  # Story IDs
    blocks: List[str] = field(default_factory=list)  # Story IDs this story blocks

    # Technical notes
    technical_notes: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "epic_id": self.epic_id,
            "status": self.status.value,
            "as_a": self.as_a,
            "i_want": self.i_want,
            "so_that": self.so_that,
            "acceptance_criteria": [ac.to_dict() for ac in self.acceptance_criteria],
            "test_scenarios": [ts.to_dict() for ts in self.test_scenarios],
            "tasks": [t.to_dict() for t in self.tasks],
            "dependencies": self.dependencies,
            "blocks": self.blocks,
            "technical_notes": self.technical_notes,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Story":
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            epic_id=data.get("epic_id", ""),
            status=StoryStatus(data.get("status", "not_started")),
            as_a=data.get("as_a", ""),
            i_want=data.get("i_want", ""),
            so_that=data.get("so_that", ""),
            acceptance_criteria=[AcceptanceCriterion.from_dict(ac) for ac in data.get("acceptance_criteria", [])],
            test_scenarios=[TestScenario.from_dict(ts) for ts in data.get("test_scenarios", [])],
            tasks=[Task.from_dict(t) for t in data.get("tasks", [])],
            dependencies=data.get("dependencies", []),
            blocks=data.get("blocks", []),
            technical_notes=data.get("technical_notes", ""),
        )

    @property
    def user_story_text(self) -> str:
        """Return formatted user story text."""
        return f"As a {self.as_a}, I want {self.i_want} so that {self.so_that}"

    def get_tasks_by_role(self, role: str) -> List[Task]:
        """Get all tasks for a specific role."""
        return [t for t in self.tasks if t.role == role]

    def get_available_tasks(self, completed_task_ids: set) -> List[Task]:
        """Get tasks that are available (not blocked by dependencies)."""
        available = []
        for task in self.tasks:
            if task.status == TaskStatus.AVAILABLE:
                blocked_by = task.is_blocked_by(completed_task_ids)
                if not blocked_by:
                    available.append(task)
        return available


@dataclass
class Epic:
    """An epic containing multiple user stories."""
    id: str
    title: str
    description: str
    status: EpicStatus = EpicStatus.NOT_STARTED
    milestone_id: Optional[str] = None
    priority: str = "medium"
    dependencies: List[str] = field(default_factory=list)  # Epic IDs
    stories: List[Story] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "title": self.title,
            "description": self.description,
            "status": self.status.value,
            "milestone_id": self.milestone_id,
            "priority": self.priority,
            "dependencies": self.dependencies,
            "stories": [s.to_dict() for s in self.stories],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Epic":
        return cls(
            id=data.get("id", ""),
            title=data.get("title", ""),
            description=data.get("description", ""),
            status=EpicStatus(data.get("status", "not_started")),
            milestone_id=data.get("milestone_id"),
            priority=data.get("priority", "medium"),
            dependencies=data.get("dependencies", []),
            stories=[Story.from_dict(s) for s in data.get("stories", [])],
        )

    def get_all_tasks(self) -> List[Task]:
        """Get all tasks across all stories."""
        tasks = []
        for story in self.stories:
            tasks.extend(story.tasks)
        return tasks

    def get_tasks_by_role(self, role: str) -> List[Task]:
        """Get all tasks for a specific role across all stories."""
        tasks = []
        for story in self.stories:
            tasks.extend(story.get_tasks_by_role(role))
        return tasks


@dataclass
class Milestone:
    """A milestone containing multiple epics."""
    id: str
    name: str
    description: str
    epic_ids: List[str] = field(default_factory=list)
    target_date: Optional[datetime] = None
    completed: bool = False
    pr_url: Optional[str] = None  # PR from integration to main

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "description": self.description,
            "epic_ids": self.epic_ids,
            "target_date": self.target_date.isoformat() if self.target_date else None,
            "completed": self.completed,
            "pr_url": self.pr_url,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Milestone":
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            description=data.get("description", ""),
            epic_ids=data.get("epic_ids", []),
            target_date=datetime.fromisoformat(data["target_date"]) if data.get("target_date") else None,
            completed=data.get("completed", False),
            pr_url=data.get("pr_url"),
        )


@dataclass
class Persona:
    """An agent persona definition."""
    id: str
    name: str
    role: str
    capabilities: List[str] = field(default_factory=list)
    constraints: List[str] = field(default_factory=list)
    claude_md_template: str = ""

    def to_dict(self) -> dict:
        return {
            "id": self.id,
            "name": self.name,
            "role": self.role,
            "capabilities": self.capabilities,
            "constraints": self.constraints,
            "claude_md_template": self.claude_md_template,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Persona":
        return cls(
            id=data.get("id", ""),
            name=data.get("name", ""),
            role=data.get("role", ""),
            capabilities=data.get("capabilities", []),
            constraints=data.get("constraints", []),
            claude_md_template=data.get("claude_md_template", ""),
        )


@dataclass
class ProjectPlan:
    """Complete project plan with all components."""
    name: str
    description: str
    epics: List[Epic] = field(default_factory=list)
    milestones: List[Milestone] = field(default_factory=list)
    personas: List[Persona] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "name": self.name,
            "description": self.description,
            "epics": [e.to_dict() for e in self.epics],
            "milestones": [m.to_dict() for m in self.milestones],
            "personas": [p.to_dict() for p in self.personas],
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ProjectPlan":
        return cls(
            name=data.get("name", ""),
            description=data.get("description", ""),
            epics=[Epic.from_dict(e) for e in data.get("epics", [])],
            milestones=[Milestone.from_dict(m) for m in data.get("milestones", [])],
            personas=[Persona.from_dict(p) for p in data.get("personas", [])],
        )

    def get_all_tasks(self) -> List[Task]:
        """Get all tasks across all epics and stories."""
        tasks = []
        for epic in self.epics:
            tasks.extend(epic.get_all_tasks())
        return tasks

    def get_all_stories(self) -> List[Story]:
        """Get all stories across all epics."""
        stories = []
        for epic in self.epics:
            stories.extend(epic.stories)
        return stories

    def get_tasks_by_role(self, role: str) -> List[Task]:
        """Get all tasks for a specific role."""
        tasks = []
        for epic in self.epics:
            tasks.extend(epic.get_tasks_by_role(role))
        return tasks

    def get_available_tasks_for_role(self, role: str) -> List[Task]:
        """Get tasks available for a role (not blocked by dependencies)."""
        completed_task_ids = {
            t.id for t in self.get_all_tasks()
            if t.status == TaskStatus.COMPLETE
        }

        available = []
        for epic in self.epics:
            for story in epic.stories:
                for task in story.get_available_tasks(completed_task_ids):
                    if task.role == role:
                        available.append(task)
        return available

    def get_task_by_id(self, task_id: str) -> Optional[Task]:
        """Find a task by ID."""
        for task in self.get_all_tasks():
            if task.id == task_id:
                return task
        return None

    def get_story_by_id(self, story_id: str) -> Optional[Story]:
        """Find a story by ID."""
        for story in self.get_all_stories():
            if story.id == story_id:
                return story
        return None

    def get_epic_by_id(self, epic_id: str) -> Optional[Epic]:
        """Find an epic by ID."""
        for epic in self.epics:
            if epic.id == epic_id:
                return epic
        return None

    def get_persona_by_role(self, role: str) -> Optional[Persona]:
        """Find a persona by role."""
        for persona in self.personas:
            if persona.role == role:
                return persona
        return None

    def get_milestone_by_id(self, milestone_id: str) -> Optional[Milestone]:
        """Find a milestone by ID."""
        for milestone in self.milestones:
            if milestone.id == milestone_id:
                return milestone
        return None

    def get_epics_for_milestone(self, milestone_id: str) -> List[Epic]:
        """Get all epics for a milestone."""
        milestone = self.get_milestone_by_id(milestone_id)
        if not milestone:
            return []
        return [e for e in self.epics if e.id in milestone.epic_ids]

    def is_milestone_complete(self, milestone_id: str) -> bool:
        """Check if all tasks in a milestone are complete."""
        epics = self.get_epics_for_milestone(milestone_id)
        for epic in epics:
            for task in epic.get_all_tasks():
                if task.status != TaskStatus.COMPLETE:
                    return False
        return True

    def get_roles(self) -> List[str]:
        """Get all unique roles from personas."""
        return list({p.role for p in self.personas})
