# Orchestrator

> Main coordination engine for multi-agent orchestration.

## Overview

The orchestrator is the entry point for the framework. It coordinates all agents and manages the complete project lifecycle:

- Parses and validates project plans
- Spawns agents for each role with available tasks
- Manages agent lifecycles with the Ralph Wiggum loop
- Coordinates CI events for unblocking
- Handles milestone completion and PR creation

## Key Components

| Component | Purpose |
|-----------|---------|
| `Orchestrator` | Main coordination class |
| `OrchestratorConfig` | Configuration dataclass |
| `OrchestratorError` | Base exception |
| `PlanParseError` | Plan parsing failure |
| `PlanValidationError` | Plan validation failure |
| `AgentSpawnError` | Agent spawning failure |
| `run_orchestration()` | Convenience function |

## Usage

### Basic Usage

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
    await orchestrator.stop()
```

### Convenience Function

```python
from orchestrator.main import run_orchestration

status = await run_orchestration(
    plan_dir=".state/plans",
    repo_dir="."
)
```

## Configuration

`OrchestratorConfig` accepts the following parameters:

| Parameter | Type | Default | Description |
|-----------|------|---------|-------------|
| `repo_dir` | Path | required | Repository root directory |
| `plan_dir` | Path | required | Directory containing plan files |
| `sandbox_dir` | Path | `{repo_dir}/sandbox` | Agent workspace directory |
| `integration_branch` | str | `"integration"` | Branch for merging completed work |
| `max_retries` | int | `100` | Maximum retries per agent |
| `retry_interval` | float | `30.0` | Seconds between retry attempts |
| `auto_spawn` | bool | `True` | Spawn agents automatically on start |
| `auto_merge` | bool | `False` | Auto-create PRs for milestones |

## Agent Lifecycle Flow

```
              ┌─────────┐
              │  START  │
              └────┬────┘
                   │
          ┌────────▼────────┐
          │   Parse Plan    │
          │  Validate Plan  │
          └────────┬────────┘
                   │
          ┌────────▼────────┐
          │  Spawn Agents   │◄────────┐
          │  (per role)     │         │
          └────────┬────────┘         │
                   │                  │
          ┌────────▼────────┐         │
          │ Run Lifecycle   │         │
          │     Loops       │         │ retry
          └────────┬────────┘         │
                   │                  │
        ┌──────────┼──────────┐       │
        ▼          ▼          ▼       │
   ┌────────┐ ┌────────┐ ┌────────┐   │
   │Complete│ │Blocked │ │ Error  │───┘
   └────────┘ └────┬───┘ └────────┘
                   │
          (wait for CI event)
```

## API Reference

### `Orchestrator`

#### Methods

- `start(plan_dir: Path = None) -> bool` - Start orchestrator with a plan
- `spawn_agent(role: str, task: Task) -> AgentInstance` - Spawn agent for a task
- `status() -> Dict[str, Any]` - Get current orchestrator status
- `get_milestone_pr(milestone_id: str) -> Optional[str]` - Get PR URL for milestone
- `stop()` - Stop orchestrator and all agents
- `wait_for_completion(timeout: float = None) -> bool` - Wait for agents to finish

### `run_orchestration()`

```python
async def run_orchestration(
    plan_dir: str,
    repo_dir: Optional[str] = None
) -> Dict[str, Any]
```

Convenience function that handles the full lifecycle automatically.

## Related Modules

- [/plan](../plan/) - Plan models and parsing
- [/personas](../personas/) - Agent definitions
- [/lifecycle](../lifecycle/) - Agent lifecycle loop
- [/runtime](../runtime/) - Process and workspace management
- [/communication](../communication/) - Agent coordination
- [/ci](../ci/) - CI/CD integration

## Files

- [`main.py`](./main.py) - Main orchestrator implementation
