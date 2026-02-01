/**
 * SWARM Framework - Configuration Validator
 * Validate workflow configurations against schema
 * @module swarm/config/validator
 */

import {
  PlannerImplementation,
  SchedulerImplementation,
  RouterImplementation,
  JudgeImplementation,
  ContextBuilderImplementation,
  ToolSandboxImplementation,
  MemoryManagerImplementation,
  SecurityGuardrailImplementation,
} from '../types/module.js';
import { TraceLevel, IsolationLevel, ModelProvider } from '../types/foundation.js';
import { WorkerSelectionStrategy, ExportFormat, QualityAggregation } from '../types/workflow.js';

/**
 * @typedef {import('../types/workflow.js').WorkflowConfig} WorkflowConfig
 */

/**
 * @typedef {Object} ValidationError
 * @property {string} path - Path to the invalid field
 * @property {string} message - Error message
 * @property {unknown} [value] - The invalid value
 */

/**
 * @typedef {Object} ValidationWarning
 * @property {string} path - Path to the field
 * @property {string} message - Warning message
 * @property {string} [suggestion] - Suggested fix
 */

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} valid - Whether configuration is valid
 * @property {ValidationError[]} errors - Validation errors
 * @property {ValidationWarning[]} warnings - Validation warnings
 */

/**
 * Create a validation result
 * @returns {ValidationResult}
 */
function createResult() {
  return {
    valid: true,
    errors: [],
    warnings: [],
  };
}

/**
 * Add an error to the result
 * @param {ValidationResult} result
 * @param {string} path
 * @param {string} message
 * @param {unknown} [value]
 */
function addError(result, path, message, value) {
  result.valid = false;
  result.errors.push({ path, message, value });
}

/**
 * Add a warning to the result
 * @param {ValidationResult} result
 * @param {string} path
 * @param {string} message
 * @param {string} [suggestion]
 */
function addWarning(result, path, message, suggestion) {
  result.warnings.push({ path, message, suggestion });
}

/**
 * Check if a value is one of allowed enum values
 * @param {unknown} value
 * @param {Record<string, string>} enumObj
 * @returns {boolean}
 */
function isValidEnum(value, enumObj) {
  return Object.values(enumObj).includes(/** @type {string} */ (value));
}

/**
 * Validate a ModelSpec
 * @param {ValidationResult} result
 * @param {unknown} model
 * @param {string} path
 */
function validateModelSpec(result, model, path) {
  if (!model || typeof model !== 'object') {
    addError(result, path, 'Model specification is required');
    return;
  }

  const m = /** @type {Record<string, unknown>} */ (model);

  if (!isValidEnum(m.provider, ModelProvider)) {
    addError(result, `${path}.provider`, `Invalid provider: ${m.provider}`, m.provider);
  }

  if (typeof m.name !== 'string' || m.name.length === 0) {
    addError(result, `${path}.name`, 'Model name is required');
  }

  if (typeof m.temperature !== 'number' || m.temperature < 0 || m.temperature > 2) {
    addError(result, `${path}.temperature`, 'Temperature must be between 0 and 2', m.temperature);
  }

  if (typeof m.maxOutputTokens !== 'number' || m.maxOutputTokens <= 0) {
    addError(result, `${path}.maxOutputTokens`, 'maxOutputTokens must be positive', m.maxOutputTokens);
  }

  if (typeof m.contextWindow !== 'number' || m.contextWindow <= 0) {
    addError(result, `${path}.contextWindow`, 'contextWindow must be positive', m.contextWindow);
  }
}

/**
 * Validate orchestration layer configuration
 * @param {ValidationResult} result
 * @param {unknown} orchestration
 */
function validateOrchestration(result, orchestration) {
  if (!orchestration || typeof orchestration !== 'object') {
    addError(result, 'orchestration', 'Orchestration configuration is required');
    return;
  }

  const o = /** @type {Record<string, unknown>} */ (orchestration);

  // Planner
  if (!o.planner || typeof o.planner !== 'object') {
    addError(result, 'orchestration.planner', 'Planner configuration is required');
  } else {
    const p = /** @type {Record<string, unknown>} */ (o.planner);
    if (!isValidEnum(p.implementation, PlannerImplementation)) {
      addError(result, 'orchestration.planner.implementation', `Invalid implementation: ${p.implementation}`, p.implementation);
    }
    if (p.model) {
      validateModelSpec(result, p.model, 'orchestration.planner.model');
    }
  }

  // Scheduler
  if (!o.scheduler || typeof o.scheduler !== 'object') {
    addError(result, 'orchestration.scheduler', 'Scheduler configuration is required');
  } else {
    const s = /** @type {Record<string, unknown>} */ (o.scheduler);
    if (!isValidEnum(s.implementation, SchedulerImplementation)) {
      addError(result, 'orchestration.scheduler.implementation', `Invalid implementation: ${s.implementation}`, s.implementation);
    }
  }

  // Router
  if (!o.router || typeof o.router !== 'object') {
    addError(result, 'orchestration.router', 'Router configuration is required');
  } else {
    const r = /** @type {Record<string, unknown>} */ (o.router);
    if (!isValidEnum(r.implementation, RouterImplementation)) {
      addError(result, 'orchestration.router.implementation', `Invalid implementation: ${r.implementation}`, r.implementation);
    }
  }

  // Judge
  if (!o.judge || typeof o.judge !== 'object') {
    addError(result, 'orchestration.judge', 'Judge configuration is required');
  } else {
    const j = /** @type {Record<string, unknown>} */ (o.judge);
    if (!isValidEnum(j.implementation, JudgeImplementation)) {
      addError(result, 'orchestration.judge.implementation', `Invalid implementation: ${j.implementation}`, j.implementation);
    }
    if (j.model) {
      validateModelSpec(result, j.model, 'orchestration.judge.model');
    }
  }
}

/**
 * Validate configuration layer
 * @param {ValidationResult} result
 * @param {unknown} configuration
 */
function validateConfiguration(result, configuration) {
  if (!configuration || typeof configuration !== 'object') {
    addError(result, 'configuration', 'Configuration layer is required');
    return;
  }

  const c = /** @type {Record<string, unknown>} */ (configuration);

  // Context Builder
  if (!c.contextBuilder || typeof c.contextBuilder !== 'object') {
    addError(result, 'configuration.contextBuilder', 'Context builder configuration is required');
  } else {
    const cb = /** @type {Record<string, unknown>} */ (c.contextBuilder);
    if (!isValidEnum(cb.implementation, ContextBuilderImplementation)) {
      addError(result, 'configuration.contextBuilder.implementation', `Invalid implementation: ${cb.implementation}`, cb.implementation);
    }
    if (typeof cb.maxTokens !== 'number' || cb.maxTokens <= 0) {
      addError(result, 'configuration.contextBuilder.maxTokens', 'maxTokens must be positive', cb.maxTokens);
    }
  }

  // Tool Sandbox
  if (!c.toolSandbox || typeof c.toolSandbox !== 'object') {
    addError(result, 'configuration.toolSandbox', 'Tool sandbox configuration is required');
  } else {
    const ts = /** @type {Record<string, unknown>} */ (c.toolSandbox);
    if (!isValidEnum(ts.implementation, ToolSandboxImplementation)) {
      addError(result, 'configuration.toolSandbox.implementation', `Invalid implementation: ${ts.implementation}`, ts.implementation);
    }
    if (ts.isolationLevel && !isValidEnum(ts.isolationLevel, IsolationLevel)) {
      addError(result, 'configuration.toolSandbox.isolationLevel', `Invalid isolation level: ${ts.isolationLevel}`, ts.isolationLevel);
    }
  }

  // Memory Manager
  if (!c.memoryManager || typeof c.memoryManager !== 'object') {
    addError(result, 'configuration.memoryManager', 'Memory manager configuration is required');
  } else {
    const mm = /** @type {Record<string, unknown>} */ (c.memoryManager);
    if (!isValidEnum(mm.implementation, MemoryManagerImplementation)) {
      addError(result, 'configuration.memoryManager.implementation', `Invalid implementation: ${mm.implementation}`, mm.implementation);
    }
  }

  // Security Guardrail
  if (!c.securityGuardrail || typeof c.securityGuardrail !== 'object') {
    addError(result, 'configuration.securityGuardrail', 'Security guardrail configuration is required');
  } else {
    const sg = /** @type {Record<string, unknown>} */ (c.securityGuardrail);
    if (!isValidEnum(sg.implementation, SecurityGuardrailImplementation)) {
      addError(result, 'configuration.securityGuardrail.implementation', `Invalid implementation: ${sg.implementation}`, sg.implementation);
    }
  }
}

/**
 * Validate execution layer
 * @param {ValidationResult} result
 * @param {unknown} execution
 */
function validateExecution(result, execution) {
  if (!execution || typeof execution !== 'object') {
    addError(result, 'execution', 'Execution configuration is required');
    return;
  }

  const e = /** @type {Record<string, unknown>} */ (execution);

  if (!Array.isArray(e.workerProfiles) || e.workerProfiles.length === 0) {
    addError(result, 'execution.workerProfiles', 'At least one worker profile is required');
  }

  if (typeof e.maxConcurrentWorkers !== 'number' || e.maxConcurrentWorkers <= 0) {
    addError(result, 'execution.maxConcurrentWorkers', 'maxConcurrentWorkers must be positive', e.maxConcurrentWorkers);
  }

  if (!isValidEnum(e.workerSelectionStrategy, WorkerSelectionStrategy)) {
    addError(result, 'execution.workerSelectionStrategy', `Invalid strategy: ${e.workerSelectionStrategy}`, e.workerSelectionStrategy);
  }

  // Warn about high concurrency
  if (typeof e.maxConcurrentWorkers === 'number' && e.maxConcurrentWorkers > 10) {
    addWarning(
      result,
      'execution.maxConcurrentWorkers',
      'High concurrency may increase coordination overhead',
      'Consider starting with 5-10 concurrent workers'
    );
  }
}

/**
 * Validate measurement layer
 * @param {ValidationResult} result
 * @param {unknown} measurement
 */
function validateMeasurement(result, measurement) {
  if (!measurement || typeof measurement !== 'object') {
    addError(result, 'measurement', 'Measurement configuration is required');
    return;
  }

  const m = /** @type {Record<string, unknown>} */ (measurement);

  // Metrics
  if (m.metrics && typeof m.metrics === 'object') {
    const metrics = /** @type {Record<string, unknown>} */ (m.metrics);
    if (metrics.exportFormat && !isValidEnum(metrics.exportFormat, ExportFormat)) {
      addError(result, 'measurement.metrics.exportFormat', `Invalid format: ${metrics.exportFormat}`, metrics.exportFormat);
    }
  }

  // Tracer
  if (m.tracer && typeof m.tracer === 'object') {
    const tracer = /** @type {Record<string, unknown>} */ (m.tracer);
    if (tracer.traceLevel && !isValidEnum(tracer.traceLevel, TraceLevel)) {
      addError(result, 'measurement.tracer.traceLevel', `Invalid level: ${tracer.traceLevel}`, tracer.traceLevel);
    }
    if (typeof tracer.sampleRate === 'number' && (tracer.sampleRate < 0 || tracer.sampleRate > 1)) {
      addError(result, 'measurement.tracer.sampleRate', 'sampleRate must be between 0 and 1', tracer.sampleRate);
    }
  }

  // Quality Assessor
  if (m.qualityAssessor && typeof m.qualityAssessor === 'object') {
    const qa = /** @type {Record<string, unknown>} */ (m.qualityAssessor);
    if (qa.aggregationMethod && !isValidEnum(qa.aggregationMethod, QualityAggregation)) {
      addError(result, 'measurement.qualityAssessor.aggregationMethod', `Invalid method: ${qa.aggregationMethod}`, qa.aggregationMethod);
    }
  }
}

/**
 * Validate constraints
 * @param {ValidationResult} result
 * @param {unknown} constraints
 */
function validateConstraints(result, constraints) {
  if (!constraints || typeof constraints !== 'object') {
    addError(result, 'constraints', 'Constraints configuration is required');
    return;
  }

  const c = /** @type {Record<string, unknown>} */ (constraints);

  if (typeof c.maxTotalTokens !== 'number' || c.maxTotalTokens <= 0) {
    addError(result, 'constraints.maxTotalTokens', 'maxTotalTokens must be positive', c.maxTotalTokens);
  }

  if (typeof c.maxTotalCost !== 'number' || c.maxTotalCost <= 0) {
    addError(result, 'constraints.maxTotalCost', 'maxTotalCost must be positive', c.maxTotalCost);
  }

  if (typeof c.maxTotalRuntime !== 'number' || c.maxTotalRuntime <= 0) {
    addError(result, 'constraints.maxTotalRuntime', 'maxTotalRuntime must be positive', c.maxTotalRuntime);
  }

  if (typeof c.qualityThreshold !== 'number' || c.qualityThreshold < 0 || c.qualityThreshold > 1) {
    addError(result, 'constraints.qualityThreshold', 'qualityThreshold must be between 0 and 1', c.qualityThreshold);
  }
}

/**
 * Validate a workflow configuration
 * @param {unknown} config - Configuration to validate
 * @returns {ValidationResult}
 */
export function validateConfig(config) {
  const result = createResult();

  if (!config || typeof config !== 'object') {
    addError(result, '', 'Configuration must be an object');
    return result;
  }

  const c = /** @type {Record<string, unknown>} */ (config);

  // Basic fields
  if (typeof c.id !== 'string' || c.id.length === 0) {
    addError(result, 'id', 'Configuration ID is required');
  }

  if (typeof c.name !== 'string' || c.name.length === 0) {
    addError(result, 'name', 'Configuration name is required');
  }

  if (typeof c.version !== 'string' || c.version.length === 0) {
    addError(result, 'version', 'Configuration version is required');
  }

  // Validate each layer
  validateOrchestration(result, c.orchestration);
  validateConfiguration(result, c.configuration);
  validateExecution(result, c.execution);
  validateMeasurement(result, c.measurement);
  validateConstraints(result, c.constraints);

  return result;
}
