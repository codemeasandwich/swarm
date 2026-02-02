# src/swarm/execution

SWARM execution layer - worker lifecycle, context, sandbox, and memory.

## Purpose

Manages the runtime execution of AI agent workers including process spawning, context building, tool sandboxing, and memory persistence.

## Submodules

| Submodule | Description |
|-----------|-------------|
| `worker/` | `WorkerPool`, `WorkerSpawner`, worker lifecycle management |
| `context/` | Context builders with token estimation and truncation |
| `sandbox/` | Tool access control and blocklists |
| `memory/` | Ephemeral and file-based memory storage |

## Exports

```javascript
import {
  // Worker
  ManagedWorkerInstance,
  WorkerPool,
  WorkerSpawner,
  createWorkerModule,
  createEpisodicWorker,
  createPersistentWorker,
  // Context
  estimateTokens,
  truncateToTokens,
  createContextBuilder,
  createMinimalContextBuilder,
  createScopedContextBuilder,
  createRichContextBuilder,
  // Sandbox
  MINIMAL_TOOLS,
  STANDARD_TOOLS,
  EXTENDED_TOOLS,
  FULL_TOOLS,
  DEFAULT_BLOCKLIST,
  isBlocked,
  createSandbox,
  // Memory
  MemoryOperation,
  createMemoryManager,
  createEphemeralMemory,
  createFileBasedMemory,
} from './execution/index.js';
```

## Worker Types

| Type | Description |
|------|-------------|
| `episodic` | Fresh context per task, no state carryover |
| `persistent` | Maintains context across tasks |

## Context Builder Variants

| Variant | Description |
|---------|-------------|
| `minimal` | Task description only |
| `scoped` | Task + relevant file contents |
| `rich` | Full project context |

## Tool Sandboxes

| Level | Tools Included |
|-------|----------------|
| `MINIMAL_TOOLS` | read |
| `STANDARD_TOOLS` | read, write, grep |
| `EXTENDED_TOOLS` | read, write, grep, bash (limited) |
| `FULL_TOOLS` | All tools unrestricted |

## Dependencies

- `../types/` - Worker and execution types
- `../registry/` - Module registration
