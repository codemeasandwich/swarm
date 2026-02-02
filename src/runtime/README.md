# src/runtime

Process, git branch, and workspace management.

## Purpose

Handles the execution environment for agents: spawning processes, managing git branches for isolated work, and creating sandboxed workspaces.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `process.js` | `AgentProcess` for spawning/managing agent processes, `TerminalManager` for terminal allocation |
| `branches.js` | `BranchInfo` data class and `BranchManager` for git branch operations |
| `workspace.js` | `WorkspaceManager` for creating isolated agent workspaces |

## Exports

```javascript
import {
  AgentProcess,
  TerminalManager,
  BranchInfo,
  BranchManager,
  WorkspaceManager,
} from './runtime/index.js';
```

## Branch Naming

Agents work on dedicated branches following the pattern:
```
agent/<agent-id>/<task-id>
```

## Workspace Isolation

Each agent gets an isolated workspace:
```
.state/sandboxes/
├── agent-001/
│   └── (worktree or copy of repo)
└── agent-002/
    └── (worktree or copy of repo)
```

## Process Management

`AgentProcess` handles:
- Spawning Claude Code CLI processes
- Streaming stdout/stderr
- Timeout enforcement
- Graceful shutdown

## Dependencies

- `child_process` - Node.js process spawning
- `../config/` - Sandbox paths and timeouts
