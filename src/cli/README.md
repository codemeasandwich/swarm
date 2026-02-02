# src/cli

Command-line interface for the orchestration framework.

## Purpose

Provides CLI commands for managing agents, monitoring status, and watching communications files.

## Files

| File | Description |
|------|-------------|
| `index.js` | CLI entry point using Commander.js, defines program structure |
| `commands.js` | Command implementations (`runWatcher`, `runAgent`, `showStatus`) |

## Commands

```bash
# Start file watcher to monitor communications.json
orchestrate watcher [-f <path>]

# Start an interactive agent with a given name
orchestrate agent <name> [-f <path>]

# Show status of all agents
orchestrate status [-f <path>]
```

## Exports

```javascript
import {
  createProgram,  // Create Commander program instance
  run,            // Run CLI with arguments
  runWatcher,     // Start file watcher programmatically
  runAgent,       // Start agent programmatically
  showStatus,     // Get status programmatically
} from './cli/index.js';
```

## Dependencies

- `commander` - CLI framework
- `../communication/` - Agent coordination
- `../config/` - Configuration settings
