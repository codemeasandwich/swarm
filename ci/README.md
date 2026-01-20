# CI

> CI/CD provider interface and event handling.

## Overview

The CI module provides an abstraction layer for CI/CD systems, allowing the orchestrator to:

- Trigger builds for agent branches
- Create and monitor pull requests
- Subscribe to CI events for unblocking
- Wait for builds and PR merges

## Key Components

| Component | Purpose |
|-----------|---------|
| `CIProvider` | Abstract base class for CI implementations |
| `LocalCIProvider` | Local testing implementation |
| `BuildStatus` | Build state tracking |
| `PRInfo` | Pull request information |
| `CIEvent` | CI system events |
| `CIEventEmitter` | Event emission system |
| `CIEventType` | Event type enumeration |

## Status Types

### BuildStatusType

| Status | Description |
|--------|-------------|
| `PENDING` | Build not yet started |
| `RUNNING` | Build in progress |
| `SUCCESS` | Build completed successfully |
| `FAILURE` | Build failed |
| `CANCELLED` | Build was cancelled |

### PRStatusType

| Status | Description |
|--------|-------------|
| `OPEN` | PR is open for review |
| `MERGED` | PR has been merged |
| `CLOSED` | PR was closed without merge |

## Usage

### Basic CI Operations

```python
from ci.local import LocalCIProvider
from pathlib import Path

provider = LocalCIProvider(Path("."))

# Trigger a build
run_id = await provider.trigger_build("agent/architect-T001")

# Check build status
status = await provider.get_build_status(run_id)
if status.is_success():
    print("Build passed!")

# Wait for build completion
status = await provider.wait_for_build(run_id, timeout=300)

# Cancel a build
await provider.cancel_build(run_id)
```

### Pull Requests

```python
# Create a PR
pr_info = await provider.create_pr(
    source_branch="integration",
    target_branch="main",
    title="Milestone: Calculator Core",
    body="## Summary\n- Implemented basic operations",
)
print(f"PR created: {pr_info.url}")

# Check PR status
pr_info = await provider.get_pr_status(pr_info.pr_number)
if pr_info.checks_passed:
    print("All checks passed!")

# Wait for merge
pr_info = await provider.wait_for_pr_merge(
    pr_number=pr_info.pr_number,
    timeout=600,
)

# Merge PR
success = await provider.merge_pr(pr_info.pr_number)
```

### Event Subscriptions

```python
from ci.interface import CIEvent

async def on_ci_event(event: CIEvent):
    if event.event_type == "build_success":
        print(f"Build succeeded on {event.branch}")
    elif event.event_type == "pr_merged":
        print(f"PR {event.pr_number} was merged")

# Subscribe to events
await provider.subscribe(on_ci_event)

# Unsubscribe
await provider.unsubscribe(on_ci_event)
```

### Event Types

| Event Type | Description |
|------------|-------------|
| `BUILD_TRIGGERED` | Build was started |
| `BUILD_SUCCESS` | Build completed successfully |
| `BUILD_FAILURE` | Build failed |
| `BUILD_CANCELLED` | Build was cancelled |
| `PR_CREATED` | Pull request created |
| `PR_MERGED` | Pull request merged |
| `PR_CLOSED` | Pull request closed |

## Implementing a CI Provider

```python
from ci.interface import CIProvider, BuildStatus, PRInfo, CIEvent
from typing import Optional, Dict, Any, Callable, Awaitable

class GitHubCIProvider(CIProvider):

    async def trigger_build(
        self,
        branch: str,
        config: Optional[Dict[str, Any]] = None
    ) -> str:
        # Trigger GitHub Actions workflow
        ...

    async def get_build_status(self, run_id: str) -> BuildStatus:
        # Query workflow run status
        ...

    async def cancel_build(self, run_id: str) -> bool:
        # Cancel workflow run
        ...

    async def create_pr(
        self,
        source_branch: str,
        target_branch: str,
        title: str,
        body: str = "",
    ) -> PRInfo:
        # Create GitHub PR
        ...

    async def get_pr_status(self, pr_number: int) -> PRInfo:
        # Query PR status
        ...

    async def merge_pr(self, pr_number: int) -> bool:
        # Merge the PR
        ...

    async def subscribe(
        self,
        callback: Callable[[CIEvent], Awaitable[None]]
    ):
        # Subscribe to webhook events
        ...

    async def unsubscribe(
        self,
        callback: Callable[[CIEvent], Awaitable[None]]
    ):
        # Unsubscribe from events
        ...
```

## Local CI Provider

The `LocalCIProvider` is for testing without a real CI system:

- Simulates build execution with configurable delays
- Stores PR information in memory
- Emits events through `CIEventEmitter`

```python
from ci.local import LocalCIProvider
from ci.events import CIEventEmitter

emitter = CIEventEmitter()
provider = LocalCIProvider(
    repo_dir=Path("."),
    event_emitter=emitter,
)
```

## Related Modules

- [/orchestrator](../orchestrator/) - Uses CI for milestone PRs
- [/lifecycle](../lifecycle/) - Subscribes to CI events for unblocking

## Files

- [`interface.py`](./interface.py) - Abstract CI provider interface
- [`local.py`](./local.py) - Local testing implementation
- [`events.py`](./events.py) - CI event types and emitter
