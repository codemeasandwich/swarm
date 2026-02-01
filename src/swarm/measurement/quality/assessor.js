/**
 * SWARM Framework - Quality Assessor
 * Aggregates and computes quality scores from judge evaluations
 * @module swarm/measurement/quality/assessor
 */

import { ModuleType, createModuleMetrics } from '../../types/module.js';
import { globalRegistry } from '../../registry/module-registry.js';
import { LogLevel } from '../../types/trace.js';

// =============================================================================
// QUALITY DIMENSIONS
// =============================================================================

/**
 * Quality dimension names
 * @readonly
 * @enum {string}
 */
export const QualityDimension = Object.freeze({
  CORRECTNESS: 'correctness',
  COMPLETENESS: 'completeness',
  MAINTAINABILITY: 'maintainability',
  PERFORMANCE: 'performance',
  SECURITY: 'security',
  STYLE: 'style',
});

/**
 * @typedef {typeof QualityDimension[keyof typeof QualityDimension]} QualityDimensionValue
 */

/**
 * Default dimension weights
 * @type {Record<QualityDimensionValue, number>}
 */
export const DEFAULT_DIMENSION_WEIGHTS = Object.freeze({
  [QualityDimension.CORRECTNESS]: 0.30,
  [QualityDimension.COMPLETENESS]: 0.25,
  [QualityDimension.MAINTAINABILITY]: 0.15,
  [QualityDimension.PERFORMANCE]: 0.10,
  [QualityDimension.SECURITY]: 0.15,
  [QualityDimension.STYLE]: 0.05,
});

// =============================================================================
// QUALITY ASSESSOR CONFIG
// =============================================================================

/**
 * @typedef {Object} QualityAssessorConfig
 * @property {string} implementation - Which assessor to use
 * @property {Record<string, number>} [dimensionWeights] - Weights for each dimension
 * @property {number} [passingThreshold] - Minimum score to pass (0-1, default 0.7)
 * @property {boolean} [requireAllDimensions] - Require all dimensions to pass
 */

/**
 * @typedef {Object} JudgeResult
 * @property {string} taskId - Task that was judged
 * @property {string} workerId - Worker that performed task
 * @property {boolean} passed - Whether task passed
 * @property {number} score - Overall score (0-1)
 * @property {Record<string, number>} [dimensionScores] - Scores by dimension
 * @property {string[]} [failures] - List of failures
 * @property {Record<string, unknown>} [metadata] - Additional data
 */

/**
 * @typedef {Object} QualityAssessorInput
 * @property {string} operation - 'record' | 'compute' | 'getReport' | 'reset'
 * @property {string} runId - Workflow run ID
 * @property {JudgeResult} [judgeResult] - Judge result for record
 */

/**
 * @typedef {Object} QualityReport
 * @property {string} runId - Workflow run ID
 * @property {number} timestamp - Report generation time
 * @property {number} overallScore - Weighted overall score
 * @property {boolean} passed - Whether overall quality passed threshold
 * @property {number} taskCount - Number of tasks assessed
 * @property {number} passedCount - Number of tasks that passed
 * @property {number} passRate - Pass rate percentage
 * @property {Record<string, number>} dimensionAverages - Average scores by dimension
 * @property {Record<string, {count: number, avgScore: number}>} byWorker - Scores by worker
 * @property {string[]} commonFailures - Most common failure reasons
 */

/**
 * @typedef {Object} QualityAssessorOutput
 * @property {boolean} success - Whether operation succeeded
 * @property {boolean} [recorded] - Whether result was recorded
 * @property {number} [runningScore] - Current running score
 * @property {QualityReport} [report] - Full quality report
 */

// =============================================================================
// QUALITY STORE
// =============================================================================

/**
 * Stores quality data for a workflow run
 */
export class QualityStore {
  /**
   * @param {string} runId
   * @param {Record<string, number>} dimensionWeights
   * @param {number} passingThreshold
   */
  constructor(runId, dimensionWeights = DEFAULT_DIMENSION_WEIGHTS, passingThreshold = 0.7) {
    /** @type {string} */
    this.runId = runId;
    /** @type {Record<string, number>} */
    this.dimensionWeights = { ...dimensionWeights };
    /** @type {number} */
    this.passingThreshold = passingThreshold;
    /** @type {JudgeResult[]} */
    this.results = [];
    /** @type {Map<string, JudgeResult[]>} */
    this.byWorker = new Map();
    /** @type {Map<string, number>} */
    this.failureReasons = new Map();
  }

  /**
   * Record a judge result
   * @param {JudgeResult} result
   */
  record(result) {
    this.results.push(result);

    // Track by worker
    if (!this.byWorker.has(result.workerId)) {
      this.byWorker.set(result.workerId, []);
    }
    this.byWorker.get(result.workerId).push(result);

    // Track failure reasons
    if (result.failures) {
      for (const failure of result.failures) {
        const count = this.failureReasons.get(failure) || 0;
        this.failureReasons.set(failure, count + 1);
      }
    }
  }

  /**
   * Compute weighted score from dimension scores
   * @param {Record<string, number>} dimensionScores
   * @returns {number}
   */
  computeWeightedScore(dimensionScores) {
    let totalWeight = 0;
    let weightedSum = 0;

    for (const [dimension, score] of Object.entries(dimensionScores)) {
      const weight = this.dimensionWeights[dimension] || 0;
      totalWeight += weight;
      weightedSum += score * weight;
    }

    return totalWeight > 0 ? weightedSum / totalWeight : 0;
  }

  /**
   * Compute current running score
   * @returns {number}
   */
  computeRunningScore() {
    if (this.results.length === 0) return 0;

    const totalScore = this.results.reduce((sum, r) => sum + r.score, 0);
    return totalScore / this.results.length;
  }

  /**
   * Get dimension averages
   * @returns {Record<string, number>}
   */
  getDimensionAverages() {
    const dimensions = {};
    const counts = {};

    for (const result of this.results) {
      if (result.dimensionScores) {
        for (const [dim, score] of Object.entries(result.dimensionScores)) {
          dimensions[dim] = (dimensions[dim] || 0) + score;
          counts[dim] = (counts[dim] || 0) + 1;
        }
      }
    }

    const averages = {};
    for (const [dim, total] of Object.entries(dimensions)) {
      averages[dim] = total / counts[dim];
    }

    return averages;
  }

  /**
   * Get worker statistics
   * @returns {Record<string, {count: number, avgScore: number}>}
   */
  getWorkerStats() {
    const stats = {};

    for (const [workerId, results] of this.byWorker) {
      const totalScore = results.reduce((sum, r) => sum + r.score, 0);
      stats[workerId] = {
        count: results.length,
        avgScore: results.length > 0 ? totalScore / results.length : 0,
      };
    }

    return stats;
  }

  /**
   * Get most common failures
   * @param {number} limit
   * @returns {string[]}
   */
  getCommonFailures(limit = 10) {
    return Array.from(this.failureReasons.entries())
      .sort((a, b) => b[1] - a[1])
      .slice(0, limit)
      .map(([reason]) => reason);
  }

  /**
   * Generate full report
   * @returns {QualityReport}
   */
  generateReport() {
    const taskCount = this.results.length;
    const passedCount = this.results.filter((r) => r.passed).length;

    return {
      runId: this.runId,
      timestamp: Date.now(),
      overallScore: this.computeRunningScore(),
      passed: this.computeRunningScore() >= this.passingThreshold,
      taskCount,
      passedCount,
      passRate: taskCount > 0 ? (passedCount / taskCount) * 100 : 0,
      dimensionAverages: this.getDimensionAverages(),
      byWorker: this.getWorkerStats(),
      commonFailures: this.getCommonFailures(),
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.results = [];
    this.byWorker.clear();
    this.failureReasons.clear();
  }
}

// =============================================================================
// STANDARD QUALITY ASSESSOR MODULE
// =============================================================================

/**
 * Creates a standard quality assessor module
 * @returns {import('../../types/module.js').Module<QualityAssessorConfig, QualityAssessorInput, QualityAssessorOutput>}
 */
export function createStandardQualityAssessor() {
  /** @type {QualityAssessorConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  /** @type {Map<string, QualityStore>} */
  const stores = new Map();

  /**
   * Get or create store for run
   * @param {string} runId
   * @returns {QualityStore}
   */
  function getStore(runId) {
    if (!stores.has(runId)) {
      stores.set(
        runId,
        new QualityStore(
          runId,
          config?.dimensionWeights || DEFAULT_DIMENSION_WEIGHTS,
          config?.passingThreshold || 0.7
        )
      );
    }
    return stores.get(runId);
  }

  return {
    id: 'quality-assessor-standard',
    version: '1.0.0',
    type: ModuleType.QUALITY_ASSESSOR,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('QualityAssessor not configured');
      }

      const startTime = Date.now();
      const store = getStore(input.runId);

      try {
        switch (input.operation) {
          case 'record': {
            if (!input.judgeResult) {
              return { success: false };
            }

            // Compute weighted score if dimension scores provided
            let finalResult = input.judgeResult;
            if (input.judgeResult.dimensionScores && !input.judgeResult.score) {
              const score = store.computeWeightedScore(input.judgeResult.dimensionScores);
              finalResult = {
                ...input.judgeResult,
                score,
                passed: score >= store.passingThreshold,
              };
            }

            store.record(finalResult);

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'quality.recorded',
              moduleId: 'quality-assessor-standard',
              payload: {
                taskId: finalResult.taskId,
                workerId: finalResult.workerId,
                score: finalResult.score,
                passed: finalResult.passed,
              },
              level: LogLevel.DEBUG,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;

            return {
              success: true,
              recorded: true,
              runningScore: store.computeRunningScore(),
            };
          }

          case 'compute': {
            const report = store.generateReport();

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'quality.computed',
              moduleId: 'quality-assessor-standard',
              payload: {
                overallScore: report.overallScore,
                passed: report.passed,
                taskCount: report.taskCount,
              },
              level: LogLevel.INFO,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;

            return {
              success: true,
              report,
            };
          }

          case 'getReport': {
            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return {
              success: true,
              report: store.generateReport(),
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
    getReport(runId) {
      const store = stores.get(runId);
      return store ? store.generateReport() : null;
    },
  };
}

// =============================================================================
// MODULE FACTORY
// =============================================================================

/**
 * Create a custom quality assessor module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: QualityAssessorInput, config: QualityAssessorConfig, context: import('../../types/workflow.js').ExecutionContext, store: QualityStore) => Promise<QualityAssessorOutput>} assessFn
 * @returns {import('../../types/module.js').Module<QualityAssessorConfig, QualityAssessorInput, QualityAssessorOutput>}
 */
export function createQualityAssessorModule(id, implementation, assessFn) {
  /** @type {QualityAssessorConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  const store = new QualityStore('default');

  return {
    id,
    version: '1.0.0',
    type: ModuleType.QUALITY_ASSESSOR,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('QualityAssessor not configured');
      }

      const startTime = Date.now();
      try {
        const result = await assessFn(input, config, context, store);
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
 * Register all quality assessor implementations
 */
export function registerQualityAssessors() {
  if (!globalRegistry.has(ModuleType.QUALITY_ASSESSOR, 'standard')) {
    globalRegistry.register(ModuleType.QUALITY_ASSESSOR, 'standard', createStandardQualityAssessor);
  }
}

// Auto-register on import
registerQualityAssessors();
