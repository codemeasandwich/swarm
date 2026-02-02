# src/swarm/state

SWARM workflow state persistence.

## Purpose

Serializes and persists workflow state to enable pause/resume, crash recovery, and experiment reproducibility.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `persistence.js` | File I/O for state serialization |
| `workflow-state.js` | `WorkflowStateManager` for runtime state management |

## Exports

```javascript
import {
  // Persistence
  serializeState,
  deserializeState,
  saveState,
  loadState,
  stateExists,
  getStateFilePath,
  // State management
  WorkflowStateManager,
} from './state/index.js';
```

## State Structure

```javascript
{
  workflowId: 'uuid',
  status: 'running',
  startedAt: '2024-01-01T00:00:00Z',
  config: { ... },
  tasks: [
    { id: 'task-1', status: 'completed', result: { ... } }
  ],
  workers: [
    { id: 'worker-1', status: 'idle', currentTask: null }
  ],
  metrics: {
    tasksCompleted: 5,
    totalCost: 0.15
  }
}
```

## Usage

```javascript
// Save state
await saveState(workflowId, state);

// Load state
const state = await loadState(workflowId);

// State manager
const manager = new WorkflowStateManager(workflowId);
await manager.updateTask('task-1', { status: 'completed' });
await manager.checkpoint();
```

## State File Location

States are stored at:
```
.state/swarm/<workflow-id>.json
```

## Dependencies

- `../types/` - State type definitions
