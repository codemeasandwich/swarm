# src/swarm/measurement

SWARM measurement layer - metrics, tracing, cost, quality, and profiling.

## Purpose

Comprehensive instrumentation for measuring workflow performance, costs, and quality. Supports profiling mode for deep analysis.

## Submodules

| Submodule | Description |
|-----------|-------------|
| `metrics/` | Metric definitions and collectors |
| `tracer/` | Request/response trace logging |
| `cost/` | API cost tracking with model pricing |
| `quality/` | Multi-dimensional quality assessment |
| `reports/` | JSON and HTML report generation |
| `profiling/` | Deep instrumentation for optimisation |

## Exports

```javascript
import {
  // Metrics
  TASK_COMPLETION_RATE,
  TASK_COMPLETION_TIME,
  TOTAL_COST,
  MetricsCollector,
  createStandardCollector,
  // Tracer
  TraceStore,
  createJSONTracer,
  // Cost
  CLAUDE_PRICING,
  calculateCost,
  CostStore,
  createStandardCostTracker,
  // Quality
  QualityDimension,
  QualityStore,
  createStandardQualityAssessor,
  // Reports
  createJSONReportGenerator,
  createHTMLReportGenerator,
  // Profiling
  ProfilingStore,
  ProfilingEventType,
  createProfilingModule,
} from './measurement/index.js';
```

## Built-in Metrics

| Metric | Description |
|--------|-------------|
| `TASK_COMPLETION_RATE` | Percentage of tasks completed successfully |
| `TASK_COMPLETION_TIME` | Time to complete tasks (seconds) |
| `COORDINATION_OVERHEAD` | Time spent on non-task work |
| `CONTEXT_EFFICIENCY` | Token utilisation percentage |
| `TOOL_UTILISATION` | Tool usage patterns |
| `RETRY_RATE` | Percentage of retried requests |
| `QUALITY_SCORE` | Composite quality score |
| `TOTAL_COST` | API costs in USD |

## Profiling Events

| Event | Description |
|-------|-------------|
| `strategyDecision` | Planner/scheduler decisions |
| `workerRouting` | Router assignment decisions |
| `toolUsage` | Tool invocation patterns |
| `contextUtilization` | Token usage over time |
| `parallelismSnapshot` | Worker concurrency levels |

## Dependencies

- `../types/` - Measurement type definitions
- `../registry/` - Module registration
