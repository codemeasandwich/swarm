# E2E Tests

> End-to-end tests for the multi-agent orchestration framework.

## Overview

These tests verify system behavior through public APIs, treating the system as a black box where possible. They focus on observable behavior rather than implementation details.

## Test Files

| File | Description |
|------|-------------|
| `communication.test.js` | Agent communication workflows, coordinator |
| `plan-models.test.js` | Task, ProjectPlan, PlanValidator |

## Running Tests

```bash
# Run all e2e tests
node --test tests/e2e/

# Run with verbose output
node --test --test-reporter=spec tests/e2e/

# Run specific file
node --test tests/e2e/communication.test.js

# Run with coverage
npm run test:coverage
```

## Test Highlights

### Communication Tests (`communication.test.js`)

- CommunicationsFile operations
- Agent status updates
- Request/response workflows
- Coordinator agent management

### Plan Model Tests (`plan-models.test.js`)

- Task creation and serialization
- ProjectPlan operations
- Dependency checking
- PlanValidator validation

## Philosophy

These tests follow E2E testing principles:

1. **Test observable behavior** - What the user sees
2. **Minimize mocking** - Use real components when practical
3. **Independent tests** - No shared state between tests
4. **Clear assertions** - Verify specific outcomes

## Fixtures

Tests use fixtures from `../helpers/fixtures.js`:

```javascript
import { createTempDir, removeTempDir, createMockProjectPlan } from '../helpers/fixtures.js';

describe('My Tests', () => {
  let tempDir;

  before(async () => {
    tempDir = await createTempDir();
  });

  after(async () => {
    await removeTempDir(tempDir);
  });

  test('example test', () => {
    const planData = createMockProjectPlan();
    // ...
  });
});
```
