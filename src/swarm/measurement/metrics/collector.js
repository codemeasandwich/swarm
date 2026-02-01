/**
 * SWARM Framework - Metrics Collector
 * Collects and aggregates workflow metrics
 * @module swarm/measurement/metrics/collector
 */

import { ModuleType, createModuleMetrics } from '../../types/module.js';
import { globalRegistry } from '../../registry/module-registry.js';
import {
  BUILT_IN_METRICS,
  getMetricDefinition,
  aggregate,
  AggregationType,
} from './definitions.js';

// =============================================================================
// METRICS COLLECTOR CONFIG
// =============================================================================

/**
 * @typedef {Object} MetricsCollectorConfig
 * @property {string} implementation - Which collector to use
 * @property {string[]} [enabledMetrics] - Which metrics to collect (default: all)
 * @property {number} [aggregationInterval] - How often to aggregate in ms
 * @property {boolean} [includeDistributions] - Include percentile distributions
 */

/**
 * @typedef {Object} MetricsCollectorInput
 * @property {string} runId - Workflow run ID
 * @property {import('./definitions.js').MetricDataPoint} dataPoint - Data point to record
 */

/**
 * @typedef {Object} MetricsSnapshot
 * @property {string} runId - Workflow run ID
 * @property {number} timestamp - Snapshot time
 * @property {Record<string, number | object>} metrics - Computed metrics
 * @property {Record<string, import('./definitions.js').MetricDataPoint[]>} rawData - Raw data points
 */

/**
 * @typedef {Object} MetricsCollectorOutput
 * @property {boolean} recorded - Whether the data point was recorded
 * @property {MetricsSnapshot} [snapshot] - Current metrics snapshot
 */

// =============================================================================
// METRICS COLLECTOR CLASS
// =============================================================================

/**
 * Collects and aggregates metrics during workflow execution
 */
export class MetricsCollector {
  /**
   * @param {string} [runId]
   */
  constructor(runId) {
    /** @type {string} */
    this.runId = runId || `run-${Date.now()}`;
    /** @type {Map<string, import('./definitions.js').MetricDataPoint[]>} */
    this.dataPoints = new Map();
    /** @type {import('./definitions.js').MetricDefinition[]} */
    this.metrics = [...BUILT_IN_METRICS];
    /** @type {boolean} */
    this.includeDistributions = false;
  }

  /**
   * Record a data point for a metric
   * @param {string} metricName
   * @param {number} value
   * @param {Partial<import('./definitions.js').MetricDataPoint>} [options]
   */
  record(metricName, value, options = {}) {
    const dataPoint = {
      timestamp: Date.now(),
      taskId: options.taskId || 'unknown',
      workerId: options.workerId,
      value,
      metadata: options.metadata,
    };

    if (!this.dataPoints.has(metricName)) {
      this.dataPoints.set(metricName, []);
    }
    this.dataPoints.get(metricName).push(dataPoint);
  }

  /**
   * Compute current metrics
   * @returns {Record<string, number | object>}
   */
  compute() {
    const results = {};

    for (const metric of this.metrics) {
      const points = this.dataPoints.get(metric.name) || [];
      results[metric.name] = metric.compute(points);

      if (this.includeDistributions && points.length > 0) {
        const values = points.map((p) => p.value);
        results[`${metric.name}_distribution`] = aggregate(values, AggregationType.DISTRIBUTION);
      }
    }

    return results;
  }

  /**
   * Get a snapshot of current metrics
   * @returns {MetricsSnapshot}
   */
  snapshot() {
    const rawData = {};
    for (const [name, points] of this.dataPoints) {
      rawData[name] = [...points];
    }

    return {
      runId: this.runId,
      timestamp: Date.now(),
      metrics: this.compute(),
      rawData,
    };
  }

  /**
   * Register a custom metric
   * @param {import('./definitions.js').MetricDefinition} definition
   */
  registerMetric(definition) {
    if (!this.metrics.find((m) => m.name === definition.name)) {
      this.metrics.push(definition);
    }
  }

  /**
   * Clear all collected data
   */
  clear() {
    this.dataPoints.clear();
  }

  /**
   * Get raw data points for a metric
   * @param {string} metricName
   * @returns {import('./definitions.js').MetricDataPoint[]}
   */
  getRawData(metricName) {
    return this.dataPoints.get(metricName) || [];
  }
}

// =============================================================================
// STANDARD COLLECTOR MODULE
// =============================================================================

/**
 * Creates a standard metrics collector module
 * @returns {import('../../types/module.js').Module<MetricsCollectorConfig, MetricsCollectorInput, MetricsCollectorOutput>}
 */
export function createStandardCollector() {
  /** @type {MetricsCollectorConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  /** @type {Map<string, MetricsCollector>} */
  const collectors = new Map();

  /**
   * Get or create collector for run
   * @param {string} runId
   * @returns {MetricsCollector}
   */
  function getCollector(runId) {
    if (!collectors.has(runId)) {
      const collector = new MetricsCollector(runId);
      if (config?.includeDistributions) {
        collector.includeDistributions = true;
      }
      collectors.set(runId, collector);
    }
    return collectors.get(runId);
  }

  return {
    id: 'metrics-collector-standard',
    version: '1.0.0',
    type: ModuleType.METRICS_COLLECTOR,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('MetricsCollector not configured');
      }

      const startTime = Date.now();

      const collector = getCollector(input.runId);
      const { dataPoint } = input;

      // Check if metric is enabled
      if (config.enabledMetrics && !config.enabledMetrics.includes(dataPoint.metadata?.metricName)) {
        // Metric not enabled, skip
        metrics.executionCount++;
        return { recorded: false };
      }

      // Record the data point
      const metricName = dataPoint.metadata?.metricName || 'unknown';
      collector.record(metricName, dataPoint.value, {
        taskId: dataPoint.taskId,
        workerId: dataPoint.workerId,
        metadata: dataPoint.metadata,
      });

      context.emit({
        timestamp: Date.now(),
        runId: input.runId,
        eventType: 'metrics.recorded',
        moduleId: 'metrics-collector-standard',
        payload: {
          metricName,
          value: dataPoint.value,
          taskId: dataPoint.taskId,
        },
        level: 'debug',
      });

      metrics.executionCount++;
      metrics.totalDuration += Date.now() - startTime;

      return {
        recorded: true,
        snapshot: collector.snapshot(),
      };
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      collectors.clear();
      metrics = createModuleMetrics();
    },

    // Additional methods exposed for direct access
    getCollector,
    getSnapshot(runId) {
      const collector = collectors.get(runId);
      return collector ? collector.snapshot() : null;
    },
    clearRun(runId) {
      collectors.delete(runId);
    },
  };
}

// =============================================================================
// MODULE FACTORY
// =============================================================================

/**
 * Create a metrics collector module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: MetricsCollectorInput, config: MetricsCollectorConfig, context: import('../../types/workflow.js').ExecutionContext, collector: MetricsCollector) => Promise<MetricsCollectorOutput>} collectFn
 * @returns {import('../../types/module.js').Module<MetricsCollectorConfig, MetricsCollectorInput, MetricsCollectorOutput>}
 */
export function createMetricsCollectorModule(id, implementation, collectFn) {
  /** @type {MetricsCollectorConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  const collector = new MetricsCollector();

  return {
    id,
    version: '1.0.0',
    type: ModuleType.METRICS_COLLECTOR,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('MetricsCollector not configured');
      }

      const startTime = Date.now();
      try {
        const result = await collectFn(input, config, context, collector);
        metrics.executionCount++;
        metrics.totalDuration += Date.now() - startTime;
        return result;
      } catch (error) {
        metrics.errorCount++;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      collector.clear();
      metrics = createModuleMetrics();
    },
  };
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register all metrics collector implementations
 */
export function registerMetricsCollectors() {
  if (!globalRegistry.has(ModuleType.METRICS_COLLECTOR, 'standard')) {
    globalRegistry.register(ModuleType.METRICS_COLLECTOR, 'standard', createStandardCollector);
  }
}

// Auto-register on import
registerMetricsCollectors();
