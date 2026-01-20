# Personas

> Agent persona definitions, task matching, and context generation.

## Overview

The personas module defines agent roles and manages the mapping between tasks and agents. It provides:

- Persona configuration with capabilities and constraints
- Task-to-role matching logic
- `.claude.md` context file generation
- Agent instance runtime state

## Key Components

| Component | Purpose |
|-----------|---------|
| `Persona` | Base persona definition (from plan module) |
| `PersonaConfig` | Runtime configuration for a persona |
| `AgentInstance` | Runtime state of an agent |
| `LifecycleState` | Agent lifecycle state enum |
| `Breakpoint` | Natural stopping point info |
| `PersonaMatcher` | Maps tasks to personas |
| `ClaudeMdGenerator` | Generates `.claude.md` context |

## Lifecycle States

| State | Description |
|-------|-------------|
| `IDLE` | Not currently working |
| `WORKING` | Actively working on a task |
| `BLOCKED` | Waiting for dependencies |
| `PR_PENDING` | Waiting for PR review/merge |
| `COMPLETE` | All work finished |
| `FAILED` | Unrecoverable error |

## Usage

### Working with Personas

```python
from personas.models import PersonaConfig, AgentInstance, LifecycleState
from plan.models import Persona

# Create persona configuration
persona = Persona(
    id="arch-01",
    name="System Architect",
    role="architect",
    capabilities=["API design", "system architecture"],
    constraints=["No implementation code"],
)

config = PersonaConfig(
    persona=persona,
    working_directory="sandbox",
    max_retries=100,
)
```

### Creating Agent Instances

```python
from personas.models import AgentInstance, LifecycleState
from datetime import datetime

agent = AgentInstance(
    agent_id="architect-T001",
    persona_config=config,
    branch="agent/architect-T001",
    sandbox_path="sandbox",
    lifecycle_state=LifecycleState.IDLE,
    started_at=datetime.now(),
)

# Set to working state
agent.set_working(task)

# Mark as blocked
agent.set_blocked(["T002", "T003"], reason="Waiting for implementation")

# Complete a task
agent.set_task_complete(summary="API design completed")

# Track spawns
agent.increment_spawn()
```

### Task Matching

```python
from personas.matcher import PersonaMatcher

matcher = PersonaMatcher(plan)

# Get available tasks for a persona
tasks = matcher.get_claimable_tasks(persona)

# Get blocked tasks
blocked = matcher.get_blocked_tasks_for_role("implementer")

# Check workload
workload = matcher.get_role_workload("architect")
print(f"Available: {workload['available']}, In progress: {workload['in_progress']}")

# Claim a task
matcher.claim_task(task, agent_id="arch-T001")

# Check if should spawn new agent
if matcher.should_spawn_agent(persona):
    # Spawn new agent
    pass
```

### Generating Context

```python
from personas.generator import ClaudeMdGenerator

generator = ClaudeMdGenerator(plan)

claude_md = generator.generate(
    persona_config=config,
    task=task,
    branch="agent/architect-T001",
    context_summary="Previous work: Completed initial research...",
)

# Write to sandbox
Path("sandbox/.claude.md").write_text(claude_md)
```

## Agent Instance State Diagram

```
┌──────────┐
│   IDLE   │◄───────────────────────────────────┐
└────┬─────┘                                    │
     │ set_working(task)                        │
     ▼                                          │
┌──────────┐                                    │
│ WORKING  │────────────────────┐               │
└────┬─────┘                    │               │
     │                          │               │
     ├─── set_blocked() ────►┌──▼──────┐        │
     │                       │ BLOCKED │────────┤
     │                       └─────────┘        │
     │                                          │
     ├─── set_pr_pending() ─►┌──────────┐       │
     │                       │PR_PENDING│───────┤
     │                       └──────────┘       │
     │                                          │
     └─── set_task_complete() ──────────────────┘
                   │
                   │ (all tasks done)
                   ▼
            ┌──────────┐
            │ COMPLETE │
            └──────────┘
```

## Breakpoint Types

| Type | Description | Fields |
|------|-------------|--------|
| `task_complete` | Task finished | `task_id`, `summary` |
| `blocked` | Waiting on deps | `blocked_on`, `reason` |
| `pr_created` | PR submitted | `pr_url`, `task_id` |

## Related Modules

- [/plan](../plan/) - Persona definitions in plan
- [/lifecycle](../lifecycle/) - Uses breakpoints for loop control
- [/orchestrator](../orchestrator/) - Spawns agent instances
- [/communication](../communication/) - Agent status updates

## Files

- [`models.py`](./models.py) - Data models (PersonaConfig, AgentInstance, etc.)
- [`matcher.py`](./matcher.py) - Task-to-persona matching
- [`generator.py`](./generator.py) - `.claude.md` generation
