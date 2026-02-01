/**
 * SWARM Framework - Module Registry
 * Plugin architecture for registering and retrieving modules
 * @module swarm/registry/module-registry
 */

import { ModuleType } from '../types/module.js';

/**
 * @template TConfig
 * @template TInput
 * @template TOutput
 * @typedef {import('../types/module.js').Module<TConfig, TInput, TOutput>} Module
 */

/**
 * @typedef {() => Module<unknown, unknown, unknown>} ModuleFactory
 */

/**
 * ModuleRegistry manages registration and retrieval of SWARM modules
 */
export class ModuleRegistry {
  /** @type {Map<string, ModuleFactory>} */
  #factories = new Map();

  /** @type {Map<string, Module<unknown, unknown, unknown>>} */
  #instances = new Map();

  /**
   * Generate a registry key from type and implementation
   * @param {import('../types/module.js').ModuleTypeValue} type
   * @param {string} implementation
   * @returns {string}
   */
  #key(type, implementation) {
    return `${type}:${implementation}`;
  }

  /**
   * Register a module factory
   * @param {import('../types/module.js').ModuleTypeValue} type - Module type
   * @param {string} implementation - Implementation name (e.g., 'single-shot', 'fifo')
   * @param {ModuleFactory} factory - Factory function that creates module instances
   */
  register(type, implementation, factory) {
    const key = this.#key(type, implementation);

    if (this.#factories.has(key)) {
      throw new Error(`Module already registered: ${type}/${implementation}`);
    }

    this.#factories.set(key, factory);
  }

  /**
   * Get a module instance (creates if not cached)
   * @param {import('../types/module.js').ModuleTypeValue} type - Module type
   * @param {string} implementation - Implementation name
   * @returns {Module<unknown, unknown, unknown>}
   * @throws {Error} If module is not registered
   */
  get(type, implementation) {
    const key = this.#key(type, implementation);

    // Return cached instance if available
    if (this.#instances.has(key)) {
      return /** @type {Module<unknown, unknown, unknown>} */ (this.#instances.get(key));
    }

    // Create new instance from factory
    const factory = this.#factories.get(key);
    if (!factory) {
      throw new Error(`Module not registered: ${type}/${implementation}`);
    }

    const instance = factory();
    this.#instances.set(key, instance);
    return instance;
  }

  /**
   * Check if a module is registered
   * @param {import('../types/module.js').ModuleTypeValue} type
   * @param {string} implementation
   * @returns {boolean}
   */
  has(type, implementation) {
    return this.#factories.has(this.#key(type, implementation));
  }

  /**
   * List all registered implementations for a module type
   * @param {import('../types/module.js').ModuleTypeValue} type
   * @returns {string[]}
   */
  list(type) {
    const implementations = [];
    const prefix = `${type}:`;

    for (const key of this.#factories.keys()) {
      if (key.startsWith(prefix)) {
        implementations.push(key.slice(prefix.length));
      }
    }

    return implementations;
  }

  /**
   * List all registered modules
   * @returns {{type: string, implementation: string}[]}
   */
  listAll() {
    const modules = [];

    for (const key of this.#factories.keys()) {
      const [type, implementation] = key.split(':');
      modules.push({ type, implementation });
    }

    return modules;
  }

  /**
   * Unregister a module
   * @param {import('../types/module.js').ModuleTypeValue} type
   * @param {string} implementation
   */
  unregister(type, implementation) {
    const key = this.#key(type, implementation);
    this.#factories.delete(key);
    this.#instances.delete(key);
  }

  /**
   * Clear all cached instances (factories remain)
   */
  clearInstances() {
    this.#instances.clear();
  }

  /**
   * Clear everything (factories and instances)
   */
  clear() {
    this.#factories.clear();
    this.#instances.clear();
  }

  /**
   * Get the count of registered modules
   * @returns {number}
   */
  get size() {
    return this.#factories.size;
  }
}

/**
 * Global module registry instance
 * @type {ModuleRegistry}
 */
export const globalRegistry = new ModuleRegistry();

/**
 * Helper to create a module that satisfies the Module interface
 * @param {object} options
 * @param {string} options.id
 * @param {string} options.version
 * @param {import('../types/module.js').ModuleTypeValue} options.type
 * @param {(config: unknown) => Promise<void>} options.configure
 * @param {(input: unknown, context: import('../types/workflow.js').ExecutionContext) => Promise<unknown>} options.execute
 * @returns {Module<unknown, unknown, unknown>}
 */
export function createModule(options) {
  let metrics = {
    executionCount: 0,
    totalDuration: 0,
    totalTokensUsed: 0,
    errorCount: 0,
    customMetrics: {},
  };

  return {
    id: options.id,
    version: options.version,
    type: options.type,

    configure: options.configure,

    async execute(input, context) {
      const start = Date.now();
      metrics.executionCount += 1;

      try {
        const result = await options.execute(input, context);
        metrics.totalDuration += Date.now() - start;
        return result;
      } catch (error) {
        metrics.errorCount += 1;
        metrics.totalDuration += Date.now() - start;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      metrics = {
        executionCount: 0,
        totalDuration: 0,
        totalTokensUsed: 0,
        errorCount: 0,
        customMetrics: {},
      };
    },
  };
}
