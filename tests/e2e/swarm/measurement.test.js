/**
 * SWARM Framework - Measurement Layer E2E Tests
 * Tests for Metrics, Tracer, Cost Tracker, Quality Assessor, and Reports
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm, mkdir, readFile, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import SWARM modules
import {
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
  BUILT_IN_METRICS,
  getMetricDefinition,
  createMetricDefinition,
  MetricsCollector,
  createStandardCollector,
  registerMetricsCollectors,
  // Tracer
  TraceStore,
  createJSONTracer,
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
  registerCostTrackers,
  // Quality
  QualityDimension,
  DEFAULT_DIMENSION_WEIGHTS,
  QualityStore,
  createStandardQualityAssessor,
  registerQualityAssessors,
  // Reports
  createJSONReportGenerator,
  createHTMLReportGenerator,
  // Types and helpers
  createExecutionContext,
  createBaselineConfig,
  globalRegistry,
  ModuleType,
  TraceEventType,
  LogLevel,
  // Layer registration
  registerMeasurementModules,
} from '../../../src/swarm/index.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a mock execution context
 * @returns {import('../../../src/swarm/types/workflow.js').ExecutionContext}
 */
function createTestContext() {
  const events = [];
  const config = createBaselineConfig();
  const context = createExecutionContext(config);

  context.emit = (event) => {
    events.push(event);
  };

  context._events = events;
  return context;
}

// Temp directory for file-based tests
const TEST_DIR = join(tmpdir(), 'swarm-measurement-test-' + Date.now());

// =============================================================================
// Metric Definitions Tests
// =============================================================================

describe('SWARM Metric Definitions', () => {
  describe('Aggregation Functions', () => {
    test('sum aggregates values', () => {
      assert.equal(sum([1, 2, 3, 4, 5]), 15);
      assert.equal(sum([]), 0);
    });

    test('mean calculates average', () => {
      assert.equal(mean([2, 4, 6]), 4);
      assert.equal(mean([]), 0);
    });

    test('median finds middle value', () => {
      assert.equal(median([1, 3, 5]), 3);
      assert.equal(median([1, 2, 3, 4]), 2.5);
      assert.equal(median([]), 0);
    });

    test('max finds maximum', () => {
      assert.equal(max([1, 5, 3]), 5);
      assert.equal(max([]), 0);
    });

    test('min finds minimum', () => {
      assert.equal(min([1, 5, 3]), 1);
      assert.equal(min([]), 0);
    });

    test('distribution calculates percentiles', () => {
      const values = [1, 2, 3, 4, 5, 6, 7, 8, 9, 10];
      const dist = distribution(values);
      assert.equal(dist.p50, 5);
      assert(dist.p90 >= 9);
    });

    test('distribution handles empty array', () => {
      const dist = distribution([]);
      assert.equal(dist.p50, 0);
    });

    test('aggregate uses correct method', () => {
      const values = [1, 2, 3, 4, 5];
      assert.equal(aggregate(values, AggregationType.SUM), 15);
      assert.equal(aggregate(values, AggregationType.MEAN), 3);
      assert.equal(aggregate(values, AggregationType.MEDIAN), 3);
      assert.equal(aggregate(values, AggregationType.MAX), 5);
      assert.equal(aggregate(values, AggregationType.MIN), 1);
      assert.equal(aggregate(values, AggregationType.COUNT), 5);
    });

    test('aggregate returns distribution object', () => {
      const result = aggregate([1, 2, 3], AggregationType.DISTRIBUTION);
      assert(typeof result === 'object');
      assert('p50' in result);
    });

    test('aggregate defaults to mean for unknown type', () => {
      assert.equal(aggregate([2, 4, 6], 'unknown'), 4);
    });
  });

  describe('Built-in Metrics', () => {
    test('BUILT_IN_METRICS contains all core metrics', () => {
      assert.equal(BUILT_IN_METRICS.length, 8);
      const names = BUILT_IN_METRICS.map((m) => m.name);
      assert(names.includes('task_completion_rate'));
      assert(names.includes('task_completion_time'));
      assert(names.includes('coordination_overhead'));
      assert(names.includes('context_efficiency'));
      assert(names.includes('tool_utilisation'));
      assert(names.includes('retry_rate'));
      assert(names.includes('quality_score'));
      assert(names.includes('total_cost'));
    });

    test('getMetricDefinition retrieves by name', () => {
      const metric = getMetricDefinition('task_completion_rate');
      assert(metric !== undefined);
      assert.equal(metric.name, 'task_completion_rate');
      assert.equal(metric.unit, '%');
    });

    test('getMetricDefinition returns undefined for unknown', () => {
      const metric = getMetricDefinition('unknown_metric');
      assert.equal(metric, undefined);
    });

    test('createMetricDefinition creates custom metric', () => {
      const metric = createMetricDefinition('custom_metric', {
        unit: 'ops/sec',
        description: 'Custom operations per second',
        aggregation: AggregationType.MEAN,
        compute: (points) => sum(points.map((p) => p.value)),
      });

      assert.equal(metric.name, 'custom_metric');
      assert.equal(metric.unit, 'ops/sec');
    });

    test('TASK_COMPLETION_RATE computes percentage', () => {
      const points = [
        { timestamp: 1, taskId: 't1', value: 0, metadata: { status: 'completed' } },
        { timestamp: 2, taskId: 't2', value: 0, metadata: { status: 'completed' } },
        { timestamp: 3, taskId: 't3', value: 0, metadata: { status: 'failed' } },
      ];
      const rate = TASK_COMPLETION_RATE.compute(points);
      assert(Math.abs(rate - 66.67) < 1);
    });

    test('TASK_COMPLETION_RATE handles empty', () => {
      assert.equal(TASK_COMPLETION_RATE.compute([]), 0);
    });

    test('TASK_COMPLETION_TIME computes mean duration', () => {
      const points = [
        { timestamp: 1, taskId: 't1', value: 100 },
        { timestamp: 2, taskId: 't2', value: 200 },
        { timestamp: 3, taskId: 't3', value: 300 },
      ];
      assert.equal(TASK_COMPLETION_TIME.compute(points), 200);
    });
  });
});

// =============================================================================
// MetricsCollector Tests
// =============================================================================

describe('SWARM MetricsCollector', () => {
  describe('MetricsCollector Class', () => {
    test('creates collector with run ID', () => {
      const collector = new MetricsCollector('run-123');
      assert.equal(collector.runId, 'run-123');
    });

    test('records data points', () => {
      const collector = new MetricsCollector('run-1');
      collector.record('task_completion_time', 100, { taskId: 't1' });
      collector.record('task_completion_time', 200, { taskId: 't2' });

      const points = collector.getRawData('task_completion_time');
      assert.equal(points.length, 2);
      assert.equal(points[0].value, 100);
    });

    test('computes metrics from recorded data', () => {
      const collector = new MetricsCollector('run-1');
      collector.record('task_completion_rate', 0, { taskId: 't1', metadata: { status: 'completed' } });
      collector.record('task_completion_rate', 0, { taskId: 't2', metadata: { status: 'completed' } });

      const computed = collector.compute();
      assert.equal(computed.task_completion_rate, 100);
    });

    test('generates snapshot', () => {
      const collector = new MetricsCollector('run-1');
      collector.record('total_cost', 0.05, { taskId: 't1' });

      const snapshot = collector.snapshot();
      assert.equal(snapshot.runId, 'run-1');
      assert(snapshot.timestamp > 0);
      assert(snapshot.metrics !== undefined);
      assert(snapshot.rawData !== undefined);
    });

    test('registers custom metrics', () => {
      const collector = new MetricsCollector('run-1');
      collector.registerMetric({
        name: 'custom',
        unit: 'ops',
        aggregation: AggregationType.SUM,
        compute: (points) => sum(points.map((p) => p.value)),
      });

      collector.record('custom', 10, { taskId: 't1' });
      const computed = collector.compute();
      assert.equal(computed.custom, 10);
    });

    test('clears data', () => {
      const collector = new MetricsCollector('run-1');
      collector.record('total_cost', 0.05, { taskId: 't1' });
      collector.clear();

      assert.equal(collector.getRawData('total_cost').length, 0);
    });

    test('includes distributions when enabled', () => {
      const collector = new MetricsCollector('run-1');
      collector.includeDistributions = true;
      collector.record('task_completion_time', 100, { taskId: 't1' });
      collector.record('task_completion_time', 200, { taskId: 't2' });

      const computed = collector.compute();
      assert(computed.task_completion_time_distribution !== undefined);
    });
  });

  describe('Standard Collector Module', () => {
    beforeEach(() => {
      globalRegistry.clear();
      registerMetricsCollectors();
    });

    test('registers standard collector', () => {
      assert(globalRegistry.has(ModuleType.METRICS_COLLECTOR, 'standard'));
    });

    test('records data points via module', async () => {
      const collector = createStandardCollector();
      await collector.configure({
        implementation: 'standard',
        includeDistributions: false,
      });

      const context = createTestContext();
      const result = await collector.execute(
        {
          runId: 'run-1',
          dataPoint: {
            timestamp: Date.now(),
            taskId: 't1',
            value: 100,
            metadata: { metricName: 'task_completion_time' },
          },
        },
        context
      );

      assert.equal(result.recorded, true);
      assert(result.snapshot !== undefined);
    });

    test('returns snapshot with current metrics', async () => {
      const collector = createStandardCollector();
      await collector.configure({ implementation: 'standard' });

      const context = createTestContext();
      await collector.execute(
        {
          runId: 'run-1',
          dataPoint: {
            timestamp: Date.now(),
            taskId: 't1',
            value: 0.1,
            metadata: { metricName: 'total_cost' },
          },
        },
        context
      );

      const snapshot = collector.getSnapshot('run-1');
      assert(snapshot !== undefined);
      assert(snapshot.rawData.total_cost.length > 0);
    });

    test('skips recording for disabled metrics', async () => {
      const collector = createStandardCollector();
      await collector.configure({
        implementation: 'standard',
        enabledMetrics: ['task_completion_time'], // Only this metric enabled
      });

      const context = createTestContext();
      const result = await collector.execute(
        {
          runId: 'run-1',
          dataPoint: {
            timestamp: Date.now(),
            taskId: 't1',
            value: 100,
            metadata: { metricName: 'total_cost' }, // Not in enabled list
          },
        },
        context
      );

      assert.equal(result.recorded, false);
    });

    test('emits events on record', async () => {
      const collector = createStandardCollector();
      await collector.configure({ implementation: 'standard' });

      const context = createTestContext();
      await collector.execute(
        {
          runId: 'run-1',
          dataPoint: {
            timestamp: Date.now(),
            taskId: 't1',
            value: 100,
            metadata: { metricName: 'task_completion_time' },
          },
        },
        context
      );

      assert(context._events.some((e) => e.eventType === 'metrics.recorded'));
    });

    test('throws when not configured', async () => {
      const collector = createStandardCollector();

      await assert.rejects(
        () =>
          collector.execute(
            { runId: 'run-1', dataPoint: { timestamp: 1, taskId: 't1', value: 1 } },
            createTestContext()
          ),
        /not configured/
      );
    });

    test('tracks metrics correctly', async () => {
      const collector = createStandardCollector();
      await collector.configure({ implementation: 'standard' });

      const context = createTestContext();
      await collector.execute(
        {
          runId: 'run-1',
          dataPoint: { timestamp: 1, taskId: 't1', value: 100, metadata: { metricName: 'test' } },
        },
        context
      );

      const metrics = collector.getMetrics();
      assert.equal(metrics.executionCount, 1);
    });

    test('resets collector state', async () => {
      const collector = createStandardCollector();
      await collector.configure({ implementation: 'standard' });

      const context = createTestContext();
      await collector.execute(
        {
          runId: 'run-1',
          dataPoint: { timestamp: 1, taskId: 't1', value: 100, metadata: { metricName: 'test' } },
        },
        context
      );

      await collector.reset();
      assert.equal(collector.getSnapshot('run-1'), null);
    });

    test('clears specific run', async () => {
      const collector = createStandardCollector();
      await collector.configure({ implementation: 'standard' });

      const context = createTestContext();
      await collector.execute(
        {
          runId: 'run-1',
          dataPoint: { timestamp: 1, taskId: 't1', value: 100, metadata: { metricName: 'test' } },
        },
        context
      );

      collector.clearRun('run-1');
      assert.equal(collector.getSnapshot('run-1'), null);
    });
  });
});

// =============================================================================
// Tracer Tests
// =============================================================================

describe('SWARM Tracer', () => {
  beforeEach(async () => {
    globalRegistry.clear();
    registerTracers();
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('TraceStore Class', () => {
    test('records events', () => {
      const store = new TraceStore('run-1');
      store.recordEvent({
        timestamp: Date.now(),
        runId: 'run-1',
        eventType: TraceEventType.TASK_STARTED,
        payload: {},
        level: LogLevel.INFO,
      });

      assert.equal(store.getEvents().length, 1);
    });

    test('manages spans', () => {
      const store = new TraceStore('run-1');
      const span = store.startSpan('test-span', null, { key: 'value' });

      assert(span.id.startsWith('span-'));
      assert.equal(span.name, 'test-span');
      assert.equal(store.getSpans().length, 1);

      store.endSpan(span.id);
      const endedSpan = store.getSpans()[0];
      assert(endedSpan.endTime !== undefined);
    });

    test('tracks nested spans', () => {
      const store = new TraceStore('run-1');
      const parent = store.startSpan('parent');
      const child = store.startSpan('child', parent.id);

      assert.equal(child.parentId, parent.id);

      store.endSpan(child.id);
      store.endSpan(parent.id);

      assert.equal(store.getSpans().length, 2);
    });

    test('exports trace data', () => {
      const store = new TraceStore('run-1');
      store.recordEvent({
        timestamp: Date.now(),
        runId: 'run-1',
        eventType: TraceEventType.WORKFLOW_STARTED,
        payload: {},
        level: LogLevel.INFO,
      });

      const exported = store.export();
      assert.equal(exported.runId, 'run-1');
      assert(exported.startTime > 0);
      assert(exported.endTime >= exported.startTime);
      assert.equal(exported.events.length, 1);
    });

    test('clears data', () => {
      const store = new TraceStore('run-1');
      store.recordEvent({
        timestamp: Date.now(),
        runId: 'run-1',
        eventType: TraceEventType.TASK_STARTED,
        payload: {},
        level: LogLevel.INFO,
      });
      store.startSpan('test');

      store.clear();
      assert.equal(store.getEvents().length, 0);
      assert.equal(store.getSpans().length, 0);
    });

    test('adds events to active span', () => {
      const store = new TraceStore('run-1');
      const span = store.startSpan('test-span');

      store.recordEvent({
        timestamp: Date.now(),
        runId: 'run-1',
        eventType: TraceEventType.TASK_STARTED,
        payload: {},
        level: LogLevel.INFO,
      });

      assert.equal(span.events.length, 1);
    });
  });

  describe('JSON Tracer Module', () => {
    test('registers json tracer', () => {
      assert(globalRegistry.has(ModuleType.TRACER, 'json'));
    });

    test('records events', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        includePayloads: true,
        includeSpans: true,
      });

      const context = createTestContext();
      const result = await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_STARTED,
            taskId: 't1',
            payload: { data: 'test' },
            level: LogLevel.INFO,
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert.equal(tracer.getEvents('run-1').length, 1);
    });

    test('filters events by type', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        filterEvents: [TraceEventType.TASK_STARTED],
        includeSpans: true,
      });

      const context = createTestContext();

      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_STARTED,
            payload: {},
            level: LogLevel.INFO,
          },
        },
        context
      );

      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_COMPLETED,
            payload: {},
            level: LogLevel.INFO,
          },
        },
        context
      );

      assert.equal(tracer.getEvents('run-1').length, 1);
    });

    test('filters events by log level', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        minLevel: LogLevel.WARN,
        includeSpans: true,
      });

      const context = createTestContext();

      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_STARTED,
            payload: {},
            level: LogLevel.DEBUG,
          },
        },
        context
      );

      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_FAILED,
            payload: {},
            level: LogLevel.ERROR,
          },
        },
        context
      );

      assert.equal(tracer.getEvents('run-1').length, 1);
    });

    test('strips payloads when configured', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        includePayloads: false,
        includeSpans: true,
      });

      const context = createTestContext();
      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_STARTED,
            payload: { secret: 'data' },
            level: LogLevel.INFO,
          },
        },
        context
      );

      const events = tracer.getEvents('run-1');
      assert.deepEqual(events[0].payload, {});
    });

    test('manages spans via operations', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        includeSpans: true,
      });

      const context = createTestContext();

      const startResult = await tracer.execute(
        {
          operation: 'startSpan',
          runId: 'run-1',
          spanName: 'test-span',
          attributes: { key: 'value' },
        },
        context
      );

      assert.equal(startResult.success, true);
      assert(startResult.spanId !== undefined);

      const endResult = await tracer.execute(
        {
          operation: 'endSpan',
          runId: 'run-1',
          spanId: startResult.spanId,
        },
        context
      );

      assert.equal(endResult.success, true);
      assert.equal(tracer.getSpans('run-1').length, 1);
    });

    test('returns false for startSpan when spans disabled', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        includeSpans: false,
      });

      const context = createTestContext();
      const result = await tracer.execute(
        {
          operation: 'startSpan',
          runId: 'run-1',
          spanName: 'test',
        },
        context
      );

      assert.equal(result.success, false);
    });

    test('exports to JSON file', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        outputPath: TEST_DIR,
        includeSpans: true,
      });

      const context = createTestContext();
      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-export',
          event: {
            timestamp: Date.now(),
            runId: 'run-export',
            eventType: TraceEventType.WORKFLOW_STARTED,
            payload: {},
            level: LogLevel.INFO,
          },
        },
        context
      );

      const result = await tracer.execute(
        { operation: 'export', runId: 'run-export' },
        context
      );

      assert.equal(result.success, true);
      assert(result.filePath !== undefined);
      await access(result.filePath, constants.F_OK);

      const content = JSON.parse(await readFile(result.filePath, 'utf-8'));
      assert.equal(content.runId, 'run-export');
      assert.equal(content.events.length, 1);
    });

    test('exports without file when no outputPath', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        includeSpans: true,
      });

      const context = createTestContext();
      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_STARTED,
            payload: {},
            level: LogLevel.INFO,
          },
        },
        context
      );

      const result = await tracer.execute({ operation: 'export', runId: 'run-1' }, context);

      assert.equal(result.success, true);
      assert.equal(result.filePath, undefined);
      assert(result.events.length > 0);
    });

    test('clears trace data', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        includeSpans: true,
      });

      const context = createTestContext();
      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_STARTED,
            payload: {},
            level: LogLevel.INFO,
          },
        },
        context
      );

      await tracer.execute({ operation: 'clear', runId: 'run-1' }, context);

      assert.equal(tracer.getEvents('run-1').length, 0);
    });

    test('returns false for unknown operation', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({ implementation: 'json', includeSpans: true });

      const context = createTestContext();
      const result = await tracer.execute({ operation: 'unknown', runId: 'run-1' }, context);
      assert.equal(result.success, false);
    });

    test('returns false for record without event', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({ implementation: 'json', includeSpans: true });

      const context = createTestContext();
      const result = await tracer.execute({ operation: 'record', runId: 'run-1' }, context);
      assert.equal(result.success, false);
    });

    test('returns false for endSpan without spanId', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({ implementation: 'json', includeSpans: true });

      const context = createTestContext();
      const result = await tracer.execute({ operation: 'endSpan', runId: 'run-1' }, context);
      assert.equal(result.success, false);
    });

    test('throws when not configured', async () => {
      const tracer = createJSONTracer();

      await assert.rejects(
        () =>
          tracer.execute({ operation: 'record', runId: 'run-1', event: {} }, createTestContext()),
        /not configured/
      );
    });

    test('emits trace events', async () => {
      const tracer = createJSONTracer();
      await tracer.configure({
        implementation: 'json',
        includeSpans: true,
      });

      const context = createTestContext();
      await tracer.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: {
            timestamp: Date.now(),
            runId: 'run-1',
            eventType: TraceEventType.TASK_STARTED,
            payload: {},
            level: LogLevel.INFO,
          },
        },
        context
      );

      assert(context._events.some((e) => e.eventType === 'trace.recorded'));
    });
  });
});

// =============================================================================
// Cost Tracker Tests
// =============================================================================

describe('SWARM Cost Tracker', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerCostTrackers();
  });

  describe('Pricing Functions', () => {
    test('CLAUDE_PRICING contains model prices', () => {
      assert(CLAUDE_PRICING.sonnet !== undefined);
      assert(CLAUDE_PRICING.haiku !== undefined);
      assert(CLAUDE_PRICING.opus !== undefined);
    });

    test('calculateCost computes correctly', () => {
      const cost = calculateCost(1000, 500, { inputPer1M: 3, outputPer1M: 15 });
      assert(cost > 0);
      assert.equal(cost, (1000 / 1_000_000) * 3 + (500 / 1_000_000) * 15);
    });

    test('getModelPricing retrieves by name', () => {
      const pricing = getModelPricing('sonnet');
      assert.equal(pricing.inputPer1M, DEFAULT_PRICING.inputPer1M);
    });

    test('getModelPricing returns default for unknown', () => {
      const pricing = getModelPricing('unknown-model');
      assert.equal(pricing, DEFAULT_PRICING);
    });

    test('calculateModelCost uses correct pricing', () => {
      const cost = calculateModelCost('haiku', 1000, 500);
      const expected = calculateCost(1000, 500, CLAUDE_PRICING.haiku);
      assert.equal(cost, expected);
    });

    test('getCostBreakdown returns detailed info', () => {
      const breakdown = getCostBreakdown('sonnet', 10000, 5000);
      assert.equal(breakdown.inputTokens, 10000);
      assert.equal(breakdown.outputTokens, 5000);
      assert.equal(breakdown.model, 'sonnet');
      assert(breakdown.inputCost > 0);
      assert(breakdown.outputCost > 0);
      assert.equal(breakdown.totalCost, breakdown.inputCost + breakdown.outputCost);
    });

    test('formatCost formats correctly', () => {
      assert.equal(formatCost(0.0123), '$0.0123');
      assert.equal(formatCost(0.00001), '$0.0000');
    });

    test('estimateTokensFromChars estimates correctly', () => {
      assert.equal(estimateTokensFromChars(100), 25); // 100/4
      assert.equal(estimateTokensFromChars(0), 0);
    });
  });

  describe('CostStore Class', () => {
    test('records token usage', () => {
      const store = new CostStore('run-1', 10);
      const breakdown = store.record('sonnet', 1000, 500);

      assert(breakdown.totalCost > 0);
      assert.equal(store.totalInputTokens, 1000);
      assert.equal(store.totalOutputTokens, 500);
      assert(store.totalCost > 0);
    });

    test('tracks by model', () => {
      const store = new CostStore('run-1', 10);
      store.record('sonnet', 1000, 500);
      store.record('haiku', 2000, 1000);

      const status = store.getStatus();
      assert(status.byModel.sonnet !== undefined);
      assert(status.byModel.haiku !== undefined);
    });

    test('tracks by worker', () => {
      const store = new CostStore('run-1', 10);
      store.record('sonnet', 1000, 500, 'worker-1');
      store.record('sonnet', 500, 250, 'worker-2');

      const status = store.getStatus();
      assert(status.byWorker['worker-1'] !== undefined);
      assert(status.byWorker['worker-2'] !== undefined);
    });

    test('accumulates costs for same model', () => {
      const store = new CostStore('run-1', 10);
      store.record('sonnet', 1000, 500);
      store.record('sonnet', 1000, 500);

      const status = store.getStatus();
      assert.equal(status.byModel.sonnet.inputTokens, 2000);
      assert.equal(status.byModel.sonnet.outputTokens, 1000);
    });

    test('detects budget exceeded', () => {
      const store = new CostStore('run-1', 0.0001); // Very small budget
      store.record('sonnet', 100000, 50000); // Large usage

      assert(store.isBudgetExceeded());
    });

    test('detects warning threshold', () => {
      const store = new CostStore('run-1', 1);
      store.totalCost = 0.8;

      assert(store.isWarningThreshold(0.7));
      assert(!store.isWarningThreshold(0.9));
    });

    test('calculates budget remaining', () => {
      const store = new CostStore('run-1', 10);
      store.totalCost = 3;

      assert.equal(store.getBudgetRemaining(), 7);
    });

    test('returns Infinity for unlimited budget', () => {
      const store = new CostStore('run-1', 0);
      assert.equal(store.getBudgetRemaining(), Infinity);
    });

    test('adjusts budget', () => {
      const store = new CostStore('run-1', 5);
      store.totalCost = 6;
      store.budgetExceeded = true;

      store.adjustBudget(10);
      assert.equal(store.budgetLimit, 10);
      assert.equal(store.budgetExceeded, false);
    });

    test('clears data', () => {
      const store = new CostStore('run-1', 10);
      store.record('sonnet', 1000, 500, 'worker-1');
      store.warningTriggered = true;

      store.clear();
      assert.equal(store.totalCost, 0);
      assert.equal(store.warningTriggered, false);
    });
  });

  describe('Standard Cost Tracker Module', () => {
    test('registers standard tracker', () => {
      assert(globalRegistry.has(ModuleType.COST_TRACKER, 'standard'));
    });

    test('records cost', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({
        implementation: 'standard',
        trackByModel: true,
        trackByWorker: true,
      });

      const context = createTestContext();
      const result = await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 1000,
          outputTokens: 500,
          workerId: 'w1',
          taskId: 't1',
        },
        context
      );

      assert.equal(result.success, true);
      assert.equal(result.recorded, true);
      assert(result.breakdown !== undefined);
    });

    test('triggers warning at threshold', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({
        implementation: 'standard',
        budgetLimit: 0.0001,
        warningThreshold: 0.5,
      });

      const context = createTestContext();
      await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 100000,
          outputTokens: 50000,
        },
        context
      );

      assert(context._events.some((e) => e.eventType === TraceEventType.BUDGET_WARNING));
    });

    test('halts on budget exceeded', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({
        implementation: 'standard',
        budgetLimit: 0.00001,
        haltOnBudgetExceeded: true,
      });

      const context = createTestContext();

      // First call exceeds budget
      await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 1000000,
          outputTokens: 500000,
        },
        context
      );

      // Second call should be rejected
      const result = await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 1000,
          outputTokens: 500,
        },
        context
      );

      assert.equal(result.success, false);
      assert.equal(result.recorded, false);
      assert.equal(result.budgetExceeded, true);
    });

    test('gets status', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({
        implementation: 'standard',
        budgetLimit: 10,
      });

      const context = createTestContext();
      await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 1000,
          outputTokens: 500,
        },
        context
      );

      const result = await tracker.execute(
        { operation: 'getStatus', runId: 'run-1' },
        context
      );

      assert.equal(result.success, true);
      assert(result.status !== undefined);
      assert(result.status.totalCost > 0);
    });

    test('adjusts budget', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({
        implementation: 'standard',
        budgetLimit: 5,
      });

      const context = createTestContext();
      const result = await tracker.execute(
        { operation: 'adjustBudget', runId: 'run-1', newBudget: 20 },
        context
      );

      assert.equal(result.success, true);
      assert.equal(result.status.budgetLimit, 20);
    });

    test('resets run', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({ implementation: 'standard' });

      const context = createTestContext();
      await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 1000,
          outputTokens: 500,
        },
        context
      );

      await tracker.execute({ operation: 'reset', runId: 'run-1' }, context);

      assert.equal(tracker.getStatus('run-1'), null);
    });

    test('returns false for unknown operation', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({ implementation: 'standard' });

      const context = createTestContext();
      const result = await tracker.execute(
        { operation: 'unknown', runId: 'run-1' },
        context
      );

      assert.equal(result.success, false);
    });

    test('uses default model when not specified', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({ implementation: 'standard' });

      const context = createTestContext();
      const result = await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          inputTokens: 1000,
          outputTokens: 500,
        },
        context
      );

      assert.equal(result.success, true);
      assert.equal(result.breakdown.model, 'sonnet');
    });

    test('throws when not configured', async () => {
      const tracker = createStandardCostTracker();

      await assert.rejects(
        () =>
          tracker.execute(
            { operation: 'record', runId: 'run-1' },
            createTestContext()
          ),
        /not configured/
      );
    });

    test('emits cost.recorded events', async () => {
      const tracker = createStandardCostTracker();
      await tracker.configure({ implementation: 'standard' });

      const context = createTestContext();
      await tracker.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 1000,
          outputTokens: 500,
        },
        context
      );

      assert(context._events.some((e) => e.eventType === 'cost.recorded'));
    });
  });
});

// =============================================================================
// Quality Assessor Tests
// =============================================================================

describe('SWARM Quality Assessor', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerQualityAssessors();
  });

  describe('Quality Dimensions', () => {
    test('QualityDimension contains all dimensions', () => {
      assert.equal(QualityDimension.CORRECTNESS, 'correctness');
      assert.equal(QualityDimension.COMPLETENESS, 'completeness');
      assert.equal(QualityDimension.MAINTAINABILITY, 'maintainability');
      assert.equal(QualityDimension.PERFORMANCE, 'performance');
      assert.equal(QualityDimension.SECURITY, 'security');
      assert.equal(QualityDimension.STYLE, 'style');
    });

    test('DEFAULT_DIMENSION_WEIGHTS sum to 1', () => {
      const total = Object.values(DEFAULT_DIMENSION_WEIGHTS).reduce((a, b) => a + b, 0);
      assert.equal(total, 1);
    });
  });

  describe('QualityStore Class', () => {
    test('records judge results', () => {
      const store = new QualityStore('run-1');
      store.record({
        taskId: 't1',
        workerId: 'w1',
        passed: true,
        score: 0.85,
      });

      assert.equal(store.results.length, 1);
    });

    test('tracks by worker', () => {
      const store = new QualityStore('run-1');
      store.record({ taskId: 't1', workerId: 'w1', passed: true, score: 0.8 });
      store.record({ taskId: 't2', workerId: 'w1', passed: true, score: 0.9 });

      const stats = store.getWorkerStats();
      assert.equal(stats.w1.count, 2);
      assert(Math.abs(stats.w1.avgScore - 0.85) < 0.0001); // Use tolerance for floating point
    });

    test('tracks failure reasons', () => {
      const store = new QualityStore('run-1');
      store.record({
        taskId: 't1',
        workerId: 'w1',
        passed: false,
        score: 0.4,
        failures: ['Test failed', 'Lint error'],
      });
      store.record({
        taskId: 't2',
        workerId: 'w2',
        passed: false,
        score: 0.5,
        failures: ['Test failed'],
      });

      const failures = store.getCommonFailures();
      assert.equal(failures[0], 'Test failed');
    });

    test('computes weighted score', () => {
      const store = new QualityStore('run-1');
      const score = store.computeWeightedScore({
        correctness: 1.0,
        completeness: 0.8,
        maintainability: 0.7,
        performance: 0.9,
        security: 0.6,
        style: 1.0,
      });

      assert(score > 0 && score < 1);
    });

    test('computeWeightedScore handles empty', () => {
      const store = new QualityStore('run-1');
      const score = store.computeWeightedScore({});
      assert.equal(score, 0);
    });

    test('computes running score', () => {
      const store = new QualityStore('run-1');
      store.record({ taskId: 't1', workerId: 'w1', passed: true, score: 0.8 });
      store.record({ taskId: 't2', workerId: 'w1', passed: true, score: 0.6 });

      assert.equal(store.computeRunningScore(), 0.7);
    });

    test('computeRunningScore handles empty', () => {
      const store = new QualityStore('run-1');
      assert.equal(store.computeRunningScore(), 0);
    });

    test('gets dimension averages', () => {
      const store = new QualityStore('run-1');
      store.record({
        taskId: 't1',
        workerId: 'w1',
        passed: true,
        score: 0.8,
        dimensionScores: { correctness: 0.9, completeness: 0.7 },
      });
      store.record({
        taskId: 't2',
        workerId: 'w1',
        passed: true,
        score: 0.8,
        dimensionScores: { correctness: 0.7, completeness: 0.9 },
      });

      const avgs = store.getDimensionAverages();
      assert.equal(avgs.correctness, 0.8);
      assert.equal(avgs.completeness, 0.8);
    });

    test('generates report', () => {
      const store = new QualityStore('run-1', DEFAULT_DIMENSION_WEIGHTS, 0.7);
      store.record({ taskId: 't1', workerId: 'w1', passed: true, score: 0.8 });
      store.record({ taskId: 't2', workerId: 'w2', passed: false, score: 0.5 });

      const report = store.generateReport();
      assert.equal(report.runId, 'run-1');
      assert.equal(report.taskCount, 2);
      assert.equal(report.passedCount, 1);
      assert.equal(report.passRate, 50);
    });

    test('clears data', () => {
      const store = new QualityStore('run-1');
      store.record({ taskId: 't1', workerId: 'w1', passed: true, score: 0.8 });

      store.clear();
      assert.equal(store.results.length, 0);
    });
  });

  describe('Standard Quality Assessor Module', () => {
    test('registers standard assessor', () => {
      assert(globalRegistry.has(ModuleType.QUALITY_ASSESSOR, 'standard'));
    });

    test('records judge result', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({
        implementation: 'standard',
        passingThreshold: 0.7,
      });

      const context = createTestContext();
      const result = await assessor.execute(
        {
          operation: 'record',
          runId: 'run-1',
          judgeResult: {
            taskId: 't1',
            workerId: 'w1',
            passed: true,
            score: 0.85,
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert.equal(result.recorded, true);
      assert(result.runningScore > 0);
    });

    test('computes weighted score from dimensions', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({
        implementation: 'standard',
        dimensionWeights: DEFAULT_DIMENSION_WEIGHTS,
        passingThreshold: 0.7,
      });

      const context = createTestContext();
      const result = await assessor.execute(
        {
          operation: 'record',
          runId: 'run-1',
          judgeResult: {
            taskId: 't1',
            workerId: 'w1',
            passed: false, // Will be computed
            dimensionScores: {
              correctness: 0.9,
              completeness: 0.8,
              maintainability: 0.7,
              performance: 0.8,
              security: 0.9,
              style: 0.8,
            },
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.runningScore > 0);
    });

    test('gets report', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({
        implementation: 'standard',
        passingThreshold: 0.7,
      });

      const context = createTestContext();
      await assessor.execute(
        {
          operation: 'record',
          runId: 'run-1',
          judgeResult: { taskId: 't1', workerId: 'w1', passed: true, score: 0.8 },
        },
        context
      );

      const result = await assessor.execute(
        { operation: 'getReport', runId: 'run-1' },
        context
      );

      assert.equal(result.success, true);
      assert(result.report !== undefined);
      assert.equal(result.report.taskCount, 1);
    });

    test('compute operation generates report', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({
        implementation: 'standard',
        passingThreshold: 0.7,
      });

      const context = createTestContext();
      await assessor.execute(
        {
          operation: 'record',
          runId: 'run-1',
          judgeResult: { taskId: 't1', workerId: 'w1', passed: true, score: 0.8 },
        },
        context
      );

      const result = await assessor.execute(
        { operation: 'compute', runId: 'run-1' },
        context
      );

      assert.equal(result.success, true);
      assert(result.report !== undefined);
      assert(context._events.some((e) => e.eventType === 'quality.computed'));
    });

    test('resets run', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({
        implementation: 'standard',
        passingThreshold: 0.7,
      });

      const context = createTestContext();
      await assessor.execute(
        {
          operation: 'record',
          runId: 'run-1',
          judgeResult: { taskId: 't1', workerId: 'w1', passed: true, score: 0.8 },
        },
        context
      );

      await assessor.execute({ operation: 'reset', runId: 'run-1' }, context);

      assert.equal(assessor.getReport('run-1'), null);
    });

    test('returns false for unknown operation', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({ implementation: 'standard' });

      const context = createTestContext();
      const result = await assessor.execute(
        { operation: 'unknown', runId: 'run-1' },
        context
      );

      assert.equal(result.success, false);
    });

    test('returns false for record without judgeResult', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({ implementation: 'standard' });

      const context = createTestContext();
      const result = await assessor.execute(
        { operation: 'record', runId: 'run-1' },
        context
      );

      assert.equal(result.success, false);
    });

    test('throws when not configured', async () => {
      const assessor = createStandardQualityAssessor();

      await assert.rejects(
        () =>
          assessor.execute(
            { operation: 'record', runId: 'run-1', judgeResult: {} },
            createTestContext()
          ),
        /not configured/
      );
    });

    test('emits quality.recorded events', async () => {
      const assessor = createStandardQualityAssessor();
      await assessor.configure({ implementation: 'standard' });

      const context = createTestContext();
      await assessor.execute(
        {
          operation: 'record',
          runId: 'run-1',
          judgeResult: { taskId: 't1', workerId: 'w1', passed: true, score: 0.8 },
        },
        context
      );

      assert(context._events.some((e) => e.eventType === 'quality.recorded'));
    });
  });
});

// =============================================================================
// Report Generator Tests
// =============================================================================

describe('SWARM Report Generators', () => {
  beforeEach(async () => {
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('JSON Report Generator', () => {
    test('generates report from metrics', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
        includeRawData: true,
        prettyPrint: true,
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          metricsSnapshot: {
            runId: 'run-1',
            timestamp: Date.now(),
            metrics: { task_completion_rate: 85 },
            rawData: {},
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.report !== undefined);
      assert.equal(result.report.runId, 'run-1');
      assert(result.report.summary !== undefined);
    });

    test('includes cost data', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          costStatus: {
            totalCost: 0.15,
            totalInputTokens: 50000,
            totalOutputTokens: 25000,
            budgetLimit: 10,
            budgetRemaining: 9.85,
            budgetUsedPercent: 1.5,
            warningTriggered: false,
            budgetExceeded: false,
            byModel: {},
            byWorker: {},
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.report.costs !== undefined);
      assert.equal(result.report.costs.total, 0.15);
    });

    test('includes quality data', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          qualityReport: {
            runId: 'run-1',
            timestamp: Date.now(),
            overallScore: 0.85,
            passed: true,
            taskCount: 10,
            passedCount: 8,
            passRate: 80,
            dimensionAverages: {},
            byWorker: {},
            commonFailures: [],
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.report.quality !== undefined);
      assert.equal(result.report.quality.overallScore, 0.85);
    });

    test('includes trace data when configured', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
        includeTraces: true,
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          traceData: {
            events: [
              {
                timestamp: Date.now(),
                runId: 'run-1',
                eventType: TraceEventType.WORKFLOW_STARTED,
                payload: {},
                level: LogLevel.INFO,
              },
            ],
            spans: [],
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.report.traces !== undefined);
      assert.equal(result.report.traces.eventCount, 1);
    });

    test('includes custom data', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          customData: { environment: 'test', version: '1.0.0' },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.report.custom !== undefined);
      assert.equal(result.report.custom.environment, 'test');
    });

    test('exports to file', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
        outputPath: TEST_DIR,
        prettyPrint: true,
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'export',
          runId: 'run-export',
          metricsSnapshot: {
            runId: 'run-export',
            timestamp: Date.now(),
            metrics: { task_completion_rate: 90 },
            rawData: {},
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.filePath !== undefined);
      await access(result.filePath, constants.F_OK);
    });

    test('returns false for unknown operation', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({ implementation: 'json' });

      const context = createTestContext();
      const result = await generator.execute(
        { operation: 'unknown', runId: 'run-1' },
        context
      );

      assert.equal(result.success, false);
    });

    test('throws when not configured', async () => {
      const generator = createJSONReportGenerator();

      await assert.rejects(
        () =>
          generator.execute(
            { operation: 'generate', runId: 'run-1' },
            createTestContext()
          ),
        /not configured/
      );
    });

    test('computes summary from data', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
        includeTraces: true,
      });

      const startTime = Date.now();
      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          costStatus: {
            totalCost: 0.5,
            totalInputTokens: 100000,
            totalOutputTokens: 50000,
            budgetLimit: 10,
            budgetRemaining: 9.5,
            budgetUsedPercent: 5,
            warningTriggered: false,
            budgetExceeded: false,
            byModel: {},
            byWorker: {},
          },
          qualityReport: {
            runId: 'run-1',
            timestamp: Date.now(),
            overallScore: 0.9,
            passed: true,
            taskCount: 5,
            passedCount: 4,
            passRate: 80,
            dimensionAverages: {},
            byWorker: {},
            commonFailures: [],
          },
          traceData: {
            events: [
              {
                timestamp: startTime,
                runId: 'run-1',
                eventType: 'workflow.started',
                payload: {},
                level: LogLevel.INFO,
              },
              {
                timestamp: startTime + 5000,
                runId: 'run-1',
                eventType: 'workflow.completed',
                payload: {},
                level: LogLevel.INFO,
              },
            ],
            spans: [],
          },
        },
        context
      );

      assert.equal(result.report.summary.totalCost, 0.5);
      assert.equal(result.report.summary.qualityScore, 0.9);
      assert.equal(result.report.summary.duration, 5000);
      assert.equal(result.report.summary.taskCount, 5);
    });

    test('detects failed status from traces', async () => {
      const generator = createJSONReportGenerator();
      await generator.configure({
        implementation: 'json',
        includeTraces: true,
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          traceData: {
            events: [
              {
                timestamp: Date.now(),
                runId: 'run-1',
                eventType: 'workflow.started',
                payload: {},
                level: LogLevel.INFO,
              },
              {
                timestamp: Date.now() + 1000,
                runId: 'run-1',
                eventType: 'workflow.failed',
                payload: {},
                level: LogLevel.ERROR,
              },
            ],
            spans: [],
          },
        },
        context
      );

      assert.equal(result.report.summary.status, 'failed');
    });
  });

  describe('HTML Report Generator', () => {
    test('generates HTML report', async () => {
      const generator = createHTMLReportGenerator();
      await generator.configure({
        implementation: 'html',
        includeTraces: true,
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'generate',
          runId: 'run-1',
          metricsSnapshot: {
            runId: 'run-1',
            timestamp: Date.now(),
            metrics: { task_completion_rate: 85 },
            rawData: {},
          },
          costStatus: {
            totalCost: 0.1,
            totalInputTokens: 10000,
            totalOutputTokens: 5000,
            budgetLimit: 10,
            budgetRemaining: 9.9,
            budgetUsedPercent: 1,
            warningTriggered: false,
            budgetExceeded: false,
            byModel: { sonnet: { model: 'sonnet', inputTokens: 10000, outputTokens: 5000, inputCost: 0.03, outputCost: 0.075, totalCost: 0.105 } },
            byWorker: {},
          },
          qualityReport: {
            runId: 'run-1',
            timestamp: Date.now(),
            overallScore: 0.85,
            passed: true,
            taskCount: 10,
            passedCount: 8,
            passRate: 80,
            dimensionAverages: { correctness: 0.9, completeness: 0.8 },
            byWorker: {},
            commonFailures: ['Test failed'],
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.report !== undefined);
    });

    test('exports HTML to file', async () => {
      const generator = createHTMLReportGenerator();
      await generator.configure({
        implementation: 'html',
        outputPath: TEST_DIR,
        includeTraces: true,
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'export',
          runId: 'run-html',
          metricsSnapshot: {
            runId: 'run-html',
            timestamp: Date.now(),
            metrics: { task_completion_rate: 90 },
            rawData: {},
          },
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.filePath !== undefined);
      await access(result.filePath, constants.F_OK);

      const content = await readFile(result.filePath, 'utf-8');
      assert(content.includes('<!DOCTYPE html>'));
      assert(content.includes('SWARM Workflow Report'));
    });

    test('includes trace timeline', async () => {
      const generator = createHTMLReportGenerator();
      await generator.configure({
        implementation: 'html',
        outputPath: TEST_DIR,
        includeTraces: true,
      });

      const context = createTestContext();
      const result = await generator.execute(
        {
          operation: 'export',
          runId: 'run-timeline',
          traceData: {
            events: [
              {
                timestamp: Date.now(),
                runId: 'run-timeline',
                eventType: TraceEventType.TASK_STARTED,
                taskId: 't1',
                payload: {},
                level: LogLevel.INFO,
              },
              {
                timestamp: Date.now() + 100,
                runId: 'run-timeline',
                eventType: TraceEventType.TASK_COMPLETED,
                taskId: 't1',
                payload: {},
                level: LogLevel.INFO,
              },
            ],
            spans: [],
          },
        },
        context
      );

      assert.equal(result.success, true);

      const content = await readFile(result.filePath, 'utf-8');
      assert(content.includes('Execution Timeline'));
    });

    test('throws when not configured', async () => {
      const generator = createHTMLReportGenerator();

      await assert.rejects(
        () =>
          generator.execute(
            { operation: 'generate', runId: 'run-1' },
            createTestContext()
          ),
        /not configured/
      );
    });
  });
});

// =============================================================================
// Factory Function Tests
// =============================================================================

import { createMetricsCollectorModule } from '../../../src/swarm/measurement/metrics/collector.js';
import { createTracerModule } from '../../../src/swarm/measurement/tracer/json-tracer.js';
import { createCostTrackerModule } from '../../../src/swarm/measurement/cost/tracker.js';
import { createQualityAssessorModule } from '../../../src/swarm/measurement/quality/assessor.js';

describe('SWARM Measurement Module Factories', () => {
  describe('createMetricsCollectorModule', () => {
    test('creates custom collector', async () => {
      const custom = createMetricsCollectorModule(
        'custom-collector',
        'custom',
        async (input, config, context, collector) => {
          collector.record('custom', input.dataPoint.value, { taskId: input.dataPoint.taskId });
          return { recorded: true, snapshot: collector.snapshot() };
        }
      );

      await custom.configure({ implementation: 'custom' });
      const context = createTestContext();
      const result = await custom.execute(
        {
          runId: 'run-1',
          dataPoint: { timestamp: 1, taskId: 't1', value: 100 },
        },
        context
      );

      assert.equal(result.recorded, true);
      assert.equal(custom.getMetrics().executionCount, 1);

      await custom.reset();
      assert.equal(custom.getMetrics().executionCount, 0);
    });

    test('handles errors', async () => {
      const custom = createMetricsCollectorModule(
        'error-collector',
        'error',
        async () => {
          throw new Error('Test error');
        }
      );

      await custom.configure({ implementation: 'error' });
      const context = createTestContext();

      await assert.rejects(
        () =>
          custom.execute(
            { runId: 'run-1', dataPoint: { timestamp: 1, taskId: 't1', value: 1 } },
            context
          ),
        /Test error/
      );
      assert.equal(custom.getMetrics().errorCount, 1);
    });
  });

  describe('createTracerModule', () => {
    test('creates custom tracer', async () => {
      const custom = createTracerModule(
        'custom-tracer',
        'custom',
        async (input, config, context, store) => {
          if (input.operation === 'record') {
            store.recordEvent(input.event);
            return { success: true };
          }
          return { success: false };
        }
      );

      await custom.configure({ implementation: 'custom' });
      const context = createTestContext();
      const result = await custom.execute(
        {
          operation: 'record',
          runId: 'run-1',
          event: { timestamp: 1, runId: 'run-1', eventType: 'test', payload: {}, level: 'info' },
        },
        context
      );

      assert.equal(result.success, true);
      assert.equal(custom.getMetrics().executionCount, 1);

      await custom.reset();
      assert.equal(custom.getMetrics().executionCount, 0);
    });

    test('handles errors', async () => {
      const custom = createTracerModule(
        'error-tracer',
        'error',
        async () => {
          throw new Error('Tracer error');
        }
      );

      await custom.configure({ implementation: 'error' });
      const context = createTestContext();

      await assert.rejects(
        () => custom.execute({ operation: 'record', runId: 'run-1' }, context),
        /Tracer error/
      );
      assert.equal(custom.getMetrics().errorCount, 1);
    });
  });

  describe('createCostTrackerModule', () => {
    test('creates custom tracker', async () => {
      const custom = createCostTrackerModule(
        'custom-cost',
        'custom',
        async (input, config, context, store) => {
          if (input.operation === 'record') {
            store.record(input.model || 'sonnet', input.inputTokens || 0, input.outputTokens || 0);
            return { success: true, recorded: true };
          }
          return { success: false };
        }
      );

      await custom.configure({ implementation: 'custom', budgetLimit: 10 });
      const context = createTestContext();
      const result = await custom.execute(
        {
          operation: 'record',
          runId: 'run-1',
          model: 'sonnet',
          inputTokens: 1000,
          outputTokens: 500,
        },
        context
      );

      assert.equal(result.success, true);
      assert.equal(custom.getMetrics().executionCount, 1);

      await custom.reset();
      assert.equal(custom.getMetrics().executionCount, 0);
    });

    test('handles errors', async () => {
      const custom = createCostTrackerModule(
        'error-cost',
        'error',
        async () => {
          throw new Error('Cost error');
        }
      );

      await custom.configure({ implementation: 'error' });
      const context = createTestContext();

      await assert.rejects(
        () => custom.execute({ operation: 'record', runId: 'run-1' }, context),
        /Cost error/
      );
      assert.equal(custom.getMetrics().errorCount, 1);
    });
  });

  describe('createQualityAssessorModule', () => {
    test('creates custom assessor', async () => {
      const custom = createQualityAssessorModule(
        'custom-quality',
        'custom',
        async (input, config, context, store) => {
          if (input.operation === 'record' && input.judgeResult) {
            store.record(input.judgeResult);
            return { success: true, recorded: true };
          }
          return { success: false };
        }
      );

      await custom.configure({ implementation: 'custom' });
      const context = createTestContext();
      const result = await custom.execute(
        {
          operation: 'record',
          runId: 'run-1',
          judgeResult: { taskId: 't1', workerId: 'w1', passed: true, score: 0.8 },
        },
        context
      );

      assert.equal(result.success, true);
      assert.equal(custom.getMetrics().executionCount, 1);

      await custom.reset();
      assert.equal(custom.getMetrics().executionCount, 0);
    });

    test('handles errors', async () => {
      const custom = createQualityAssessorModule(
        'error-quality',
        'error',
        async () => {
          throw new Error('Quality error');
        }
      );

      await custom.configure({ implementation: 'error' });
      const context = createTestContext();

      await assert.rejects(
        () => custom.execute({ operation: 'record', runId: 'run-1' }, context),
        /Quality error/
      );
      assert.equal(custom.getMetrics().errorCount, 1);
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('SWARM Measurement Layer Integration', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerMeasurementModules();
  });

  test('all measurement modules are registered', () => {
    assert(globalRegistry.has(ModuleType.METRICS_COLLECTOR, 'standard'));
    assert(globalRegistry.has(ModuleType.TRACER, 'json'));
    assert(globalRegistry.has(ModuleType.COST_TRACKER, 'standard'));
    assert(globalRegistry.has(ModuleType.QUALITY_ASSESSOR, 'standard'));
  });

  test('full measurement workflow', async () => {
    const context = createTestContext();

    // 1. Create and configure all modules
    const metricsCollector = createStandardCollector();
    const tracer = createJSONTracer();
    const costTracker = createStandardCostTracker();
    const qualityAssessor = createStandardQualityAssessor();
    const reportGenerator = createJSONReportGenerator();

    await metricsCollector.configure({ implementation: 'standard' });
    await tracer.configure({ implementation: 'json', includeSpans: true });
    await costTracker.configure({
      implementation: 'standard',
      budgetLimit: 10,
    });
    await qualityAssessor.configure({
      implementation: 'standard',
      passingThreshold: 0.7,
    });
    await reportGenerator.configure({
      implementation: 'json',
      includeTraces: true,
    });

    const runId = 'integration-run-1';

    // 2. Record workflow start
    await tracer.execute(
      {
        operation: 'record',
        runId,
        event: {
          timestamp: Date.now(),
          runId,
          eventType: TraceEventType.WORKFLOW_STARTED,
          payload: {},
          level: LogLevel.INFO,
        },
      },
      context
    );

    // 3. Simulate task execution
    for (let i = 0; i < 3; i++) {
      // Record metrics
      await metricsCollector.execute(
        {
          runId,
          dataPoint: {
            timestamp: Date.now(),
            taskId: `t${i}`,
            value: i === 0 ? 0 : 1, // First task fails
            metadata: {
              metricName: 'task_completion_rate',
              status: i === 0 ? 'failed' : 'completed',
            },
          },
        },
        context
      );

      // Record cost
      await costTracker.execute(
        {
          operation: 'record',
          runId,
          model: 'sonnet',
          inputTokens: 1000 + i * 500,
          outputTokens: 500 + i * 250,
          taskId: `t${i}`,
          workerId: 'w1',
        },
        context
      );

      // Record quality
      await qualityAssessor.execute(
        {
          operation: 'record',
          runId,
          judgeResult: {
            taskId: `t${i}`,
            workerId: 'w1',
            passed: i !== 0,
            score: i === 0 ? 0.4 : 0.85,
          },
        },
        context
      );

      // Record trace
      await tracer.execute(
        {
          operation: 'record',
          runId,
          event: {
            timestamp: Date.now(),
            runId,
            eventType: i === 0 ? TraceEventType.TASK_FAILED : TraceEventType.TASK_COMPLETED,
            taskId: `t${i}`,
            payload: {},
            level: LogLevel.INFO,
          },
        },
        context
      );
    }

    // 4. Record workflow completion
    await tracer.execute(
      {
        operation: 'record',
        runId,
        event: {
          timestamp: Date.now(),
          runId,
          eventType: TraceEventType.WORKFLOW_COMPLETED,
          payload: {},
          level: LogLevel.INFO,
        },
      },
      context
    );

    // 5. Get all data
    const metricsSnapshot = metricsCollector.getSnapshot(runId);
    const traceExport = await tracer.execute({ operation: 'export', runId }, context);
    const costStatus = (
      await costTracker.execute({ operation: 'getStatus', runId }, context)
    ).status;
    const qualityReport = (
      await qualityAssessor.execute({ operation: 'getReport', runId }, context)
    ).report;

    // 6. Generate report
    const reportResult = await reportGenerator.execute(
      {
        operation: 'generate',
        runId,
        metricsSnapshot,
        traceData: {
          events: traceExport.events,
          spans: traceExport.spans,
        },
        costStatus,
        qualityReport,
      },
      context
    );

    // 7. Verify report
    assert.equal(reportResult.success, true);
    const report = reportResult.report;

    assert.equal(report.runId, runId);
    assert(report.metrics !== undefined);
    assert(report.costs !== undefined);
    assert(report.quality !== undefined);
    assert(report.traces !== undefined);
    assert.equal(report.quality.taskCount, 3);
    assert.equal(report.quality.passedCount, 2);
    assert(report.costs.total > 0);
  });
});
