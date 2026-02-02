/**
 * SWARM Framework - Profiling Module
 * Detailed decision reasoning and resource tracking for benchmarking
 * @module swarm/measurement/profiling
 */

import scribbles from 'scribbles';
import { ModuleType, createModuleMetrics } from '../../types/module.js';
import { globalRegistry } from '../../registry/module-registry.js';
import { ProfilingStore } from './store.js';
import { ProfilingEventType } from './events.js';

// =============================================================================
// RE-EXPORTS
// =============================================================================

export { ProfilingStore } from './store.js';
export {
  ProfilingEventType,
  createStrategyDecision,
  createWorkerRouting,
  createToolUsage,
  createContextUtilization,
  createParallelismSnapshot,
} from './events.js';

// =============================================================================
// PROFILING CONFIG
// =============================================================================

/**
 * @typedef {Object} ProfilingConfig
 * @property {boolean} enabled - Whether profiling is enabled
 * @property {boolean} [captureDecisionReasoning=true] - Capture strategy/routing decisions
 * @property {boolean} [captureConfigSnapshots=true] - Include config in each decision
 * @property {boolean} [captureToolUsage=true] - Track tool usage per task
 * @property {boolean} [captureContextUtilization=true] - Track context window usage
 * @property {boolean} [captureIterationHistory=true] - Track planner iterations
 * @property {boolean} [captureParallelismSnapshots=true] - Track parallelism over time
 * @property {boolean} [captureStrategyRefinements=true] - Track strategy changes
 * @property {number} [parallelismSnapshotInterval=1000] - Interval for parallelism snapshots (ms)
 */

/**
 * Default profiling configuration
 * @type {ProfilingConfig}
 */
export const DEFAULT_PROFILING_CONFIG = Object.freeze({
  enabled: false,
  captureDecisionReasoning: true,
  captureConfigSnapshots: true,
  captureToolUsage: true,
  captureContextUtilization: true,
  captureIterationHistory: true,
  captureParallelismSnapshots: true,
  captureStrategyRefinements: true,
  parallelismSnapshotInterval: 1000,
});

// =============================================================================
// PROFILING MODULE
// =============================================================================

/**
 * @typedef {Object} ProfilingInput
 * @property {string} operation - Operation to perform
 * @property {string} runId - Workflow run ID
 * @property {Record<string, unknown>} [payload] - Operation-specific payload
 */

/**
 * @typedef {Object} ProfilingOutput
 * @property {boolean} success - Whether operation succeeded
 * @property {Object} [data] - Operation result data
 */

/**
 * Creates a profiling module
 * @returns {import('../../types/module.js').Module<ProfilingConfig, ProfilingInput, ProfilingOutput>}
 */
export function createProfilingModule() {
  /** @type {ProfilingConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  /** @type {Map<string, ProfilingStore>} */
  const stores = new Map();
  /** @type {Map<string, NodeJS.Timeout>} */
  const snapshotIntervals = new Map();

  /**
   * Get or create store for run
   * @param {string} runId
   * @returns {ProfilingStore}
   */
  function getStore(runId) {
    if (!stores.has(runId)) {
      const store = new ProfilingStore(runId);
      stores.set(runId, store);

      scribbles.dataOut('profiling.store.created', {
        runId,
        event: ProfilingEventType.PROFILING_STARTED,
        config,
      });
    }
    return stores.get(runId);
  }

  /**
   * Start parallelism snapshot interval
   * @param {string} runId
   * @param {() => import('./events.js').ParallelismSnapshotPayload} snapshotFn
   */
  function startParallelismSnapshots(runId, snapshotFn) {
    if (!config?.captureParallelismSnapshots) return;

    const interval = setInterval(() => {
      const store = stores.get(runId);
      if (store) {
        const snapshot = snapshotFn();
        store.recordParallelismSnapshot(
          snapshot.activeWorkers,
          snapshot.tasksByWorker,
          snapshot.pendingTasks,
          snapshot.completedTasks
        );
      }
    }, config.parallelismSnapshotInterval || 1000);

    snapshotIntervals.set(runId, interval);
  }

  /**
   * Stop parallelism snapshot interval
   * @param {string} runId
   */
  function stopParallelismSnapshots(runId) {
    const interval = snapshotIntervals.get(runId);
    if (interval) {
      clearInterval(interval);
      snapshotIntervals.delete(runId);
    }
  }

  return {
    id: 'profiler-standard',
    version: '1.0.0',
    type: ModuleType.PROFILER,

    async configure(cfg) {
      config = { ...DEFAULT_PROFILING_CONFIG, ...cfg };

      scribbles.dataOut('profiling.configured', {
        enabled: config.enabled,
        options: config,
      });
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Profiler not configured');
      }

      if (!config.enabled) {
        return { success: true, data: { message: 'Profiling disabled' } };
      }

      const startTime = Date.now();
      const store = getStore(input.runId);

      try {
        switch (input.operation) {
          case 'recordStrategyDecision': {
            if (!config.captureDecisionReasoning) break;
            const p = input.payload;
            store.recordStrategyDecision(
              /** @type {string} */ (p.component),
              /** @type {string} */ (p.chosen),
              /** @type {string[]} */ (p.alternatives),
              /** @type {Record<string, unknown>} */ (p.reasoning),
              config.captureConfigSnapshots ? /** @type {Record<string, unknown>} */ (p.activeConfig) : {}
            );
            break;
          }

          case 'recordWorkerRouting': {
            if (!config.captureDecisionReasoning) break;
            const p = input.payload;
            store.recordWorkerRouting(
              /** @type {string} */ (p.taskId),
              /** @type {string} */ (p.taskType),
              /** @type {string} */ (p.selectedWorkerId),
              /** @type {Record<string, number>} */ (p.candidateScores),
              /** @type {string} */ (p.reason),
              config.captureConfigSnapshots ? /** @type {Record<string, unknown>} */ (p.activeConfig) : {}
            );
            break;
          }

          case 'recordBatchSizing': {
            if (!config.captureDecisionReasoning) break;
            const p = input.payload;
            store.recordBatchSizing(
              /** @type {number} */ (p.batchSize),
              /** @type {number} */ (p.totalPending),
              /** @type {number} */ (p.availableWorkers),
              /** @type {Record<string, unknown>} */ (p.reasoning),
              config.captureConfigSnapshots ? /** @type {Record<string, unknown>} */ (p.activeConfig) : {}
            );
            break;
          }

          case 'recordEvaluationDecision': {
            if (!config.captureDecisionReasoning) break;
            const p = input.payload;
            store.recordEvaluationDecision(
              /** @type {string} */ (p.taskId),
              /** @type {string} */ (p.workerId),
              /** @type {boolean} */ (p.passed),
              /** @type {Record<string, number>} */ (p.dimensionScores),
              /** @type {'pass' | 'retry' | 'fail'} */ (p.decision),
              /** @type {string} */ (p.reason),
              config.captureConfigSnapshots ? /** @type {Record<string, unknown>} */ (p.activeConfig) : {}
            );
            break;
          }

          case 'recordToolUsage': {
            if (!config.captureToolUsage) break;
            const p = input.payload;
            store.recordToolUsage(
              /** @type {string} */ (p.taskId),
              /** @type {string} */ (p.workerId),
              /** @type {string[]} */ (p.availableTools),
              /** @type {Record<string, number>} */ (p.callCounts)
            );
            break;
          }

          case 'recordContextUtilization': {
            if (!config.captureContextUtilization) break;
            const p = input.payload;
            store.recordContextUtilization(
              /** @type {string} */ (p.taskId),
              /** @type {string} */ (p.workerId),
              /** @type {number} */ (p.budgetTokens),
              /** @type {number} */ (p.inputTokens),
              /** @type {number} */ (p.outputTokens)
            );
            break;
          }

          case 'recordParallelismSnapshot': {
            if (!config.captureParallelismSnapshots) break;
            const p = input.payload;
            store.recordParallelismSnapshot(
              /** @type {number} */ (p.activeWorkers),
              /** @type {Record<string, string[]>} */ (p.tasksByWorker),
              /** @type {number} */ (p.pendingTasks),
              /** @type {number} */ (p.completedTasks)
            );
            break;
          }

          case 'recordPlannerIteration': {
            if (!config.captureIterationHistory) break;
            const p = input.payload;
            store.recordPlannerIteration(
              /** @type {number} */ (p.iteration),
              /** @type {number} */ (p.previousTaskCount),
              /** @type {number} */ (p.newTaskCount),
              /** @type {import('./events.js').PlannerIterationChange[]} */ (p.changes),
              /** @type {string} */ (p.triggerReason),
              /** @type {string | undefined} */ (p.feedback),
              /** @type {number} */ (p.tokensUsed)
            );
            break;
          }

          case 'recordStrategyRefinement': {
            if (!config.captureStrategyRefinements) break;
            const p = input.payload;
            store.recordStrategyRefinement(
              /** @type {string} */ (p.component),
              /** @type {string} */ (p.previousStrategy),
              /** @type {string} */ (p.newStrategy),
              /** @type {string} */ (p.trigger),
              /** @type {string} */ (p.reasoning),
              /** @type {Record<string, unknown>} */ (p.metrics)
            );
            break;
          }

          case 'startSnapshots': {
            const p = input.payload;
            startParallelismSnapshots(input.runId, /** @type {() => import('./events.js').ParallelismSnapshotPayload} */ (p.snapshotFn));
            break;
          }

          case 'stopSnapshots': {
            stopParallelismSnapshots(input.runId);
            break;
          }

          case 'getSummary': {
            return {
              success: true,
              data: store.getSummary(),
            };
          }

          case 'export': {
            store.complete();
            stopParallelismSnapshots(input.runId);
            return {
              success: true,
              data: store.export(),
            };
          }

          case 'clear': {
            store.clear();
            stopParallelismSnapshots(input.runId);
            stores.delete(input.runId);
            return { success: true };
          }

          default:
            return { success: false, data: { error: `Unknown operation: ${input.operation}` } };
        }

        metrics.executionCount++;
        metrics.totalDuration += Date.now() - startTime;

        return { success: true };
      } catch (error) {
        metrics.errorCount++;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      // Stop all intervals
      for (const [runId] of snapshotIntervals) {
        stopParallelismSnapshots(runId);
      }
      stores.clear();
      metrics = createModuleMetrics();
    },

    // Additional methods for direct access
    getStore,
    isEnabled() {
      return config?.enabled ?? false;
    },
    getConfig() {
      return config ? { ...config } : null;
    },
  };
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register profiling module implementations
 */
export function registerProfilingModules() {
  if (!globalRegistry.has(ModuleType.PROFILER, 'standard')) {
    globalRegistry.register(ModuleType.PROFILER, 'standard', createProfilingModule);
  }
}

// Auto-register on import
registerProfilingModules();
