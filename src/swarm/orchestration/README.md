# src/swarm/orchestration

SWARM orchestration layer - planner, scheduler, router, and judge.

## Purpose

Core workflow coordination components that can be swapped to compare different strategies.

## Submodules

| Submodule | Description |
|-----------|-------------|
| `planner/` | Task decomposition strategies |
| `scheduler/` | Task queue management |
| `router/` | Worker assignment strategies |
| `judge/` | Response quality evaluation |

## Exports

```javascript
import {
  // Planner
  createPlanner,
  createSingleShotPlanner,
  createIterativePlanner,
  // Scheduler
  createScheduler,
  createFifoScheduler,
  createPriorityScheduler,
  // Router
  createRouter,
  createStaticRouter,
  createCapabilityRouter,
  // Judge
  createJudge,
  createDeterministicJudge,
  createLlmJudge,
  createHybridJudge,
} from './orchestration/index.js';
```

## Planner Variants

| Variant | Description |
|---------|-------------|
| `single-shot` | Decompose entire task upfront |
| `iterative` | Decompose progressively as work proceeds |

## Scheduler Variants

| Variant | Description |
|---------|-------------|
| `fifo` | First-in, first-out queue |
| `priority` | Priority-based with dependencies |

## Router Variants

| Variant | Description |
|---------|-------------|
| `static` | Round-robin assignment |
| `capability` | Match task skills to worker capabilities |

## Judge Variants

| Variant | Description |
|---------|-------------|
| `deterministic` | Rule-based quality checks |
| `llm` | LLM-based quality evaluation |
| `hybrid` | Combine rules and LLM |

## Dependencies

- `../types/` - Orchestration type definitions
- `../registry/` - Module registration
