# E2E Tests

> End-to-end tests for the multi-agent orchestration framework.

## Overview

These tests verify system behavior through public APIs, treating the system as a black box where possible. They focus on observable behavior rather than implementation details.

## Test Files

| File | Description |
|------|-------------|
| `test_agent_comm_flows.py` | Agent communication workflows |
| `test_auth.py` | Authentication and credentials |
| `test_cli_commands.py` | CLI command parsing and execution |
| `test_file_watcher.py` | File change detection |
| `test_orchestrator.py` | Orchestrator lifecycle and coordination |

## Running Tests

```bash
# Run all e2e tests
pytest tests/e2e/

# Run with verbose output
pytest tests/e2e/ -v

# Run specific file
pytest tests/e2e/test_orchestrator.py

# Run specific test
pytest tests/e2e/test_agent_comm_flows.py::test_request_response -v
```

## Test Highlights

### Agent Communication (`test_agent_comm_flows.py`)

- Request/response workflows
- Delivery acknowledgment
- Multi-agent coordination
- Blocking and unblocking

### CLI Commands (`test_cli_commands.py`)

- Status commands (mission, working, done, next)
- Communication commands (request, complete, deliveries)
- Interactive mode simulation

### File Watcher (`test_file_watcher.py`)

- Change detection via MD5 hashing
- Callback notifications
- Thread safety

### Orchestrator (`test_orchestrator.py`)

- Plan parsing and validation
- Agent spawning
- Lifecycle management
- Milestone completion

## Philosophy

These tests follow E2E testing principles:

1. **Test observable behavior** - What the user sees
2. **Minimize mocking** - Use real components when practical
3. **Independent tests** - No shared state between tests
4. **Clear assertions** - Verify specific outcomes

## Fixtures

Tests use fixtures from `../conftest.py`:

```python
@pytest.fixture
def temp_comm_file(tmp_path):
    """Create a temporary communications file."""
    return str(tmp_path / "communications.json")

@pytest.fixture
def test_plan():
    """Create a sample project plan."""
    return ProjectPlan(...)
```
