# Tests

> Test suite for the multi-agent orchestration framework.

## Overview

This directory contains the test suite with a focus on end-to-end (E2E) tests that verify system behavior through the public API.

## Structure

```
tests/
├── helpers/
│   ├── fixtures.js           # Test fixtures and utilities
│   └── mocks.js              # Mock implementations
├── e2e/                      # End-to-end tests
│   ├── communication.test.js # Agent communication tests
│   └── plan-models.test.js   # Plan model tests
└── README.md
```

## Running Tests

### All Tests

```bash
npm test
```

### With Coverage

```bash
npm run test:coverage
```

### E2E Tests Only

```bash
node --test tests/e2e/
```

### Specific Test File

```bash
node --test tests/e2e/communication.test.js
```

## Coverage

Coverage is measured using c8 (configured in `package.json`):

```bash
# Run tests with coverage
npm run test:coverage

# View coverage report
open coverage/index.html
```

## Test Categories

| Test File | Coverage |
|-----------|----------|
| `communication.test.js` | Agent communication, requests, deliveries, coordinator |
| `plan-models.test.js` | Task, ProjectPlan, PlanValidator |

## Fixtures

Common fixtures are defined in `helpers/fixtures.js`:

- `createTempDir()` - Create temporary directory
- `removeTempDir()` - Clean up temporary directory
- `createMockCommFile()` - Create mock communications.json
- `createMockProjectPlan()` - Sample project plan data

## Mock Implementations

Mocks are defined in `helpers/mocks.js`:

- `createMockCIProvider()` - Mock CI/CD provider
- `createMockTerminalManager()` - Mock process manager
- `createMockWorkspaceManager()` - Mock workspace manager
- `createMockBranchManager()` - Mock git branch manager

## Writing Tests

Tests follow the E2E philosophy:

1. Test through public APIs
2. Verify observable behavior
3. Minimize internal knowledge
4. Use real components when possible

```javascript
import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { CommunicationsFile } from '../../src/communication/communications-file.js';

describe('Agent Communication', () => {
  test('agents can exchange requests', async () => {
    const commFile = new CommunicationsFile('/tmp/test-comm.json');

    // Agent A sends request to Agent B
    await commFile.addRequest('agent_a', 'agent_b', 'Need help');

    // Agent B receives the request
    const requests = await commFile.getRequestsForAgent('agent_b');
    assert.equal(requests.length, 1);
    assert.equal(requests[0].fromAgent, 'agent_a');
  });
});
```

## Related

- [/examples](../examples/) - Demo applications
- [package.json](../package.json) - Test configuration
