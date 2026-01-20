# Lifecycle

> Agent lifecycle loop implementing the "Ralph Wiggum" pattern for continuous improvement.

## Overview

The lifecycle module manages agent execution through a continuous retry mechanism with context reset. Instead of running agents until failure, it embraces natural breakpoints and iterative improvement.

The key insight: **fresh context beats stale context**. When an agent hits a breakpoint, we terminate it and spawn a fresh agent with a summary of previous work, preventing context rot and hallucination loops.

## The Ralph Wiggum Loop

```
┌─────────────────────────────────────────────────────────────┐
│                    RALPH WIGGUM LOOP                        │
│        "Embrace iterative improvement over perfection"      │
└─────────────────────────────────────────────────────────────┘

      ┌───────────────┐
      │ Capture       │
      │ Context       │◄───────────────────────┐
      │ Snapshot      │                        │
      └───────┬───────┘                        │
              │                                │
      ┌───────▼───────┐                        │
      │ Spawn Fresh   │                        │
      │ Agent with    │                        │
      │ Context       │                        │
      └───────┬───────┘                        │
              │                                │
      ┌───────▼───────┐                        │
      │ Agent Works   │                        │
      │ Until         │                        │
      │ Breakpoint    │                        │
      └───────┬───────┘                        │
              │                                │
    ┌─────────┼─────────────┐                  │
    ▼         ▼             ▼                  │
┌───────┐ ┌───────┐    ┌───────┐              │
│task   │ │blocked│    │  PR   │              │
│done   │ │       │    │created│              │
└───┬───┘ └───┬───┘    └───┬───┘              │
    │         │            │                   │
    │    ┌────▼────┐  ┌────▼────┐              │
    │    │Terminate│  │Terminate│              │
    │    │& Wait   │  │& Wait   │              │
    │    │CI Event │  │PR Merge │              │
    │    └────┬────┘  └────┬────┘              │
    │         │            │                   │
    │         └────────────┴───────────────────┘
    │                (respawn with new context)
    ▼
 ┌──────┐
 │ DONE │
 └──────┘
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `AgentLifecycleLoop` | Main loop controller |
| `LoopResult` | Result of a loop iteration |
| `LoopResultType` | Enum of possible outcomes |
| `ContextSnapshot` | Captures agent state at breakpoint |
| `ContextBuilder` | Builds context summaries |

## Loop Result Types

| Type | Description |
|------|-------------|
| `TASK_COMPLETE` | Agent finished the task |
| `BLOCKED` | Agent waiting for dependencies |
| `PR_CREATED` | Agent created a pull request |
| `MAX_RETRIES` | Exceeded retry limit |
| `ERROR` | Unrecoverable error |
| `SHUTDOWN` | Graceful shutdown requested |

## Usage

```python
from lifecycle.loop import AgentLifecycleLoop, LoopResult, LoopResultType

loop = AgentLifecycleLoop(
    repo_dir=repo_dir,
    plan=plan,
    ci_provider=ci_provider,
    terminal_manager=terminal_manager,
    branch_manager=branch_manager,
    workspace_manager=workspace_manager,
    comm_file_path=repo_dir / "communications.json",
    max_retries=100,
    retry_interval=30.0,
)

result = await loop.run_agent_loop(agent, task)

if result.result_type == LoopResultType.TASK_COMPLETE:
    print(f"Task {result.task_id} completed!")
elif result.result_type == LoopResultType.BLOCKED:
    print(f"Blocked on: {result.blocked_on}")
elif result.result_type == LoopResultType.PR_CREATED:
    print(f"PR created: {result.pr_url}")
```

## Breakpoints

Agents signal breakpoints by updating `communications.json`:

```json
{
  "agent-T001": {
    "lifecycle_state": "complete",
    "breakpoint": {
      "type": "task_complete",
      "task_id": "T001",
      "summary": "Implemented calculator API"
    }
  }
}
```

### Breakpoint Types

| Type | When Used |
|------|-----------|
| `task_complete` | Task finished successfully |
| `blocked` | Waiting for dependencies |
| `pr_created` | Pull request created |

## Context Snapshots

When an agent hits a breakpoint, we capture:

- Task progress and status
- Git branch and commit state
- Dependencies and blockers
- Communications state
- Retry count and spawn count

The next spawn receives a **summary** of this context, not the full history.

## Configuration

From `config.py`:

| Setting | Default | Description |
|---------|---------|-------------|
| `max_retries` | 100 | Maximum retries per agent |
| `retry_interval` | 30.0 | Seconds between retries |
| `breakpoint_check_interval` | 1.0 | Seconds between breakpoint checks |
| `pr_merge_timeout` | 3600 | Seconds to wait for PR merge |

## Related Modules

- [/orchestrator](../orchestrator/) - Starts lifecycle loops
- [/runtime](../runtime/) - Process and workspace management
- [/communication](../communication/) - Breakpoint signaling
- [/ci](../ci/) - CI events for unblocking

## Files

- [`loop.py`](./loop.py) - Main lifecycle loop implementation
- [`context.py`](./context.py) - Context snapshot and builder
