/**
 * SWARM Framework - Foundation Types
 * Core type definitions for models, skills, and domains
 * @module swarm/types/foundation
 */

// =============================================================================
// MODEL PROVIDER
// =============================================================================

/**
 * Supported AI model providers
 * @readonly
 * @enum {string}
 */
export const ModelProvider = Object.freeze({
  ANTHROPIC: 'anthropic',
  OPENAI: 'openai',
  GOOGLE: 'google',
  LOCAL: 'local',
});

/**
 * @typedef {typeof ModelProvider[keyof typeof ModelProvider]} ModelProviderType
 */

// =============================================================================
// MODEL SPECIFICATION
// =============================================================================

/**
 * @typedef {Object} ModelSpec
 * @property {ModelProviderType} provider - The AI model provider
 * @property {string} name - Model name/identifier (e.g., 'claude-sonnet-4-20250514')
 * @property {number} temperature - Sampling temperature (0-1)
 * @property {number} maxOutputTokens - Maximum tokens in response
 * @property {number} contextWindow - Total context window size
 */

/**
 * Creates a ModelSpec with defaults
 * @param {Partial<ModelSpec>} [overrides={}]
 * @returns {ModelSpec}
 */
export function createModelSpec(overrides = {}) {
  return {
    provider: ModelProvider.ANTHROPIC,
    name: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    maxOutputTokens: 4096,
    contextWindow: 200000,
    ...overrides,
  };
}

// =============================================================================
// SKILLS
// =============================================================================

/**
 * Agent skill capabilities
 * @readonly
 * @enum {string}
 */
export const Skill = Object.freeze({
  CODE_GENERATION: 'code-generation',
  CODE_REVIEW: 'code-review',
  CODE_REFACTORING: 'code-refactoring',
  TEST_WRITING: 'test-writing',
  DOCUMENTATION: 'documentation',
  DEBUGGING: 'debugging',
  API_INTEGRATION: 'api-integration',
  DATABASE_DESIGN: 'database-design',
  FRONTEND_DEVELOPMENT: 'frontend-development',
  BACKEND_DEVELOPMENT: 'backend-development',
  DEVOPS: 'devops',
  SECURITY_ANALYSIS: 'security-analysis',
  PERFORMANCE_OPTIMISATION: 'performance-optimisation',
  ARCHITECTURE_DESIGN: 'architecture-design',
  RESEARCH: 'research',
  WRITING: 'writing',
  DATA_ANALYSIS: 'data-analysis',
});

/**
 * @typedef {typeof Skill[keyof typeof Skill]} SkillType
 */

// =============================================================================
// DOMAINS
// =============================================================================

/**
 * Domain expertise areas
 * @readonly
 * @enum {string}
 */
export const Domain = Object.freeze({
  WEB_DEVELOPMENT: 'web-development',
  MOBILE_DEVELOPMENT: 'mobile-development',
  CLOUD_INFRASTRUCTURE: 'cloud-infrastructure',
  MACHINE_LEARNING: 'machine-learning',
  FINANCIAL_SERVICES: 'financial-services',
  HEALTHCARE: 'healthcare',
  E_COMMERCE: 'e-commerce',
  SAAS: 'saas',
  ENTERPRISE: 'enterprise',
  STARTUP: 'startup',
});

/**
 * @typedef {typeof Domain[keyof typeof Domain]} DomainType
 */

// =============================================================================
// TASK COMPLEXITY
// =============================================================================

/**
 * Task complexity levels
 * @readonly
 * @enum {string}
 */
export const TaskComplexity = Object.freeze({
  TRIVIAL: 'trivial',
  SIMPLE: 'simple',
  MODERATE: 'moderate',
  COMPLEX: 'complex',
  VERY_COMPLEX: 'very-complex',
});

/**
 * @typedef {typeof TaskComplexity[keyof typeof TaskComplexity]} TaskComplexityType
 */

// =============================================================================
// RETRY POLICY
// =============================================================================

/**
 * Backoff strategies for retries
 * @readonly
 * @enum {string}
 */
export const BackoffStrategy = Object.freeze({
  FIXED: 'fixed',
  EXPONENTIAL: 'exponential',
  LINEAR: 'linear',
});

/**
 * @typedef {typeof BackoffStrategy[keyof typeof BackoffStrategy]} BackoffStrategyType
 */

/**
 * @typedef {Object} RetryPolicy
 * @property {number} maxRetries - Maximum number of retry attempts
 * @property {BackoffStrategyType} backoffStrategy - Strategy for increasing delay
 * @property {number} initialDelay - Initial delay in milliseconds
 * @property {number} maxDelay - Maximum delay in milliseconds
 * @property {string[]} retryableErrors - Error types that trigger retry
 */

/**
 * Creates a RetryPolicy with defaults
 * @param {Partial<RetryPolicy>} [overrides={}]
 * @returns {RetryPolicy}
 */
export function createRetryPolicy(overrides = {}) {
  return {
    maxRetries: 2,
    backoffStrategy: BackoffStrategy.EXPONENTIAL,
    initialDelay: 1000,
    maxDelay: 10000,
    retryableErrors: ['rate_limit', 'timeout', 'overloaded'],
    ...overrides,
  };
}

// =============================================================================
// TRACE LEVELS
// =============================================================================

/**
 * Trace detail levels
 * @readonly
 * @enum {string}
 */
export const TraceLevel = Object.freeze({
  NONE: 'none',
  SUMMARY: 'summary',
  DETAILED: 'detailed',
  VERBOSE: 'verbose',
});

/**
 * @typedef {typeof TraceLevel[keyof typeof TraceLevel]} TraceLevelType
 */

// =============================================================================
// ISOLATION LEVELS
// =============================================================================

/**
 * Tool sandbox isolation levels
 * @readonly
 * @enum {string}
 */
export const IsolationLevel = Object.freeze({
  NONE: 'none',
  PROCESS: 'process',
  CONTAINER: 'container',
  VM: 'vm',
});

/**
 * @typedef {typeof IsolationLevel[keyof typeof IsolationLevel]} IsolationLevelType
 */
