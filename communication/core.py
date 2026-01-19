#!/usr/bin/env python3
"""
Agent Communication System

A multi-agent coordination system using a shared JSON file.
Each agent has:
  - mission: their overall goal
  - working_on: current task
  - done: what they've completed
  - next: what they plan to do next
  - requests: array of [target_agent, request] - asks to other agents
  - added: array of [from_agent, description, original_request] - completed work delivered

File watcher notifies other agents when updates occur.
"""

from __future__ import annotations

import hashlib
import json
import logging
import threading
import time
from abc import ABC, abstractmethod
from dataclasses import dataclass, field, asdict
from datetime import datetime
from pathlib import Path
from typing import Callable, Optional, Any, Dict, List, Tuple

from personas.models import Breakpoint

logger = logging.getLogger(__name__)


@dataclass
class AgentStatus:
    """Status structure for each agent."""
    mission: str = ""
    working_on: str = ""
    done: str = ""
    next: str = ""
    # requests: list of [target_agent_name, request_description]
    requests: List[List[str]] = field(default_factory=list)
    # added: list of [from_agent, how_to_use_description, original_request]
    added: List[List[str]] = field(default_factory=list)
    last_updated: str = ""

    def to_dict(self) -> dict:
        return asdict(self)

    @classmethod
    def from_dict(cls, data: dict) -> 'AgentStatus':
        return cls(
            mission=data.get('mission', ''),
            working_on=data.get('working_on', ''),
            done=data.get('done', ''),
            next=data.get('next', ''),
            requests=data.get('requests', []),
            added=data.get('added', []),
            last_updated=data.get('last_updated', '')
        )


# BreakpointInfo is an alias for Breakpoint from personas.models for backwards compatibility
BreakpointInfo = Breakpoint


@dataclass
class EnhancedAgentStatus(AgentStatus):
    """Extended agent status with orchestration support."""
    # Identity
    agent_id: str = ""
    role: str = ""
    branch: str = ""

    # Lifecycle state: idle, working, blocked, pr_pending, complete, failed
    lifecycle_state: str = "idle"

    # Current task info
    current_task_id: str = ""

    # Blocking info
    blocked_on: List[str] = field(default_factory=list)

    # Retry/respawn info
    retry_count: int = 0
    spawn_count: int = 1

    # PR info
    pr_url: str = ""

    # Breakpoint info for context reset
    breakpoint: Optional[Breakpoint] = None

    def to_dict(self) -> dict:
        d = super().to_dict()
        d.update({
            'agent_id': self.agent_id,
            'role': self.role,
            'branch': self.branch,
            'lifecycle_state': self.lifecycle_state,
            'current_task_id': self.current_task_id,
            'blocked_on': self.blocked_on,
            'retry_count': self.retry_count,
            'spawn_count': self.spawn_count,
            'pr_url': self.pr_url,
            'breakpoint': self.breakpoint.to_dict() if self.breakpoint else None,
        })
        return d

    @classmethod
    def from_dict(cls, data: dict) -> 'EnhancedAgentStatus':
        breakpoint_data = data.get('breakpoint')
        return cls(
            mission=data.get('mission', ''),
            working_on=data.get('working_on', ''),
            done=data.get('done', ''),
            next=data.get('next', ''),
            requests=data.get('requests', []),
            added=data.get('added', []),
            last_updated=data.get('last_updated', ''),
            agent_id=data.get('agent_id', ''),
            role=data.get('role', ''),
            branch=data.get('branch', ''),
            lifecycle_state=data.get('lifecycle_state', 'idle'),
            current_task_id=data.get('current_task_id', ''),
            blocked_on=data.get('blocked_on', []),
            retry_count=data.get('retry_count', 0),
            spawn_count=data.get('spawn_count', 1),
            pr_url=data.get('pr_url', ''),
            breakpoint=Breakpoint.from_dict(breakpoint_data) if breakpoint_data else None,
        )

    # Note: These status check methods parallel AgentInstance.is_blocked/is_active/is_complete
    # in personas/models.py. The duplication is intentional:
    # - EnhancedAgentStatus uses string literals (for JSON serialization in communications.json)
    # - AgentInstance uses LifecycleState enum (for type-safe runtime operations)
    # Both need these convenience methods for their respective use cases.

    def is_blocked(self) -> bool:
        """Check if agent is in blocked state."""
        return self.lifecycle_state == "blocked"

    def is_active(self) -> bool:
        """Check if agent is actively working."""
        return self.lifecycle_state == "working"

    def is_complete(self) -> bool:
        """Check if agent has completed all work."""
        return self.lifecycle_state == "complete"

    def set_blocked(self, blocked_on: List[str], reason: str = ""):
        """Set agent to blocked state with breakpoint."""
        self.lifecycle_state = "blocked"
        self.blocked_on = blocked_on
        self.breakpoint = Breakpoint(
            type="blocked",
            blocked_on=blocked_on,
            reason=reason,
            timestamp=datetime.now(),
        )

    def set_task_complete(self, task_id: str, summary: str = ""):
        """Signal task completion with breakpoint."""
        self.breakpoint = Breakpoint(
            type="task_complete",
            task_id=task_id,
            summary=summary,
            timestamp=datetime.now(),
        )
        self.lifecycle_state = "idle"
        self.current_task_id = ""

    def set_pr_pending(self, pr_url: str, task_id: str = ""):
        """Set agent to PR pending state with breakpoint."""
        self.lifecycle_state = "pr_pending"
        self.pr_url = pr_url
        self.breakpoint = Breakpoint(
            type="pr_created",
            task_id=task_id,
            pr_url=pr_url,
            timestamp=datetime.now(),
        )


class CommunicationsFile:
    """Thread-safe handler for the communications.json file."""

    def __init__(self, filepath: str = "communications.json"):
        self.filepath = Path(filepath)
        self._lock = threading.Lock()
        self._ensure_file_exists()

    def _ensure_file_exists(self):
        """Create the file if it doesn't exist."""
        if not self.filepath.exists():
            self.filepath.parent.mkdir(parents=True, exist_ok=True)
            self._write_data({
                "_meta": {
                    "version": "1.0",
                    "last_updated": None,
                    "last_updated_by": None
                }
            })

    def _read_data(self) -> dict:
        """Read and parse the JSON file."""
        with open(self.filepath, 'r') as f:
            return json.load(f)

    def _write_data(self, data: dict):
        """Write data to the JSON file."""
        with open(self.filepath, 'w') as f:
            json.dump(data, f, indent=2)

    def _update_meta(self, data: dict, agent_name: str):
        """Update metadata."""
        data["_meta"]["last_updated"] = datetime.now().isoformat()
        data["_meta"]["last_updated_by"] = agent_name

    def read_raw(self) -> dict:
        """Read and return the raw JSON data.

        This is the public interface for reading the communications file.
        Use this instead of _read_data() for external access.
        """
        with self._lock:
            return self._read_data()

    def get_all_agents(self) -> dict[str, AgentStatus]:
        """Get status of all agents."""
        with self._lock:
            data = self._read_data()
            agents = {}
            for key, value in data.items():
                if key != "_meta" and isinstance(value, dict):
                    agents[key] = AgentStatus.from_dict(value)
            return agents

    def get_agent(self, agent_name: str) -> Optional[AgentStatus]:
        """Get a specific agent's status."""
        with self._lock:
            data = self._read_data()
            if agent_name in data and agent_name != "_meta":
                return AgentStatus.from_dict(data[agent_name])
            return None

    def update_agent(self, agent_name: str, status: AgentStatus) -> dict:
        """Update an agent's status."""
        with self._lock:
            data = self._read_data()

            timestamp = datetime.now().isoformat()
            status.last_updated = timestamp

            data[agent_name] = status.to_dict()
            self._update_meta(data, agent_name)

            self._write_data(data)
            return data

    def update_field(self, agent_name: str, field: str, value: Any) -> dict:
        """Update a single field for an agent."""
        with self._lock:
            data = self._read_data()

            if agent_name not in data:
                data[agent_name] = AgentStatus().to_dict()

            timestamp = datetime.now().isoformat()
            data[agent_name][field] = value
            data[agent_name]["last_updated"] = timestamp
            self._update_meta(data, agent_name)

            self._write_data(data)
            return data

    # ==================== REQUEST METHODS ====================

    def add_request(self, from_agent: str, to_agent: str, request: str) -> dict:
        """
        Add a request from one agent to another.

        Adds [to_agent, request] to from_agent's requests array in the
        communications file. The target agent can retrieve pending requests
        using get_requests_for_agent().

        Args:
            from_agent: The agent making the request.
            to_agent: The agent who should fulfill the request.
            request: Description of what is being requested.

        Returns:
            The updated communications data dict.
        """
        with self._lock:
            data = self._read_data()

            if from_agent not in data:
                data[from_agent] = AgentStatus().to_dict()

            if "requests" not in data[from_agent]:
                data[from_agent]["requests"] = []

            data[from_agent]["requests"].append([to_agent, request])
            data[from_agent]["last_updated"] = datetime.now().isoformat()
            self._update_meta(data, from_agent)

            self._write_data(data)
            return data

    def get_requests_for_agent(self, agent_name: str) -> List[Tuple[str, str]]:
        """
        Get all requests directed at a specific agent.
        Returns list of (requesting_agent, request_description).
        """
        with self._lock:
            data = self._read_data()
            requests = []

            for name, agent_data in data.items():
                if name == "_meta" or not isinstance(agent_data, dict):
                    continue

                agent_requests = agent_data.get("requests", [])
                for req in agent_requests:
                    if len(req) >= 2 and req[0] == agent_name:
                        requests.append((name, req[1]))  # (from_agent, request)

            return requests

    def complete_request(self, completing_agent: str, requesting_agent: str,
                         original_request: str, description: str) -> dict:
        """
        Mark a request as completed.
        - Removes the request from requesting_agent's requests
        - Adds [completing_agent, description, original_request] to requesting_agent's added
        """
        with self._lock:
            data = self._read_data()

            # Ensure requesting agent exists
            if requesting_agent not in data:
                data[requesting_agent] = AgentStatus().to_dict()

            # Remove the request from requesting_agent's requests
            if "requests" in data[requesting_agent]:
                data[requesting_agent]["requests"] = [
                    req for req in data[requesting_agent]["requests"]
                    if not (len(req) >= 2 and req[0] == completing_agent and req[1] == original_request)
                ]

            # Add to requesting_agent's 'added' array
            if "added" not in data[requesting_agent]:
                data[requesting_agent]["added"] = []

            data[requesting_agent]["added"].append([
                completing_agent,
                description,
                original_request
            ])

            timestamp = datetime.now().isoformat()
            data[requesting_agent]["last_updated"] = timestamp
            self._update_meta(data, completing_agent)

            self._write_data(data)
            return data

    def clear_added(self, agent_name: str) -> dict:
        """Clear the added array for an agent (after they've processed deliveries)."""
        with self._lock:
            data = self._read_data()

            if agent_name in data:
                data[agent_name]["added"] = []
                data[agent_name]["last_updated"] = datetime.now().isoformat()
                self._update_meta(data, agent_name)

            self._write_data(data)
            return data

    def remove_request(self, from_agent: str, to_agent: str, request: str) -> dict:
        """Remove a specific request."""
        with self._lock:
            data = self._read_data()

            if from_agent in data and "requests" in data[from_agent]:
                data[from_agent]["requests"] = [
                    req for req in data[from_agent]["requests"]
                    if not (len(req) >= 2 and req[0] == to_agent and req[1] == request)
                ]
                data[from_agent]["last_updated"] = datetime.now().isoformat()
                self._update_meta(data, from_agent)

            self._write_data(data)
            return data

    def remove_agent(self, agent_name: str):
        """Remove an agent from the communications file."""
        with self._lock:
            data = self._read_data()
            if agent_name in data:
                del data[agent_name]
                self._write_data(data)

    def get_file_hash(self) -> str:
        """Get hash of file contents for change detection."""
        with self._lock:
            content = self.filepath.read_bytes()
            return hashlib.md5(content).hexdigest()


class FileWatcher:
    """
    Watches the communications.json file for changes
    and notifies registered agents.
    """

    def __init__(self, comm_file: CommunicationsFile, poll_interval: float = 0.5):
        self.comm_file = comm_file
        self.poll_interval = poll_interval
        self._callbacks: Dict[str, Callable[[str, dict], None]] = {}
        self._running = False
        self._thread: Optional[threading.Thread] = None
        self._last_hash = ""
        self._last_data = {}

    def register(self, agent_name: str, callback: Callable[[str, dict], None]):
        """Register an agent to receive notifications."""
        self._callbacks[agent_name] = callback
        print(f"[Watcher] Registered agent: {agent_name}")

    def unregister(self, agent_name: str):
        """Unregister an agent from notifications."""
        if agent_name in self._callbacks:
            del self._callbacks[agent_name]
            print(f"[Watcher] Unregistered agent: {agent_name}")

    def _watch_loop(self):
        """Main watching loop - detects changes and notifies agents."""
        self._last_hash = self.comm_file.get_file_hash()

        while self._running:
            try:
                current_hash = self.comm_file.get_file_hash()

                if current_hash != self._last_hash:
                    data = self.comm_file._read_data()
                    updated_by = data.get("_meta", {}).get("last_updated_by")

                    # Notify all agents EXCEPT the one who made the update
                    for agent_name, callback in self._callbacks.items():
                        if agent_name != updated_by:
                            try:
                                callback(updated_by, data)
                            except Exception as e:
                                print(f"[Watcher] Error notifying {agent_name}: {e}")

                    self._last_hash = current_hash
                    self._last_data = data

                time.sleep(self.poll_interval)

            except Exception as e:
                print(f"[Watcher] Error in watch loop: {e}")
                time.sleep(self.poll_interval)

    def start(self):
        """Start the file watcher in a background thread."""
        if self._running:
            return

        self._running = True
        self._thread = threading.Thread(target=self._watch_loop, daemon=True)
        self._thread.start()
        print("[Watcher] Started watching communications.json")

    def stop(self):
        """Stop the file watcher."""
        self._running = False
        if self._thread:
            self._thread.join(timeout=2.0)
        print("[Watcher] Stopped")


class Agent(ABC):
    """Base class for an agent that participates in the communication system."""

    def __init__(self, name: str, comm_file: CommunicationsFile, watcher: FileWatcher):
        self.name = name
        self.comm_file = comm_file
        self.watcher = watcher
        self._status = AgentStatus()

        self.watcher.register(self.name, self._on_update)

    def _on_update(self, updated_by: str, data: dict):
        """Called when another agent updates the communications file."""
        self.on_communication_update(updated_by, data)

        # Check if there are new requests for this agent
        requests = self.get_pending_requests()
        if requests:
            self.on_new_requests(requests)

        # Check if there are new deliveries
        my_data = data.get(self.name, {})
        added = my_data.get("added", [])
        if added:
            self.on_deliveries(added)

    @abstractmethod
    def on_communication_update(self, updated_by: str, data: dict):
        """Override to handle updates from other agents."""
        pass

    def on_new_requests(self, requests: List[Tuple[str, str]]):
        """Override to handle incoming requests. Default: print them."""
        for from_agent, request in requests:
            print(f"[{self.name}] Request from {from_agent}: {request}")

    def on_deliveries(self, deliveries: List[List[str]]):
        """Override to handle completed deliveries. Default: print them."""
        for delivery in deliveries:
            if len(delivery) >= 3:
                from_agent, description, original = delivery
                print(f"[{self.name}] Delivery from {from_agent}: {description}")
                print(f"           (for request: {original})")

    # ==================== STATUS METHODS ====================

    def set_mission(self, mission: str):
        self._status.mission = mission
        self.comm_file.update_field(self.name, "mission", mission)

    def set_working_on(self, task: str):
        self._status.working_on = task
        self.comm_file.update_field(self.name, "working_on", task)

    def set_done(self, completed: str):
        self._status.done = completed
        self.comm_file.update_field(self.name, "done", completed)

    def set_next(self, next_task: str):
        self._status.next = next_task
        self.comm_file.update_field(self.name, "next", next_task)

    def update_all(self, mission: str = None, working_on: str = None,
                   done: str = None, next_task: str = None):
        """Update multiple fields at once."""
        if mission is not None:
            self._status.mission = mission
        if working_on is not None:
            self._status.working_on = working_on
        if done is not None:
            self._status.done = done
        if next_task is not None:
            self._status.next = next_task

        self.comm_file.update_agent(self.name, self._status)

    # ==================== REQUEST METHODS ====================

    def request(self, target_agent: str, request_description: str):
        """Send a request to another agent."""
        self.comm_file.add_request(self.name, target_agent, request_description)
        print(f"[{self.name}] Sent request to {target_agent}: {request_description}")

    def get_pending_requests(self) -> List[Tuple[str, str]]:
        """Get all requests directed at this agent."""
        return self.comm_file.get_requests_for_agent(self.name)

    def complete_request(self, requesting_agent: str, original_request: str,
                         description: str):
        """
        Complete a request from another agent.
        This removes it from their requests and adds to their 'added'.
        """
        self.comm_file.complete_request(
            completing_agent=self.name,
            requesting_agent=requesting_agent,
            original_request=original_request,
            description=description
        )
        print(f"[{self.name}] Completed request for {requesting_agent}: {description}")

    def get_my_deliveries(self) -> List[List[str]]:
        """Get deliveries that have been added for this agent."""
        status = self.comm_file.get_agent(self.name)
        return status.added if status else []

    def acknowledge_deliveries(self):
        """Clear the added array after processing deliveries."""
        self.comm_file.clear_added(self.name)

    # ==================== UTILITY METHODS ====================

    def get_other_agents(self) -> Dict[str, AgentStatus]:
        """Get status of all other agents."""
        all_agents = self.comm_file.get_all_agents()
        return {k: v for k, v in all_agents.items() if k != self.name}

    def get_agent_status(self, agent_name: str) -> Optional[AgentStatus]:
        """Get status of a specific agent."""
        return self.comm_file.get_agent(agent_name)

    def shutdown(self):
        """Unregister this agent."""
        self.watcher.unregister(self.name)


class Coordinator:
    """Central coordinator that manages the communication system."""

    def __init__(self, filepath: str = "communications.json"):
        self.comm_file = CommunicationsFile(filepath)
        self.watcher = FileWatcher(self.comm_file)
        self._agents: Dict[str, Agent] = {}

    def start(self):
        self.watcher.start()
        print("[Coordinator] System started")

    def stop(self):
        self.watcher.stop()
        print("[Coordinator] System stopped")

    def create_agent(self, agent_class: type, name: str, **kwargs) -> Agent:
        agent = agent_class(name, self.comm_file, self.watcher, **kwargs)
        self._agents[name] = agent
        return agent

    def get_agent(self, name: str) -> Optional[Agent]:
        return self._agents.get(name)

    def get_all_status(self) -> dict:
        return self.comm_file.get_all_agents()


# ============================================================
# Example concrete agent implementation
# ============================================================

class TaskAgent(Agent):
    """Example agent that handles requests and updates."""

    def on_communication_update(self, updated_by: str, data: dict):
        other_status = data.get(updated_by, {})
        print(f"\n[{self.name}] Update from {updated_by}:")
        print(f"  Working on: {other_status.get('working_on', 'N/A')}")


if __name__ == "__main__":
    # Demo: Request/Response workflow
    print("=" * 60)
    print("  AGENT REQUEST/RESPONSE DEMO")
    print("=" * 60)

    coordinator = Coordinator("communications.json")
    coordinator.start()

    # Create agents
    researcher = coordinator.create_agent(TaskAgent, "researcher")
    coder = coordinator.create_agent(TaskAgent, "coder")

    time.sleep(0.5)

    # Researcher sends a request to coder
    print("\n--- Researcher sends request ---")
    researcher.set_mission("Get API implementation")
    researcher.request("coder", "Please implement the user authentication API")

    time.sleep(1)

    # Coder checks pending requests
    print("\n--- Coder checks requests ---")
    requests = coder.get_pending_requests()
    for from_agent, req in requests:
        print(f"  Request from {from_agent}: {req}")

    # Coder works on the request
    coder.set_working_on("Implementing user authentication API")
    time.sleep(1)

    # Coder completes the request
    print("\n--- Coder completes request ---")
    coder.complete_request(
        requesting_agent="researcher",
        original_request="Please implement the user authentication API",
        description="Auth API implemented in auth_api.py - includes login, logout, and token refresh endpoints"
    )

    time.sleep(1)

    # Researcher checks deliveries
    print("\n--- Researcher checks deliveries ---")
    deliveries = researcher.get_my_deliveries()
    for delivery in deliveries:
        print(f"  From: {delivery[0]}")
        print(f"  Description: {delivery[1]}")
        print(f"  Original request: {delivery[2]}")

    researcher.acknowledge_deliveries()

    print("\n--- Final State ---")
    print(json.dumps(coordinator.comm_file._read_data(), indent=2))

    coordinator.stop()
