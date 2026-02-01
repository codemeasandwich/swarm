/**
 * SWARM Framework - Metrics Module
 * Re-exports metrics collector and definitions
 * @module swarm/measurement/metrics
 */

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
} from './definitions.js';

export {
  MetricsCollector,
  createStandardCollector,
  createMetricsCollectorModule,
  registerMetricsCollectors,
} from './collector.js';
