# src/ci

CI/CD provider interface and event handling.

## Purpose

Abstracts CI/CD systems (GitHub Actions, Jenkins, etc.) to provide a unified interface for build status monitoring and PR management.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `interface.js` | Abstract `CIProvider` interface and data models (`BuildStatus`, `PRInfo`, `CIEvent`) |
| `events.js` | `CIEventEmitter` for CI event subscriptions and `CIEventType` enum |
| `local.js` | `LocalCIProvider` implementation for local/test environments |

## Exports

```javascript
import {
  // Data models
  BuildStatus,
  PRInfo,
  CIEvent,
  // Abstract interface
  CIProvider,
  // Event system
  CIEventEmitter,
  CIEventType,
  // Local implementation
  LocalCIProvider,
} from './ci/index.js';
```

## Event Types

- `BUILD_STARTED`, `BUILD_SUCCESS`, `BUILD_FAILURE`, `BUILD_CANCELLED`
- `PR_OPENED`, `PR_CLOSED`, `PR_MERGED`
- `PR_REVIEW_REQUESTED`, `PR_APPROVED`, `PR_CHANGES_REQUESTED`

## Dependencies

- `../types/` - Enum definitions (`BuildStatusType`, `PRStatusType`, `CIEventType`)
