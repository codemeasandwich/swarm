# src/orchestrator

Main orchestration engine and error definitions.

## Purpose

Core coordinator that ties together all framework modules to run multi-agent workflows on project plans.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `orchestrator.js` | `Orchestrator` class - main entry point for running orchestrations |
| `errors.js` | Custom error classes for different failure modes |

## Exports

```javascript
import {
  Orchestrator,
  // Error types
  OrchestratorError,
  PlanParseError,
  PlanValidationError,
  AgentSpawnError,
  CommunicationError,
  BranchError,
  WorkspaceError,
  CIError,
  LifecycleError,
  TimeoutError,
} from './orchestrator/index.js';
```

## Error Hierarchy

```
OrchestratorError (base)
├── PlanParseError
├── PlanValidationError
├── AgentSpawnError
├── CommunicationError
├── BranchError
├── WorkspaceError
├── CIError
├── LifecycleError
└── TimeoutError
```

## Usage

```javascript
const orchestrator = new Orchestrator({
  repoDir: '/path/to/repo',
  planDir: '.state/plans',
  autoSpawn: true,
  maxConcurrentAgents: 5,
});

await orchestrator.start(projectPlan);
```

## Dependencies

- `../plan/` - Plan parsing and validation
- `../personas/` - Agent matching
- `../communication/` - Agent coordination
- `../lifecycle/` - Agent lifecycle management
- `../runtime/` - Process and workspace management
- `../ci/` - CI/CD integration
