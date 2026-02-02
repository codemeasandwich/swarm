/**
 * SWARM Framework - Profiling Event Types
 * Extended trace events for detailed decision reasoning capture
 * @module swarm/measurement/profiling/events
 */

// =============================================================================
// PROFILING EVENT TYPES
// =============================================================================

/**
 * Types of profiling events (extends TraceEventType)
 * @readonly
 * @enum {string}
 */
export const ProfilingEventType = Object.freeze({
  // Decision reasoning events
  DECISION_STRATEGY_SELECTED: 'profiling.decision.strategy_selected',
  DECISION_WORKER_ROUTED: 'profiling.decision.worker_routed',
  DECISION_BATCH_SIZED: 'profiling.decision.batch_sized',
  DECISION_EVALUATION_MADE: 'profiling.decision.evaluation_made',

  // Resource tracking events
  TOOL_USAGE_RECORDED: 'profiling.tool.usage_recorded',
  CONTEXT_UTILIZATION_RECORDED: 'profiling.context.utilization_recorded',
  PARALLELISM_SNAPSHOT: 'profiling.parallelism.snapshot',

  // History tracking events
  PLANNER_ITERATION: 'profiling.planner.iteration',
  STRATEGY_REFINED: 'profiling.strategy.refined',

  // Profiling lifecycle
  PROFILING_STARTED: 'profiling.started',
  PROFILING_SNAPSHOT: 'profiling.snapshot',
  PROFILING_COMPLETED: 'profiling.completed',
});

/**
 * @typedef {typeof ProfilingEventType[keyof typeof ProfilingEventType]} ProfilingEventTypeValue
 */

// =============================================================================
// DECISION REASONING PAYLOAD TYPES
// =============================================================================

/**
 * @typedef {Object} StrategyDecisionPayload
 * @property {string} component - Which component made the decision (planner, router, scheduler, judge)
 * @property {string} chosen - The strategy/option that was chosen
 * @property {string[]} alternatives - Other options that were considered
 * @property {Record<string, unknown>} reasoning - Why this choice was made (scores, thresholds, rules)
 * @property {Record<string, unknown>} activeConfig - Configuration that influenced this decision
 */

/**
 * @typedef {Object} WorkerRoutingPayload
 * @property {string} taskId - Task being routed
 * @property {string} taskType - Type of task
 * @property {string} selectedWorkerId - Worker that was selected
 * @property {Record<string, number>} candidateScores - Scores for all candidate workers
 * @property {string} reason - Human-readable explanation
 * @property {Record<string, unknown>} activeConfig - Router config at decision time
 */

/**
 * @typedef {Object} BatchSizePayload
 * @property {number} batchSize - Number of tasks in this batch
 * @property {number} totalPending - Total tasks waiting
 * @property {number} availableWorkers - Workers available
 * @property {Record<string, unknown>} reasoning - Why this batch size
 * @property {Record<string, unknown>} activeConfig - Scheduler config at decision time
 */

/**
 * @typedef {Object} EvaluationDecisionPayload
 * @property {string} taskId - Task being evaluated
 * @property {string} workerId - Worker that executed the task
 * @property {boolean} passed - Whether the task passed
 * @property {Record<string, number>} dimensionScores - Scores per evaluation dimension
 * @property {string} decision - 'pass' | 'retry' | 'fail'
 * @property {string} reason - Why this decision was made
 * @property {Record<string, unknown>} activeConfig - Judge config at decision time
 */

// =============================================================================
// RESOURCE TRACKING PAYLOAD TYPES
// =============================================================================

/**
 * @typedef {Object} ToolUsagePayload
 * @property {string} taskId - Task this usage belongs to
 * @property {string} workerId - Worker that used the tools
 * @property {string[]} availableTools - Tools that were available
 * @property {string[]} invokedTools - Tools that were actually used
 * @property {Record<string, number>} callCounts - Number of calls per tool
 * @property {string[]} unusedTools - Tools that were never called
 * @property {number} toolEfficiency - invokedTools.length / availableTools.length
 */

/**
 * @typedef {Object} ContextUtilizationPayload
 * @property {string} taskId - Task this belongs to
 * @property {string} workerId - Worker that executed
 * @property {number} budgetTokens - Token budget for this task
 * @property {number} inputTokens - Actual input tokens used
 * @property {number} outputTokens - Actual output tokens generated
 * @property {number} utilizationPercent - inputTokens / budgetTokens
 * @property {boolean} withinCap - Whether under 40% threshold
 * @property {number} contextRotRisk - Risk score for context degradation (0-1)
 */

/**
 * @typedef {Object} ParallelismSnapshotPayload
 * @property {number} timestamp - When this snapshot was taken
 * @property {number} activeWorkers - Currently active workers
 * @property {number} peakSoFar - Highest parallel count so far
 * @property {Record<string, string[]>} tasksByWorker - Which tasks each worker is handling
 * @property {number} pendingTasks - Tasks waiting in queue
 * @property {number} completedTasks - Tasks completed so far
 */

// =============================================================================
// HISTORY TRACKING PAYLOAD TYPES
// =============================================================================

/**
 * @typedef {Object} PlannerIterationChange
 * @property {'split' | 'merged' | 'added' | 'removed' | 'modified'} type - Type of change
 * @property {string} [original] - Original task ID (for split/modify)
 * @property {string[]} [into] - New task IDs (for split)
 * @property {string} [task] - Task ID (for added/removed)
 * @property {string} reason - Why this change was made
 */

/**
 * @typedef {Object} PlannerIterationPayload
 * @property {number} iteration - Iteration number (1-based)
 * @property {number} previousTaskCount - Tasks before this iteration
 * @property {number} newTaskCount - Tasks after this iteration
 * @property {PlannerIterationChange[]} changes - What changed
 * @property {string} triggerReason - What triggered this iteration (judge.feedback, timeout, etc)
 * @property {string} [feedback] - Feedback that triggered the change
 * @property {number} tokensUsed - Tokens used for this iteration
 */

/**
 * @typedef {Object} StrategyRefinementPayload
 * @property {string} component - Which component refined its strategy
 * @property {string} previousStrategy - Strategy before refinement
 * @property {string} newStrategy - Strategy after refinement
 * @property {string} trigger - What triggered the refinement
 * @property {string} reasoning - Why this refinement was made
 * @property {Record<string, unknown>} metrics - Metrics that informed the decision
 */

// =============================================================================
// FACTORY FUNCTIONS
// =============================================================================

/**
 * Create a strategy decision event payload
 * @param {string} component
 * @param {string} chosen
 * @param {string[]} alternatives
 * @param {Record<string, unknown>} reasoning
 * @param {Record<string, unknown>} activeConfig
 * @returns {StrategyDecisionPayload}
 */
export function createStrategyDecision(component, chosen, alternatives, reasoning, activeConfig) {
  return {
    component,
    chosen,
    alternatives,
    reasoning,
    activeConfig,
  };
}

/**
 * Create a worker routing event payload
 * @param {string} taskId
 * @param {string} taskType
 * @param {string} selectedWorkerId
 * @param {Record<string, number>} candidateScores
 * @param {string} reason
 * @param {Record<string, unknown>} activeConfig
 * @returns {WorkerRoutingPayload}
 */
export function createWorkerRouting(taskId, taskType, selectedWorkerId, candidateScores, reason, activeConfig) {
  return {
    taskId,
    taskType,
    selectedWorkerId,
    candidateScores,
    reason,
    activeConfig,
  };
}

/**
 * Create a tool usage event payload
 * @param {string} taskId
 * @param {string} workerId
 * @param {string[]} availableTools
 * @param {Record<string, number>} callCounts
 * @returns {ToolUsagePayload}
 */
export function createToolUsage(taskId, workerId, availableTools, callCounts) {
  const invokedTools = Object.keys(callCounts);
  const unusedTools = availableTools.filter((t) => !invokedTools.includes(t));
  const toolEfficiency = availableTools.length > 0 ? invokedTools.length / availableTools.length : 0;

  return {
    taskId,
    workerId,
    availableTools,
    invokedTools,
    callCounts,
    unusedTools,
    toolEfficiency,
  };
}

/**
 * Create a context utilization event payload
 * @param {string} taskId
 * @param {string} workerId
 * @param {number} budgetTokens
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {ContextUtilizationPayload}
 */
export function createContextUtilization(taskId, workerId, budgetTokens, inputTokens, outputTokens) {
  const utilizationPercent = budgetTokens > 0 ? inputTokens / budgetTokens : 0;
  const withinCap = utilizationPercent < 0.4; // 40% cap
  // Context rot risk increases as we approach and exceed 40%
  const contextRotRisk = utilizationPercent < 0.3 ? 0 : Math.min(1, (utilizationPercent - 0.3) / 0.3);

  return {
    taskId,
    workerId,
    budgetTokens,
    inputTokens,
    outputTokens,
    utilizationPercent,
    withinCap,
    contextRotRisk,
  };
}

/**
 * Create a parallelism snapshot payload
 * @param {number} activeWorkers
 * @param {number} peakSoFar
 * @param {Record<string, string[]>} tasksByWorker
 * @param {number} pendingTasks
 * @param {number} completedTasks
 * @returns {ParallelismSnapshotPayload}
 */
export function createParallelismSnapshot(activeWorkers, peakSoFar, tasksByWorker, pendingTasks, completedTasks) {
  return {
    timestamp: Date.now(),
    activeWorkers,
    peakSoFar,
    tasksByWorker,
    pendingTasks,
    completedTasks,
  };
}
