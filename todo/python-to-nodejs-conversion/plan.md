# Python to Node.js Conversion

## Request
Convert the entire orchestration framework from Python to JavaScript (Node.js).

## User Requirements
- **Language**: Plain JavaScript with comprehensive JSDoc on every file and function
- **Modules**: ESM (import/export)
- **Testing**: Node.js built-in test runner
- **Strategy**: Full rewrite (not incremental)

## Scope Analysis

### Current Codebase (Python)
- **Total Lines**: ~9,600 lines across 27 modules
- **Architecture**: Multi-agent orchestration framework
- **Core Pattern**: "Ralph Wiggum Loop" - agents work until breakpoints, fresh agents spawn with context summaries
- **Communication**: File-based JSON coordination with real-time polling

## Target Directory Structure

```
orchestration/
├── package.json
├── jsconfig.json              # TypeScript language service for JSDoc
├── README.md
│
├── src/
│   ├── index.js               # Main entry point - exports public API
│   │
│   ├── types/
│   │   └── index.js           # JSDoc @typedef definitions + frozen enums
│   │
│   ├── config/
│   │   └── index.js           # Configuration (env vars, defaults)
│   │
│   ├── communication/
│   │   ├── index.js           # Re-exports
│   │   ├── agent-status.js    # AgentStatus, EnhancedAgentStatus classes
│   │   ├── communications-file.js  # CommunicationsFile (JSON file ops)
│   │   ├── file-watcher.js    # FileWatcher using chokidar
│   │   ├── agent.js           # Agent base class
│   │   └── coordinator.js     # Coordinator class
│   │
│   ├── orchestrator/
│   │   ├── index.js           # Re-exports
│   │   ├── orchestrator.js    # Main Orchestrator class
│   │   └── errors.js          # Custom error classes
│   │
│   ├── plan/
│   │   ├── index.js           # Re-exports
│   │   ├── models.js          # Task, Story, Epic, Milestone, Persona, ProjectPlan
│   │   ├── parser.js          # Markdown plan parser
│   │   └── validator.js       # Plan validator
│   │
│   ├── personas/
│   │   ├── index.js           # Re-exports
│   │   ├── models.js          # PersonaConfig, AgentInstance, Breakpoint
│   │   ├── matcher.js         # PersonaMatcher (task-to-persona assignment)
│   │   └── generator.js       # ClaudeMdGenerator (.claude.md generation)
│   │
│   ├── lifecycle/
│   │   ├── index.js           # Re-exports
│   │   ├── loop.js            # AgentLifecycleLoop (Ralph Wiggum Loop)
│   │   └── context.js         # ContextSnapshot, ContextBuilder
│   │
│   ├── runtime/
│   │   ├── index.js           # Re-exports
│   │   ├── process.js         # TerminalManager, AgentProcess (child_process)
│   │   ├── branches.js        # BranchManager (git operations)
│   │   └── workspace.js       # WorkspaceManager (sandbox directories)
│   │
│   ├── ci/
│   │   ├── index.js           # Re-exports
│   │   ├── interface.js       # CIProvider abstract, BuildStatus, PRInfo
│   │   ├── local.js           # LocalCIProvider implementation
│   │   └── events.js          # CIEventEmitter, CIEventType
│   │
│   └── cli/
│       ├── index.js           # CLI entry point
│       └── commands.js        # Command handlers
│
├── tests/
│   ├── helpers/
│   │   ├── fixtures.js        # Test fixtures
│   │   └── mocks.js           # Mock utilities
│   │
│   └── e2e/
│       ├── auth.test.js
│       ├── communication.test.js
│       ├── orchestrator.test.js
│       ├── file-watcher.test.js
│       └── cli.test.js
│
├── examples/
│   ├── blocking-demo.js
│   └── duo-demo.js
│
└── bin/
    └── orchestrate.js         # CLI executable
```

## Key Python → Node.js Mappings

| Python | Node.js |
|--------|---------|
| `asyncio` | Native `async/await` + Promises |
| `subprocess` | `child_process` module |
| `threading.Lock` | Not needed (single-threaded event loop) |
| `dataclasses` | ES6 classes with JSDoc |
| `pathlib.Path` | `path` + `fs/promises` modules |
| `enum.Enum` | `Object.freeze()` patterns |
| `json` | Built-in `JSON` |
| `logging` | Console + optional scribbles |
| `hashlib` | `crypto` module |
| `argparse` | `commander` package |

## JSDoc Conventions

Every file and function will use comprehensive JSDoc:

```javascript
/**
 * @file Brief description of the module.
 * @module module-name
 */

/**
 * Brief description of the function.
 *
 * @param {string} param1 - Description of param1
 * @param {Object} [options] - Optional options object
 * @param {number} [options.timeout=5000] - Timeout in ms
 * @returns {Promise<ResultType>} Description of return value
 * @throws {ErrorType} When condition occurs
 */
```

Enums as frozen objects:
```javascript
/**
 * @readonly
 * @enum {string}
 */
export const TaskStatus = Object.freeze({
  AVAILABLE: 'available',
  CLAIMED: 'claimed',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  PR_PENDING: 'pr_pending',
  COMPLETE: 'complete',
});
```

Classes with full JSDoc:
```javascript
/**
 * A task within a user story, assigned to a role.
 */
export class Task {
  /**
   * @param {Object} props
   * @param {string} props.id - Task ID
   * @param {string} props.description - Task description
   * @param {string} props.role - Role responsible
   * @param {string} [props.status='available'] - Task status
   */
  constructor({ id, description, role, status = TaskStatus.AVAILABLE }) {
    /** @type {string} */
    this.id = id;
    // ...
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {TaskData}
   */
  toDict() { /* ... */ }

  /**
   * Create from plain object.
   * @param {TaskData} data
   * @returns {Task}
   */
  static fromDict(data) { /* ... */ }
}
```

## Dependencies

### Production
```json
{
  "dependencies": {
    "chokidar": "^3.6.0",
    "commander": "^12.0.0"
  }
}
```

### Development
```json
{
  "devDependencies": {
    "eslint": "^8.57.0",
    "c8": "^9.1.0"
  }
}
```

## Tasks

### Phase 1: Project Setup [P-setup]
1. [P-setup] Initialize package.json with ESM configuration
2. [P-setup] Create jsconfig.json for JSDoc type checking
3. [P-setup] Create directory structure

### Phase 2: Foundation [P-foundation]
4. [P-foundation] Create `src/types/index.js` - all enums and @typedef definitions
5. [P-foundation] Create `src/config/index.js` - configuration management
6. [P-foundation] Create `src/orchestrator/errors.js` - custom error classes

### Phase 3: Data Models [S]
7. [S] Create `src/plan/models.js` - Task, Story, Epic, Milestone, Persona, ProjectPlan
8. [S] Create `src/personas/models.js` - PersonaConfig, AgentInstance, Breakpoint, LifecycleState

### Phase 4: Communication Layer [P-comm]
9. [P-comm] Create `src/communication/agent-status.js` - AgentStatus, EnhancedAgentStatus
10. [S] Create `src/communication/communications-file.js` - CommunicationsFile (depends on agent-status)
11. [S] Create `src/communication/file-watcher.js` - FileWatcher with chokidar
12. [S] Create `src/communication/agent.js` - Agent base class
13. [S] Create `src/communication/coordinator.js` - Coordinator class
14. [P-comm] Create `src/communication/index.js` - re-exports

### Phase 5: Plan Management [P-plan]
15. [P-plan] Create `src/plan/parser.js` - Markdown plan parser
16. [P-plan] Create `src/plan/validator.js` - Plan validation
17. [P-plan] Create `src/plan/index.js` - re-exports

### Phase 6: Personas [P-personas]
18. [P-personas] Create `src/personas/matcher.js` - PersonaMatcher
19. [P-personas] Create `src/personas/generator.js` - ClaudeMdGenerator
20. [P-personas] Create `src/personas/index.js` - re-exports

### Phase 7: Runtime [P-runtime]
21. [P-runtime] Create `src/runtime/process.js` - TerminalManager, AgentProcess
22. [P-runtime] Create `src/runtime/branches.js` - BranchManager (git operations)
23. [P-runtime] Create `src/runtime/workspace.js` - WorkspaceManager
24. [P-runtime] Create `src/runtime/index.js` - re-exports

### Phase 8: CI Layer [S]
25. [S] Create `src/ci/interface.js` - CIProvider abstract, BuildStatus, PRInfo
26. [S] Create `src/ci/events.js` - CIEventEmitter, CIEventType
27. [S] Create `src/ci/local.js` - LocalCIProvider implementation
28. [S] Create `src/ci/index.js` - re-exports

### Phase 9: Lifecycle [S]
29. [S] Create `src/lifecycle/context.js` - ContextSnapshot, ContextBuilder
30. [S] Create `src/lifecycle/loop.js` - AgentLifecycleLoop (Ralph Wiggum Loop)
31. [S] Create `src/lifecycle/index.js` - re-exports

### Phase 10: Orchestrator [S]
32. [S] Create `src/orchestrator/orchestrator.js` - Main Orchestrator class
33. [S] Create `src/orchestrator/index.js` - re-exports

### Phase 11: CLI [S]
34. [S] Create `src/cli/commands.js` - Command handlers
35. [S] Create `src/cli/index.js` - CLI entry point with commander
36. [S] Create `bin/orchestrate.js` - CLI executable

### Phase 12: Main Entry [S]
37. [S] Create `src/index.js` - Main entry point, public API exports

### Phase 13: Examples [P-examples]
38. [P-examples] Create `examples/blocking-demo.js`
39. [P-examples] Create `examples/duo-demo.js`

### Phase 14: Tests [P-tests]
40. [P-tests] Create `tests/helpers/fixtures.js`
41. [P-tests] Create `tests/helpers/mocks.js`
42. [P-tests] Create `tests/e2e/communication.test.js`
43. [P-tests] Create `tests/e2e/orchestrator.test.js`
44. [P-tests] Create `tests/e2e/file-watcher.test.js`
45. [P-tests] Create `tests/e2e/cli.test.js`

### Phase 15: Documentation & Cleanup [S]
46. [S] Update README.md for Node.js
47. [S] Remove Python files
48. [S] Run tests and verify 100% coverage

## Critical Files to Reference During Implementation

1. **[communication/core.py](communication/core.py)** - AgentStatus, CommunicationsFile, FileWatcher, Agent, Coordinator
2. **[plan/models.py](plan/models.py)** - All data models (Task, Story, Epic, etc.)
3. **[lifecycle/loop.py](lifecycle/loop.py)** - AgentLifecycleLoop (Ralph Wiggum pattern)
4. **[runtime/process.py](runtime/process.py)** - TerminalManager, AgentProcess
5. **[orchestrator/main.py](orchestrator/main.py)** - Main Orchestrator class

## Verification Plan

1. **Unit Tests**: Run `node --test tests/**/*.test.js`
2. **Coverage**: Run `npx c8 node --test tests/**/*.test.js` - target 100%
3. **Manual Testing**:
   - Start file watcher: `node bin/orchestrate.js watcher`
   - Start agent: `node bin/orchestrate.js agent researcher`
   - Run blocking demo: `node examples/blocking-demo.js`
4. **Lint**: Run `npx eslint src/`
