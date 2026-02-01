/**
 * SWARM Framework - Experiment Types
 * Types for systematic configuration comparison
 * @module swarm/types/experiment
 */

// =============================================================================
// INDEPENDENT VARIABLE
// =============================================================================

/**
 * @typedef {Object} IndependentVariable
 * @property {string} path - Dot-notation path into WorkflowConfig
 * @property {unknown[]} values - Values to test
 * @property {string} [name] - Human-readable name
 */

// =============================================================================
// EXPERIMENT DEFINITION
// =============================================================================

/**
 * @typedef {Object} ExperimentParameters
 * @property {number} runsPerConfiguration - Number of runs per config
 * @property {number} randomSeed - Seed for reproducibility
 * @property {number} timeoutPerRun - Timeout per run in seconds
 * @property {number} warmupRuns - Warmup runs to discard
 */

/**
 * @typedef {Object} Experiment
 * @property {string} id - Unique experiment ID
 * @property {string} name - Human-readable name
 * @property {string} hypothesis - What we expect to find
 * @property {string} [description] - Detailed description
 * @property {IndependentVariable[]} independentVariables - Variables to vary
 * @property {string[]} dependentVariables - Metrics to measure
 * @property {import('./workflow.js').WorkflowConfig} controlConfig - Baseline config
 * @property {import('./task.js').TaskDefinition[]} taskSet - Tasks to run
 * @property {ExperimentParameters} parameters - Experiment parameters
 */

/**
 * Creates an Experiment with defaults
 * @param {Partial<Experiment>} [overrides={}]
 * @returns {Experiment}
 */
export function createExperiment(overrides = {}) {
  return {
    id: `exp-${Date.now()}`,
    name: 'Unnamed Experiment',
    hypothesis: '',
    independentVariables: [],
    dependentVariables: ['task_completion_rate', 'total_cost', 'quality_score'],
    taskSet: [],
    parameters: {
      runsPerConfiguration: 3,
      randomSeed: 42,
      timeoutPerRun: 600,
      warmupRuns: 1,
    },
    ...overrides,
  };
}

// =============================================================================
// DESCRIPTIVE STATISTICS
// =============================================================================

/**
 * @typedef {Object} DescriptiveStats
 * @property {number} mean - Arithmetic mean
 * @property {number} stdDev - Standard deviation
 * @property {number} median - Median value
 * @property {number} min - Minimum value
 * @property {number} max - Maximum value
 * @property {number} n - Sample size
 */

/**
 * Creates empty DescriptiveStats
 * @returns {DescriptiveStats}
 */
export function createDescriptiveStats() {
  return {
    mean: 0,
    stdDev: 0,
    median: 0,
    min: 0,
    max: 0,
    n: 0,
  };
}

// =============================================================================
// PAIRWISE COMPARISON
// =============================================================================

/**
 * @typedef {Object} PairwiseComparison
 * @property {string} configA - First configuration ID
 * @property {string} configB - Second configuration ID
 * @property {string} metric - Metric being compared
 * @property {number} difference - Difference (A - B)
 * @property {number} pValue - Statistical significance
 * @property {boolean} significant - Whether difference is significant
 * @property {number} effectSize - Cohen's d or similar
 */

// =============================================================================
// RUN RESULT
// =============================================================================

/**
 * @typedef {Object} RunResult
 * @property {string} runId - Unique run ID
 * @property {number} startedAt - Start timestamp
 * @property {number} completedAt - End timestamp
 * @property {boolean} success - Whether run succeeded
 * @property {Record<string, number>} metrics - Collected metrics
 * @property {import('./trace.js').TraceEvent[]} traces - Execution traces
 * @property {import('./workflow.js').WorkflowError[]} errors - Errors encountered
 */

// =============================================================================
// CONFIGURATION RESULT
// =============================================================================

/**
 * @typedef {Object} AggregatedMetrics
 * @property {Record<string, number>} mean - Mean values
 * @property {Record<string, number>} stdDev - Standard deviations
 * @property {Record<string, number>} median - Median values
 * @property {Record<string, number>} min - Minimum values
 * @property {Record<string, number>} max - Maximum values
 */

/**
 * @typedef {Object} ConfigurationResult
 * @property {string} configId - Configuration ID
 * @property {import('./workflow.js').WorkflowConfig} config - Configuration used
 * @property {RunResult[]} runs - Individual run results
 * @property {AggregatedMetrics} aggregated - Aggregated statistics
 */

// =============================================================================
// EXPERIMENT RESULT
// =============================================================================

/**
 * @typedef {Object} ExperimentAnalysis
 * @property {Record<string, DescriptiveStats>} summary - Summary stats by metric
 * @property {PairwiseComparison[]} comparisons - Pairwise comparisons
 * @property {string[]} recommendations - Actionable recommendations
 */

/**
 * @typedef {Object} ExperimentResult
 * @property {string} experimentId - Experiment ID
 * @property {number} startedAt - Start timestamp
 * @property {number} completedAt - End timestamp
 * @property {ConfigurationResult[]} configurations - Results per configuration
 * @property {ExperimentAnalysis} analysis - Statistical analysis
 */

// =============================================================================
// EXPERIMENT PROGRESS
// =============================================================================

/**
 * @typedef {Object} ExperimentProgress
 * @property {number} totalConfigurations - Total configurations to test
 * @property {number} completedConfigurations - Completed configurations
 * @property {string} currentConfiguration - Currently running config
 * @property {number} totalRuns - Total runs across all configs
 * @property {number} completedRuns - Completed runs
 * @property {number} estimatedTimeRemaining - Estimated seconds remaining
 */

/**
 * Creates an ExperimentProgress with defaults
 * @param {Partial<ExperimentProgress>} [overrides={}]
 * @returns {ExperimentProgress}
 */
export function createExperimentProgress(overrides = {}) {
  return {
    totalConfigurations: 0,
    completedConfigurations: 0,
    currentConfiguration: '',
    totalRuns: 0,
    completedRuns: 0,
    estimatedTimeRemaining: 0,
    ...overrides,
  };
}
