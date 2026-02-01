/**
 * SWARM Framework - Execution Layer
 * Manages worker lifecycle, context building, sandboxing, and memory
 * @module swarm/execution
 */

// Import for local use in registerExecutionModules
import { registerWorkers as _registerWorkers } from './worker/index.js';
import { registerContextBuilders as _registerContextBuilders } from './context/index.js';
import { registerSandboxes as _registerSandboxes } from './sandbox/index.js';
import { registerMemoryManagers as _registerMemoryManagers } from './memory/index.js';

// Worker module
export {
  ManagedWorkerInstance,
  WorkerPool,
  WorkerSpawner,
  createWorkerModule,
  createEpisodicWorker,
  createPersistentWorker,
  registerWorkers,
} from './worker/index.js';

// Context builder module
export {
  estimateTokens,
  truncateToTokens,
  createContextBuilder,
  createMinimalContextBuilder,
  createScopedContextBuilder,
  createRichContextBuilder,
  registerContextBuilders,
} from './context/index.js';

// Sandbox module
export {
  MINIMAL_TOOLS,
  STANDARD_TOOLS,
  EXTENDED_TOOLS,
  FULL_TOOLS,
  DEFAULT_BLOCKLIST,
  isBlocked,
  createSandbox,
  createMinimalSandbox,
  createStandardSandbox,
  createExtendedSandbox,
  registerSandboxes,
} from './sandbox/index.js';

// Memory manager module
export {
  MemoryOperation,
  createMemoryManager,
  createEphemeralMemory,
  createFileBasedMemory,
  registerMemoryManagers,
} from './memory/index.js';

/**
 * Register all execution layer modules
 * Note: Modules auto-register on import, this is for explicit control
 */
export function registerExecutionModules() {
  _registerWorkers();
  _registerContextBuilders();
  _registerSandboxes();
  _registerMemoryManagers();
}
