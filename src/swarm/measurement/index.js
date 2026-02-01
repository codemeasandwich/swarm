/**
 * SWARM Framework - Measurement Layer
 * Metrics collection, tracing, cost tracking, and quality assessment
 * @module swarm/measurement
 */

// =============================================================================
// RE-EXPORTS
// =============================================================================

// Metrics
export {
  // Aggregation
  AggregationType,
  sum,
  mean,
  median,
  max,
  min,
  distribution,
  aggregate,
  // Metric definitions
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
  // Collector
  MetricsCollector,
  createStandardCollector,
  createMetricsCollectorModule,
  registerMetricsCollectors,
} from './metrics/index.js';

// Tracer
export {
  TraceStore,
  createJSONTracer,
  createTracerModule,
  registerTracers,
} from './tracer/index.js';

// Cost
export {
  // Pricing
  CLAUDE_PRICING,
  DEFAULT_PRICING,
  calculateCost,
  getModelPricing,
  calculateModelCost,
  getCostBreakdown,
  formatCost,
  estimateTokensFromChars,
  // Cost Tracker
  CostStore,
  createStandardCostTracker,
  createCostTrackerModule,
  registerCostTrackers,
} from './cost/index.js';

// Quality
export {
  // Dimensions
  QualityDimension,
  DEFAULT_DIMENSION_WEIGHTS,
  // Quality Store and Assessor
  QualityStore,
  createStandardQualityAssessor,
  createQualityAssessorModule,
  registerQualityAssessors,
} from './quality/index.js';

// Reports
export {
  createJSONReportGenerator,
  registerJSONReportGenerator,
  createHTMLReportGenerator,
  registerHTMLReportGenerator,
} from './reports/index.js';

// =============================================================================
// LAYER REGISTRATION
// =============================================================================

import { registerMetricsCollectors } from './metrics/index.js';
import { registerTracers } from './tracer/index.js';
import { registerCostTrackers } from './cost/index.js';
import { registerQualityAssessors } from './quality/index.js';
import { registerJSONReportGenerator } from './reports/index.js';

/**
 * Register all measurement layer modules
 */
export function registerMeasurementModules() {
  registerMetricsCollectors();
  registerTracers();
  registerCostTrackers();
  registerQualityAssessors();
  registerJSONReportGenerator();
}

// Auto-register on import
registerMeasurementModules();
