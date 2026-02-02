# SWARM Framework

> **S**ystematic **W**orkflow **A**gent **R**untime **M**anager
>
> A modular Node.js framework for constructing and measuring AI agent workflows.

## Overview

This framework enables autonomous multi-agent coordination where independent Claude agents work together on complex projects. It handles:

- **Project planning** - Hierarchical breakdown into Epics, Stories, and Tasks
- **Agent coordination** - Spawning agents for specific roles with isolated workspaces
- **Lifecycle management** - The "Ralph Wiggum Loop" pattern for continuous improvement
- **Communication** - File-based coordination via shared `communications.json`
- **CI/CD integration** - Event-driven unblocking and PR management

## Architecture

```
┌────────────────────────────────────────────────────────────────────────┐
│                           ORCHESTRATOR                                  │
│                    (Main coordination engine)                           │
├────────────────────────────────────────────────────────────────────────┤
│                                                                        │
│  ┌──────────┐  ┌──────────┐  ┌───────────┐  ┌─────────────────────┐   │
│  │   PLAN   │  │ PERSONAS │  │ LIFECYCLE │  │    COMMUNICATION    │   │
│  │ parsing  │  │ matching │  │   loop    │  │   file watching     │   │
│  │ validate │  │ generate │  │  context  │  │   requests/deliver  │   │
│  └────┬─────┘  └────┬─────┘  └─────┬─────┘  └──────────┬──────────┘   │
│       │             │              │                    │              │
│       └─────────────┼──────────────┼────────────────────┘              │
│                     │              │                                   │
│              ┌──────┴──────────────┴────────┐                          │
│              │           RUNTIME            │                          │
│              │  process | branches | workspace │                       │
│              └─────────────┬────────────────┘                          │
│                            │                                           │
│              ┌─────────────┴────────────────┐                          │
│              │             CI               │                          │
│              │   interface | local | events │                          │
│              └──────────────────────────────┘                          │
└────────────────────────────────────────────────────────────────────────┘
```

## Quick Start

### Prerequisites

- Node.js 18+
- Git

### Installation

```bash
cd orchestration
npm install
```

### Run the Demos

```bash
# Duo demo - two agents working together
node examples/duo-demo.js

# Blocking demo - demonstrates dependency blocking
node examples/blocking-demo.js
```

### Interactive CLI

**Terminal 1 - Start the file watcher:**
```bash
npm run cli -- watcher
```

**Terminal 2 - Start an agent:**
```bash
npm run cli -- agent researcher
```

Or use the CLI directly:
```bash
./bin/orchestrate.js watcher
./bin/orchestrate.js agent researcher
```

## Core Concepts

### The Ralph Wiggum Loop

Agents work until hitting a natural breakpoint (task complete, blocked, or PR created). Rather than retrying with stale context, the system:

1. Captures a `ContextSnapshot` of progress
2. Terminates the agent process
3. Spawns a fresh agent with a summary of previous work
4. Prevents context rot and hallucination loops

### File-Based Communication

Agents coordinate through `communications.json`:
- Update status, mission, and current work
- Send requests to other agents
- Receive deliveries when work is complete
- Signal breakpoints for lifecycle management

### Task Dependencies

Tasks can depend on other tasks. Agents automatically block when dependencies aren't met and unblock when CI events indicate completion.

## Documentation Index

### Core Modules

| Module | Description |
|--------|-------------|
| [/src/orchestrator](./src/orchestrator/) | Main coordination engine - entry point |
| [/src/plan](./src/plan/) | Project plan models, parsing, validation |
| [/src/personas](./src/personas/) | Agent definitions, task matching, context generation |
| [/src/lifecycle](./src/lifecycle/) | Agent lifecycle loop (Ralph Wiggum pattern) |
| [/src/runtime](./src/runtime/) | Process, git branch, and workspace management |
| [/src/communication](./src/communication/) | Agent coordination via shared file |
| [/src/ci](./src/ci/) | CI/CD provider interface and events |
| [/src/cli](./src/cli/) | Interactive command-line interface |

### Supporting

| Directory | Description |
|-----------|-------------|
| [/docs](./docs/) | Architecture documentation |
| [/tests](./tests/) | Test suite |
| [/examples](./examples/) | Demo applications |
| [/.state](./.state/) | Runtime state and plan files |

### Configuration

| File | Description |
|------|-------------|
| [`src/config/index.js`](./src/config/index.js) | Centralized configuration with env vars |
| [`package.json`](./package.json) | Project metadata and scripts |
| [`jsconfig.json`](./jsconfig.json) | JSDoc type checking configuration |

## Usage Example

```javascript
import { Orchestrator, OrchestratorConfig } from './src/orchestrator/orchestrator.js';

const config = new OrchestratorConfig({
  repoDir: '.',
  planDir: '.state/plans',
  autoSpawn: true,
});

const orchestrator = new Orchestrator(config);

async function main() {
  await orchestrator.start();
  await orchestrator.waitForCompletion();
  console.log(orchestrator.getStatus());
  await orchestrator.stop();
}

main().catch(console.error);
```

## Testing

```bash
# Run all tests
npm test

# Run tests with coverage
npm run test:coverage

# Run only e2e tests
node --test tests/e2e/
```

## Environment Variables

| Variable | Default | Description |
|----------|---------|-------------|
| `ORCH_REPO_DIR` | `.` | Repository directory |
| `ORCH_PLAN_DIR` | `.state/plans` | Plan files directory |
| `ORCH_COMM_FILE` | `communications.json` | Communications file path |
| `ORCH_WORKSPACE_DIR` | `.state/workspaces` | Agent workspace directory |
| `ORCH_POLL_INTERVAL` | `1000` | File polling interval (ms) |
| `ORCH_CONTEXT_MAX_LENGTH` | `50000` | Max context length |
| `ORCH_AUTO_SPAWN` | `false` | Auto-spawn agents |
| `ORCH_MAX_RETRIES` | `3` | Max retry attempts |
| `ORCH_INTEGRATION_BRANCH` | `integration` | Integration branch name |

## License

See LICENSE file for details.
