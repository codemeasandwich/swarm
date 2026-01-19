# Multi-Agent Communication System

A lightweight, file-based coordination system for multiple independent agents. Agents communicate through a shared JSON file with real-time notifications via file watching.

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

## Core Components

| File | Purpose |
|------|---------|
| `communications.json` | Shared state file - single source of truth |
| `agent_comm.py` | Core library with Agent, FileWatcher, and CommunicationsFile classes |
| `agent_cli.py` | Interactive CLI for running agents |
| `blocking_demo.py` | Demo showing dependency-based blocking |

## Quick Start

### Run the Blocking Demo

```bash
cd agent_system
python3 blocking_demo.py
```

This demonstrates two agents (Builder and Designer) coordinating work:
1. Builder requests 2 tasks from Designer and becomes **BLOCKED**
2. Designer completes task 1 → Builder still blocked (missing 1 dependency)
3. Designer completes task 2 → Builder **UNBLOCKED** and continues

### Interactive CLI

**Terminal 1 - Start the file watcher:**
```bash
python3 agent_cli.py watcher
```

**Terminal 2 - Start an agent:**
```bash
python3 agent_cli.py agent researcher

researcher> mission Gather API requirements
researcher> request coder Please implement the auth module
researcher> status
```

**Terminal 3 - Start another agent:**
```bash
python3 agent_cli.py agent coder

coder> requests
# Shows: "From researcher: Please implement the auth module"

coder> working Implementing auth module
coder> complete researcher Please implement the auth module | Done! See auth.py
```

**Back in Terminal 2:**
```bash
researcher> deliveries
# Shows completed work from coder

researcher> ack
# Clears deliveries
```

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
    "requests": [],
    "added": [
      ["designer", "Schema: users(id, email, hash)", "Need DB schema"]
    ],
    "last_updated": "2026-01-19T08:00:00.000000"
  }
}
```

| Field | Description |
|-------|-------------|
| `mission` | Agent's overall goal |
| `working_on` | Current task |
| `done` | Last completed work |
| `next` | Planned next step |
| `requests` | Pending requests TO other agents: `[target, text]` |
| `added` | Deliveries FROM other agents: `[from, description, original_request]` |

## CLI Commands

### Status Commands
| Command | Description |
|---------|-------------|
| `mission <text>` | Set your mission |
| `working <text>` | Set current task |
| `done <text>` | Mark work as complete |
| `next <text>` | Set next planned task |
| `status` | View your current status |

### Communication Commands
| Command | Description |
|---------|-------------|
| `request <agent> <text>` | Send a request to another agent |
| `requests` | View requests directed at you |
| `complete <agent> <request> \| <description>` | Complete a request and deliver result |
| `deliveries` | View work delivered to you |
| `ack` | Acknowledge and clear deliveries |

### Other Commands
| Command | Description |
|---------|-------------|
| `agents` | List all agents |
| `view <agent>` | View another agent's status |
| `help` | Show all commands |
| `quit` | Exit |

## Key Concepts

### File Watcher Pattern
- FileWatcher polls `communications.json` using MD5 hashing
- When changes detected, all agents (except the writer) are notified
- Poll interval: 0.5 seconds

### Blocking on Dependencies
```python
# Agent can wait for multiple deliveries before proceeding
while len(my_deliveries) < required_count:
    # FileWatcher notifies when communications.json changes
    # Agent checks if dependencies are satisfied
    pass
# All dependencies received - unblocked!
```

### Thread Safety
- `CommunicationsFile` uses threading locks for concurrent access
- Safe for multiple agents in separate processes
