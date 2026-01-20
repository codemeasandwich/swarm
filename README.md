# Multi-Agent Orchestration Framework

> A Python framework for coordinating multiple AI agents to collaborate on software engineering projects.

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

- Python 3.9+
- Git

### Installation

```bash
cd orchestration
pip install -e .
```

### Run the Blocking Demo

```bash
python3 -m examples.demos.blocking_demo
```

This demonstrates two agents coordinating work with dependency blocking.

### Interactive CLI

**Terminal 1 - Start the file watcher:**
```bash
python3 -m cli.main watcher
```

**Terminal 2 - Start an agent:**
```bash
python3 -m cli.main agent researcher
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
| [/orchestrator](./orchestrator/) | Main coordination engine - entry point |
| [/plan](./plan/) | Project plan models, parsing, validation |
| [/personas](./personas/) | Agent definitions, task matching, context generation |
| [/lifecycle](./lifecycle/) | Agent lifecycle loop (Ralph Wiggum pattern) |
| [/runtime](./runtime/) | Process, git branch, and workspace management |
| [/communication](./communication/) | Agent coordination via shared file |
| [/ci](./ci/) | CI/CD provider interface and events |
| [/cli](./cli/) | Interactive command-line interface |

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
| [`config.py`](./config.py) | Centralized configuration with env vars |
| [`pyproject.toml`](./pyproject.toml) | Project metadata and pytest config |

## Usage Example

```python
from orchestrator.main import Orchestrator, OrchestratorConfig
from pathlib import Path

config = OrchestratorConfig(
    repo_dir=Path("."),
    plan_dir=Path(".state/plans"),
    auto_spawn=True,
)

orchestrator = Orchestrator(config)

async def main():
    await orchestrator.start()
    await orchestrator.wait_for_completion()
    print(orchestrator.status())
    await orchestrator.stop()
```

## Testing

```bash
# Run all tests with coverage
pytest

# Run only e2e tests
pytest tests/e2e/

# View coverage report
open coverage_html/index.html
```

## License

See LICENSE file for details.
