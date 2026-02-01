/**
 * SWARM Framework - Task Types
 * Task definitions, acceptance criteria, and context requirements
 * @module swarm/types/task
 */

// =============================================================================
// ACCEPTANCE CRITERIA
// =============================================================================

/**
 * Types of acceptance criteria evaluation
 * @readonly
 * @enum {string}
 */
export const AcceptanceCriterionType = Object.freeze({
  DETERMINISTIC: 'deterministic',
  LLM_EVALUATED: 'llm-evaluated',
});

/**
 * @typedef {typeof AcceptanceCriterionType[keyof typeof AcceptanceCriterionType]} AcceptanceCriterionTypeValue
 */

/**
 * @typedef {Object} AcceptanceCriterion
 * @property {AcceptanceCriterionTypeValue} type - How to evaluate this criterion
 * @property {string} description - Human-readable description
 * @property {string} [evaluator] - Path to evaluation script or LLM prompt
 * @property {number} weight - Weight for scoring (0-1)
 */

/**
 * Creates an AcceptanceCriterion with defaults
 * @param {Partial<AcceptanceCriterion>} [overrides={}]
 * @returns {AcceptanceCriterion}
 */
export function createAcceptanceCriterion(overrides = {}) {
  return {
    type: AcceptanceCriterionType.DETERMINISTIC,
    description: '',
    weight: 1.0,
    ...overrides,
  };
}

// =============================================================================
// CONTEXT REQUIREMENTS
// =============================================================================

/**
 * Types of context that can be required
 * @readonly
 * @enum {string}
 */
export const ContextRequirementType = Object.freeze({
  FILE: 'file',
  DIRECTORY: 'directory',
  SNIPPET: 'snippet',
  DOCUMENTATION: 'documentation',
  EXAMPLE: 'example',
});

/**
 * @typedef {typeof ContextRequirementType[keyof typeof ContextRequirementType]} ContextRequirementTypeValue
 */

/**
 * @typedef {Object} ContextRequirement
 * @property {ContextRequirementTypeValue} type - Type of context
 * @property {string} [path] - File or directory path
 * @property {string} [query] - Query for semantic retrieval
 * @property {boolean} required - Whether this context is required
 */

/**
 * Creates a ContextRequirement with defaults
 * @param {Partial<ContextRequirement>} [overrides={}]
 * @returns {ContextRequirement}
 */
export function createContextRequirement(overrides = {}) {
  return {
    type: ContextRequirementType.FILE,
    required: false,
    ...overrides,
  };
}

// =============================================================================
// TASK DEFINITION
// =============================================================================

/**
 * @typedef {Object} TaskDefinition
 * @property {string} id - Unique task identifier
 * @property {string} type - Task type (e.g., 'code-generation', 'refactoring')
 * @property {string} description - Human-readable task description
 * @property {import('./foundation.js').SkillType[]} requiredSkills - Skills needed
 * @property {import('./foundation.js').DomainType} [requiredDomain] - Domain expertise needed
 * @property {AcceptanceCriterion[]} acceptanceCriteria - How to evaluate completion
 * @property {string[]} dependencies - IDs of tasks this depends on
 * @property {import('./foundation.js').TaskComplexityType} estimatedComplexity - Complexity level
 * @property {ContextRequirement[]} contextRequirements - Context needed for task
 * @property {string[]} toolRequirements - Tools needed (e.g., 'typescript-compiler')
 * @property {number} timeout - Maximum time in seconds
 */

/**
 * Creates a TaskDefinition with defaults
 * @param {Partial<TaskDefinition>} [overrides={}]
 * @returns {TaskDefinition}
 */
export function createTaskDefinition(overrides = {}) {
  return {
    id: `task-${Date.now()}`,
    type: 'code-generation',
    description: '',
    requiredSkills: [],
    acceptanceCriteria: [],
    dependencies: [],
    estimatedComplexity: 'moderate',
    contextRequirements: [],
    toolRequirements: [],
    timeout: 300,
    ...overrides,
  };
}

// =============================================================================
// TASK STATE
// =============================================================================

/**
 * Task execution status
 * @readonly
 * @enum {string}
 */
export const TaskStatus = Object.freeze({
  PENDING: 'pending',
  QUEUED: 'queued',
  ASSIGNED: 'assigned',
  EXECUTING: 'executing',
  EVALUATING: 'evaluating',
  COMPLETED: 'completed',
  FAILED: 'failed',
});

/**
 * @typedef {typeof TaskStatus[keyof typeof TaskStatus]} TaskStatusType
 */

/**
 * @typedef {Object} TaskAttempt
 * @property {string} workerId - Worker that attempted the task
 * @property {number} startedAt - Timestamp when attempt started
 * @property {number} [completedAt] - Timestamp when attempt completed
 * @property {number} tokensUsed - Tokens consumed in this attempt
 * @property {string} [error] - Error message if failed
 */

/**
 * @typedef {Object} TaskResult
 * @property {boolean} success - Whether task completed successfully
 * @property {unknown} output - Task output data
 * @property {number} qualityScore - Overall quality score (0-1)
 * @property {Record<string, number>} qualityBreakdown - Scores by dimension
 * @property {string[]} artifacts - Paths to generated files
 */

/**
 * @typedef {Object} TaskState
 * @property {TaskDefinition} task - The task definition
 * @property {TaskStatusType} status - Current status
 * @property {string} [assignedWorkerId] - Worker currently assigned
 * @property {TaskAttempt[]} attempts - History of attempts
 * @property {TaskResult} [result] - Final result if completed
 */

/**
 * Creates a TaskState with defaults
 * @param {TaskDefinition} task
 * @param {Partial<TaskState>} [overrides={}]
 * @returns {TaskState}
 */
export function createTaskState(task, overrides = {}) {
  return {
    task,
    status: TaskStatus.PENDING,
    attempts: [],
    ...overrides,
  };
}
