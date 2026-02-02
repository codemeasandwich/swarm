# src/swarm/config

SWARM configuration management.

## Purpose

Loads, validates, and provides configuration presets for SWARM workflows. Supports YAML/JSON configs with environment variable overrides.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `loader.js` | `loadConfig()`, `loadConfigFromString()`, path utilities |
| `validator.js` | `validateConfig()` with JSON schema validation |
| `defaults.js` | Preset configurations and factory functions |

## Exports

```javascript
import {
  // Loading
  loadConfig,
  loadConfigFromString,
  applyConfigOverrides,
  getNestedValue,
  setNestedValue,
  // Validation
  validateConfig,
  // Presets
  createDefaultWorkerProfile,
  createBaselineConfig,
  createGasTownConfig,
  createCostOptimizedConfig,
  getDefaultConfig,
} from './config/index.js';
```

## Configuration Presets

| Preset | Description |
|--------|-------------|
| `createBaselineConfig()` | Standard settings for benchmarking |
| `createGasTownConfig()` | Aggressive parallelism, higher costs |
| `createCostOptimizedConfig()` | Minimize API costs |
| `getDefaultConfig()` | Balanced defaults |

## Worker Profile Structure

```javascript
{
  model: { provider: 'anthropic', id: 'claude-sonnet-4-20250514' },
  maxTokens: 8192,
  contextWindow: 200000,
  tools: ['read', 'write', 'bash'],
  retryPolicy: { maxRetries: 3, backoff: 'exponential' }
}
```

## Dependencies

- `../types/` - Configuration type definitions
