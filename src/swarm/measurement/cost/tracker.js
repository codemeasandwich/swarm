/**
 * SWARM Framework - Cost Tracker
 * Tracks token usage and costs with budget enforcement
 * @module swarm/measurement/cost/tracker
 */

import { ModuleType, createModuleMetrics } from '../../types/module.js';
import { globalRegistry } from '../../registry/module-registry.js';
import { calculateModelCost, getCostBreakdown, formatCost, DEFAULT_PRICING } from './pricing.js';
import { TraceEventType, LogLevel } from '../../types/trace.js';

// =============================================================================
// COST TRACKER CONFIG
// =============================================================================

/**
 * @typedef {Object} CostTrackerConfig
 * @property {string} implementation - Which tracker to use
 * @property {number} [budgetLimit] - Maximum budget in dollars (0 = unlimited)
 * @property {number} [warningThreshold] - Percentage of budget to trigger warning (0-1)
 * @property {boolean} [haltOnBudgetExceeded] - Whether to halt on budget exceeded
 * @property {boolean} [trackByModel] - Track costs per model (default: true)
 * @property {boolean} [trackByWorker] - Track costs per worker (default: true)
 */

/**
 * @typedef {Object} CostTrackerInput
 * @property {string} operation - 'record' | 'getStatus' | 'adjustBudget' | 'reset'
 * @property {string} runId - Workflow run ID
 * @property {string} [model] - Model name for record
 * @property {number} [inputTokens] - Input tokens for record
 * @property {number} [outputTokens] - Output tokens for record
 * @property {string} [workerId] - Worker ID for tracking
 * @property {string} [taskId] - Task ID for tracking
 * @property {number} [newBudget] - New budget for adjustBudget
 */

/**
 * @typedef {Object} CostStatus
 * @property {number} totalCost - Total cost so far
 * @property {number} totalInputTokens - Total input tokens
 * @property {number} totalOutputTokens - Total output tokens
 * @property {number} budgetLimit - Current budget limit
 * @property {number} budgetRemaining - Remaining budget
 * @property {number} budgetUsedPercent - Percentage of budget used
 * @property {boolean} warningTriggered - Whether warning was triggered
 * @property {boolean} budgetExceeded - Whether budget was exceeded
 * @property {Record<string, import('./pricing.js').CostBreakdown>} byModel - Costs by model
 * @property {Record<string, number>} byWorker - Costs by worker
 */

/**
 * @typedef {Object} CostTrackerOutput
 * @property {boolean} success - Whether operation succeeded
 * @property {boolean} [recorded] - Whether cost was recorded
 * @property {boolean} [budgetExceeded] - Whether budget was exceeded
 * @property {boolean} [warningTriggered] - Whether warning was triggered
 * @property {import('./pricing.js').CostBreakdown} [breakdown] - Cost breakdown for record
 * @property {CostStatus} [status] - Full status (for getStatus)
 */

// =============================================================================
// COST STORE
// =============================================================================

/**
 * Stores cost data for a workflow run
 */
export class CostStore {
  /**
   * @param {string} runId
   * @param {number} budgetLimit
   */
  constructor(runId, budgetLimit = 0) {
    /** @type {string} */
    this.runId = runId;
    /** @type {number} */
    this.budgetLimit = budgetLimit;
    /** @type {number} */
    this.totalCost = 0;
    /** @type {number} */
    this.totalInputTokens = 0;
    /** @type {number} */
    this.totalOutputTokens = 0;
    /** @type {Map<string, import('./pricing.js').CostBreakdown>} */
    this.byModel = new Map();
    /** @type {Map<string, number>} */
    this.byWorker = new Map();
    /** @type {boolean} */
    this.warningTriggered = false;
    /** @type {boolean} */
    this.budgetExceeded = false;
  }

  /**
   * Record token usage
   * @param {string} model
   * @param {number} inputTokens
   * @param {number} outputTokens
   * @param {string} [workerId]
   * @returns {import('./pricing.js').CostBreakdown}
   */
  record(model, inputTokens, outputTokens, workerId) {
    const breakdown = getCostBreakdown(model, inputTokens, outputTokens);

    this.totalCost += breakdown.totalCost;
    this.totalInputTokens += inputTokens;
    this.totalOutputTokens += outputTokens;

    // Track by model
    const existing = this.byModel.get(model);
    if (existing) {
      this.byModel.set(model, {
        model,
        inputTokens: existing.inputTokens + inputTokens,
        outputTokens: existing.outputTokens + outputTokens,
        inputCost: existing.inputCost + breakdown.inputCost,
        outputCost: existing.outputCost + breakdown.outputCost,
        totalCost: existing.totalCost + breakdown.totalCost,
      });
    } else {
      this.byModel.set(model, breakdown);
    }

    // Track by worker
    if (workerId) {
      const workerCost = this.byWorker.get(workerId) || 0;
      this.byWorker.set(workerId, workerCost + breakdown.totalCost);
    }

    return breakdown;
  }

  /**
   * Check if budget exceeded
   * @returns {boolean}
   */
  isBudgetExceeded() {
    if (this.budgetLimit <= 0) return false;
    return this.totalCost >= this.budgetLimit;
  }

  /**
   * Check if warning threshold reached
   * @param {number} threshold - Percentage (0-1)
   * @returns {boolean}
   */
  isWarningThreshold(threshold) {
    if (this.budgetLimit <= 0) return false;
    return (this.totalCost / this.budgetLimit) >= threshold;
  }

  /**
   * Get budget remaining
   * @returns {number}
   */
  getBudgetRemaining() {
    if (this.budgetLimit <= 0) return Infinity;
    return Math.max(0, this.budgetLimit - this.totalCost);
  }

  /**
   * Get budget used percentage
   * @returns {number}
   */
  getBudgetUsedPercent() {
    if (this.budgetLimit <= 0) return 0;
    return (this.totalCost / this.budgetLimit) * 100;
  }

  /**
   * Get full status
   * @returns {CostStatus}
   */
  getStatus() {
    const byModel = {};
    for (const [model, breakdown] of this.byModel) {
      byModel[model] = breakdown;
    }

    const byWorker = {};
    for (const [worker, cost] of this.byWorker) {
      byWorker[worker] = cost;
    }

    return {
      totalCost: this.totalCost,
      totalInputTokens: this.totalInputTokens,
      totalOutputTokens: this.totalOutputTokens,
      budgetLimit: this.budgetLimit,
      budgetRemaining: this.getBudgetRemaining(),
      budgetUsedPercent: this.getBudgetUsedPercent(),
      warningTriggered: this.warningTriggered,
      budgetExceeded: this.budgetExceeded,
      byModel,
      byWorker,
    };
  }

  /**
   * Adjust budget
   * @param {number} newBudget
   */
  adjustBudget(newBudget) {
    this.budgetLimit = newBudget;
    // Reset exceeded status if budget increased
    if (!this.isBudgetExceeded()) {
      this.budgetExceeded = false;
    }
  }

  /**
   * Clear all data
   */
  clear() {
    this.totalCost = 0;
    this.totalInputTokens = 0;
    this.totalOutputTokens = 0;
    this.byModel.clear();
    this.byWorker.clear();
    this.warningTriggered = false;
    this.budgetExceeded = false;
  }
}

// =============================================================================
// STANDARD COST TRACKER MODULE
// =============================================================================

/**
 * Creates a standard cost tracker module
 * @returns {import('../../types/module.js').Module<CostTrackerConfig, CostTrackerInput, CostTrackerOutput>}
 */
export function createStandardCostTracker() {
  /** @type {CostTrackerConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  /** @type {Map<string, CostStore>} */
  const stores = new Map();

  /**
   * Get or create store for run
   * @param {string} runId
   * @returns {CostStore}
   */
  function getStore(runId) {
    if (!stores.has(runId)) {
      stores.set(runId, new CostStore(runId, config?.budgetLimit || 0));
    }
    return stores.get(runId);
  }

  return {
    id: 'cost-tracker-standard',
    version: '1.0.0',
    type: ModuleType.COST_TRACKER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('CostTracker not configured');
      }

      const startTime = Date.now();
      const store = getStore(input.runId);

      try {
        switch (input.operation) {
          case 'record': {
            const model = input.model || 'sonnet';
            const inputTokens = input.inputTokens || 0;
            const outputTokens = input.outputTokens || 0;

            // Check if already exceeded (halt mode)
            if (store.budgetExceeded && config.haltOnBudgetExceeded) {
              context.emit({
                timestamp: Date.now(),
                runId: input.runId,
                eventType: TraceEventType.BUDGET_EXCEEDED,
                moduleId: 'cost-tracker-standard',
                payload: {
                  status: store.getStatus(),
                  rejected: true,
                },
                level: LogLevel.ERROR,
              });

              metrics.executionCount++;
              metrics.totalDuration += Date.now() - startTime;
              return {
                success: false,
                recorded: false,
                budgetExceeded: true,
              };
            }

            // Record the cost
            const breakdown = store.record(
              model,
              inputTokens,
              outputTokens,
              config.trackByWorker ? input.workerId : undefined
            );

            // Check warning threshold
            let warningTriggered = false;
            if (
              config.warningThreshold &&
              !store.warningTriggered &&
              store.isWarningThreshold(config.warningThreshold)
            ) {
              store.warningTriggered = true;
              warningTriggered = true;

              context.emit({
                timestamp: Date.now(),
                runId: input.runId,
                eventType: TraceEventType.BUDGET_WARNING,
                moduleId: 'cost-tracker-standard',
                payload: {
                  currentCost: store.totalCost,
                  budgetLimit: store.budgetLimit,
                  percentUsed: store.getBudgetUsedPercent(),
                },
                level: LogLevel.WARN,
              });
            }

            // Check budget exceeded
            let budgetExceeded = false;
            if (store.isBudgetExceeded() && !store.budgetExceeded) {
              store.budgetExceeded = true;
              budgetExceeded = true;

              context.emit({
                timestamp: Date.now(),
                runId: input.runId,
                eventType: TraceEventType.BUDGET_EXCEEDED,
                moduleId: 'cost-tracker-standard',
                payload: {
                  totalCost: store.totalCost,
                  budgetLimit: store.budgetLimit,
                  halt: config.haltOnBudgetExceeded,
                },
                level: LogLevel.ERROR,
              });
            }

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'cost.recorded',
              moduleId: 'cost-tracker-standard',
              payload: {
                model,
                inputTokens,
                outputTokens,
                cost: breakdown.totalCost,
                totalCost: store.totalCost,
                taskId: input.taskId,
                workerId: input.workerId,
              },
              level: LogLevel.DEBUG,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;

            return {
              success: true,
              recorded: true,
              budgetExceeded,
              warningTriggered,
              breakdown,
            };
          }

          case 'getStatus': {
            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return {
              success: true,
              status: store.getStatus(),
            };
          }

          case 'adjustBudget': {
            if (input.newBudget !== undefined) {
              store.adjustBudget(input.newBudget);
            }

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'cost.budget.adjusted',
              moduleId: 'cost-tracker-standard',
              payload: {
                newBudget: store.budgetLimit,
                currentCost: store.totalCost,
              },
              level: LogLevel.INFO,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return {
              success: true,
              status: store.getStatus(),
            };
          }

          case 'reset': {
            store.clear();
            stores.delete(input.runId);

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return { success: true };
          }

          default:
            return { success: false };
        }
      } catch (error) {
        metrics.errorCount++;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      stores.clear();
      metrics = createModuleMetrics();
    },

    // Additional methods for direct access
    getStore,
    getStatus(runId) {
      const store = stores.get(runId);
      return store ? store.getStatus() : null;
    },
  };
}

// =============================================================================
// MODULE FACTORY
// =============================================================================

/**
 * Create a custom cost tracker module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: CostTrackerInput, config: CostTrackerConfig, context: import('../../types/workflow.js').ExecutionContext, store: CostStore) => Promise<CostTrackerOutput>} trackFn
 * @returns {import('../../types/module.js').Module<CostTrackerConfig, CostTrackerInput, CostTrackerOutput>}
 */
export function createCostTrackerModule(id, implementation, trackFn) {
  /** @type {CostTrackerConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  const store = new CostStore('default', 0);

  return {
    id,
    version: '1.0.0',
    type: ModuleType.COST_TRACKER,

    async configure(cfg) {
      config = cfg;
      if (cfg.budgetLimit) {
        store.adjustBudget(cfg.budgetLimit);
      }
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('CostTracker not configured');
      }

      const startTime = Date.now();
      try {
        const result = await trackFn(input, config, context, store);
        metrics.executionCount++;
        metrics.totalDuration += Date.now() - startTime;
        return result;
      } catch (error) {
        metrics.errorCount++;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      store.clear();
      metrics = createModuleMetrics();
    },
  };
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register all cost tracker implementations
 */
export function registerCostTrackers() {
  if (!globalRegistry.has(ModuleType.COST_TRACKER, 'standard')) {
    globalRegistry.register(ModuleType.COST_TRACKER, 'standard', createStandardCostTracker);
  }
}

// Auto-register on import
registerCostTrackers();
