/**
 * @fileoverview Metrics API Endpoint
 *
 * Provides real-time metrics subscription and snapshots.
 *
 * @module server/api/metrics
 */

/**
 * Current metrics snapshot
 * Updated by the MetricsBridge (TODO: integrate)
 * @type {Object}
 */
let currentMetrics = {
  agents: 0,
  activeAgents: 0,
  tasks: 0,
  completedTasks: 0,
  pendingTasks: 0,
  cost: 0,
  tokenUsage: {
    input: 0,
    output: 0,
  },
  throughput: 0, // tasks per minute
  errorRate: 0,
  uptime: 0,
  lastUpdate: null,
};

/**
 * Metrics history for charts
 * @type {Array}
 */
const metricsHistory = [];
const MAX_HISTORY = 60; // Keep last 60 data points

/**
 * Metrics endpoint handler
 *
 * When called with a callback function (from api-ape subscription),
 * subscribes to metrics updates. Otherwise returns current snapshot.
 *
 * @param {Object|Function} data - Request data or subscription callback
 * @param {Object} embed - Embedded data from api-ape
 * @returns {Object} Current metrics or subscription confirmation
 */
module.exports = function metrics(data, _embed) {
  // If data is an action object
  if (data && typeof data === 'object' && data.action) {
    switch (data.action) {
      case 'snapshot':
        return getSnapshot();

      case 'history':
        return getHistory(data.limit);

      case 'reset':
        return resetMetrics();

      default:
        return { error: `Unknown action: ${data.action}` };
    }
  }

  // Default: return current snapshot
  return getSnapshot();
};

/**
 * Get current metrics snapshot
 *
 * @returns {Object} Current metrics
 */
function getSnapshot() {
  return {
    ...currentMetrics,
    timestamp: Date.now(),
  };
}

/**
 * Get metrics history
 *
 * @param {number} limit - Maximum number of entries
 * @returns {Object} Metrics history
 */
function getHistory(limit = MAX_HISTORY) {
  return {
    history: metricsHistory.slice(-limit),
    count: metricsHistory.length,
  };
}

/**
 * Reset metrics (for new execution)
 *
 * @returns {Object} Reset confirmation
 */
function resetMetrics() {
  currentMetrics = {
    agents: 0,
    activeAgents: 0,
    tasks: 0,
    completedTasks: 0,
    pendingTasks: 0,
    cost: 0,
    tokenUsage: {
      input: 0,
      output: 0,
    },
    throughput: 0,
    errorRate: 0,
    uptime: 0,
    lastUpdate: null,
  };

  metricsHistory.length = 0;

  return { reset: true };
}

/**
 * Update metrics (called by MetricsBridge)
 *
 * @param {Object} updates - Metric updates
 */
module.exports.updateMetrics = function updateMetrics(updates) {
  currentMetrics = {
    ...currentMetrics,
    ...updates,
    lastUpdate: Date.now(),
  };

  // Add to history
  metricsHistory.push({
    timestamp: Date.now(),
    ...currentMetrics,
  });

  // Trim history
  if (metricsHistory.length > MAX_HISTORY) {
    metricsHistory.shift();
  }
};

/**
 * Calculate derived metrics
 *
 * @returns {Object} Computed metrics
 */
module.exports.getComputedMetrics = function getComputedMetrics() {
  const history = metricsHistory.slice(-10);

  if (history.length < 2) {
    return {
      throughputTrend: 'stable',
      costRate: 0,
      avgTaskTime: 0,
    };
  }

  const first = history[0];
  const last = history[history.length - 1];
  const duration = (last.timestamp - first.timestamp) / 1000 / 60; // minutes

  const tasksCompleted = last.completedTasks - first.completedTasks;
  const throughput = duration > 0 ? tasksCompleted / duration : 0;

  const costDiff = last.cost - first.cost;
  const costRate = duration > 0 ? costDiff / duration : 0;

  return {
    throughputTrend: throughput > currentMetrics.throughput ? 'increasing' : 'decreasing',
    costRate: costRate.toFixed(4),
    avgTaskTime: tasksCompleted > 0 ? ((duration * 60) / tasksCompleted).toFixed(1) : 0,
  };
};
