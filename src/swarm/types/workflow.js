/**
 * SWARM Framework - Workflow Types
 * Workflow configuration, state, and execution context
 * @module swarm/types/workflow
 */

import { createModelSpec } from './foundation.js';

// =============================================================================
// WORKER PROFILE
// =============================================================================

/**
 * Worker status values
 * @readonly
 * @enum {string}
 */
export const WorkerStatus = Object.freeze({
  IDLE: 'idle',
  WORKING: 'working',
  COMPLETED: 'completed',
  FAILED: 'failed',
  TERMINATED: 'terminated',
});

/**
 * @typedef {typeof WorkerStatus[keyof typeof WorkerStatus]} WorkerStatusType
 */

/**
 * @typedef {Object} WorkerCapabilities
 * @property {import('./foundation.js').SkillType[]} skills - Agent skills
 * @property {import('./foundation.js').DomainType[]} domainExpertise - Domain knowledge
 * @property {string[]} toolAccess - Available tools
 */

/**
 * @typedef {Object} WorkerOperational
 * @property {number} maxRuntime - Maximum runtime in seconds
 * @property {number} contextWindow - Context tokens available
 * @property {boolean} episodicReset - Whether to reset after task
 * @property {import('./foundation.js').RetryPolicy} retryPolicy - Retry configuration
 */

/**
 * @typedef {Object} WorkerInstrumentation
 * @property {import('./foundation.js').TraceLevelType} traceLevel - Trace detail level
 * @property {boolean} captureIntermediates - Whether to capture intermediate states
 * @property {number[]} qualityCheckpoints - Percentages at which to check quality
 */

/**
 * @typedef {Object} WorkerProfile
 * @property {string} id - Unique worker profile ID
 * @property {string} name - Human-readable name
 * @property {import('./foundation.js').ModelSpec} model - Model configuration
 * @property {WorkerCapabilities} capabilities - What the worker can do
 * @property {WorkerOperational} operational - Runtime constraints
 * @property {WorkerInstrumentation} instrumentation - Measurement config
 * @property {string} [systemPrompt] - Custom system prompt
 */

/**
 * @typedef {Object} WorkerMetrics
 * @property {number} tasksCompleted - Number of tasks completed
 * @property {number} tasksFailed - Number of tasks failed
 * @property {number} totalRuntime - Total runtime in seconds
 * @property {number} totalTokensUsed - Total tokens consumed
 * @property {number} averageQualityScore - Average quality score (0-1)
 */

/**
 * @typedef {Object} WorkerInstance
 * @property {string} id - Unique instance ID
 * @property {string} profileId - Profile this instance is based on
 * @property {WorkerStatusType} status - Current status
 * @property {string} [currentTaskId] - Task currently being worked on
 * @property {number} [startedAt] - Timestamp when worker started
 * @property {WorkerMetrics} metrics - Performance metrics
 */

/**
 * Creates a WorkerProfile with defaults
 * @param {Partial<WorkerProfile>} [overrides={}]
 * @returns {WorkerProfile}
 */
export function createWorkerProfile(overrides = {}) {
  return {
    id: `worker-${Date.now()}`,
    name: 'Default Worker',
    model: createModelSpec(),
    capabilities: {
      skills: ['code-generation'],
      domainExpertise: ['web-development'],
      toolAccess: ['file-editor', 'test-runner'],
    },
    operational: {
      maxRuntime: 600,
      contextWindow: 32000,
      episodicReset: true,
      retryPolicy: {
        maxRetries: 2,
        backoffStrategy: 'exponential',
        initialDelay: 1000,
        maxDelay: 10000,
        retryableErrors: ['rate_limit', 'timeout', 'overloaded'],
      },
    },
    instrumentation: {
      traceLevel: 'detailed',
      captureIntermediates: true,
      qualityCheckpoints: [25, 50, 75, 100],
    },
    ...overrides,
  };
}

/**
 * Creates a WorkerInstance with defaults
 * @param {string} profileId
 * @param {Partial<WorkerInstance>} [overrides={}]
 * @returns {WorkerInstance}
 */
export function createWorkerInstance(profileId, overrides = {}) {
  return {
    id: `instance-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`,
    profileId,
    status: WorkerStatus.IDLE,
    metrics: {
      tasksCompleted: 0,
      tasksFailed: 0,
      totalRuntime: 0,
      totalTokensUsed: 0,
      averageQualityScore: 0,
    },
    ...overrides,
  };
}

// =============================================================================
// MEASUREMENT CONFIGURATION
// =============================================================================

/**
 * Metric aggregation methods
 * @readonly
 * @enum {string}
 */
export const MetricAggregation = Object.freeze({
  SUM: 'sum',
  MEAN: 'mean',
  MEDIAN: 'median',
  MAX: 'max',
  MIN: 'min',
  DISTRIBUTION: 'distribution',
});

/**
 * @typedef {typeof MetricAggregation[keyof typeof MetricAggregation]} MetricAggregationType
 */

/**
 * @typedef {Object} MetricDefinition
 * @property {string} name - Metric name
 * @property {string} unit - Unit of measurement
 * @property {string} description - Human-readable description
 * @property {MetricAggregationType} aggregation - How to aggregate
 * @property {string[]} labels - Labels for grouping
 */

/**
 * Export format options
 * @readonly
 * @enum {string}
 */
export const ExportFormat = Object.freeze({
  JSON: 'json',
  PROMETHEUS: 'prometheus',
  OPENTELEMETRY: 'opentelemetry',
  OTLP: 'otlp',
  JAEGER: 'jaeger',
});

/**
 * @typedef {typeof ExportFormat[keyof typeof ExportFormat]} ExportFormatType
 */

/**
 * @typedef {Object} MetricsConfig
 * @property {boolean} enabled - Whether metrics collection is enabled
 * @property {number} collectInterval - Collection interval in ms
 * @property {ExportFormatType} exportFormat - Output format
 * @property {string} [exportPath] - Path for file export
 * @property {MetricDefinition[]} customMetrics - Custom metric definitions
 */

/**
 * @typedef {Object} TracerConfig
 * @property {boolean} enabled - Whether tracing is enabled
 * @property {import('./foundation.js').TraceLevelType} traceLevel - Detail level
 * @property {ExportFormatType} exportFormat - Output format
 * @property {string} [exportEndpoint] - Endpoint for remote export
 * @property {number} sampleRate - Sampling rate (0-1)
 */

/**
 * @typedef {Object} CostTrackerConfig
 * @property {boolean} enabled - Whether cost tracking is enabled
 * @property {Record<string, {input: number, output: number}>} tokenPricing - Model to price mapping
 * @property {number} [budgetLimit] - Maximum budget in dollars
 * @property {number} [alertThreshold] - Percentage of budget for alerts (0-1)
 * @property {string} [alertWebhook] - Webhook for budget alerts
 */

/**
 * Quality evaluator types
 * @readonly
 * @enum {string}
 */
export const QualityEvaluator = Object.freeze({
  DETERMINISTIC: 'deterministic',
  LLM: 'llm',
  HYBRID: 'hybrid',
});

/**
 * @typedef {typeof QualityEvaluator[keyof typeof QualityEvaluator]} QualityEvaluatorType
 */

/**
 * @typedef {Object} QualityDimension
 * @property {string} name - Dimension name
 * @property {number} weight - Weight in final score (0-1)
 * @property {QualityEvaluatorType} evaluator - How to evaluate
 * @property {Record<string, unknown>} config - Evaluator-specific config
 */

/**
 * Quality aggregation methods
 * @readonly
 * @enum {string}
 */
export const QualityAggregation = Object.freeze({
  WEIGHTED_MEAN: 'weighted-mean',
  MIN: 'min',
  GEOMETRIC_MEAN: 'geometric-mean',
});

/**
 * @typedef {typeof QualityAggregation[keyof typeof QualityAggregation]} QualityAggregationType
 */

/**
 * @typedef {Object} QualityAssessorConfig
 * @property {QualityDimension[]} dimensions - Quality dimensions
 * @property {QualityAggregationType} aggregationMethod - How to combine scores
 * @property {number} passingThreshold - Minimum score to pass (0-1)
 */

// =============================================================================
// WORKFLOW CONFIGURATION
// =============================================================================

/**
 * Worker selection strategies
 * @readonly
 * @enum {string}
 */
export const WorkerSelectionStrategy = Object.freeze({
  ROUND_ROBIN: 'round-robin',
  CAPABILITY_MATCH: 'capability-match',
  LOAD_BALANCED: 'load-balanced',
});

/**
 * @typedef {typeof WorkerSelectionStrategy[keyof typeof WorkerSelectionStrategy]} WorkerSelectionStrategyType
 */

/**
 * @typedef {Object} OrchestrationConfig
 * @property {import('./module.js').PlannerConfig} planner
 * @property {import('./module.js').SchedulerConfig} scheduler
 * @property {import('./module.js').RouterConfig} router
 * @property {import('./module.js').JudgeConfig} judge
 */

/**
 * @typedef {Object} ConfigurationLayerConfig
 * @property {import('./module.js').ContextBuilderConfig} contextBuilder
 * @property {import('./module.js').ToolSandboxConfig} toolSandbox
 * @property {import('./module.js').MemoryManagerConfig} memoryManager
 * @property {import('./module.js').SecurityGuardrailConfig} securityGuardrail
 */

/**
 * @typedef {Object} ExecutionLayerConfig
 * @property {WorkerProfile[]} workerProfiles
 * @property {number} maxConcurrentWorkers
 * @property {WorkerSelectionStrategyType} workerSelectionStrategy
 */

/**
 * @typedef {Object} MeasurementConfig
 * @property {MetricsConfig} metrics
 * @property {TracerConfig} tracer
 * @property {CostTrackerConfig} costTracker
 * @property {QualityAssessorConfig} qualityAssessor
 */

/**
 * @typedef {Object} WorkflowConstraints
 * @property {number} maxTotalTokens - Maximum total tokens
 * @property {number} maxTotalCost - Maximum total cost in dollars
 * @property {number} maxTotalRuntime - Maximum runtime in seconds
 * @property {number} qualityThreshold - Minimum quality score (0-1)
 */

/**
 * @typedef {Object} WorkflowConfig
 * @property {string} id - Unique workflow ID
 * @property {string} name - Human-readable name
 * @property {string} version - Configuration version
 * @property {string} [description] - Description
 * @property {OrchestrationConfig} orchestration - Orchestration layer config
 * @property {ConfigurationLayerConfig} configuration - Configuration layer config
 * @property {ExecutionLayerConfig} execution - Execution layer config
 * @property {MeasurementConfig} measurement - Measurement layer config
 * @property {WorkflowConstraints} constraints - Global constraints
 */

// =============================================================================
// WORKFLOW STATE
// =============================================================================

/**
 * Workflow execution status
 * @readonly
 * @enum {string}
 */
export const WorkflowStatus = Object.freeze({
  PENDING: 'pending',
  PLANNING: 'planning',
  EXECUTING: 'executing',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/**
 * @typedef {typeof WorkflowStatus[keyof typeof WorkflowStatus]} WorkflowStatusType
 */

/**
 * @typedef {Object} WorkflowError
 * @property {number} timestamp - When error occurred
 * @property {string} [taskId] - Associated task
 * @property {string} [workerId] - Associated worker
 * @property {string} [moduleId] - Associated module
 * @property {string} error - Error message
 * @property {string} [stack] - Stack trace
 * @property {boolean} recoverable - Whether error is recoverable
 */

/**
 * @typedef {Object} WorkflowState
 * @property {WorkflowStatusType} status - Current status
 * @property {Map<string, import('./task.js').TaskState>} tasks - Task states by ID
 * @property {Map<string, WorkerInstance>} workers - Worker instances by ID
 * @property {number} startedAt - Timestamp when workflow started
 * @property {number} [completedAt] - Timestamp when workflow completed
 * @property {number} totalTokensUsed - Total tokens consumed
 * @property {number} totalCost - Total cost in dollars
 * @property {WorkflowError[]} errors - Errors encountered
 */

/**
 * Creates an empty WorkflowState
 * @returns {WorkflowState}
 */
export function createWorkflowState() {
  return {
    status: WorkflowStatus.PENDING,
    tasks: new Map(),
    workers: new Map(),
    startedAt: Date.now(),
    totalTokensUsed: 0,
    totalCost: 0,
    errors: [],
  };
}

// =============================================================================
// EXECUTION CONTEXT
// =============================================================================

/**
 * @typedef {Object} ExecutionContext
 * @property {string} workflowId - Workflow ID
 * @property {string} runId - Unique run ID
 * @property {string} [taskId] - Current task ID
 * @property {string} [workerId] - Current worker ID
 * @property {ExecutionContext} [parentContext] - Parent context for nesting
 * @property {WorkflowState} state - Current workflow state
 * @property {WorkflowConfig} config - Workflow configuration
 * @property {(event: import('./trace.js').TraceEvent) => void} emit - Emit trace event
 * @property {(name: string) => number | undefined} getMetric - Get metric value
 * @property {(name: string, value: number) => void} setMetric - Set metric value
 */

/**
 * Creates a minimal ExecutionContext for testing
 * @param {WorkflowConfig} config
 * @param {Partial<ExecutionContext>} [overrides={}]
 * @returns {ExecutionContext}
 */
export function createExecutionContext(config, overrides = {}) {
  const metrics = new Map();
  return {
    workflowId: config.id,
    runId: `run-${Date.now()}`,
    state: createWorkflowState(),
    config,
    emit: () => {},
    getMetric: (name) => metrics.get(name),
    setMetric: (name, value) => metrics.set(name, value),
    ...overrides,
  };
}

// =============================================================================
// WORKFLOW RESULT
// =============================================================================

/**
 * @typedef {Object} WorkflowSummary
 * @property {number} totalTasks - Total tasks in workflow
 * @property {number} completedTasks - Tasks completed successfully
 * @property {number} failedTasks - Tasks that failed
 * @property {number} totalRuntime - Total runtime in seconds
 * @property {number} totalTokens - Total tokens used
 * @property {number} totalCost - Total cost in dollars
 * @property {number} averageQuality - Average quality score (0-1)
 */

/**
 * @typedef {Object} WorkflowResult
 * @property {boolean} success - Whether workflow completed successfully
 * @property {Map<string, import('./task.js').TaskResult>} taskResults - Results by task ID
 * @property {Record<string, number>} metrics - Collected metrics
 * @property {import('./trace.js').TraceEvent[]} traces - Execution traces
 * @property {WorkflowError[]} errors - Errors encountered
 * @property {WorkflowSummary} summary - Summary statistics
 */
