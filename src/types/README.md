# src/types

Global TypeScript/JSDoc type definitions and enums.

## Purpose

Centralizes all type definitions for the orchestration framework. Uses JSDoc `@typedef` for TypeScript-compatible type checking without requiring a build step.

## Files

| File | Description |
|------|-------------|
| `index.js` | All enum exports and JSDoc type definitions |

## Enums

| Enum | Values |
|------|--------|
| `TaskStatus` | `AVAILABLE`, `CLAIMED`, `IN_PROGRESS`, `BLOCKED`, `PR_PENDING`, `COMPLETE` |
| `StoryStatus` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE` |
| `EpicStatus` | `NOT_STARTED`, `IN_PROGRESS`, `COMPLETE` |
| `LifecycleState` | `IDLE`, `WORKING`, `BLOCKED`, `PR_PENDING`, `COMPLETE`, `FAILED` |
| `LoopResultType` | `TASK_COMPLETE`, `BLOCKED`, `PR_CREATED`, `MAX_RETRIES`, `ERROR`, `SHUTDOWN` |
| `BuildStatusType` | `PENDING`, `RUNNING`, `SUCCESS`, `FAILURE`, `CANCELLED` |
| `PRStatusType` | `OPEN`, `CLOSED`, `MERGED`, `DRAFT` |
| `CIEventType` | `BUILD_*`, `PR_*` events |
| `BreakpointType` | `TASK_COMPLETE`, `BLOCKED`, `PR_CREATED` |

## Type Definitions

Key types defined via JSDoc `@typedef`:

- `TaskData`, `StoryData`, `EpicData`, `MilestoneData`
- `PersonaData`, `ProjectPlanData`
- `AgentStatusData`, `EnhancedAgentStatusData`
- `BreakpointData`, `AgentInstanceData`
- `BranchInfoData`, `BuildStatusData`, `PRInfoData`
- `ContextSnapshotData`, `LoopResultData`
- `CommunicationsFileData`, `OrchestratorConfigData`

## Usage

```javascript
import { TaskStatus, LifecycleState } from './types/index.js';

// Use as runtime values
if (task.status === TaskStatus.COMPLETE) { ... }

// JSDoc for type hints
/** @type {import('./types/index.js').TaskData} */
const task = { ... };
```
