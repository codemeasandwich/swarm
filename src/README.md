# src

Main source code for the multi-agent orchestration framework.

## Purpose

Entry point and core modules for orchestrating multiple AI agents working on software development tasks. Provides plan management, agent coordination, lifecycle management, and CI/CD integration.

## Modules

| Module | Description |
|--------|-------------|
| [ci/](ci/) | CI/CD provider interface and event handling |
| [cli/](cli/) | Command-line interface for orchestration commands |
| [communication/](communication/) | Agent-to-agent coordination via file-based messaging |
| [config/](config/) | Centralized configuration management |
| [lifecycle/](lifecycle/) | Agent lifecycle management (Ralph Wiggum Loop) |
| [orchestrator/](orchestrator/) | Main orchestration engine and error definitions |
| [personas/](personas/) | Agent persona definitions and task matching |
| [plan/](plan/) | Project plan parsing and validation |
| [runtime/](runtime/) | Process, git branch, and workspace management |
| [swarm/](swarm/) | SWARM multi-agent framework for benchmarking |
| [types/](types/) | Global TypeScript/JSDoc type definitions |

## Usage

```javascript
import {
  Orchestrator,
  PlanParser,
  getConfig,
} from 'orchestration';

// Load and validate a project plan
const parser = new PlanParser();
const plan = await parser.parse('./plan.yaml');

// Start orchestration
const orchestrator = new Orchestrator(config);
await orchestrator.start(plan);
```

## Architecture

The framework follows a layered architecture:
1. **Plan Layer** - Parse and validate project plans (epics, stories, tasks)
2. **Persona Layer** - Match tasks to agent personas based on capabilities
3. **Communication Layer** - File-based messaging between agents
4. **Lifecycle Layer** - Manage agent spawning, monitoring, and breakpoints
5. **Runtime Layer** - Git branches, workspaces, and process management
6. **CI Layer** - Build status and PR integration
