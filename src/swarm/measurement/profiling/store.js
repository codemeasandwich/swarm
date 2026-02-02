/**
 * SWARM Framework - Profiling Store
 * Aggregates all profiling data for a workflow run
 * @module swarm/measurement/profiling/store
 */

import scribbles from 'scribbles';
import {
  ProfilingEventType,
  createStrategyDecision,
  createWorkerRouting,
  createToolUsage,
  createContextUtilization,
  createParallelismSnapshot,
} from './events.js';

// =============================================================================
// PROFILING STORE
// =============================================================================

/**
 * Stores all profiling data for a workflow run
 */
export class ProfilingStore {
  /**
   * @param {string} runId
   */
  constructor(runId) {
    /** @type {string} */
    this.runId = runId;

    /** @type {number} */
    this.startTime = Date.now();

    /** @type {number | null} */
    this.endTime = null;

    // Decision reasoning storage
    /** @type {import('./events.js').StrategyDecisionPayload[]} */
    this.strategyDecisions = [];

    /** @type {import('./events.js').WorkerRoutingPayload[]} */
    this.workerRoutings = [];

    /** @type {import('./events.js').BatchSizePayload[]} */
    this.batchSizings = [];

    /** @type {import('./events.js').EvaluationDecisionPayload[]} */
    this.evaluationDecisions = [];

    // Resource tracking storage
    /** @type {Map<string, import('./events.js').ToolUsagePayload>} */
    this.toolUsageByTask = new Map();

    /** @type {Map<string, import('./events.js').ContextUtilizationPayload>} */
    this.contextUtilizationByTask = new Map();

    /** @type {import('./events.js').ParallelismSnapshotPayload[]} */
    this.parallelismSnapshots = [];

    /** @type {number} */
    this.peakParallelism = 0;

    // History tracking storage
    /** @type {import('./events.js').PlannerIterationPayload[]} */
    this.plannerIterations = [];

    /** @type {import('./events.js').StrategyRefinementPayload[]} */
    this.strategyRefinements = [];
  }

  // ===========================================================================
  // DECISION RECORDING
  // ===========================================================================

  /**
   * Record a strategy selection decision
   * @param {string} component
   * @param {string} chosen
   * @param {string[]} alternatives
   * @param {Record<string, unknown>} reasoning
   * @param {Record<string, unknown>} activeConfig
   */
  recordStrategyDecision(component, chosen, alternatives, reasoning, activeConfig) {
    const decision = createStrategyDecision(component, chosen, alternatives, reasoning, activeConfig);
    this.strategyDecisions.push(decision);

    scribbles.dataOut('profiling.strategy.decision', {
      runId: this.runId,
      event: ProfilingEventType.DECISION_STRATEGY_SELECTED,
      ...decision,
    });
  }

  /**
   * Record a worker routing decision
   * @param {string} taskId
   * @param {string} taskType
   * @param {string} selectedWorkerId
   * @param {Record<string, number>} candidateScores
   * @param {string} reason
   * @param {Record<string, unknown>} activeConfig
   */
  recordWorkerRouting(taskId, taskType, selectedWorkerId, candidateScores, reason, activeConfig) {
    const routing = createWorkerRouting(taskId, taskType, selectedWorkerId, candidateScores, reason, activeConfig);
    this.workerRoutings.push(routing);

    scribbles.dataOut('profiling.worker.routing', {
      runId: this.runId,
      event: ProfilingEventType.DECISION_WORKER_ROUTED,
      ...routing,
    });
  }

  /**
   * Record a batch sizing decision
   * @param {number} batchSize
   * @param {number} totalPending
   * @param {number} availableWorkers
   * @param {Record<string, unknown>} reasoning
   * @param {Record<string, unknown>} activeConfig
   */
  recordBatchSizing(batchSize, totalPending, availableWorkers, reasoning, activeConfig) {
    /** @type {import('./events.js').BatchSizePayload} */
    const sizing = {
      batchSize,
      totalPending,
      availableWorkers,
      reasoning,
      activeConfig,
    };
    this.batchSizings.push(sizing);

    scribbles.dataOut('profiling.batch.sizing', {
      runId: this.runId,
      event: ProfilingEventType.DECISION_BATCH_SIZED,
      ...sizing,
    });
  }

  /**
   * Record an evaluation decision
   * @param {string} taskId
   * @param {string} workerId
   * @param {boolean} passed
   * @param {Record<string, number>} dimensionScores
   * @param {'pass' | 'retry' | 'fail'} decision
   * @param {string} reason
   * @param {Record<string, unknown>} activeConfig
   */
  recordEvaluationDecision(taskId, workerId, passed, dimensionScores, decision, reason, activeConfig) {
    /** @type {import('./events.js').EvaluationDecisionPayload} */
    const evalPayload = {
      taskId,
      workerId,
      passed,
      dimensionScores,
      decision,
      reason,
      activeConfig,
    };
    this.evaluationDecisions.push(evalPayload);

    scribbles.dataOut('profiling.evaluation.decision', {
      runId: this.runId,
      event: ProfilingEventType.DECISION_EVALUATION_MADE,
      ...evalPayload,
    });
  }

  // ===========================================================================
  // RESOURCE TRACKING
  // ===========================================================================

  /**
   * Record tool usage for a task
   * @param {string} taskId
   * @param {string} workerId
   * @param {string[]} availableTools
   * @param {Record<string, number>} callCounts
   */
  recordToolUsage(taskId, workerId, availableTools, callCounts) {
    const usage = createToolUsage(taskId, workerId, availableTools, callCounts);
    this.toolUsageByTask.set(taskId, usage);

    scribbles.dataOut('profiling.tool.usage', {
      runId: this.runId,
      event: ProfilingEventType.TOOL_USAGE_RECORDED,
      ...usage,
    });
  }

  /**
   * Record context utilization for a task
   * @param {string} taskId
   * @param {string} workerId
   * @param {number} budgetTokens
   * @param {number} inputTokens
   * @param {number} outputTokens
   */
  recordContextUtilization(taskId, workerId, budgetTokens, inputTokens, outputTokens) {
    const util = createContextUtilization(taskId, workerId, budgetTokens, inputTokens, outputTokens);
    this.contextUtilizationByTask.set(taskId, util);

    scribbles.dataOut('profiling.context.utilization', {
      runId: this.runId,
      event: ProfilingEventType.CONTEXT_UTILIZATION_RECORDED,
      ...util,
    });

    // Warn if context rot risk is high
    if (util.contextRotRisk > 0.5) {
      scribbles.stdOut(
        '[PROFILING] High context rot risk (%.1f%%) for task %s - utilization at %.1f%%',
        util.contextRotRisk * 100,
        taskId,
        util.utilizationPercent * 100
      );
    }
  }

  /**
   * Record a parallelism snapshot
   * @param {number} activeWorkers
   * @param {Record<string, string[]>} tasksByWorker
   * @param {number} pendingTasks
   * @param {number} completedTasks
   */
  recordParallelismSnapshot(activeWorkers, tasksByWorker, pendingTasks, completedTasks) {
    if (activeWorkers > this.peakParallelism) {
      this.peakParallelism = activeWorkers;
    }

    const snapshot = createParallelismSnapshot(
      activeWorkers,
      this.peakParallelism,
      tasksByWorker,
      pendingTasks,
      completedTasks
    );
    this.parallelismSnapshots.push(snapshot);

    scribbles.dataOut('profiling.parallelism.snapshot', {
      runId: this.runId,
      event: ProfilingEventType.PARALLELISM_SNAPSHOT,
      ...snapshot,
    });
  }

  // ===========================================================================
  // HISTORY TRACKING
  // ===========================================================================

  /**
   * Record a planner iteration
   * @param {number} iteration
   * @param {number} previousTaskCount
   * @param {number} newTaskCount
   * @param {import('./events.js').PlannerIterationChange[]} changes
   * @param {string} triggerReason
   * @param {string} [feedback]
   * @param {number} tokensUsed
   */
  recordPlannerIteration(iteration, previousTaskCount, newTaskCount, changes, triggerReason, feedback, tokensUsed) {
    /** @type {import('./events.js').PlannerIterationPayload} */
    const iterPayload = {
      iteration,
      previousTaskCount,
      newTaskCount,
      changes,
      triggerReason,
      feedback,
      tokensUsed,
    };
    this.plannerIterations.push(iterPayload);

    scribbles.dataOut('profiling.planner.iteration', {
      runId: this.runId,
      event: ProfilingEventType.PLANNER_ITERATION,
      ...iterPayload,
    });
  }

  /**
   * Record a strategy refinement
   * @param {string} component
   * @param {string} previousStrategy
   * @param {string} newStrategy
   * @param {string} trigger
   * @param {string} reasoning
   * @param {Record<string, unknown>} metrics
   */
  recordStrategyRefinement(component, previousStrategy, newStrategy, trigger, reasoning, metrics) {
    /** @type {import('./events.js').StrategyRefinementPayload} */
    const refinement = {
      component,
      previousStrategy,
      newStrategy,
      trigger,
      reasoning,
      metrics,
    };
    this.strategyRefinements.push(refinement);

    scribbles.dataOut('profiling.strategy.refined', {
      runId: this.runId,
      event: ProfilingEventType.STRATEGY_REFINED,
      ...refinement,
    });
  }

  // ===========================================================================
  // AGGREGATION & EXPORT
  // ===========================================================================

  /**
   * Mark profiling as complete
   */
  complete() {
    this.endTime = Date.now();

    scribbles.dataOut('profiling.completed', {
      runId: this.runId,
      event: ProfilingEventType.PROFILING_COMPLETED,
      duration: this.endTime - this.startTime,
      summary: this.getSummary(),
    });
  }

  /**
   * Get a summary of profiling data
   * @returns {Object}
   */
  getSummary() {
    const toolUsageArray = Array.from(this.toolUsageByTask.values());
    const contextUtilArray = Array.from(this.contextUtilizationByTask.values());

    return {
      runId: this.runId,
      duration: (this.endTime || Date.now()) - this.startTime,

      // Decision counts
      strategyDecisionCount: this.strategyDecisions.length,
      routingDecisionCount: this.workerRoutings.length,
      batchSizingCount: this.batchSizings.length,
      evaluationCount: this.evaluationDecisions.length,

      // Resource metrics
      tasksWithToolTracking: this.toolUsageByTask.size,
      avgToolEfficiency:
        toolUsageArray.length > 0
          ? toolUsageArray.reduce((sum, t) => sum + t.toolEfficiency, 0) / toolUsageArray.length
          : 0,

      tasksWithContextTracking: this.contextUtilizationByTask.size,
      avgContextUtilization:
        contextUtilArray.length > 0
          ? contextUtilArray.reduce((sum, c) => sum + c.utilizationPercent, 0) / contextUtilArray.length
          : 0,
      tasksExceedingContextCap: contextUtilArray.filter((c) => !c.withinCap).length,

      // Parallelism
      peakParallelism: this.peakParallelism,
      parallelismSnapshots: this.parallelismSnapshots.length,

      // History
      plannerIterations: this.plannerIterations.length,
      strategyRefinements: this.strategyRefinements.length,
    };
  }

  /**
   * Export all profiling data
   * @returns {Object}
   */
  export() {
    return {
      runId: this.runId,
      startTime: this.startTime,
      endTime: this.endTime,
      summary: this.getSummary(),

      decisions: {
        strategy: this.strategyDecisions,
        routing: this.workerRoutings,
        batchSizing: this.batchSizings,
        evaluation: this.evaluationDecisions,
      },

      resources: {
        toolUsage: Object.fromEntries(this.toolUsageByTask),
        contextUtilization: Object.fromEntries(this.contextUtilizationByTask),
        parallelismSnapshots: this.parallelismSnapshots,
        peakParallelism: this.peakParallelism,
      },

      history: {
        plannerIterations: this.plannerIterations,
        strategyRefinements: this.strategyRefinements,
      },
    };
  }

  /**
   * Clear all profiling data
   */
  clear() {
    this.startTime = Date.now();
    this.endTime = null;
    this.strategyDecisions = [];
    this.workerRoutings = [];
    this.batchSizings = [];
    this.evaluationDecisions = [];
    this.toolUsageByTask.clear();
    this.contextUtilizationByTask.clear();
    this.parallelismSnapshots = [];
    this.peakParallelism = 0;
    this.plannerIterations = [];
    this.strategyRefinements = [];
  }
}
