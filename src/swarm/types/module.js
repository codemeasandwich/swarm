/**
 * SWARM Framework - Module Types
 * Module interfaces, metrics, and registry types
 * @module swarm/types/module
 */

// =============================================================================
// MODULE TYPES
// =============================================================================

/**
 * Types of modules in the SWARM framework
 * @readonly
 * @enum {string}
 */
export const ModuleType = Object.freeze({
  // Orchestration layer
  PLANNER: 'planner',
  SCHEDULER: 'scheduler',
  ROUTER: 'router',
  JUDGE: 'judge',
  // Execution layer
  WORKER: 'worker',
  // Configuration layer
  CONTEXT_BUILDER: 'context-builder',
  TOOL_SANDBOX: 'tool-sandbox',
  MEMORY_MANAGER: 'memory-manager',
  SECURITY_GUARDRAIL: 'security-guardrail',
  // Measurement layer
  METRICS_COLLECTOR: 'metrics-collector',
  TRACER: 'tracer',
  COST_TRACKER: 'cost-tracker',
  QUALITY_ASSESSOR: 'quality-assessor',
  PROFILER: 'profiler',
});

/**
 * @typedef {typeof ModuleType[keyof typeof ModuleType]} ModuleTypeValue
 */

// =============================================================================
// MODULE METRICS
// =============================================================================

/**
 * @typedef {Object} ModuleMetrics
 * @property {number} executionCount - Number of times execute() called
 * @property {number} totalDuration - Total execution time in ms
 * @property {number} totalTokensUsed - Total tokens consumed
 * @property {number} errorCount - Number of errors encountered
 * @property {Record<string, number>} customMetrics - Module-specific metrics
 */

/**
 * Creates empty ModuleMetrics
 * @returns {ModuleMetrics}
 */
export function createModuleMetrics() {
  return {
    executionCount: 0,
    totalDuration: 0,
    totalTokensUsed: 0,
    errorCount: 0,
    customMetrics: {},
  };
}

// =============================================================================
// MODULE INTERFACE
// =============================================================================

/**
 * @template TConfig
 * @template TInput
 * @template TOutput
 * @typedef {Object} Module
 * @property {string} id - Unique module identifier
 * @property {string} version - Module version
 * @property {ModuleTypeValue} type - Module type
 * @property {(config: TConfig) => Promise<void>} configure - Configure the module
 * @property {(input: TInput, context: import('./workflow.js').ExecutionContext) => Promise<TOutput>} execute - Execute the module
 * @property {() => ModuleMetrics} getMetrics - Get current metrics
 * @property {() => Promise<void>} reset - Reset module state
 */

// =============================================================================
// PLANNER CONFIGURATION
// =============================================================================

/**
 * Planner implementation types
 * @readonly
 * @enum {string}
 */
export const PlannerImplementation = Object.freeze({
  SINGLE_SHOT: 'single-shot',
  ITERATIVE: 'iterative',
  HIERARCHICAL: 'hierarchical',
  REACTIVE: 'reactive',
});

/**
 * @typedef {typeof PlannerImplementation[keyof typeof PlannerImplementation]} PlannerImplementationType
 */

/**
 * Task granularity levels
 * @readonly
 * @enum {string}
 */
export const TaskGranularity = Object.freeze({
  COARSE: 'coarse',
  MEDIUM: 'medium',
  FINE: 'fine',
});

/**
 * @typedef {typeof TaskGranularity[keyof typeof TaskGranularity]} TaskGranularityType
 */

/**
 * Parallelism hints
 * @readonly
 * @enum {string}
 */
export const ParallelismHint = Object.freeze({
  SEQUENTIAL: 'sequential',
  PARALLEL: 'parallel',
  MIXED: 'mixed',
});

/**
 * @typedef {typeof ParallelismHint[keyof typeof ParallelismHint]} ParallelismHintType
 */

/**
 * @typedef {Object} PlannerConfig
 * @property {PlannerImplementationType} implementation - Which planner to use
 * @property {import('./foundation.js').ModelSpec} model - Model for planning
 * @property {number} maxDecompositionDepth - Max levels of task decomposition
 * @property {TaskGranularityType} taskGranularity - How fine to split tasks
 * @property {ParallelismHintType} parallelismHint - Execution preference
 * @property {number} contextBudget - Tokens allocated to planning
 * @property {string} [systemPrompt] - Custom system prompt
 */

// =============================================================================
// SCHEDULER CONFIGURATION
// =============================================================================

/**
 * Scheduler implementation types
 * @readonly
 * @enum {string}
 */
export const SchedulerImplementation = Object.freeze({
  FIFO: 'fifo',
  PRIORITY: 'priority',
  ADAPTIVE: 'adaptive',
  COST_AWARE: 'cost-aware',
});

/**
 * @typedef {typeof SchedulerImplementation[keyof typeof SchedulerImplementation]} SchedulerImplementationType
 */

/**
 * @typedef {Object} PriorityWeights
 * @property {number} urgency - Weight for urgency (0-1)
 * @property {number} complexity - Weight for complexity (0-1)
 * @property {number} dependencies - Weight for dependencies (0-1)
 */

/**
 * @typedef {Object} SchedulerConfig
 * @property {SchedulerImplementationType} implementation - Which scheduler to use
 * @property {number} maxQueueSize - Maximum tasks in queue
 * @property {PriorityWeights} [priorityWeights] - Weights for priority scheduler
 * @property {number} [adaptiveWindow] - Window size for adaptive scheduler
 */

// =============================================================================
// ROUTER CONFIGURATION
// =============================================================================

/**
 * Router implementation types
 * @readonly
 * @enum {string}
 */
export const RouterImplementation = Object.freeze({
  STATIC: 'static',
  CAPABILITY: 'capability',
  LOAD_BALANCED: 'load-balanced',
  SPECIALIST: 'specialist',
});

/**
 * @typedef {typeof RouterImplementation[keyof typeof RouterImplementation]} RouterImplementationType
 */

/**
 * Load balance strategies
 * @readonly
 * @enum {string}
 */
export const LoadBalanceStrategy = Object.freeze({
  ROUND_ROBIN: 'round-robin',
  LEAST_LOADED: 'least-loaded',
  RANDOM: 'random',
});

/**
 * @typedef {typeof LoadBalanceStrategy[keyof typeof LoadBalanceStrategy]} LoadBalanceStrategyType
 */

/**
 * @typedef {Object} RouterConfig
 * @property {RouterImplementationType} implementation - Which router to use
 * @property {Record<string, string>} [staticMapping] - Task type to worker ID mapping
 * @property {number} [capabilityThreshold] - Minimum skill match score (0-1)
 * @property {LoadBalanceStrategyType} [loadBalanceStrategy] - Strategy for load balancing
 */

// =============================================================================
// JUDGE CONFIGURATION
// =============================================================================

/**
 * Judge implementation types
 * @readonly
 * @enum {string}
 */
export const JudgeImplementation = Object.freeze({
  DETERMINISTIC: 'deterministic',
  LLM_EVAL: 'llm-eval',
  HYBRID: 'hybrid',
  CONSENSUS: 'consensus',
});

/**
 * @typedef {typeof JudgeImplementation[keyof typeof JudgeImplementation]} JudgeImplementationType
 */

/**
 * @typedef {Object} EvaluationDimension
 * @property {string} name - Dimension name (e.g., 'correctness')
 * @property {number} weight - Weight in final score (0-1)
 * @property {string} criteria - Description of criteria
 */

/**
 * @typedef {Object} EvaluationRubric
 * @property {EvaluationDimension[]} dimensions - Evaluation dimensions
 * @property {number} passingThreshold - Minimum score to pass (0-1)
 */

/**
 * @typedef {Object} JudgeConfig
 * @property {JudgeImplementationType} implementation - Which judge to use
 * @property {import('./foundation.js').ModelSpec} [model] - Model for LLM evaluation
 * @property {EvaluationRubric} [rubric] - Evaluation rubric
 * @property {number} [consensusThreshold] - Threshold for consensus judge
 * @property {boolean} retryOnFailure - Whether to retry failed tasks
 * @property {number} maxRetries - Maximum retry attempts
 */

// =============================================================================
// WORKER CONFIGURATION (Execution Layer)
// =============================================================================

/**
 * Worker implementation types
 * @readonly
 * @enum {string}
 */
export const WorkerImplementation = Object.freeze({
  EPISODIC: 'episodic',
  PERSISTENT: 'persistent',
});

/**
 * @typedef {typeof WorkerImplementation[keyof typeof WorkerImplementation]} WorkerImplementationType
 */

/**
 * @typedef {Object} WorkerConfig
 * @property {WorkerImplementationType} implementation - Which worker to use
 * @property {number} maxRuntime - Maximum runtime per task in seconds
 * @property {boolean} episodicReset - Whether to terminate after each task
 * @property {number} maxConcurrentWorkers - Maximum concurrent workers in pool
 * @property {string} [workingDir] - Working directory for worker processes
 * @property {boolean} [dangerouslySkipPermissions] - Skip permission checks
 */

// =============================================================================
// CONTEXT BUILDER CONFIGURATION
// =============================================================================

/**
 * Context builder implementation types
 * @readonly
 * @enum {string}
 */
export const ContextBuilderImplementation = Object.freeze({
  MINIMAL: 'minimal',
  SCOPED: 'scoped',
  RICH: 'rich',
  FULL: 'full',
});

/**
 * @typedef {typeof ContextBuilderImplementation[keyof typeof ContextBuilderImplementation]} ContextBuilderImplementationType
 */

/**
 * @typedef {Object} ContextBuilderConfig
 * @property {ContextBuilderImplementationType} implementation - Which builder to use
 * @property {number} maxTokens - Maximum tokens for context
 * @property {boolean} includeProjectContext - Include project-level context
 * @property {boolean} includeExamples - Include examples
 * @property {boolean} includeConstraints - Include constraints
 * @property {boolean} includeHistory - Include execution history
 * @property {number} relevanceThreshold - Threshold for semantic filtering (0-1)
 * @property {string} [embeddingModel] - Model for semantic retrieval
 */

// =============================================================================
// TOOL SANDBOX CONFIGURATION
// =============================================================================

/**
 * Tool sandbox implementation types
 * @readonly
 * @enum {string}
 */
export const ToolSandboxImplementation = Object.freeze({
  MINIMAL: 'minimal',
  STANDARD: 'standard',
  EXTENDED: 'extended',
  FULL: 'full',
});

/**
 * @typedef {typeof ToolSandboxImplementation[keyof typeof ToolSandboxImplementation]} ToolSandboxImplementationType
 */

/**
 * @typedef {Object} ToolSandboxConfig
 * @property {ToolSandboxImplementationType} implementation - Which sandbox to use
 * @property {string[]} allowedTools - List of allowed tool names
 * @property {string[]} blockedPatterns - Patterns to block
 * @property {Record<string, number>} rateLimits - Tool to calls-per-minute mapping
 * @property {number} timeoutPerCall - Timeout per tool call in seconds
 * @property {import('./foundation.js').IsolationLevelType} isolationLevel - Isolation level
 */

// =============================================================================
// MEMORY MANAGER CONFIGURATION
// =============================================================================

/**
 * Memory manager implementation types
 * @readonly
 * @enum {string}
 */
export const MemoryManagerImplementation = Object.freeze({
  EPHEMERAL: 'ephemeral',
  FILE_BASED: 'file-based',
  STRUCTURED: 'structured',
  VECTOR: 'vector',
  HYBRID: 'hybrid',
});

/**
 * @typedef {typeof MemoryManagerImplementation[keyof typeof MemoryManagerImplementation]} MemoryManagerImplementationType
 */

/**
 * @typedef {Object} MemoryManagerConfig
 * @property {MemoryManagerImplementationType} implementation - Which manager to use
 * @property {string} storagePath - Path for persistent storage
 * @property {number} [maxEntries] - Maximum entries to store
 * @property {string} [embeddingModel] - Model for vector implementation
 * @property {number} [ttl] - Time-to-live in seconds
 */

// =============================================================================
// SECURITY GUARDRAIL CONFIGURATION
// =============================================================================

/**
 * Security guardrail implementation types
 * @readonly
 * @enum {string}
 */
export const SecurityGuardrailImplementation = Object.freeze({
  PERMISSIVE: 'permissive',
  STANDARD: 'standard',
  STRICT: 'strict',
  PARANOID: 'paranoid',
});

/**
 * @typedef {typeof SecurityGuardrailImplementation[keyof typeof SecurityGuardrailImplementation]} SecurityGuardrailImplementationType
 */

/**
 * @typedef {Object} SecurityGuardrailConfig
 * @property {SecurityGuardrailImplementationType} implementation - Which guardrail to use
 * @property {string[]} blocklist - Commands/patterns to block
 * @property {string[]} [allowlist] - Explicitly allowed commands
 * @property {string[]} requireApprovalFor - Commands requiring human approval
 * @property {string} [humanInLoopWebhook] - Webhook for human-in-loop
 * @property {boolean} auditLog - Whether to log all actions
 */
