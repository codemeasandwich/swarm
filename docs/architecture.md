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

| Module | Purpose |
|--------|---------|
| `communications.json` | Shared state file - single source of truth |
| `src/communication/` | Core library with Agent, FileWatcher, and CommunicationsFile classes |
| `src/cli/` | Interactive CLI for running agents |
| `examples/blocking-demo.js` | Demo showing dependency-based blocking |

## Quick Start

### Run the Blocking Demo

```bash
node examples/blocking-demo.js
```

This demonstrates two agents (Builder and Designer) coordinating work:
1. Builder requests 2 tasks from Designer and becomes **BLOCKED**
2. Designer completes task 1 -> Builder still blocked (missing 1 dependency)
3. Designer completes task 2 -> Builder **UNBLOCKED** and continues

### Interactive CLI

**Terminal 1 - Start the file watcher:**
```bash
npm run cli -- watcher
```

**Terminal 2 - Start an agent:**
```bash
npm run cli -- agent researcher
```

**Terminal 3 - Start another agent:**
```bash
npm run cli -- agent coder
```

## Data Structure

```json
{
  "_meta": {
    "version": "1.0",
    "lastUpdated": "2026-01-19T08:00:00.000Z",
    "lastUpdatedBy": "builder"
  },
  "builder": {
    "mission": "Build the user management application",
    "workingOn": "Implementing user CRUD",
    "done": "",
    "next": "Deploy to staging",
    "requests": [],
    "added": [
      ["designer", "Schema: users(id, email, hash)", "Need DB schema"]
    ],
    "lastUpdated": "2026-01-19T08:00:00.000Z"
  }
}
```

| Field | Description |
|-------|-------------|
| `mission` | Agent's overall goal |
| `workingOn` | Current task |
| `done` | Last completed work |
| `next` | Planned next step |
| `requests` | Pending requests TO other agents: `[target, text]` |
| `added` | Deliveries FROM other agents: `[from, description, originalRequest]` |

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
| `complete <agent> <request> | <description>` | Complete a request and deliver result |
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
- FileWatcher uses chokidar for cross-platform file watching
- When changes detected, all registered agents are notified via callbacks
- Efficient native filesystem events (no polling)

### Blocking on Dependencies
```javascript
// Agent can wait for multiple deliveries before proceeding
const deliveries = await agent.getMyDeliveries();
while (deliveries.length < requiredCount) {
  // FileWatcher notifies when communications.json changes
  // Agent checks if dependencies are satisfied
  await sleep(100);
}
// All dependencies received - unblocked!
```

### Event Loop Safety
- Node.js single-threaded event loop eliminates race conditions
- Async/await patterns for clean asynchronous code
- No explicit locking needed (unlike Python threading)
