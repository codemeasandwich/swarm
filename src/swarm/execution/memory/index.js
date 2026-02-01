/**
 * SWARM Framework - Memory Manager Module
 * Handles state persistence across episodic agent runs
 * @module swarm/execution/memory
 */

import { mkdir, writeFile, readFile, readdir, rm } from 'node:fs/promises';
import { join } from 'node:path';
import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';

/**
 * @typedef {import('../../types/module.js').MemoryManagerConfig} MemoryManagerConfig
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 */

/**
 * Memory operation types
 * @readonly
 * @enum {string}
 */
export const MemoryOperation = Object.freeze({
  SAVE: 'save',
  LOAD: 'load',
  LIST: 'list',
  CLEAR: 'clear',
});

/**
 * @typedef {typeof MemoryOperation[keyof typeof MemoryOperation]} MemoryOperationType
 */

/**
 * @typedef {Object} MemoryEntry
 * @property {string} key - Unique key for the entry
 * @property {unknown} data - Stored data
 * @property {number} timestamp - When entry was created/updated
 * @property {string} [workerId] - Associated worker ID
 * @property {string} [taskId] - Associated task ID
 */

/**
 * @typedef {Object} MemoryInput
 * @property {MemoryOperationType} operation - Operation to perform
 * @property {string} workerId - Worker ID
 * @property {string} [key] - Key for save/load operations
 * @property {unknown} [data] - Data to save
 * @property {string} [taskId] - Associated task ID
 */

/**
 * @typedef {Object} MemoryOutput
 * @property {boolean} success - Whether operation succeeded
 * @property {unknown} [data] - Retrieved data for load operation
 * @property {string[]} [keys] - Available keys for list operation
 * @property {string} [error] - Error message if failed
 */

// =============================================================================
// MEMORY MANAGER FACTORY
// =============================================================================

/**
 * Create a memory manager module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: MemoryInput, config: MemoryManagerConfig, context: ExecutionContext, store: Map<string, MemoryEntry>) => Promise<MemoryOutput>} executeFn
 * @returns {import('../../types/module.js').Module<MemoryManagerConfig, MemoryInput, MemoryOutput>}
 */
export function createMemoryManager(id, implementation, executeFn) {
  /** @type {MemoryManagerConfig | null} */
  let config = null;
  /** @type {Map<string, MemoryEntry>} */
  const store = new Map();

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.MEMORY_MANAGER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Memory manager not configured');
      }
      return executeFn(input, config, context, store);
    },
  });
}

// =============================================================================
// EPHEMERAL MEMORY MANAGER
// =============================================================================

/**
 * Generate storage key
 * @param {string} workerId
 * @param {string} [key]
 * @returns {string}
 */
function makeStoreKey(workerId, key) {
  return key ? `${workerId}:${key}` : workerId;
}

/**
 * Ephemeral memory manager - in-memory only, no persistence
 * Best for stateless, isolated tasks
 */
export function createEphemeralMemory() {
  return createMemoryManager(
    'memory-ephemeral',
    'ephemeral',
    async (input, config, context, store) => {
      const { operation, workerId, key, data, taskId } = input;

      switch (operation) {
        case MemoryOperation.SAVE: {
          if (!key) {
            return { success: false, error: 'Key required for save operation' };
          }

          const storeKey = makeStoreKey(workerId, key);
          const entry = {
            key,
            data,
            timestamp: Date.now(),
            workerId,
            taskId,
          };

          // Check max entries
          if (config.maxEntries && store.size >= config.maxEntries) {
            // Remove oldest entry
            let oldestKey = null;
            let oldestTime = Infinity;
            for (const [k, v] of store.entries()) {
              if (v.timestamp < oldestTime) {
                oldestTime = v.timestamp;
                oldestKey = k;
              }
            }
            if (oldestKey) {
              store.delete(oldestKey);
            }
          }

          store.set(storeKey, entry);

          context.emit({
            timestamp: Date.now(),
            runId: context.runId,
            eventType: 'memory.saved',
            moduleId: 'memory-ephemeral',
            payload: { workerId, key, taskId },
            level: 'info',
          });

          return { success: true };
        }

        case MemoryOperation.LOAD: {
          if (!key) {
            return { success: false, error: 'Key required for load operation' };
          }

          const storeKey = makeStoreKey(workerId, key);
          const entry = store.get(storeKey);

          if (!entry) {
            return { success: false, error: `Key not found: ${key}` };
          }

          context.emit({
            timestamp: Date.now(),
            runId: context.runId,
            eventType: 'memory.loaded',
            moduleId: 'memory-ephemeral',
            payload: { workerId, key },
            level: 'info',
          });

          return { success: true, data: entry.data };
        }

        case MemoryOperation.LIST: {
          const prefix = `${workerId}:`;
          const keys = [];
          for (const k of store.keys()) {
            if (k.startsWith(prefix)) {
              keys.push(k.slice(prefix.length));
            }
          }

          return { success: true, keys };
        }

        case MemoryOperation.CLEAR: {
          const prefix = `${workerId}:`;
          const toDelete = [];
          for (const k of store.keys()) {
            if (k.startsWith(prefix) || k === workerId) {
              toDelete.push(k);
            }
          }
          for (const k of toDelete) {
            store.delete(k);
          }

          context.emit({
            timestamp: Date.now(),
            runId: context.runId,
            eventType: 'memory.cleared',
            moduleId: 'memory-ephemeral',
            payload: { workerId, keysCleared: toDelete.length },
            level: 'info',
          });

          return { success: true };
        }

        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }
    }
  );
}

// =============================================================================
// FILE-BASED MEMORY MANAGER
// =============================================================================

/**
 * File-based memory manager - persists to markdown files
 * Best for tasks requiring persistence across spawns
 */
export function createFileBasedMemory() {
  return createMemoryManager(
    'memory-file-based',
    'file-based',
    async (input, config, context, store) => {
      const { operation, workerId, key, data, taskId } = input;
      const baseDir = config.storagePath || '.state/memory';
      const workerDir = join(baseDir, workerId);

      switch (operation) {
        case MemoryOperation.SAVE: {
          if (!key) {
            return { success: false, error: 'Key required for save operation' };
          }

          try {
            await mkdir(workerDir, { recursive: true });

            const entry = {
              key,
              data,
              timestamp: Date.now(),
              workerId,
              taskId,
            };

            // Save to file as markdown with frontmatter
            const content = `---
key: ${key}
workerId: ${workerId}
taskId: ${taskId || 'none'}
timestamp: ${entry.timestamp}
---

# Memory Entry: ${key}

\`\`\`json
${JSON.stringify(data, null, 2)}
\`\`\`
`;

            const filePath = join(workerDir, `${key}.md`);
            await writeFile(filePath, content, 'utf-8');

            // Also cache in memory
            const storeKey = makeStoreKey(workerId, key);
            store.set(storeKey, entry);

            context.emit({
              timestamp: Date.now(),
              runId: context.runId,
              eventType: 'memory.saved',
              moduleId: 'memory-file-based',
              payload: { workerId, key, taskId, filePath },
              level: 'info',
            });

            return { success: true };
          } catch (error) {
            return { success: false, error: `Failed to save: ${error.message}` };
          }
        }

        case MemoryOperation.LOAD: {
          if (!key) {
            return { success: false, error: 'Key required for load operation' };
          }

          // Check cache first
          const storeKey = makeStoreKey(workerId, key);
          const cached = store.get(storeKey);
          if (cached) {
            return { success: true, data: cached.data };
          }

          // Load from file
          try {
            const filePath = join(workerDir, `${key}.md`);
            const content = await readFile(filePath, 'utf-8');

            // Parse JSON from markdown code block
            const jsonMatch = content.match(/```json\n([\s\S]*?)\n```/);
            if (!jsonMatch) {
              return { success: false, error: 'Invalid memory file format' };
            }

            const parsedData = JSON.parse(jsonMatch[1]);

            // Cache it
            store.set(storeKey, {
              key,
              data: parsedData,
              timestamp: Date.now(),
              workerId,
            });

            context.emit({
              timestamp: Date.now(),
              runId: context.runId,
              eventType: 'memory.loaded',
              moduleId: 'memory-file-based',
              payload: { workerId, key, fromFile: true },
              level: 'info',
            });

            return { success: true, data: parsedData };
          } catch (error) {
            if (error.code === 'ENOENT') {
              return { success: false, error: `Key not found: ${key}` };
            }
            return { success: false, error: `Failed to load: ${error.message}` };
          }
        }

        case MemoryOperation.LIST: {
          try {
            const files = await readdir(workerDir);
            const keys = files
              .filter(f => f.endsWith('.md'))
              .map(f => f.slice(0, -3));

            return { success: true, keys };
          } catch (error) {
            if (error.code === 'ENOENT') {
              return { success: true, keys: [] };
            }
            return { success: false, error: `Failed to list: ${error.message}` };
          }
        }

        case MemoryOperation.CLEAR: {
          try {
            await rm(workerDir, { recursive: true, force: true });

            // Clear from cache
            const prefix = `${workerId}:`;
            const toDelete = [];
            for (const k of store.keys()) {
              if (k.startsWith(prefix) || k === workerId) {
                toDelete.push(k);
              }
            }
            for (const k of toDelete) {
              store.delete(k);
            }

            context.emit({
              timestamp: Date.now(),
              runId: context.runId,
              eventType: 'memory.cleared',
              moduleId: 'memory-file-based',
              payload: { workerId, directory: workerDir },
              level: 'info',
            });

            return { success: true };
          } catch (error) {
            // rm with force: true handles ENOENT internally, so this catches other errors
            return { success: false, error: `Failed to clear: ${error.message}` };
          }
        }

        default:
          return { success: false, error: `Unknown operation: ${operation}` };
      }
    }
  );
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register default memory manager implementations
 */
export function registerMemoryManagers() {
  if (!globalRegistry.has(ModuleType.MEMORY_MANAGER, 'ephemeral')) {
    globalRegistry.register(ModuleType.MEMORY_MANAGER, 'ephemeral', createEphemeralMemory);
  }
  if (!globalRegistry.has(ModuleType.MEMORY_MANAGER, 'file-based')) {
    globalRegistry.register(ModuleType.MEMORY_MANAGER, 'file-based', createFileBasedMemory);
  }
}

// Auto-register on import
registerMemoryManagers();
