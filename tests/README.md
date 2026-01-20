# Tests

> Test suite for the multi-agent orchestration framework.

## Overview

This directory contains the test suite with a focus on end-to-end (E2E) tests that verify system behavior through the public API.

## Structure

```
tests/
├── conftest.py           # Shared fixtures
├── e2e/                  # End-to-end tests
│   ├── test_agent_comm_flows.py   # Agent communication tests
│   ├── test_auth.py               # Authentication tests
│   ├── test_cli_commands.py       # CLI command tests
│   ├── test_file_watcher.py       # File watcher tests
│   └── test_orchestrator.py       # Orchestrator tests
└── README.md
```

## Running Tests

### All Tests with Coverage

```bash
pytest
```

This runs all tests with coverage reporting (configured in `pyproject.toml`).

### E2E Tests Only

```bash
pytest tests/e2e/
```

### Specific Test File

```bash
pytest tests/e2e/test_orchestrator.py -v
```

### Specific Test

```bash
pytest tests/e2e/test_cli_commands.py::test_mission_command -v
```

## Coverage

Coverage is configured in `pyproject.toml`:

- Minimum coverage: 80%
- Reports: terminal + HTML
- HTML report: `coverage_html/index.html`

```bash
# View coverage report
open coverage_html/index.html
```

## Test Categories

| Test File | Coverage |
|-----------|----------|
| `test_agent_comm_flows.py` | Agent communication, requests, deliveries |
| `test_auth.py` | Authentication utilities |
| `test_cli_commands.py` | CLI commands and modes |
| `test_file_watcher.py` | File change detection |
| `test_orchestrator.py` | Orchestrator lifecycle |

## Fixtures

Common fixtures are defined in `conftest.py`:

- `temp_comm_file` - Temporary communications.json
- `test_plan` - Sample project plan
- `mock_terminal_manager` - Mocked process manager

## Writing Tests

Tests follow the E2E philosophy:

1. Test through public APIs
2. Verify observable behavior
3. Minimize internal knowledge
4. Use real components when possible

```python
import pytest
from communication.core import CommunicationsFile

def test_agent_communication(temp_comm_file):
    """Test that agents can exchange requests."""
    comm = CommunicationsFile(temp_comm_file)

    # Agent A sends request to Agent B
    comm.add_request("agent_a", "agent_b", "Need help")

    # Agent B receives the request
    requests = comm.get_requests_for_agent("agent_b")
    assert len(requests) == 1
    assert requests[0] == ("agent_a", "Need help")
```

## Related

- [/examples](../examples/) - Demo applications
- [pyproject.toml](../pyproject.toml) - Test configuration
