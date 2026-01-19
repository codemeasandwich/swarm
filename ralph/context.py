"""Context snapshot and restoration for agent respawns."""

import json
import subprocess
from dataclasses import dataclass, field
from datetime import datetime
from pathlib import Path
from typing import Optional, List, Dict, Any

from plan.models import Task, TaskStatus
from personas.models import AgentInstance, Breakpoint


@dataclass
class ContextSnapshot:
    """
    A snapshot of an agent's context at a breakpoint.

    This is used to provide fresh context when respawning
    an agent, preventing context rot.
    """
    agent_id: str
    spawn_number: int
    timestamp: datetime

    # Task context
    current_task_id: Optional[str] = None
    current_task_description: Optional[str] = None
    task_status: Optional[str] = None

    # Progress summary
    completed_work: str = ""
    remaining_work: str = ""

    # Git state
    branch: str = ""
    recent_commits: List[str] = field(default_factory=list)
    uncommitted_files: List[str] = field(default_factory=list)

    # Dependencies
    completed_dependencies: List[str] = field(default_factory=list)
    pending_dependencies: List[str] = field(default_factory=list)

    # Breakpoint info
    breakpoint_type: str = ""
    breakpoint_reason: str = ""
    blocked_on: List[str] = field(default_factory=list)

    # Communications
    pending_requests: List[Dict[str, str]] = field(default_factory=list)
    recent_deliveries: List[Dict[str, str]] = field(default_factory=list)

    # Retry info
    retry_count: int = 0
    previous_error: str = ""

    def to_dict(self) -> dict:
        return {
            "agent_id": self.agent_id,
            "spawn_number": self.spawn_number,
            "timestamp": self.timestamp.isoformat(),
            "current_task_id": self.current_task_id,
            "current_task_description": self.current_task_description,
            "task_status": self.task_status,
            "completed_work": self.completed_work,
            "remaining_work": self.remaining_work,
            "branch": self.branch,
            "recent_commits": self.recent_commits,
            "uncommitted_files": self.uncommitted_files,
            "completed_dependencies": self.completed_dependencies,
            "pending_dependencies": self.pending_dependencies,
            "breakpoint_type": self.breakpoint_type,
            "breakpoint_reason": self.breakpoint_reason,
            "blocked_on": self.blocked_on,
            "pending_requests": self.pending_requests,
            "recent_deliveries": self.recent_deliveries,
            "retry_count": self.retry_count,
            "previous_error": self.previous_error,
        }

    @classmethod
    def from_dict(cls, data: dict) -> "ContextSnapshot":
        return cls(
            agent_id=data.get("agent_id", ""),
            spawn_number=data.get("spawn_number", 1),
            timestamp=datetime.fromisoformat(data["timestamp"]) if data.get("timestamp") else datetime.now(),
            current_task_id=data.get("current_task_id"),
            current_task_description=data.get("current_task_description"),
            task_status=data.get("task_status"),
            completed_work=data.get("completed_work", ""),
            remaining_work=data.get("remaining_work", ""),
            branch=data.get("branch", ""),
            recent_commits=data.get("recent_commits", []),
            uncommitted_files=data.get("uncommitted_files", []),
            completed_dependencies=data.get("completed_dependencies", []),
            pending_dependencies=data.get("pending_dependencies", []),
            breakpoint_type=data.get("breakpoint_type", ""),
            breakpoint_reason=data.get("breakpoint_reason", ""),
            blocked_on=data.get("blocked_on", []),
            pending_requests=data.get("pending_requests", []),
            recent_deliveries=data.get("recent_deliveries", []),
            retry_count=data.get("retry_count", 0),
            previous_error=data.get("previous_error", ""),
        )

    def save(self, filepath: Path):
        """Save snapshot to a JSON file."""
        filepath = Path(filepath)
        filepath.parent.mkdir(parents=True, exist_ok=True)
        filepath.write_text(json.dumps(self.to_dict(), indent=2))

    @classmethod
    def load(cls, filepath: Path) -> "ContextSnapshot":
        """Load snapshot from a JSON file."""
        data = json.loads(Path(filepath).read_text())
        return cls.from_dict(data)


class ContextBuilder:
    """Builds context snapshots and summary text for agent respawns."""

    def __init__(self, repo_dir: Path):
        self.repo_dir = Path(repo_dir)

    def capture_snapshot(
        self,
        agent: AgentInstance,
        task: Optional[Task] = None,
        comm_file_path: Optional[Path] = None,
    ) -> ContextSnapshot:
        """
        Capture a full context snapshot for an agent.

        Args:
            agent: The agent instance
            task: The current task (if any)
            comm_file_path: Path to communications.json

        Returns:
            ContextSnapshot with current state
        """
        snapshot = ContextSnapshot(
            agent_id=agent.agent_id,
            spawn_number=agent.spawn_count,
            timestamp=datetime.now(),
        )

        # Task context
        if task:
            snapshot.current_task_id = task.id
            snapshot.current_task_description = task.description
            snapshot.task_status = task.status.value
            snapshot.pending_dependencies = task.dependencies

        # Breakpoint info
        if agent.breakpoint:
            snapshot.breakpoint_type = agent.breakpoint.type
            snapshot.breakpoint_reason = agent.breakpoint.reason
            snapshot.blocked_on = agent.breakpoint.blocked_on

        # Git state
        snapshot.branch = agent.branch
        snapshot.recent_commits = self._get_recent_commits(agent.branch)
        snapshot.uncommitted_files = self._get_uncommitted_files()

        # Retry info
        snapshot.retry_count = agent.retry_count

        # Communications
        if comm_file_path and comm_file_path.exists():
            snapshot.pending_requests, snapshot.recent_deliveries = \
                self._get_communications(agent.agent_id, comm_file_path)

        return snapshot

    def _get_recent_commits(self, branch: str, count: int = 5) -> List[str]:
        """Get recent commits on a branch."""
        try:
            result = subprocess.run(
                ["git", "log", branch, f"-{count}", "--oneline"],
                cwd=str(self.repo_dir),
                capture_output=True,
                text=True,
                check=True,
            )
            return [line.strip() for line in result.stdout.splitlines() if line.strip()]
        except subprocess.CalledProcessError:
            return []

    def _get_uncommitted_files(self) -> List[str]:
        """Get list of uncommitted files."""
        try:
            result = subprocess.run(
                ["git", "status", "--porcelain"],
                cwd=str(self.repo_dir),
                capture_output=True,
                text=True,
                check=True,
            )
            files = []
            for line in result.stdout.splitlines():
                if line.strip():
                    files.append(line[3:].strip())
            return files
        except subprocess.CalledProcessError:
            return []

    def _get_communications(
        self,
        agent_id: str,
        comm_file_path: Path
    ) -> tuple[List[Dict[str, str]], List[Dict[str, str]]]:
        """Get pending requests and recent deliveries for an agent."""
        try:
            data = json.loads(comm_file_path.read_text())

            # Get requests directed at this agent
            pending_requests = []
            for name, agent_data in data.items():
                if name == "_meta" or not isinstance(agent_data, dict):
                    continue
                for req in agent_data.get("requests", []):
                    if len(req) >= 2 and req[0] == agent_id:
                        pending_requests.append({
                            "from": name,
                            "request": req[1],
                        })

            # Get deliveries to this agent
            recent_deliveries = []
            agent_data = data.get(agent_id, {})
            for delivery in agent_data.get("added", []):
                if len(delivery) >= 3:
                    recent_deliveries.append({
                        "from": delivery[0],
                        "description": delivery[1],
                        "original_request": delivery[2],
                    })

            return pending_requests, recent_deliveries

        except (json.JSONDecodeError, FileNotFoundError):
            return [], []

    def build_context_summary(self, snapshot: ContextSnapshot) -> str:
        """
        Build a human-readable context summary for agent respawn.

        This text is injected into the agent's .claude.md to provide
        fresh, relevant context at the top of the context window.
        """
        lines = []

        lines.append("## Context Summary (Fresh Start)")
        lines.append("")
        lines.append(f"**Spawn #{snapshot.spawn_number}** - {snapshot.timestamp.isoformat()}")
        lines.append("")

        # Current task
        if snapshot.current_task_id:
            lines.append("### Current Task")
            lines.append(f"- **Task:** {snapshot.current_task_id}")
            lines.append(f"- **Description:** {snapshot.current_task_description}")
            lines.append(f"- **Status:** {snapshot.task_status}")
            lines.append("")

        # Previous progress
        if snapshot.completed_work:
            lines.append("### Previous Progress")
            lines.append(snapshot.completed_work)
            lines.append("")

        # Breakpoint info
        if snapshot.breakpoint_type:
            lines.append("### Last Breakpoint")
            lines.append(f"- **Type:** {snapshot.breakpoint_type}")
            if snapshot.breakpoint_reason:
                lines.append(f"- **Reason:** {snapshot.breakpoint_reason}")
            if snapshot.blocked_on:
                lines.append(f"- **Blocked on:** {', '.join(snapshot.blocked_on)}")
            lines.append("")

        # Git state
        if snapshot.branch or snapshot.recent_commits:
            lines.append("### Git State")
            if snapshot.branch:
                lines.append(f"- **Branch:** {snapshot.branch}")
            if snapshot.recent_commits:
                lines.append("- **Recent commits:**")
                for commit in snapshot.recent_commits[:3]:
                    lines.append(f"  - {commit}")
            if snapshot.uncommitted_files:
                lines.append(f"- **Uncommitted files:** {len(snapshot.uncommitted_files)}")
            lines.append("")

        # Dependencies
        if snapshot.pending_dependencies or snapshot.completed_dependencies:
            lines.append("### Dependencies")
            if snapshot.completed_dependencies:
                lines.append(f"- **Completed:** {', '.join(snapshot.completed_dependencies)}")
            if snapshot.pending_dependencies:
                lines.append(f"- **Pending:** {', '.join(snapshot.pending_dependencies)}")
            lines.append("")

        # Communications
        if snapshot.pending_requests:
            lines.append("### Pending Requests (for you)")
            for req in snapshot.pending_requests:
                lines.append(f"- From **{req['from']}**: {req['request']}")
            lines.append("")

        if snapshot.recent_deliveries:
            lines.append("### Recent Deliveries (to you)")
            for delivery in snapshot.recent_deliveries:
                lines.append(f"- From **{delivery['from']}**: {delivery['description']}")
            lines.append("")

        # Retry info
        if snapshot.retry_count > 0:
            lines.append("### Retry Info")
            lines.append(f"- **Previous attempts:** {snapshot.retry_count}")
            if snapshot.previous_error:
                lines.append(f"- **Last error:** {snapshot.previous_error[:200]}")
            lines.append("")

        lines.append("---")
        lines.append("")
        lines.append("**Continue from where you left off. Check communications.json for updates.**")

        return "\n".join(lines)

    def save_snapshot(
        self,
        snapshot: ContextSnapshot,
        output_dir: Path,
    ) -> Path:
        """Save a snapshot to the output directory."""
        output_dir = Path(output_dir)
        output_dir.mkdir(parents=True, exist_ok=True)

        filename = f"{snapshot.agent_id}_spawn{snapshot.spawn_number}_{snapshot.timestamp.strftime('%Y%m%d_%H%M%S')}.json"
        filepath = output_dir / filename
        snapshot.save(filepath)

        return filepath
