/**
 * @file Custom error classes for the orchestration system.
 * Provides a hierarchy of errors for different failure scenarios.
 * @module orchestrator/errors
 */

/**
 * Base error class for all orchestrator errors.
 * @extends Error
 */
export class OrchestratorError extends Error {
  /**
   * Create an OrchestratorError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'OrchestratorError';
    Error.captureStackTrace?.(this, this.constructor);
  }
}

/**
 * Error thrown when plan parsing fails.
 * @extends OrchestratorError
 */
export class PlanParseError extends OrchestratorError {
  /**
   * Create a PlanParseError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.file] - The file being parsed
   * @param {number} [options.line] - The line number where parsing failed
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'PlanParseError';
    /** @type {string|undefined} */
    this.file = options.file;
    /** @type {number|undefined} */
    this.line = options.line;
  }
}

/**
 * Error thrown when plan validation fails.
 * @extends OrchestratorError
 */
export class PlanValidationError extends OrchestratorError {
  /**
   * Create a PlanValidationError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string[]} [options.errors] - List of validation errors
   * @param {string[]} [options.warnings] - List of validation warnings
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'PlanValidationError';
    /** @type {string[]} */
    this.errors = options.errors ?? [];
    /** @type {string[]} */
    this.warnings = options.warnings ?? [];
  }
}

/**
 * Error thrown when agent spawning fails.
 * @extends OrchestratorError
 */
export class AgentSpawnError extends OrchestratorError {
  /**
   * Create an AgentSpawnError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.agentId] - The agent that failed to spawn
   * @param {string} [options.taskId] - The task the agent was assigned
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'AgentSpawnError';
    /** @type {string|undefined} */
    this.agentId = options.agentId;
    /** @type {string|undefined} */
    this.taskId = options.taskId;
  }
}

/**
 * Error thrown when agent communication fails.
 * @extends OrchestratorError
 */
export class CommunicationError extends OrchestratorError {
  /**
   * Create a CommunicationError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.agentId] - The agent involved
   * @param {string} [options.operation] - The operation that failed
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'CommunicationError';
    /** @type {string|undefined} */
    this.agentId = options.agentId;
    /** @type {string|undefined} */
    this.operation = options.operation;
  }
}

/**
 * Error thrown when branch operations fail.
 * @extends OrchestratorError
 */
export class BranchError extends OrchestratorError {
  /**
   * Create a BranchError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.branch] - The branch involved
   * @param {string} [options.operation] - The git operation that failed
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'BranchError';
    /** @type {string|undefined} */
    this.branch = options.branch;
    /** @type {string|undefined} */
    this.operation = options.operation;
  }
}

/**
 * Error thrown when workspace operations fail.
 * @extends OrchestratorError
 */
export class WorkspaceError extends OrchestratorError {
  /**
   * Create a WorkspaceError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.agentId] - The agent whose workspace failed
   * @param {string} [options.path] - The workspace path
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'WorkspaceError';
    /** @type {string|undefined} */
    this.agentId = options.agentId;
    /** @type {string|undefined} */
    this.path = options.path;
  }
}

/**
 * Error thrown when CI operations fail.
 * @extends OrchestratorError
 */
export class CIError extends OrchestratorError {
  /**
   * Create a CIError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.provider] - The CI provider
   * @param {string} [options.operation] - The CI operation that failed
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'CIError';
    /** @type {string|undefined} */
    this.provider = options.provider;
    /** @type {string|undefined} */
    this.operation = options.operation;
  }
}

/**
 * Error thrown when lifecycle loop operations fail.
 * @extends OrchestratorError
 */
export class LifecycleError extends OrchestratorError {
  /**
   * Create a LifecycleError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.agentId] - The agent in the lifecycle
   * @param {string} [options.state] - The lifecycle state when error occurred
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'LifecycleError';
    /** @type {string|undefined} */
    this.agentId = options.agentId;
    /** @type {string|undefined} */
    this.state = options.state;
  }
}

/**
 * Error thrown when an operation times out.
 * @extends OrchestratorError
 */
export class TimeoutError extends OrchestratorError {
  /**
   * Create a TimeoutError.
   * @param {string} message - Error message
   * @param {Object} [options] - Additional options
   * @param {Error} [options.cause] - The underlying cause
   * @param {string} [options.operation] - The operation that timed out
   * @param {number} [options.timeoutMs] - The timeout value in milliseconds
   */
  constructor(message, options = {}) {
    super(message, options);
    this.name = 'TimeoutError';
    /** @type {string|undefined} */
    this.operation = options.operation;
    /** @type {number|undefined} */
    this.timeoutMs = options.timeoutMs;
  }
}
