/**
 * SWARM Framework - Experiment Runner
 * Executes experiments with multiple configurations
 * @module swarm/experiment/runner
 */

import { ModuleType, createModuleMetrics } from '../types/module.js';
import { globalRegistry } from '../registry/module-registry.js';
import { LogLevel } from '../types/trace.js';
import { createExperimentProgress } from '../types/experiment.js';
import { generateMatrix, calculateTotalRuns } from './matrix.js';
import { analyzeExperiment, aggregateRunMetrics } from './analysis.js';

// =============================================================================
// RUNNER CONFIG
// =============================================================================

/**
 * @typedef {Object} RunnerConfig
 * @property {string} implementation - 'standard' | 'parallel'
 * @property {number} [maxConcurrentConfigs=1] - Max concurrent configurations
 * @property {boolean} [captureTraces=true] - Whether to capture traces
 * @property {boolean} [stopOnError=false] - Stop experiment on first error
 */

/**
 * @typedef {Object} RunnerInput
 * @property {string} operation - 'execute' | 'validate' | 'dryRun'
 * @property {import('../types/experiment.js').Experiment} experiment
 * @property {ExecuteWorkflowFn} [executeWorkflow] - Function to execute a workflow
 */

/**
 * @callback ExecuteWorkflowFn
 * @param {import('../types/workflow.js').WorkflowConfig} config
 * @param {import('../types/task.js').TaskDefinition[]} tasks
 * @returns {Promise<WorkflowResult>}
 */

/**
 * @typedef {Object} WorkflowResult
 * @property {boolean} success
 * @property {Record<string, number>} metrics
 * @property {import('../types/trace.js').TraceEvent[]} [traces]
 * @property {import('../types/workflow.js').WorkflowError[]} [errors]
 */

/**
 * @typedef {Object} RunnerOutput
 * @property {boolean} success
 * @property {import('../types/experiment.js').ExperimentResult} [result]
 * @property {import('../types/experiment.js').ExperimentProgress} [progress]
 * @property {string[]} [validationErrors]
 */

// =============================================================================
// RUNNER STATE
// =============================================================================

/**
 * Experiment runner state
 */
class RunnerState {
  constructor() {
    /** @type {import('../types/experiment.js').ExperimentProgress} */
    this.progress = createExperimentProgress();
    /** @type {boolean} */
    this.running = false;
    /** @type {boolean} */
    this.cancelled = false;
  }

  reset() {
    this.progress = createExperimentProgress();
    this.running = false;
    this.cancelled = false;
  }

  cancel() {
    this.cancelled = true;
  }
}

// =============================================================================
// VALIDATION
// =============================================================================

/**
 * Validate experiment definition
 * @param {import('../types/experiment.js').Experiment} experiment
 * @returns {string[]} - Validation errors
 */
export function validateExperiment(experiment) {
  const errors = [];

  if (!experiment.id) {
    errors.push('Experiment ID is required');
  }

  if (!experiment.name) {
    errors.push('Experiment name is required');
  }

  if (!experiment.taskSet || experiment.taskSet.length === 0) {
    errors.push('Experiment must have at least one task in taskSet');
  }

  if (!experiment.dependentVariables || experiment.dependentVariables.length === 0) {
    errors.push('Experiment must have at least one dependent variable (metric)');
  }

  if (!experiment.parameters) {
    errors.push('Experiment parameters are required');
  } else {
    if (experiment.parameters.runsPerConfiguration < 1) {
      errors.push('runsPerConfiguration must be at least 1');
    }
    if (experiment.parameters.timeoutPerRun < 1) {
      errors.push('timeoutPerRun must be at least 1 second');
    }
  }

  // Validate independent variables
  if (experiment.independentVariables) {
    for (const variable of experiment.independentVariables) {
      if (!variable.path) {
        errors.push('Independent variable must have a path');
      }
      if (!variable.values || variable.values.length === 0) {
        errors.push(`Independent variable "${variable.path}" must have at least one value`);
      }
    }
  }

  return errors;
}

// =============================================================================
// DRY RUN
// =============================================================================

/**
 * Perform dry run to preview experiment execution
 * @param {import('../types/experiment.js').Experiment} experiment
 * @returns {{totalConfigurations: number, totalRuns: number, estimatedDuration: number, matrix: import('./matrix.js').ConfigurationMatrix}}
 */
export function dryRun(experiment) {
  const matrix = generateMatrix(experiment);
  const totalRuns = calculateTotalRuns(matrix, experiment.parameters.runsPerConfiguration);
  const estimatedDuration = totalRuns * experiment.parameters.timeoutPerRun;

  return {
    totalConfigurations: matrix.totalConfigurations,
    totalRuns,
    estimatedDuration,
    matrix,
  };
}

// =============================================================================
// EXECUTION
// =============================================================================

/**
 * Default mock workflow executor (for testing)
 * @type {ExecuteWorkflowFn}
 */
export const mockExecuteWorkflow = async (config, tasks) => {
  // Simulate some execution time
  await new Promise((resolve) => setTimeout(resolve, 10));

  return {
    success: true,
    metrics: {
      task_completion_rate: 80 + Math.random() * 20,
      total_cost: 0.01 + Math.random() * 0.05,
      quality_score: 0.7 + Math.random() * 0.3,
      task_completion_time: 10 + Math.random() * 50,
    },
    traces: [],
    errors: [],
  };
};

/**
 * Execute a single run
 * @param {import('../types/workflow.js').WorkflowConfig} config
 * @param {import('../types/task.js').TaskDefinition[]} tasks
 * @param {ExecuteWorkflowFn} executeWorkflow
 * @param {number} runIndex
 * @returns {Promise<import('../types/experiment.js').RunResult>}
 */
async function executeRun(config, tasks, executeWorkflow, runIndex) {
  const runId = `run-${Date.now()}-${runIndex}`;
  const startedAt = Date.now();

  try {
    const result = await executeWorkflow(config, tasks);

    return {
      runId,
      startedAt,
      completedAt: Date.now(),
      success: result.success,
      metrics: result.metrics,
      traces: result.traces || [],
      errors: result.errors || [],
    };
  } catch (error) {
    return {
      runId,
      startedAt,
      completedAt: Date.now(),
      success: false,
      metrics: {},
      traces: [],
      errors: [
        {
          code: 'EXECUTION_ERROR',
          message: error.message,
          timestamp: Date.now(),
          recoverable: false,
        },
      ],
    };
  }
}

/**
 * Execute all runs for a configuration
 * @param {import('./matrix.js').MatrixConfiguration} matrixConfig
 * @param {import('../types/task.js').TaskDefinition[]} tasks
 * @param {import('../types/experiment.js').ExperimentParameters} params
 * @param {ExecuteWorkflowFn} executeWorkflow
 * @param {RunnerState} state
 * @param {function} onProgress
 * @returns {Promise<import('../types/experiment.js').ConfigurationResult>}
 */
async function executeConfiguration(matrixConfig, tasks, params, executeWorkflow, state, onProgress) {
  const runs = [];
  const totalRuns = params.runsPerConfiguration + params.warmupRuns;

  for (let i = 0; i < totalRuns; i++) {
    if (state.cancelled) {
      break;
    }

    const run = await executeRun(matrixConfig.config, tasks, executeWorkflow, i);

    // Discard warmup runs
    if (i >= params.warmupRuns) {
      runs.push(run);
    }

    state.progress.completedRuns++;
    onProgress(state.progress);
  }

  return {
    configId: matrixConfig.id,
    config: matrixConfig.config,
    runs,
    aggregated: aggregateRunMetrics(runs),
  };
}

// =============================================================================
// RUNNER MODULE
// =============================================================================

/**
 * Creates an experiment runner module
 * @returns {import('../types/module.js').Module<RunnerConfig, RunnerInput, RunnerOutput>}
 */
export function createExperimentRunner() {
  /** @type {RunnerConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  const state = new RunnerState();

  /** @type {(progress: import('../types/experiment.js').ExperimentProgress) => void} */
  let progressCallback = () => {};

  return {
    id: 'experiment-runner',
    version: '1.0.0',
    type: ModuleType.METRICS_COLLECTOR, // Experiments are part of measurement

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('ExperimentRunner not configured');
      }

      const startTime = Date.now();

      try {
        switch (input.operation) {
          case 'validate': {
            const errors = validateExperiment(input.experiment);
            return {
              success: errors.length === 0,
              validationErrors: errors,
            };
          }

          case 'dryRun': {
            const preview = dryRun(input.experiment);
            return {
              success: true,
              progress: {
                totalConfigurations: preview.totalConfigurations,
                completedConfigurations: 0,
                currentConfiguration: '',
                totalRuns: preview.totalRuns,
                completedRuns: 0,
                estimatedTimeRemaining: preview.estimatedDuration,
              },
            };
          }

          case 'execute': {
            const errors = validateExperiment(input.experiment);
            if (errors.length > 0) {
              return { success: false, validationErrors: errors };
            }

            state.reset();
            state.running = true;

            const executeWorkflow = input.executeWorkflow || mockExecuteWorkflow;
            const matrix = generateMatrix(input.experiment);
            const params = input.experiment.parameters;

            // Initialize progress
            state.progress.totalConfigurations = matrix.totalConfigurations;
            state.progress.totalRuns = calculateTotalRuns(
              matrix,
              params.runsPerConfiguration + params.warmupRuns
            );

            context.emit({
              timestamp: Date.now(),
              runId: input.experiment.id,
              eventType: 'experiment.started',
              moduleId: 'experiment-runner',
              payload: {
                experimentId: input.experiment.id,
                totalConfigurations: matrix.totalConfigurations,
              },
              level: LogLevel.INFO,
            });

            // Execute all configurations
            const configurationResults = [];

            for (const matrixConfig of matrix.configurations) {
              if (state.cancelled) {
                break;
              }

              state.progress.currentConfiguration = matrixConfig.id;
              progressCallback(state.progress);

              context.emit({
                timestamp: Date.now(),
                runId: input.experiment.id,
                eventType: 'experiment.config.started',
                moduleId: 'experiment-runner',
                payload: { configId: matrixConfig.id },
                level: LogLevel.DEBUG,
              });

              const result = await executeConfiguration(
                matrixConfig,
                input.experiment.taskSet,
                params,
                executeWorkflow,
                state,
                progressCallback
              );

              configurationResults.push(result);
              state.progress.completedConfigurations++;

              if (config.stopOnError && result.runs.some((r) => !r.success)) {
                break;
              }

              context.emit({
                timestamp: Date.now(),
                runId: input.experiment.id,
                eventType: 'experiment.config.completed',
                moduleId: 'experiment-runner',
                payload: { configId: matrixConfig.id },
                level: LogLevel.DEBUG,
              });
            }

            // Build result
            const experimentResult = {
              experimentId: input.experiment.id,
              startedAt: startTime,
              completedAt: Date.now(),
              configurations: configurationResults,
              analysis: { summary: {}, comparisons: [], recommendations: [] },
            };

            // Run analysis
            experimentResult.analysis = analyzeExperiment(experimentResult);

            state.running = false;

            context.emit({
              timestamp: Date.now(),
              runId: input.experiment.id,
              eventType: 'experiment.completed',
              moduleId: 'experiment-runner',
              payload: {
                experimentId: input.experiment.id,
                duration: Date.now() - startTime,
              },
              level: LogLevel.INFO,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;

            return {
              success: !state.cancelled,
              result: experimentResult,
              progress: state.progress,
            };
          }

          default:
            return { success: false };
        }
      } catch (error) {
        metrics.errorCount++;
        state.running = false;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      metrics = createModuleMetrics();
      state.reset();
    },

    // Additional methods for runner control
    /** @param {(progress: import('../types/experiment.js').ExperimentProgress) => void} callback */
    onProgress(callback) {
      progressCallback = callback;
    },

    cancel() {
      state.cancel();
    },

    isRunning() {
      return state.running;
    },
  };
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register experiment runner
 */
export function registerExperimentRunner() {
  if (!globalRegistry.has(ModuleType.METRICS_COLLECTOR, 'experiment-runner')) {
    globalRegistry.register(ModuleType.METRICS_COLLECTOR, 'experiment-runner', createExperimentRunner);
  }
}
