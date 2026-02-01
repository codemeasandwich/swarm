/**
 * SWARM Framework - Built-in Metric Definitions
 * Core metrics for workflow measurement
 * @module swarm/measurement/metrics/definitions
 */

// =============================================================================
// AGGREGATION TYPES
// =============================================================================

/**
 * Aggregation methods for metrics
 * @readonly
 * @enum {string}
 */
export const AggregationType = Object.freeze({
  SUM: 'sum',
  MEAN: 'mean',
  MEDIAN: 'median',
  MAX: 'max',
  MIN: 'min',
  COUNT: 'count',
  DISTRIBUTION: 'distribution',
});

/**
 * @typedef {typeof AggregationType[keyof typeof AggregationType]} AggregationTypeValue
 */

// =============================================================================
// METRIC DEFINITION
// =============================================================================

/**
 * @typedef {Object} MetricDefinition
 * @property {string} name - Unique metric name
 * @property {string} unit - Unit of measurement (%, seconds, $/token, etc.)
 * @property {string} description - Human-readable description
 * @property {AggregationTypeValue} aggregation - How to aggregate values
 * @property {(dataPoints: MetricDataPoint[]) => number} compute - Compute metric from data
 */

/**
 * @typedef {Object} MetricDataPoint
 * @property {number} timestamp - When recorded
 * @property {string} taskId - Associated task
 * @property {string} [workerId] - Associated worker
 * @property {number} value - The value
 * @property {Record<string, unknown>} [metadata] - Additional context
 */

// =============================================================================
// AGGREGATION FUNCTIONS
// =============================================================================

/**
 * Sum all values
 * @param {number[]} values
 * @returns {number}
 */
export function sum(values) {
  return values.reduce((acc, v) => acc + v, 0);
}

/**
 * Calculate mean
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  if (values.length === 0) return 0;
  return sum(values) / values.length;
}

/**
 * Calculate median
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
  if (values.length === 0) return 0;
  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);
  return sorted.length % 2 !== 0 ? sorted[mid] : (sorted[mid - 1] + sorted[mid]) / 2;
}

/**
 * Find maximum
 * @param {number[]} values
 * @returns {number}
 */
export function max(values) {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Find minimum
 * @param {number[]} values
 * @returns {number}
 */
export function min(values) {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Calculate distribution (percentiles)
 * @param {number[]} values
 * @returns {{p10: number, p25: number, p50: number, p75: number, p90: number, p99: number}}
 */
export function distribution(values) {
  if (values.length === 0) {
    return { p10: 0, p25: 0, p50: 0, p75: 0, p90: 0, p99: 0 };
  }
  const sorted = [...values].sort((a, b) => a - b);
  const percentile = (p) => {
    const index = Math.ceil((p / 100) * sorted.length) - 1;
    return sorted[Math.max(0, index)];
  };
  return {
    p10: percentile(10),
    p25: percentile(25),
    p50: percentile(50),
    p75: percentile(75),
    p90: percentile(90),
    p99: percentile(99),
  };
}

// =============================================================================
// CORE METRICS
// =============================================================================

/**
 * Task completion rate metric
 * @type {MetricDefinition}
 */
export const TASK_COMPLETION_RATE = {
  name: 'task_completion_rate',
  unit: '%',
  description: 'Percentage of tasks completed successfully',
  aggregation: AggregationType.MEAN,
  compute: (dataPoints) => {
    if (dataPoints.length === 0) return 0;
    const completed = dataPoints.filter((d) => d.metadata?.status === 'completed').length;
    return (completed / dataPoints.length) * 100;
  },
};

/**
 * Task completion time metric
 * @type {MetricDefinition}
 */
export const TASK_COMPLETION_TIME = {
  name: 'task_completion_time',
  unit: 'seconds',
  description: 'Time from task assignment to completion',
  aggregation: AggregationType.MEAN,
  compute: (dataPoints) => {
    const times = dataPoints.filter((d) => d.value > 0).map((d) => d.value);
    return mean(times);
  },
};

/**
 * Coordination overhead metric
 * @type {MetricDefinition}
 */
export const COORDINATION_OVERHEAD = {
  name: 'coordination_overhead',
  unit: '%',
  description: 'Percentage of time spent in non-execution activities',
  aggregation: AggregationType.MEAN,
  compute: (dataPoints) => {
    if (dataPoints.length === 0) return 0;
    const values = dataPoints.map((d) => d.value);
    return mean(values);
  },
};

/**
 * Context efficiency metric
 * @type {MetricDefinition}
 */
export const CONTEXT_EFFICIENCY = {
  name: 'context_efficiency',
  unit: 'tasks/token',
  description: 'Number of tasks completed per context token used',
  aggregation: AggregationType.MEAN,
  compute: (dataPoints) => {
    if (dataPoints.length === 0) return 0;
    const totalTasks = dataPoints.filter((d) => d.metadata?.completed).length;
    const totalTokens = sum(dataPoints.map((d) => d.value));
    return totalTokens > 0 ? totalTasks / totalTokens : 0;
  },
};

/**
 * Tool utilization metric
 * @type {MetricDefinition}
 */
export const TOOL_UTILISATION = {
  name: 'tool_utilisation',
  unit: '%',
  description: 'Percentage of available tools actually used',
  aggregation: AggregationType.MEAN,
  compute: (dataPoints) => {
    if (dataPoints.length === 0) return 0;
    const values = dataPoints.map((d) => d.value);
    return mean(values);
  },
};

/**
 * Retry rate metric
 * @type {MetricDefinition}
 */
export const RETRY_RATE = {
  name: 'retry_rate',
  unit: '%',
  description: 'Percentage of tasks requiring retry',
  aggregation: AggregationType.MEAN,
  compute: (dataPoints) => {
    if (dataPoints.length === 0) return 0;
    const retried = dataPoints.filter((d) => d.metadata?.retried).length;
    return (retried / dataPoints.length) * 100;
  },
};

/**
 * Quality score metric
 * @type {MetricDefinition}
 */
export const QUALITY_SCORE = {
  name: 'quality_score',
  unit: '0-1',
  description: 'Weighted quality score from judge evaluations',
  aggregation: AggregationType.MEAN,
  compute: (dataPoints) => {
    if (dataPoints.length === 0) return 0;
    const scores = dataPoints.filter((d) => d.value >= 0 && d.value <= 1).map((d) => d.value);
    return mean(scores);
  },
};

/**
 * Total cost metric
 * @type {MetricDefinition}
 */
export const TOTAL_COST = {
  name: 'total_cost',
  unit: '$',
  description: 'Total cost based on token usage and pricing',
  aggregation: AggregationType.SUM,
  compute: (dataPoints) => {
    return sum(dataPoints.map((d) => d.value));
  },
};

/**
 * All built-in metrics
 * @type {MetricDefinition[]}
 */
export const BUILT_IN_METRICS = [
  TASK_COMPLETION_RATE,
  TASK_COMPLETION_TIME,
  COORDINATION_OVERHEAD,
  CONTEXT_EFFICIENCY,
  TOOL_UTILISATION,
  RETRY_RATE,
  QUALITY_SCORE,
  TOTAL_COST,
];

/**
 * Get metric definition by name
 * @param {string} name
 * @returns {MetricDefinition | undefined}
 */
export function getMetricDefinition(name) {
  return BUILT_IN_METRICS.find((m) => m.name === name);
}

/**
 * Create a custom metric definition
 * @param {string} name
 * @param {Omit<MetricDefinition, 'name'>} options
 * @returns {MetricDefinition}
 */
export function createMetricDefinition(name, options) {
  return {
    name,
    ...options,
  };
}

/**
 * Aggregate values using specified method
 * @param {number[]} values
 * @param {AggregationTypeValue} method
 * @returns {number | object}
 */
export function aggregate(values, method) {
  switch (method) {
    case AggregationType.SUM:
      return sum(values);
    case AggregationType.MEAN:
      return mean(values);
    case AggregationType.MEDIAN:
      return median(values);
    case AggregationType.MAX:
      return max(values);
    case AggregationType.MIN:
      return min(values);
    case AggregationType.COUNT:
      return values.length;
    case AggregationType.DISTRIBUTION:
      return distribution(values);
    default:
      return mean(values);
  }
}
