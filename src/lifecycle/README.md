# src/lifecycle

Agent lifecycle management using the Ralph Wiggum Loop pattern.

## Purpose

Manages the complete lifecycle of agent processes: spawning, monitoring, breakpoint handling, and context preservation across respawns.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `context.js` | `ContextSnapshot` and `ContextBuilder` for preserving state across respawns |
| `loop.js` | `AgentLifecycleLoop` and `RalphWiggumLoop` for continuous agent execution |

## Exports

```javascript
import {
  ContextSnapshot,
  ContextBuilder,
  LoopResult,
  AgentLifecycleLoop,
  RalphWiggumLoop,
} from './lifecycle/index.js';
```

## Ralph Wiggum Loop

Named after the pattern where agents work until they hit a "breakpoint" (task complete, blocked, or PR created), then get respawned with fresh context.

```
┌─────────────────────────────────────┐
│  Spawn Agent with Context Snapshot  │
└──────────────┬──────────────────────┘
               │
               ▼
        ┌──────────────┐
        │ Agent Works  │
        └──────┬───────┘
               │
               ▼
      ┌────────────────────┐
      │  Breakpoint Hit?   │──No──┐
      └────────┬───────────┘      │
               │ Yes              │
               ▼                  │
      ┌────────────────────┐      │
      │  Save Snapshot     │      │
      └────────┬───────────┘      │
               │                  │
               └────────◄─────────┘
```

## Loop Results

- `TASK_COMPLETE` - Agent finished assigned task
- `BLOCKED` - Agent waiting on dependencies
- `PR_CREATED` - Agent created a pull request
- `MAX_RETRIES` - Exceeded retry limit
- `ERROR` - Unrecoverable error
- `SHUTDOWN` - Graceful shutdown requested

## Dependencies

- `../types/` - `LifecycleState`, `LoopResultType`, `BreakpointType` enums
- `../communication/` - Agent status updates
