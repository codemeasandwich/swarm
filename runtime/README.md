# Runtime

> Process management, git branches, and workspace isolation.

## Overview

The runtime module provides infrastructure for running agents in isolated environments:

- **Process management** - Spawn and manage Claude CLI subprocesses
- **Branch management** - Git branch isolation per agent
- **Workspace management** - Sandboxed directories for each agent

## Key Components

| Component | Purpose |
|-----------|---------|
| `TerminalManager` | Manages agent subprocesses |
| `AgentProcess` | Represents a running subprocess |
| `BranchManager` | Git branch operations |
| `BranchInfo` | Branch state tracking |
| `WorkspaceManager` | Sandbox directory management |

## Process Management

### Spawning a Claude Agent

```python
from runtime.process import TerminalManager
from pathlib import Path

manager = TerminalManager(Path("."))

# Spawn Claude CLI agent
process = manager.spawn_claude_agent(
    agent_id="architect-T001",
    prompt="Complete task T001: Design the API",
    working_dir=Path("sandbox"),
    timeout=300,
    dangerously_skip_permissions=True,
)

# Check if running
if process.is_running:
    print(f"Agent running with PID: {process.pid}")

# Get output
output = manager.get_output("architect-T001")
errors = manager.get_errors("architect-T001")

# Wait for completion
return_code = manager.wait_for_completion("architect-T001", timeout=300)

# Terminate
manager.terminate("architect-T001")

# Terminate all
manager.terminate_all()
```

### Output Callbacks

```python
def on_output(stream: str, line: str):
    if stream == "stdout":
        print(f"[OUT] {line}")
    else:
        print(f"[ERR] {line}")

manager.register_output_callback("architect-T001", on_output)
```

### AgentProcess Properties

| Property | Description |
|----------|-------------|
| `pid` | Process ID |
| `is_running` | Whether process is active |
| `return_code` | Exit code (None if running) |
| `output_lines` | Captured stdout lines |
| `error_lines` | Captured stderr lines |

## Branch Management

### Creating Agent Branches

```python
from runtime.branches import BranchManager
from pathlib import Path

branches = BranchManager(
    repo_dir=Path("."),
    integration_branch="integration",
)

# Create agent branch
branch_name = branches.create_agent_branch(
    agent_id="architect-T001",
    task_id="T001",
)
# Returns: "agent/architect-T001-T001"

# Commit changes
branches.commit_changes(
    agent_id="architect-T001",
    message="Completed API design",
)

# Push branch
branches.push_branch("architect-T001")

# Merge to integration
branches.merge_to_integration("architect-T001")

# Get diff from base
diff = branches.get_diff_from_base("architect-T001")
```

### Branch Naming Convention

```
agent/{agent_id}-{task_id}
```

Example: `agent/architect-T001-T001`

## Workspace Management

### Creating Sandboxes

```python
from runtime.workspace import WorkspaceManager
from pathlib import Path

workspace = WorkspaceManager(Path("sandbox"))

# Create sandbox for agent
sandbox_path = workspace.create_sandbox("architect-T001")
# Returns: Path("sandbox/architect-T001")

# Get sandbox path
path = workspace.get_sandbox("architect-T001")

# Inject .claude.md context
workspace.inject_claude_md("architect-T001", claude_md_content)

# Clean up
workspace.cleanup("architect-T001")
workspace.cleanup_all()
```

### Sandbox Structure

```
sandbox/
├── architect-T001/
│   ├── .claude.md       # Agent context
│   └── ... (agent work)
├── implementer-T002/
│   ├── .claude.md
│   └── ...
└── tester-T003/
    ├── .claude.md
    └── ...
```

## Architecture

```
┌─────────────────────────────────────────────────────────────────┐
│                        RUNTIME LAYER                            │
├─────────────────────────────────────────────────────────────────┤
│                                                                 │
│  ┌─────────────────┐  ┌─────────────────┐  ┌────────────────┐  │
│  │ TerminalManager │  │  BranchManager  │  │WorkspaceManager│  │
│  ├─────────────────┤  ├─────────────────┤  ├────────────────┤  │
│  │ spawn_claude_   │  │ create_agent_   │  │ create_sandbox │  │
│  │   agent()       │  │   branch()      │  │ inject_claude_ │  │
│  │ terminate()     │  │ commit_changes()│  │   md()         │  │
│  │ get_output()    │  │ merge_to_       │  │ cleanup()      │  │
│  │                 │  │   integration() │  │                │  │
│  └────────┬────────┘  └────────┬────────┘  └───────┬────────┘  │
│           │                    │                    │           │
│           ▼                    ▼                    ▼           │
│  ┌─────────────────────────────────────────────────────────────┐│
│  │                   Agent Subprocess                          ││
│  │  - Runs in isolated branch                                  ││
│  │  - Works in sandbox directory                               ││
│  │  - Has .claude.md context                                   ││
│  └─────────────────────────────────────────────────────────────┘│
│                                                                 │
└─────────────────────────────────────────────────────────────────┘
```

## Thread Safety

- `TerminalManager` uses `threading.Lock` for process management
- Output reader threads run as daemon threads
- Safe for concurrent agent spawning

## Related Modules

- [/orchestrator](../orchestrator/) - Uses runtime for agent spawning
- [/lifecycle](../lifecycle/) - Controls agent process lifecycle
- [/personas](../personas/) - Agent configuration

## Files

- [`process.py`](./process.py) - Terminal and process management
- [`branches.py`](./branches.py) - Git branch operations
- [`workspace.py`](./workspace.py) - Sandbox directory management
