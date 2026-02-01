/**
 * SWARM Framework - Systematic Workflow Agent Runtime Manager
 * Main entry point and public API
 * @module swarm
 */

// Types
export * from './types/index.js';

// Configuration
export {
  loadConfig,
  loadConfigFromString,
  applyConfigOverrides,
  getNestedValue,
  setNestedValue,
  validateConfig,
  createBaselineConfig,
  createGasTownConfig,
  createCostOptimizedConfig,
  getDefaultConfig,
  createDefaultWorkerProfile,
} from './config/index.js';

// State Management
export {
  serializeState,
  deserializeState,
  saveState,
  loadState,
  stateExists,
  getStateFilePath,
  WorkflowStateManager,
} from './state/index.js';

// Module Registry
export { ModuleRegistry, globalRegistry, createModule } from './registry/index.js';

// Orchestration Layer
export {
  // Planner
  createPlanner,
  createSingleShotPlanner,
  createIterativePlanner,
  registerPlanners,
  // Scheduler
  createScheduler,
  createFifoScheduler,
  createPriorityScheduler,
  registerSchedulers,
  // Router
  createRouter,
  createStaticRouter,
  createCapabilityRouter,
  registerRouters,
  // Judge
  createJudge,
  createDeterministicJudge,
  createLlmJudge,
  createHybridJudge,
  registerJudges,
  registerOrchestrationModules,
} from './orchestration/index.js';

// Execution Layer
export {
  // Worker
  ManagedWorkerInstance,
  WorkerPool,
  WorkerSpawner,
  createWorkerModule,
  createEpisodicWorker,
  createPersistentWorker,
  registerWorkers,
  // Context Builder
  estimateTokens,
  truncateToTokens,
  createContextBuilder,
  createMinimalContextBuilder,
  createScopedContextBuilder,
  createRichContextBuilder,
  registerContextBuilders,
  // Sandbox
  MINIMAL_TOOLS,
  STANDARD_TOOLS,
  EXTENDED_TOOLS,
  FULL_TOOLS,
  DEFAULT_BLOCKLIST,
  isBlocked,
  createSandbox,
  createMinimalSandbox,
  createStandardSandbox,
  createExtendedSandbox,
  registerSandboxes,
  // Memory Manager
  MemoryOperation,
  createMemoryManager,
  createEphemeralMemory,
  createFileBasedMemory,
  registerMemoryManagers,
} from './execution/index.js';

// Measurement Layer
export {
  // Metrics
  AggregationType,
  sum,
  mean,
  median,
  max,
  min,
  distribution,
  aggregate,
  TASK_COMPLETION_RATE,
  TASK_COMPLETION_TIME,
  COORDINATION_OVERHEAD,
  CONTEXT_EFFICIENCY,
  TOOL_UTILISATION,
  RETRY_RATE,
  QUALITY_SCORE,
  TOTAL_COST,
  BUILT_IN_METRICS,
  getMetricDefinition,
  createMetricDefinition,
  MetricsCollector,
  createStandardCollector,
  createMetricsCollectorModule,
  registerMetricsCollectors,
  // Tracer
  TraceStore,
  createJSONTracer,
  createTracerModule,
  registerTracers,
  // Cost
  CLAUDE_PRICING,
  DEFAULT_PRICING,
  calculateCost,
  getModelPricing,
  calculateModelCost,
  getCostBreakdown,
  formatCost,
  estimateTokensFromChars,
  CostStore,
  createStandardCostTracker,
  createCostTrackerModule,
  registerCostTrackers,
  // Quality
  QualityDimension,
  DEFAULT_DIMENSION_WEIGHTS,
  QualityStore,
  createStandardQualityAssessor,
  createQualityAssessorModule,
  registerQualityAssessors,
  // Reports
  createJSONReportGenerator,
  registerJSONReportGenerator,
  createHTMLReportGenerator,
  registerHTMLReportGenerator,
  // Layer registration
  registerMeasurementModules,
} from './measurement/index.js';

// Experiment Framework
export {
  // Matrix generation
  getByPath,
  setByPath,
  deepClone,
  cartesianProduct,
  generateMatrix,
  generateMatrixWithControl,
  filterMatrix,
  getConfiguration,
  calculateTotalRuns,
  getVariableValues,
  groupByVariable,
  // Statistical analysis
  variance,
  stdDev,
  standardError,
  descriptiveStats,
  cohensD,
  interpretCohensD,
  tStatistic,
  welchDF,
  tToPValue,
  tTest,
  fStatistic,
  fToPValue,
  oneWayAnova,
  etaSquared,
  pairwiseComparisons,
  analyzeExperiment,
  aggregateRunMetrics,
  // Experiment runner
  validateExperiment,
  dryRun,
  mockExecuteWorkflow,
  createExperimentRunner,
  registerExperimentRunner,
  // Task corpus
  corpusStore,
  createCorpus,
  registerCorpus,
  getCorpus,
  getAllCorpora,
  mergeCorpora,
  filterBySkills,
  filterByDomain,
  sampleTasks,
  splitCorpus,
  createCodeGenCorpus,
  createCodeReviewCorpus,
  registerBuiltinCorpora,
  // Layer registration
  registerExperimentModules,
} from './experiment/index.js';
