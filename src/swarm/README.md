# src/swarm

SWARM Framework - Systematic Workflow Agent Runtime Manager.

## Purpose

A modular framework for constructing and measuring AI agent workflows. Every component can be swapped, measured, and optimised through controlled experiments.

## Architecture

```
┌─────────────────────────────────────────────────────────┐
│                    EXPERIMENT LAYER                      │
│  Matrix generation, statistical analysis, task corpora   │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  MEASUREMENT LAYER                       │
│  Metrics, tracing, cost tracking, quality, profiling     │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                 ORCHESTRATION LAYER                      │
│  Planner, Scheduler, Router, Judge                       │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                   EXECUTION LAYER                        │
│  Worker, Context Builder, Sandbox, Memory                │
└─────────────────────────────────────────────────────────┘
                           │
┌─────────────────────────────────────────────────────────┐
│                  FOUNDATION LAYER                        │
│  Types, Config, State, Registry                          │
└─────────────────────────────────────────────────────────┘
```

## Modules

| Module | Description |
|--------|-------------|
| [config/](config/) | Configuration management with presets |
| [execution/](execution/) | Worker lifecycle, context, sandbox, memory |
| [experiment/](experiment/) | Experiment design, matrix generation, statistics |
| [measurement/](measurement/) | Metrics, tracing, cost, quality, profiling |
| [orchestration/](orchestration/) | Planner, scheduler, router, judge |
| [registry/](registry/) | Module registry for swappable components |
| [state/](state/) | Workflow state persistence |
| [types/](types/) | SWARM-specific type definitions |

## Usage

```javascript
import {
  // Configuration
  loadConfig,
  createBaselineConfig,
  // Orchestration
  createPlanner,
  createScheduler,
  createRouter,
  createJudge,
  // Execution
  WorkerPool,
  createContextBuilder,
  // Measurement
  MetricsCollector,
  CostStore,
  // Experiment
  generateMatrix,
  analyzeExperiment,
} from './swarm/index.js';
```

## Key Concepts

- **Modules** - Swappable components registered in a global registry
- **Profiles** - Worker configurations (model, tools, context limits)
- **Experiments** - Systematic comparisons with statistical analysis
- **Profiling Mode** - Deep instrumentation for optimisation
