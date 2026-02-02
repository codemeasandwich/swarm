# src/swarm/types

SWARM-specific TypeScript/JSDoc type definitions.

## Purpose

Centralizes all SWARM framework type definitions. Uses JSDoc `@typedef` and factory functions for runtime type creation.

## Files

| File | Description |
|------|-------------|
| `index.js` | Re-exports all types |
| `foundation.js` | Core types: models, skills, retry policies |
| `task.js` | Task definitions and states |
| `module.js` | Module type enums and implementations |
| `workflow.js` | Worker profiles, instances, workflow state |
| `trace.js` | Trace events and spans |
| `experiment.js` | Experiment definitions and results |

## Type Categories

### Foundation Types

| Type | Description |
|------|-------------|
| `ModelProvider` | AI provider enum (anthropic, openai, etc.) |
| `Skill` | Worker capability enum |
| `Domain` | Task domain enum |
| `TaskComplexity` | Complexity level enum |
| `BackoffStrategy` | Retry backoff enum |
| `TraceLevel` | Logging verbosity enum |

### Task Types

| Type | Description |
|------|-------------|
| `AcceptanceCriterionType` | Criterion type enum |
| `ContextRequirementType` | Context requirement enum |
| `TaskStatus` | Task lifecycle status enum |
| `TaskDefinition` | Full task specification |
| `TaskState` | Runtime task state |

### Module Types

| Type | Description |
|------|-------------|
| `ModuleType` | Module category enum |
| `PlannerImplementation` | Planner variant enum |
| `SchedulerImplementation` | Scheduler variant enum |
| `RouterImplementation` | Router variant enum |
| `JudgeImplementation` | Judge variant enum |

### Workflow Types

| Type | Description |
|------|-------------|
| `WorkerStatus` | Worker lifecycle status |
| `WorkerProfile` | Worker configuration |
| `WorkerInstance` | Runtime worker state |
| `WorkflowStatus` | Workflow lifecycle status |
| `WorkflowState` | Full workflow state |

## Factory Functions

```javascript
import {
  createModelSpec,
  createRetryPolicy,
  createTaskDefinition,
  createTaskState,
  createWorkerProfile,
  createWorkerInstance,
  createWorkflowState,
  createTraceEvent,
  createExperiment,
} from './types/index.js';
```
