# Communication

> File-based coordination system for multi-agent communication.

## Overview

The communication module provides a lightweight, file-based coordination system where agents communicate through a shared `communications.json` file. It includes:

- Thread-safe file operations
- Real-time change detection via file watching
- Request/response protocol between agents
- Lifecycle state management for orchestration

## Architecture

```
┌─────────────┐     ┌─────────────┐     ┌─────────────┐
│   Agent A   │     │   Agent B   │     │   Agent C   │
└──────┬──────┘     └──────┬──────┘     └──────┬──────┘
       │                   │                   │
       │    ┌──────────────┴──────────────┐    │
       │    │                             │    │
       ▼    ▼                             ▼    ▼
┌─────────────────────────────────────────────────────┐
│              communications.json                     │
│  ┌─────────────────────────────────────────────┐    │
│  │ agent_a: { mission, requests, deliveries }  │    │
│  │ agent_b: { mission, requests, deliveries }  │    │
│  │ agent_c: { mission, requests, deliveries }  │    │
│  └─────────────────────────────────────────────┘    │
└─────────────────────────────────────────────────────┘
                         │
                         ▼
              ┌─────────────────────┐
              │    File Watcher     │
              │  (detects changes)  │
              └─────────────────────┘
                         │
           ┌─────────────┼─────────────┐
           ▼             ▼             ▼
        Agent A       Agent B       Agent C
       (notified)    (notified)    (notified)
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `CommunicationsFile` | Thread-safe JSON file handler |
| `FileWatcher` | Detects file changes via polling |
| `AgentStatus` | Basic agent status structure |
| `EnhancedAgentStatus` | Extended status with orchestration fields |
| `Agent` | Abstract base class for agents |
| `Coordinator` | Central coordinator for the system |

## Data Structure

```json
{
  "_meta": {
    "version": "1.0",
    "last_updated": "2026-01-19T08:00:00.000000",
    "last_updated_by": "builder"
  },
  "builder": {
    "mission": "Build the user management application",
    "working_on": "Implementing user CRUD",
    "done": "",
    "next": "Deploy to staging",
    "requests": [["designer", "Need DB schema"]],
    "added": [["designer", "Schema: users(id, email, hash)", "Need DB schema"]],
    "last_updated": "2026-01-19T08:00:00.000000"
  }
}
```

### Fields

| Field | Description |
|-------|-------------|
| `mission` | Agent's overall goal |
| `working_on` | Current task |
| `done` | Last completed work |
| `next` | Planned next step |
| `requests` | Outgoing requests: `[target, text]` |
| `added` | Deliveries received: `[from, description, original_request]` |

### Enhanced Fields (for orchestration)

| Field | Description |
|-------|-------------|
| `agent_id` | Unique agent identifier |
| `role` | Agent's role (architect, implementer, etc.) |
| `branch` | Git branch name |
| `lifecycle_state` | idle, working, blocked, pr_pending, complete, failed |
| `current_task_id` | Current task being worked on |
| `blocked_on` | List of blocking task IDs |
| `breakpoint` | Breakpoint info for context reset |

## Usage

### Basic Communication

```python
from communication.core import CommunicationsFile

comm = CommunicationsFile("communications.json")

# Update agent status
from communication.core import AgentStatus
status = AgentStatus(
    mission="Implement auth API",
    working_on="Login endpoint",
)
comm.update_agent("builder", status)

# Send a request
comm.add_request("builder", "designer", "Need UI mockups")

# Check for requests
requests = comm.get_requests_for_agent("designer")
for from_agent, request in requests:
    print(f"Request from {from_agent}: {request}")

# Complete a request
comm.complete_request(
    completing_agent="designer",
    requesting_agent="builder",
    original_request="Need UI mockups",
    description="Mockups ready in /designs"
)
```

### File Watching

```python
from communication.core import CommunicationsFile, FileWatcher

comm = CommunicationsFile("communications.json")
watcher = FileWatcher(comm, poll_interval=0.5)

def on_change(updated_by: str, data: dict):
    print(f"Update from {updated_by}")

watcher.register("my_agent", on_change)
watcher.start()
```

### Using Agent Base Class

```python
from communication.core import Agent, CommunicationsFile, FileWatcher

class MyAgent(Agent):
    def on_communication_update(self, updated_by: str, data: dict):
        print(f"Update from {updated_by}")

    def on_new_requests(self, requests):
        for from_agent, req in requests:
            print(f"New request: {req}")

comm = CommunicationsFile("communications.json")
watcher = FileWatcher(comm)
agent = MyAgent("researcher", comm, watcher)

agent.set_mission("Research API requirements")
agent.request("coder", "Please implement auth")
```

## Request/Response Flow

```
┌─────────────┐                    ┌─────────────┐
│  Agent A    │                    │  Agent B    │
└──────┬──────┘                    └──────┬──────┘
       │                                  │
       │  add_request(A, B, "need X")     │
       ├──────────────────────────────────►
       │         writes to                │
       │    communications.json           │
       │                                  │
       │          ┌────────────┐          │
       │          │FileWatcher │          │
       │          │ detects    │          │
       │          │ change     │          │
       │          └─────┬──────┘          │
       │                │                 │
       │◄───────────────┤ notify A        │
       │                │ notify B ───────►
       │                │                 │
       │                │  get_requests() │
       │                │◄────────────────┤
       │                │                 │
       │                │ complete_request│
       │◄───────────────┴─────────────────┤
       │       delivery in "added"        │
```

## Thread Safety

- `CommunicationsFile` uses `threading.Lock` for all operations
- Safe for multiple agents in separate processes
- FileWatcher runs in a daemon thread

## Related Modules

- [/orchestrator](../orchestrator/) - Uses communications for agent coordination
- [/lifecycle](../lifecycle/) - Signals breakpoints via communications
- [/cli](../cli/) - Interactive agent interface

## Files

- [`core.py`](./core.py) - Core communication classes
