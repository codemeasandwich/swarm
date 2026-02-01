/**
 * SWARM Framework - Experiment Module
 * Systematic comparison of workflow configurations
 * @module swarm/experiment
 */

// Import for internal use
import { registerExperimentRunner as _registerExperimentRunner } from './runner.js';
import { registerBuiltinCorpora as _registerBuiltinCorpora } from './tasks/index.js';

// =============================================================================
// MATRIX GENERATION
// =============================================================================

export {
  // Path utilities
  getByPath,
  setByPath,
  deepClone,
  // Cartesian product
  cartesianProduct,
  // Matrix generation
  generateMatrix,
  generateMatrixWithControl,
  filterMatrix,
  getConfiguration,
  calculateTotalRuns,
  // Variable analysis
  getVariableValues,
  groupByVariable,
} from './matrix.js';

// =============================================================================
// STATISTICAL ANALYSIS
// =============================================================================

export {
  // Descriptive stats
  mean,
  variance,
  stdDev,
  median,
  min,
  max,
  standardError,
  descriptiveStats,
  // Effect size
  cohensD,
  interpretCohensD,
  // T-test
  tStatistic,
  welchDF,
  tToPValue,
  tTest,
  // ANOVA
  fStatistic,
  fToPValue,
  oneWayAnova,
  etaSquared,
  // Pairwise comparisons
  pairwiseComparisons,
  // Experiment analysis
  analyzeExperiment,
  aggregateRunMetrics,
} from './analysis.js';

// =============================================================================
// EXPERIMENT RUNNER
// =============================================================================

export {
  // Validation
  validateExperiment,
  // Dry run
  dryRun,
  // Mock executor
  mockExecuteWorkflow,
  // Runner module
  createExperimentRunner,
  registerExperimentRunner,
} from './runner.js';

// =============================================================================
// TASK CORPUS
// =============================================================================

export {
  // Store
  corpusStore,
  // Creation
  createCorpus,
  registerCorpus,
  getCorpus,
  getAllCorpora,
  // Utilities
  mergeCorpora,
  filterBySkills,
  filterByDomain,
  sampleTasks,
  splitCorpus,
  // Built-in corpora
  createCodeGenCorpus,
  createCodeReviewCorpus,
  registerBuiltinCorpora,
} from './tasks/index.js';

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register all experiment modules
 */
export function registerExperimentModules() {
  _registerExperimentRunner();
  _registerBuiltinCorpora();
}

// Auto-register on import
registerExperimentModules();
