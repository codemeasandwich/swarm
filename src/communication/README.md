# src/communication

Agent-to-agent coordination via file-based messaging.

## Purpose

Enables multiple agents to coordinate work through a shared `communications.json` file. Agents publish status updates and request help from other agents.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `agent-status.js` | `AgentStatus` and `EnhancedAgentStatus` classes for tracking agent state |
| `communications-file.js` | `CommunicationsFile` class for reading/writing the shared JSON file |
| `file-watcher.js` | `FileWatcher` class for monitoring file changes using chokidar |
| `agent.js` | `Agent` and `TaskAgent` classes for agent behavior |
| `coordinator.js` | `Coordinator` class for orchestrating agent interactions |

## Exports

```javascript
import {
  AgentStatus,
  EnhancedAgentStatus,
  CommunicationsFile,
  FileWatcher,
  Agent,
  TaskAgent,
  Coordinator,
} from './communication/index.js';
```

## Communication Flow

1. Agents write status to `communications.json` with their mission, current work, and requests
2. `FileWatcher` detects changes and notifies listeners
3. `Coordinator` processes requests and routes work between agents
4. Agents read responses and continue working

## Status Structure

```javascript
{
  mission: "Agent's overall goal",
  workingOn: "Current task",
  done: "Completed work",
  next: "Planned work",
  requests: [["targetAgent", "request"]],
  added: [["fromAgent", "description", "originalRequest"]]
}
```

## Dependencies

- `chokidar` - File system watcher
- `../config/` - Configuration for file paths
