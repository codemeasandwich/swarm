/**
 * SWARM Framework - Trace Types
 * Event tracing and logging types
 * @module swarm/types/trace
 */

// =============================================================================
// TRACE EVENT TYPES
// =============================================================================

/**
 * Types of trace events
 * @readonly
 * @enum {string}
 */
export const TraceEventType = Object.freeze({
  // Workflow lifecycle
  WORKFLOW_STARTED: 'workflow.started',
  WORKFLOW_COMPLETED: 'workflow.completed',
  WORKFLOW_FAILED: 'workflow.failed',

  // Planning
  PLAN_STARTED: 'plan.started',
  PLAN_COMPLETED: 'plan.completed',

  // Task lifecycle
  TASK_CREATED: 'task.created',
  TASK_QUEUED: 'task.queued',
  TASK_ASSIGNED: 'task.assigned',
  TASK_STARTED: 'task.started',
  TASK_COMPLETED: 'task.completed',
  TASK_FAILED: 'task.failed',
  TASK_RETRYING: 'task.retrying',

  // Worker lifecycle
  WORKER_SPAWNED: 'worker.spawned',
  WORKER_WORKING: 'worker.working',
  WORKER_COMPLETED: 'worker.completed',
  WORKER_FAILED: 'worker.failed',
  WORKER_TERMINATED: 'worker.terminated',

  // Judge evaluation
  JUDGE_EVALUATING: 'judge.evaluating',
  JUDGE_PASSED: 'judge.passed',
  JUDGE_FAILED: 'judge.failed',

  // Security
  GUARDRAIL_BLOCKED: 'guardrail.blocked',
  GUARDRAIL_APPROVED: 'guardrail.approved',

  // Budget
  BUDGET_WARNING: 'budget.warning',
  BUDGET_EXCEEDED: 'budget.exceeded',
});

/**
 * @typedef {typeof TraceEventType[keyof typeof TraceEventType]} TraceEventTypeValue
 */

// =============================================================================
// LOG LEVELS
// =============================================================================

/**
 * Log severity levels
 * @readonly
 * @enum {string}
 */
export const LogLevel = Object.freeze({
  DEBUG: 'debug',
  INFO: 'info',
  WARN: 'warn',
  ERROR: 'error',
});

/**
 * @typedef {typeof LogLevel[keyof typeof LogLevel]} LogLevelType
 */

// =============================================================================
// TRACE EVENT
// =============================================================================

/**
 * @typedef {Object} TokenUsage
 * @property {number} input - Input tokens used
 * @property {number} output - Output tokens used
 */

/**
 * @typedef {Object} TraceEvent
 * @property {number} timestamp - When the event occurred
 * @property {string} runId - Run this event belongs to
 * @property {TraceEventTypeValue} eventType - Type of event
 * @property {string} [moduleId] - Module that generated event
 * @property {string} [workerId] - Associated worker
 * @property {string} [taskId] - Associated task
 * @property {Record<string, unknown>} payload - Event-specific data
 * @property {TokenUsage} [tokenUsage] - Token usage if applicable
 * @property {number} [latency] - Duration in ms if applicable
 * @property {LogLevelType} level - Log level
 */

/**
 * Creates a TraceEvent with defaults
 * @param {TraceEventTypeValue} eventType
 * @param {string} runId
 * @param {Partial<TraceEvent>} [overrides={}]
 * @returns {TraceEvent}
 */
export function createTraceEvent(eventType, runId, overrides = {}) {
  return {
    timestamp: Date.now(),
    runId,
    eventType,
    payload: {},
    level: LogLevel.INFO,
    ...overrides,
  };
}

// =============================================================================
// TRACE SPAN
// =============================================================================

/**
 * @typedef {Object} TraceSpan
 * @property {string} id - Unique span ID
 * @property {string} name - Span name
 * @property {string} [parentId] - Parent span ID
 * @property {number} startTime - Start timestamp
 * @property {number} [endTime] - End timestamp
 * @property {Record<string, unknown>} attributes - Span attributes
 * @property {TraceEvent[]} events - Events within this span
 */

/**
 * Creates a TraceSpan with defaults
 * @param {string} name
 * @param {Partial<TraceSpan>} [overrides={}]
 * @returns {TraceSpan}
 */
export function createTraceSpan(name, overrides = {}) {
  return {
    id: `span-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    name,
    startTime: Date.now(),
    attributes: {},
    events: [],
    ...overrides,
  };
}
