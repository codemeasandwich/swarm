# src/config

Centralized configuration management.

## Purpose

Provides a frozen, singleton configuration object with environment variable overrides for the orchestration system.

## Files

| File | Description |
|------|-------------|
| `index.js` | Configuration loader with `getConfig()`, `resetConfig()`, and `createConfig()` |

## Exports

```javascript
import {
  getConfig,     // Get global frozen config (singleton)
  resetConfig,   // Reset for testing
  createConfig,  // Create custom config with overrides
} from './config/index.js';
```

## Configuration Options

| Option | Env Variable | Default |
|--------|--------------|---------|
| `commFile` | `ORCHESTRATION_COMM_FILE` | `communications.json` |
| `pollInterval` | `ORCHESTRATION_POLL_INTERVAL` | `500` ms |
| `breakpointCheckInterval` | `ORCHESTRATION_BREAKPOINT_CHECK_INTERVAL` | `2000` ms |
| `maxRetries` | `ORCHESTRATION_MAX_RETRIES` | `100` |
| `retryInterval` | `ORCHESTRATION_RETRY_INTERVAL` | `30000` ms |
| `prMergeTimeout` | `ORCHESTRATION_PR_MERGE_TIMEOUT` | `600000` ms |
| `processTimeout` | `ORCHESTRATION_PROCESS_TIMEOUT` | `300000` ms |
| `integrationBranch` | `ORCHESTRATION_INTEGRATION_BRANCH` | `integration` |
| `maxConcurrentAgents` | `ORCHESTRATION_MAX_CONCURRENT_AGENTS` | `5` |
| `snapshotDir` | `ORCHESTRATION_SNAPSHOT_DIR` | `.state/snapshots` |
| `sandboxBaseDir` | `ORCHESTRATION_SANDBOX_BASE_DIR` | `.state/sandboxes` |

## Usage

```javascript
const config = getConfig();
console.log(config.maxConcurrentAgents); // 5

// For testing
const testConfig = createConfig({ maxRetries: 3 });
```
