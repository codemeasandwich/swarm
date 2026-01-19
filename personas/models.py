"""Persona configuration and agent instance models."""

from dataclasses import dataclass, field
from datetime import datetime
from enum import Enum
from typing import List, Optional, Dict, Any

from plan.models import Persona, Task


class LifecycleState(Enum):
    """Agent lifecycle states."""
    IDLE = "idle"
    WORKING = "working"
    BLOCKED = "blocked"
    PR_PENDING = "pr_pending"
    COMPLETE = "complete"
    FAILED = "failed"


@dataclass
class Breakpoint:
    """Represents a natural stopping point for an agent."""
    type: str  # "task_complete", "blocked", "pr_created"
    task_id: Optional[str] = None
    summary: str = ""
    blocked_on: List[str] = field(default_factory=list)
    reason: str = ""
    pr_url: Optional[str] = None
    timestamp: Optional[datetime] = None

    def to_dict(self) -> dict:
        return {
            "type": self.type,
            "task_id": self.task_id,
            "summary": self.summary,
            "blocked_on": self.blocked_on,
            "reason": self.reason,
            "pr_url": self.pr_url,
            "timestamp": self.timestamp.isoformat() if self.timestamp else None,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "Breakpoint":
        return cls(
            type=data.get("type", ""),
            task_id=data.get("task_id"),
            summary=data.get("summary", ""),
            blocked_on=data.get("blocked_on", []),
            reason=data.get("reason", ""),
            pr_url=data.get("pr_url"),
            timestamp=datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else None,
        )


@dataclass
class PersonaConfig:
    """Configuration for an agent persona, extends plan.Persona with runtime config."""
    persona: Persona
    working_directory: str = "sandbox"
    max_retries: int = 100
    retry_interval: float = 30.0
    auto_commit: bool = True
    auto_pr: bool = True

    @property
    def id(self) -> str:
        return self.persona.id

    @property
    def name(self) -> str:
        return self.persona.name

    @property
    def role(self) -> str:
        return self.persona.role

    @property
    def capabilities(self) -> List[str]:
        return self.persona.capabilities

    @property
    def constraints(self) -> List[str]:
        return self.persona.constraints

    def to_dict(self) -> dict:
        return {
            "persona": self.persona.to_dict(),
            "working_directory": self.working_directory,
            "max_retries": self.max_retries,
            "retry_interval": self.retry_interval,
            "auto_commit": self.auto_commit,
            "auto_pr": self.auto_pr,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "PersonaConfig":
        return cls(
            persona=Persona.from_dict(data.get("persona", {})),
            working_directory=data.get("working_directory", "sandbox"),
            max_retries=data.get("max_retries", 100),
            retry_interval=data.get("retry_interval", 30.0),
            auto_commit=data.get("auto_commit", True),
            auto_pr=data.get("auto_pr", True),
        )


@dataclass
class AgentInstance:
    """Runtime state of an agent instance."""
    agent_id: str
    persona_config: PersonaConfig
    branch: str
    sandbox_path: str

    # Runtime state
    lifecycle_state: LifecycleState = LifecycleState.IDLE
    current_task: Optional[Task] = None
    blocked_on: List[str] = field(default_factory=list)
    retry_count: int = 0
    spawn_count: int = 1  # How many times this agent has been spawned/reset

    # Process info
    pid: Optional[int] = None
    started_at: Optional[datetime] = None
    last_activity: Optional[datetime] = None

    # Breakpoint info
    breakpoint: Optional[Breakpoint] = None

    # Git/PR info
    pr_url: Optional[str] = None
    commits: List[str] = field(default_factory=list)

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "persona_config": self.persona_config.to_dict(),
            "branch": self.branch,
            "sandbox_path": self.sandbox_path,
            "lifecycle_state": self.lifecycle_state.value,
            "current_task": self.current_task.to_dict() if self.current_task else None,
            "blocked_on": self.blocked_on,
            "retry_count": self.retry_count,
            "spawn_count": self.spawn_count,
            "pid": self.pid,
            "started_at": self.started_at.isoformat() if self.started_at else None,
            "last_activity": self.last_activity.isoformat() if self.last_activity else None,
            "breakpoint": self.breakpoint.to_dict() if self.breakpoint else None,
            "pr_url": self.pr_url,
            "commits": self.commits,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "AgentInstance":
        return cls(
            agent_id=data.get("agent_id", ""),
            persona_config=PersonaConfig.from_dict(data.get("persona_config", {})),
            branch=data.get("branch", ""),
            sandbox_path=data.get("sandbox_path", ""),
            lifecycle_state=LifecycleState(data.get("lifecycle_state", "idle")),
            current_task=Task.from_dict(data["current_task"]) if data.get("current_task") else None,
            blocked_on=data.get("blocked_on", []),
            retry_count=data.get("retry_count", 0),
            spawn_count=data.get("spawn_count", 1),
            pid=data.get("pid"),
            started_at=datetime.fromisoformat(data["started_at"]) if data.get("started_at") else None,
            last_activity=datetime.fromisoformat(data["last_activity"]) if data.get("last_activity") else None,
            breakpoint=Breakpoint.from_dict(data["breakpoint"]) if data.get("breakpoint") else None,
            pr_url=data.get("pr_url"),
            commits=data.get("commits", []),
        )

    @property
    def role(self) -> str:
        return self.persona_config.role

    @property
    def name(self) -> str:
        return self.persona_config.name

    def is_blocked(self) -> bool:
        """Check if agent is blocked."""
        return self.lifecycle_state == LifecycleState.BLOCKED

    def is_active(self) -> bool:
        """Check if agent is actively working."""
        return self.lifecycle_state == LifecycleState.WORKING

    def is_complete(self) -> bool:
        """Check if agent has completed all work."""
        return self.lifecycle_state == LifecycleState.COMPLETE

    def set_blocked(self, blocked_on: List[str], reason: str = ""):
        """Set agent to blocked state."""
        self.lifecycle_state = LifecycleState.BLOCKED
        self.blocked_on = blocked_on
        self.breakpoint = Breakpoint(
            type="blocked",
            blocked_on=blocked_on,
            reason=reason,
            timestamp=datetime.now(),
        )

    def set_working(self, task: Task):
        """Set agent to working state."""
        self.lifecycle_state = LifecycleState.WORKING
        self.current_task = task
        self.blocked_on = []
        self.last_activity = datetime.now()

    def set_task_complete(self, summary: str = ""):
        """Set agent's current task as complete."""
        self.breakpoint = Breakpoint(
            type="task_complete",
            task_id=self.current_task.id if self.current_task else None,
            summary=summary,
            timestamp=datetime.now(),
        )
        self.lifecycle_state = LifecycleState.IDLE

    def set_pr_pending(self, pr_url: str):
        """Set agent to PR pending state."""
        self.lifecycle_state = LifecycleState.PR_PENDING
        self.pr_url = pr_url
        self.breakpoint = Breakpoint(
            type="pr_created",
            task_id=self.current_task.id if self.current_task else None,
            pr_url=pr_url,
            timestamp=datetime.now(),
        )

    def increment_spawn(self):
        """Increment spawn count (after reset)."""
        self.spawn_count += 1
        self.retry_count = 0
        self.started_at = datetime.now()

    def increment_retry(self):
        """Increment retry count."""
        self.retry_count += 1
        self.last_activity = datetime.now()
