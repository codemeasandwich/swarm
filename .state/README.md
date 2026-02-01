# .state

> Runtime state storage for the orchestration framework.

## Overview

This directory contains runtime state and plan files used by the orchestration system. Contents here are typically generated or managed by the framework.

**Note:** This directory may contain ephemeral/generated content. Don't commit changes here without understanding their impact.

## Structure

```
.state/
├── plans/              # Project plan definitions
│   ├── project.md      # Main project overview
│   ├── epics/          # Epic definitions
│   ├── stories/        # Story definitions
│   └── personas/       # Persona configurations
├── snapshots/          # Context snapshots (if enabled)
└── final_state.json    # Final run state
```

## Contents

| Directory | Description |
|-----------|-------------|
| [plans/](./plans/) | Project plan markdown files |
| snapshots/ | Agent context snapshots for respawning |

## Files

| File | Description |
|------|-------------|
| `final_state.json` | State from last orchestration run |

## Usage

The `.state` directory is specified when starting the orchestrator:

```javascript
import { Orchestrator, OrchestratorConfig } from './src/orchestrator/orchestrator.js';

const config = new OrchestratorConfig({
  repoDir: '.',
  planDir: '.state/plans',
});
```

## Related

- [/src/plan](../src/plan/) - Plan parsing module
- [/src/orchestrator](../src/orchestrator/) - Uses plans from this directory
