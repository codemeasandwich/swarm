# tests/e2e

End-to-end test suites for the orchestration framework.

## Purpose

Contains integration tests that verify complete workflows and multi-module interactions. Tests use real implementations rather than mocks where possible.

## Files

| File | Description |
|------|-------------|
| `communication.test.js` | Tests for agent communication, file watching, and coordination |
| `plan-models.test.js` | Tests for plan parsing, validation, and model structures |

## SWARM Framework Tests

| File | Description |
|------|-------------|
| `swarm/foundation.test.js` | Core SWARM types, enums, and factory functions |
| `swarm/execution.test.js` | Worker lifecycle, context building, sandboxing, memory |
| `swarm/measurement.test.js` | Metrics collection, cost tracking, quality assessment |
| `swarm/experiment.test.js` | Experiment matrix generation and statistical analysis |
| `swarm/orchestration.test.js` | Planner, scheduler, router, and judge modules |
| `swarm/integration.test.js` | Full SWARM workflow integration tests |

## Running Tests

```bash
# Run all E2E tests
npm test

# Run with coverage
npm run test:coverage

# Run specific test file
npm test -- tests/e2e/communication.test.js
```

## Test Helpers

Test utilities are located in `../helpers/`:
- `fixtures.js` - Test data fixtures and sample plans
- `mocks.js` - Mock implementations for external dependencies
