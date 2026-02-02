# src/swarm/registry

SWARM module registry for swappable components.

## Purpose

Provides a global registry for registering and retrieving SWARM modules. Enables hot-swapping of planners, schedulers, routers, judges, and other components.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `module-registry.js` | `ModuleRegistry` class and global instance |

## Exports

```javascript
import {
  ModuleRegistry,
  globalRegistry,
  createModule,
} from './registry/index.js';
```

## Module Types

Modules are registered by type:
- `planner` - Task decomposition
- `scheduler` - Task queue management
- `router` - Worker assignment
- `judge` - Quality evaluation
- `contextBuilder` - Context construction
- `sandbox` - Tool access control
- `memoryManager` - State persistence
- `metricsCollector` - Performance metrics
- `tracer` - Request tracing
- `costTracker` - Cost accounting
- `qualityAssessor` - Quality scoring
- `experimentRunner` - Experiment execution

## Usage

```javascript
// Register a module
globalRegistry.register('planner', 'my-planner', {
  name: 'my-planner',
  create: (config) => ({ plan: (task) => [...] })
});

// Retrieve a module
const planner = globalRegistry.get('planner', 'my-planner');
const instance = planner.create(config);

// List all modules of a type
const planners = globalRegistry.list('planner');
```

## Module Structure

```javascript
{
  name: 'module-name',
  version: '1.0.0',
  description: 'What this module does',
  create: (config) => moduleInstance,
  defaultConfig: { ... }
}
```
