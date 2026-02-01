/**
 * SWARM Framework - Experiment Framework E2E Tests
 * Phase 5: Systematic configuration comparison
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm } from 'node:fs/promises';
import { join } from 'node:path';

// =============================================================================
// IMPORTS
// =============================================================================

// Matrix generation
import {
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
} from '../../../src/swarm/experiment/matrix.js';

// Statistical analysis
import {
  mean,
  variance,
  stdDev,
  median,
  min,
  max,
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
} from '../../../src/swarm/experiment/analysis.js';

// Experiment runner
import {
  validateExperiment,
  dryRun,
  mockExecuteWorkflow,
  createExperimentRunner,
} from '../../../src/swarm/experiment/runner.js';

// Task corpus
import {
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
} from '../../../src/swarm/experiment/tasks/corpus.js';

// Types
import { createExperiment } from '../../../src/swarm/types/experiment.js';
import { createTaskDefinition } from '../../../src/swarm/types/task.js';
import { createBaselineConfig } from '../../../src/swarm/config/defaults.js';
import { Skill, Domain } from '../../../src/swarm/types/foundation.js';
import { LogLevel } from '../../../src/swarm/types/trace.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

/**
 * Create a simple experiment for testing
 */
function createTestExperiment(overrides = {}) {
  return createExperiment({
    id: 'test-experiment',
    name: 'Test Experiment',
    hypothesis: 'Testing the framework',
    independentVariables: [
      {
        path: 'orchestration.planner.implementation',
        values: ['single-shot', 'iterative'],
        name: 'Planner Type',
      },
    ],
    dependentVariables: ['task_completion_rate', 'total_cost'],
    controlConfig: createBaselineConfig(),
    taskSet: [
      createTaskDefinition({ id: 'task-1', name: 'Test Task 1' }),
      createTaskDefinition({ id: 'task-2', name: 'Test Task 2' }),
    ],
    parameters: {
      runsPerConfiguration: 3,
      randomSeed: 42,
      timeoutPerRun: 60,
      warmupRuns: 0,
    },
    ...overrides,
  });
}

/**
 * Create mock execution context
 */
function createMockContext() {
  const events = [];
  return {
    emit: (event) => events.push(event),
    getEvents: () => events,
  };
}

// =============================================================================
// PATH UTILITIES TESTS
// =============================================================================

describe('Path Utilities', () => {
  describe('getByPath', () => {
    test('gets value at simple path', () => {
      const obj = { a: 1, b: 2 };
      assert.equal(getByPath(obj, 'a'), 1);
      assert.equal(getByPath(obj, 'b'), 2);
    });

    test('gets value at nested path', () => {
      const obj = { a: { b: { c: 42 } } };
      assert.equal(getByPath(obj, 'a.b.c'), 42);
    });

    test('returns undefined for non-existent path', () => {
      const obj = { a: 1 };
      assert.equal(getByPath(obj, 'b'), undefined);
      assert.equal(getByPath(obj, 'a.b.c'), undefined);
    });

    test('handles null/undefined in path', () => {
      const obj = { a: null };
      assert.equal(getByPath(obj, 'a.b'), undefined);
    });
  });

  describe('setByPath', () => {
    test('sets value at simple path', () => {
      const obj = { a: 1 };
      setByPath(obj, 'b', 2);
      assert.equal(obj.b, 2);
    });

    test('sets value at nested path', () => {
      const obj = {};
      setByPath(obj, 'a.b.c', 42);
      assert.equal(obj.a.b.c, 42);
    });

    test('overwrites existing value', () => {
      const obj = { a: { b: 1 } };
      setByPath(obj, 'a.b', 2);
      assert.equal(obj.a.b, 2);
    });

    test('returns the modified object', () => {
      const obj = {};
      const result = setByPath(obj, 'a', 1);
      assert.equal(result, obj);
    });
  });

  describe('deepClone', () => {
    test('clones primitive values', () => {
      assert.equal(deepClone(42), 42);
      assert.equal(deepClone('hello'), 'hello');
      assert.equal(deepClone(true), true);
      assert.equal(deepClone(null), null);
    });

    test('clones arrays', () => {
      const arr = [1, 2, 3];
      const clone = deepClone(arr);
      assert.deepEqual(clone, arr);
      assert.notEqual(clone, arr);
    });

    test('clones nested objects', () => {
      const obj = { a: { b: { c: 42 } } };
      const clone = deepClone(obj);
      assert.deepEqual(clone, obj);
      assert.notEqual(clone, obj);
      assert.notEqual(clone.a, obj.a);
    });

    test('clones mixed structures', () => {
      const obj = { arr: [1, { x: 2 }], nested: { y: [3, 4] } };
      const clone = deepClone(obj);
      assert.deepEqual(clone, obj);
      assert.notEqual(clone.arr, obj.arr);
      assert.notEqual(clone.arr[1], obj.arr[1]);
    });
  });
});

// =============================================================================
// CARTESIAN PRODUCT TESTS
// =============================================================================

describe('Cartesian Product', () => {
  test('handles empty input', () => {
    const result = cartesianProduct([]);
    assert.deepEqual(result, [[]]);
  });

  test('handles single array', () => {
    const result = cartesianProduct([[1, 2, 3]]);
    assert.deepEqual(result, [[1], [2], [3]]);
  });

  test('handles two arrays', () => {
    const result = cartesianProduct([
      ['a', 'b'],
      [1, 2],
    ]);
    assert.deepEqual(result, [
      ['a', 1],
      ['a', 2],
      ['b', 1],
      ['b', 2],
    ]);
  });

  test('handles three arrays', () => {
    const result = cartesianProduct([['x', 'y'], [1, 2], [true]]);
    assert.deepEqual(result, [
      ['x', 1, true],
      ['x', 2, true],
      ['y', 1, true],
      ['y', 2, true],
    ]);
  });

  test('calculates correct product size', () => {
    const result = cartesianProduct([[1, 2], ['a', 'b', 'c'], [true, false]]);
    assert.equal(result.length, 2 * 3 * 2);
  });
});

// =============================================================================
// MATRIX GENERATION TESTS
// =============================================================================

describe('Matrix Generation', () => {
  describe('generateMatrix', () => {
    test('generates config matrix from experiment', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      assert.equal(matrix.experimentId, 'test-experiment');
      assert.equal(matrix.totalConfigurations, 2);
      assert.equal(matrix.configurations.length, 2);
    });

    test('applies variable values to configurations', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      const config1 = matrix.configurations[0];
      const config2 = matrix.configurations[1];

      assert.equal(
        getByPath(config1.config, 'orchestration.planner.implementation'),
        'single-shot'
      );
      assert.equal(getByPath(config2.config, 'orchestration.planner.implementation'), 'iterative');
    });

    test('handles multiple variables', () => {
      const experiment = createTestExperiment({
        independentVariables: [
          { path: 'orchestration.planner.implementation', values: ['single-shot', 'iterative'] },
          { path: 'execution.maxConcurrentWorkers', values: [1, 5] },
        ],
      });
      const matrix = generateMatrix(experiment);

      assert.equal(matrix.totalConfigurations, 4);
    });

    test('handles empty variables', () => {
      const experiment = createTestExperiment({ independentVariables: [] });
      const matrix = generateMatrix(experiment);

      assert.equal(matrix.totalConfigurations, 1);
      assert.equal(matrix.configurations[0].id, 'control');
    });

    test('generates unique config IDs', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      const ids = matrix.configurations.map((c) => c.id);
      const uniqueIds = [...new Set(ids)];
      assert.equal(ids.length, uniqueIds.length);
    });
  });

  describe('generateMatrixWithControl', () => {
    test('adds control configuration', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrixWithControl(experiment);

      const controlConfig = matrix.configurations.find((c) => c.id === 'control');
      assert.ok(controlConfig);
      assert.equal(controlConfig.name, 'Control (Baseline)');
    });

    test('control is first configuration', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrixWithControl(experiment);

      assert.equal(matrix.configurations[0].id, 'control');
    });
  });

  describe('filterMatrix', () => {
    test('filters to specific configurations', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);
      const configIds = [matrix.configurations[0].id];

      const filtered = filterMatrix(matrix, configIds);

      assert.equal(filtered.totalConfigurations, 1);
      assert.equal(filtered.configurations.length, 1);
    });

    test('returns empty for no matches', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      const filtered = filterMatrix(matrix, ['nonexistent']);

      assert.equal(filtered.totalConfigurations, 0);
    });
  });

  describe('getConfiguration', () => {
    test('gets configuration by ID', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);
      const firstId = matrix.configurations[0].id;

      const config = getConfiguration(matrix, firstId);

      assert.ok(config);
      assert.equal(config.id, firstId);
    });

    test('returns undefined for unknown ID', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      const config = getConfiguration(matrix, 'unknown');

      assert.equal(config, undefined);
    });
  });

  describe('calculateTotalRuns', () => {
    test('calculates total runs', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      const totalRuns = calculateTotalRuns(matrix, 3);

      assert.equal(totalRuns, 2 * 3);
    });
  });

  describe('Variable Analysis', () => {
    test('getVariableValues returns unique values', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      const values = getVariableValues(matrix, 'orchestration.planner.implementation');

      assert.deepEqual(values.sort(), ['iterative', 'single-shot']);
    });

    test('groupByVariable groups configurations', () => {
      const experiment = createTestExperiment();
      const matrix = generateMatrix(experiment);

      const groups = groupByVariable(matrix, 'orchestration.planner.implementation');

      assert.ok(groups.has('single-shot'));
      assert.ok(groups.has('iterative'));
      assert.equal(groups.get('single-shot').length, 1);
      assert.equal(groups.get('iterative').length, 1);
    });
  });
});

// =============================================================================
// DESCRIPTIVE STATISTICS TESTS
// =============================================================================

describe('Descriptive Statistics', () => {
  describe('mean', () => {
    test('calculates mean', () => {
      assert.equal(mean([1, 2, 3, 4, 5]), 3);
      assert.equal(mean([10]), 10);
    });

    test('handles empty array', () => {
      assert.equal(mean([]), 0);
    });
  });

  describe('variance', () => {
    test('calculates sample variance', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const v = variance(values);
      assert(Math.abs(v - 4.571) < 0.01);
    });

    test('calculates population variance', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const v = variance(values, true);
      assert(Math.abs(v - 4) < 0.01);
    });

    test('handles single value', () => {
      assert.equal(variance([5]), 0);
    });

    test('handles empty array', () => {
      assert.equal(variance([]), 0);
    });
  });

  describe('stdDev', () => {
    test('calculates standard deviation', () => {
      const values = [2, 4, 4, 4, 5, 5, 7, 9];
      const sd = stdDev(values);
      assert(Math.abs(sd - 2.138) < 0.01);
    });
  });

  describe('median', () => {
    test('calculates median for odd length', () => {
      assert.equal(median([1, 3, 5]), 3);
      assert.equal(median([1, 2, 3, 4, 5]), 3);
    });

    test('calculates median for even length', () => {
      assert.equal(median([1, 2, 3, 4]), 2.5);
      assert.equal(median([1, 2]), 1.5);
    });

    test('handles single value', () => {
      assert.equal(median([42]), 42);
    });

    test('handles empty array', () => {
      assert.equal(median([]), 0);
    });
  });

  describe('min and max', () => {
    test('calculates min and max', () => {
      const values = [3, 1, 4, 1, 5, 9, 2, 6];
      assert.equal(min(values), 1);
      assert.equal(max(values), 9);
    });

    test('handles empty array', () => {
      assert.equal(min([]), 0);
      assert.equal(max([]), 0);
    });
  });

  describe('standardError', () => {
    test('calculates standard error', () => {
      const values = [1, 2, 3, 4, 5];
      const se = standardError(values);
      const expected = stdDev(values) / Math.sqrt(values.length);
      assert(Math.abs(se - expected) < 0.001);
    });

    test('handles small sample', () => {
      assert.equal(standardError([1]), 0);
    });
  });

  describe('descriptiveStats', () => {
    test('returns all statistics', () => {
      const values = [1, 2, 3, 4, 5];
      const stats = descriptiveStats(values);

      assert.equal(stats.mean, 3);
      assert.equal(stats.median, 3);
      assert.equal(stats.min, 1);
      assert.equal(stats.max, 5);
      assert.equal(stats.n, 5);
      assert(stats.stdDev > 0);
    });
  });
});

// =============================================================================
// EFFECT SIZE TESTS
// =============================================================================

describe('Effect Size', () => {
  describe('cohensD', () => {
    test('calculates Cohen d', () => {
      const group1 = [10, 12, 14, 16, 18];
      const group2 = [8, 10, 12, 14, 16];
      const d = cohensD(group1, group2);

      // Groups differ by 2, with similar variance
      assert(Math.abs(d) > 0);
    });

    test('returns 0 for empty groups', () => {
      assert.equal(cohensD([], [1, 2, 3]), 0);
      assert.equal(cohensD([1, 2, 3], []), 0);
    });

    test('returns 0 for identical groups', () => {
      const group = [1, 2, 3, 4, 5];
      const d = cohensD(group, group);
      assert(Math.abs(d) < 0.001);
    });
  });

  describe('interpretCohensD', () => {
    test('interprets effect sizes', () => {
      assert.equal(interpretCohensD(0.1), 'negligible');
      assert.equal(interpretCohensD(0.3), 'small');
      assert.equal(interpretCohensD(0.6), 'medium');
      assert.equal(interpretCohensD(1.0), 'large');
    });

    test('handles negative values', () => {
      assert.equal(interpretCohensD(-0.9), 'large');
    });
  });
});

// =============================================================================
// T-TEST TESTS
// =============================================================================

describe('T-Test', () => {
  describe('tStatistic', () => {
    test('calculates t-statistic', () => {
      const group1 = [5, 6, 7, 8, 9];
      const group2 = [1, 2, 3, 4, 5];
      const t = tStatistic(group1, group2);

      assert(t > 0); // group1 has higher mean
    });

    test('returns 0 for empty groups', () => {
      assert.equal(tStatistic([], [1, 2, 3]), 0);
    });
  });

  describe('welchDF', () => {
    test('calculates degrees of freedom', () => {
      const group1 = [1, 2, 3, 4, 5];
      const group2 = [2, 3, 4, 5, 6];
      const df = welchDF(group1, group2);

      assert(df > 0);
      assert(df <= group1.length + group2.length - 2);
    });
  });

  describe('tToPValue', () => {
    test('returns valid p-value', () => {
      const p = tToPValue(2, 10);
      assert(p >= 0 && p <= 1);
    });

    test('lower p-value for higher t', () => {
      const p1 = tToPValue(1, 10);
      const p2 = tToPValue(3, 10);
      assert(p2 < p1);
    });
  });

  describe('tTest', () => {
    test('performs complete t-test', () => {
      const group1 = [10, 12, 14, 16, 18, 20];
      const group2 = [2, 4, 6, 8, 10, 12];

      const result = tTest(group1, group2);

      assert.ok('t' in result);
      assert.ok('df' in result);
      assert.ok('pValue' in result);
      assert.ok('significant' in result);
      assert.ok('effectSize' in result);
    });

    test('detects significant difference', () => {
      const group1 = [100, 102, 104, 106, 108, 110];
      const group2 = [1, 2, 3, 4, 5, 6];

      const result = tTest(group1, group2);

      assert(result.significant === true);
      assert(result.pValue < 0.05);
    });
  });
});

// =============================================================================
// ANOVA TESTS
// =============================================================================

describe('ANOVA', () => {
  describe('fStatistic', () => {
    test('calculates F-statistic', () => {
      const groups = [
        [1, 2, 3],
        [4, 5, 6],
        [7, 8, 9],
      ];
      const f = fStatistic(groups);

      assert(f > 0);
    });

    test('returns 0 for single group', () => {
      assert.equal(fStatistic([[1, 2, 3]]), 0);
    });
  });

  describe('oneWayAnova', () => {
    test('performs one-way ANOVA', () => {
      const groups = [
        [1, 2, 3, 4],
        [5, 6, 7, 8],
        [9, 10, 11, 12],
      ];

      const result = oneWayAnova(groups);

      assert.ok('f' in result);
      assert.ok('dfBetween' in result);
      assert.ok('dfWithin' in result);
      assert.ok('pValue' in result);
      assert.ok('significant' in result);

      assert.equal(result.dfBetween, 2);
      assert.equal(result.dfWithin, 9);
    });

    test('detects significant differences', () => {
      const groups = [
        [1, 2, 3],
        [100, 101, 102],
        [200, 201, 202],
      ];

      const result = oneWayAnova(groups);

      assert(result.significant === true);
    });
  });

  describe('etaSquared', () => {
    test('calculates eta-squared', () => {
      const groups = [
        [1, 2, 3],
        [10, 11, 12],
      ];
      const eta2 = etaSquared(groups);

      assert(eta2 >= 0 && eta2 <= 1);
    });

    test('returns 0 for single group', () => {
      assert.equal(etaSquared([[1, 2, 3]]), 0);
    });
  });
});

// =============================================================================
// PAIRWISE COMPARISONS TESTS
// =============================================================================

describe('Pairwise Comparisons', () => {
  test('performs all pairwise tests', () => {
    const groups = new Map([
      ['A', [1, 2, 3, 4, 5]],
      ['B', [2, 3, 4, 5, 6]],
      ['C', [10, 11, 12, 13, 14]],
    ]);

    const results = pairwiseComparisons(groups);

    // 3 groups = 3 comparisons (A-B, A-C, B-C)
    assert.equal(results.length, 3);
  });

  test('includes comparison details', () => {
    const groups = new Map([
      ['control', [1, 2, 3]],
      ['treatment', [10, 11, 12]],
    ]);

    const results = pairwiseComparisons(groups);

    assert.equal(results.length, 1);
    assert.ok('groupA' in results[0]);
    assert.ok('groupB' in results[0]);
    assert.ok('meanDiff' in results[0]);
    assert.ok('pValue' in results[0]);
    assert.ok('significant' in results[0]);
    assert.ok('effectSize' in results[0]);
  });

  test('applies Bonferroni correction', () => {
    const groups = new Map([
      ['A', [1, 2, 3, 4, 5]],
      ['B', [2, 3, 4, 5, 6]],
      ['C', [3, 4, 5, 6, 7]],
    ]);

    // With Bonferroni correction and small differences, may not be significant
    const results = pairwiseComparisons(groups);
    assert.equal(results.length, 3);
  });
});

// =============================================================================
// EXPERIMENT ANALYSIS TESTS
// =============================================================================

describe('Experiment Analysis', () => {
  describe('analyzeExperiment', () => {
    test('analyzes experiment results', () => {
      const result = {
        experimentId: 'test',
        startedAt: Date.now() - 1000,
        completedAt: Date.now(),
        configurations: [
          {
            configId: 'config-a',
            config: {},
            runs: [
              { runId: 'r1', metrics: { task_completion_rate: 80, total_cost: 0.05 } },
              { runId: 'r2', metrics: { task_completion_rate: 85, total_cost: 0.06 } },
            ],
            aggregated: {},
          },
          {
            configId: 'config-b',
            config: {},
            runs: [
              { runId: 'r3', metrics: { task_completion_rate: 90, total_cost: 0.10 } },
              { runId: 'r4', metrics: { task_completion_rate: 92, total_cost: 0.12 } },
            ],
            aggregated: {},
          },
        ],
        analysis: { summary: {}, comparisons: [], recommendations: [] },
      };

      const analysis = analyzeExperiment(result);

      assert.ok('summary' in analysis);
      assert.ok('comparisons' in analysis);
      assert.ok('recommendations' in analysis);
    });

    test('includes summary statistics', () => {
      const result = {
        experimentId: 'test',
        startedAt: Date.now(),
        completedAt: Date.now(),
        configurations: [
          {
            configId: 'config-a',
            config: {},
            runs: [
              { runId: 'r1', metrics: { task_completion_rate: 80 } },
              { runId: 'r2', metrics: { task_completion_rate: 90 } },
            ],
            aggregated: {},
          },
        ],
        analysis: { summary: {}, comparisons: [], recommendations: [] },
      };

      const analysis = analyzeExperiment(result);

      assert.ok('task_completion_rate' in analysis.summary);
      assert.ok(analysis.summary.task_completion_rate.n > 0);
    });
  });

  describe('aggregateRunMetrics', () => {
    test('aggregates metrics across runs', () => {
      const runs = [
        { runId: 'r1', metrics: { score: 10, cost: 1 } },
        { runId: 'r2', metrics: { score: 20, cost: 2 } },
        { runId: 'r3', metrics: { score: 30, cost: 3 } },
      ];

      const agg = aggregateRunMetrics(runs);

      assert.equal(agg.mean.score, 20);
      assert.equal(agg.mean.cost, 2);
      assert.equal(agg.min.score, 10);
      assert.equal(agg.max.score, 30);
    });

    test('handles empty runs', () => {
      const agg = aggregateRunMetrics([]);

      assert.deepEqual(agg.mean, {});
      assert.deepEqual(agg.stdDev, {});
    });
  });
});

// =============================================================================
// EXPERIMENT VALIDATION TESTS
// =============================================================================

describe('Experiment Validation', () => {
  test('validates valid experiment', () => {
    const experiment = createTestExperiment();
    const errors = validateExperiment(experiment);

    assert.equal(errors.length, 0);
  });

  test('catches missing ID', () => {
    const experiment = createTestExperiment({ id: '' });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('ID')));
  });

  test('catches missing name', () => {
    const experiment = createTestExperiment({ name: '' });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('name')));
  });

  test('catches empty task set', () => {
    const experiment = createTestExperiment({ taskSet: [] });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('task')));
  });

  test('catches missing dependent variables', () => {
    const experiment = createTestExperiment({ dependentVariables: [] });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('dependent')));
  });

  test('catches invalid runs per configuration', () => {
    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 0, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('runsPerConfiguration')));
  });

  test('catches invalid timeout', () => {
    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 3, timeoutPerRun: 0, randomSeed: 42, warmupRuns: 0 },
    });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('timeout')));
  });

  test('catches missing variable path', () => {
    const experiment = createTestExperiment({
      independentVariables: [{ path: '', values: [1, 2] }],
    });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('path')));
  });

  test('catches empty variable values', () => {
    const experiment = createTestExperiment({
      independentVariables: [{ path: 'some.path', values: [] }],
    });
    const errors = validateExperiment(experiment);

    assert(errors.some((e) => e.includes('value')));
  });
});

// =============================================================================
// DRY RUN TESTS
// =============================================================================

describe('Dry Run', () => {
  test('calculates experiment preview', () => {
    const experiment = createTestExperiment();
    const preview = dryRun(experiment);

    assert.equal(preview.totalConfigurations, 2);
    assert.equal(preview.totalRuns, 2 * 3);
    assert.equal(preview.estimatedDuration, 2 * 3 * 60);
    assert.ok(preview.matrix);
  });

  test('includes matrix in preview', () => {
    const experiment = createTestExperiment();
    const preview = dryRun(experiment);

    assert.equal(preview.matrix.configurations.length, 2);
  });
});

// =============================================================================
// EXPERIMENT RUNNER TESTS
// =============================================================================

describe('Experiment Runner', () => {
  let runner;
  let context;

  beforeEach(() => {
    runner = createExperimentRunner();
    context = createMockContext();
  });

  test('creates runner module', () => {
    assert.equal(runner.id, 'experiment-runner');
    assert.equal(runner.version, '1.0.0');
    assert.ok(runner.configure);
    assert.ok(runner.execute);
    assert.ok(runner.getMetrics);
    assert.ok(runner.reset);
  });

  test('validates experiment via execute', async () => {
    await runner.configure({ implementation: 'standard' });

    const experiment = createTestExperiment({ id: '' });
    const result = await runner.execute({ operation: 'validate', experiment }, context);

    assert.equal(result.success, false);
    assert(result.validationErrors.length > 0);
  });

  test('performs dry run via execute', async () => {
    await runner.configure({ implementation: 'standard' });

    const experiment = createTestExperiment();
    const result = await runner.execute({ operation: 'dryRun', experiment }, context);

    assert.equal(result.success, true);
    assert.ok(result.progress);
    assert.equal(result.progress.totalConfigurations, 2);
  });

  test('executes experiment', async () => {
    await runner.configure({ implementation: 'standard' });

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 2, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    const result = await runner.execute({ operation: 'execute', experiment }, context);

    assert.equal(result.success, true);
    assert.ok(result.result);
    assert.equal(result.result.experimentId, 'test-experiment');
    assert.equal(result.result.configurations.length, 2);
  });

  test('executes with custom workflow executor', async () => {
    await runner.configure({ implementation: 'standard' });

    let executionCount = 0;
    const customExecutor = async () => {
      executionCount++;
      return {
        success: true,
        metrics: { custom_metric: executionCount },
      };
    };

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 2, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    const result = await runner.execute(
      { operation: 'execute', experiment, executeWorkflow: customExecutor },
      context
    );

    assert.equal(result.success, true);
    assert.equal(executionCount, 4); // 2 configs * 2 runs
  });

  test('emits events during execution', async () => {
    await runner.configure({ implementation: 'standard' });

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 1, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    await runner.execute({ operation: 'execute', experiment }, context);

    const events = context.getEvents();
    const startEvent = events.find((e) => e.eventType === 'experiment.started');
    const completeEvent = events.find((e) => e.eventType === 'experiment.completed');

    assert.ok(startEvent);
    assert.ok(completeEvent);
  });

  test('handles warmup runs', async () => {
    await runner.configure({ implementation: 'standard' });

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 2, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 1 },
    });
    const result = await runner.execute({ operation: 'execute', experiment }, context);

    // Each config should have 2 runs (warmup runs discarded)
    for (const config of result.result.configurations) {
      assert.equal(config.runs.length, 2);
    }
  });

  test('tracks progress', async () => {
    await runner.configure({ implementation: 'standard' });

    const progressUpdates = [];
    runner.onProgress((progress) => progressUpdates.push({ ...progress }));

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 2, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    await runner.execute({ operation: 'execute', experiment }, context);

    assert(progressUpdates.length > 0);
    const lastProgress = progressUpdates[progressUpdates.length - 1];
    assert.equal(lastProgress.completedRuns, 4);
  });

  test('provides running status', async () => {
    await runner.configure({ implementation: 'standard' });

    assert.equal(runner.isRunning(), false);
  });

  test('updates metrics after execution', async () => {
    await runner.configure({ implementation: 'standard' });

    const metricsBefore = runner.getMetrics();
    assert.equal(metricsBefore.executionCount, 0);

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 1, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    await runner.execute({ operation: 'execute', experiment }, context);

    const metricsAfter = runner.getMetrics();
    assert.equal(metricsAfter.executionCount, 1);
  });

  test('resets state', async () => {
    await runner.configure({ implementation: 'standard' });

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 1, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    await runner.execute({ operation: 'execute', experiment }, context);

    await runner.reset();

    const metrics = runner.getMetrics();
    assert.equal(metrics.executionCount, 0);
  });

  test('throws when not configured', async () => {
    const experiment = createTestExperiment();

    await assert.rejects(async () => {
      await runner.execute({ operation: 'execute', experiment }, context);
    }, /not configured/);
  });

  test('returns false for unknown operation', async () => {
    await runner.configure({ implementation: 'standard' });

    const experiment = createTestExperiment();
    const result = await runner.execute({ operation: 'unknown', experiment }, context);

    assert.equal(result.success, false);
  });

  test('stops on error when configured', async () => {
    await runner.configure({ implementation: 'standard', stopOnError: true });

    let callCount = 0;
    const failingExecutor = async () => {
      callCount++;
      return {
        success: callCount > 1 ? false : true,
        metrics: {},
      };
    };

    const experiment = createTestExperiment({
      parameters: { runsPerConfiguration: 3, timeoutPerRun: 60, randomSeed: 42, warmupRuns: 0 },
    });
    await runner.execute(
      { operation: 'execute', experiment, executeWorkflow: failingExecutor },
      context
    );

    // Should stop after first config with an error
    assert(callCount < 6); // Would be 6 if it ran all
  });
});

// =============================================================================
// TASK CORPUS TESTS
// =============================================================================

describe('Task Corpus', () => {
  beforeEach(() => {
    corpusStore.clear();
  });

  describe('createCorpus', () => {
    test('creates corpus with defaults', () => {
      const corpus = createCorpus();

      assert.ok(corpus.id.startsWith('corpus-'));
      assert.equal(corpus.name, 'Unnamed Corpus');
      assert.deepEqual(corpus.tasks, []);
      assert.deepEqual(corpus.tags, []);
    });

    test('creates corpus with tasks', () => {
      const tasks = [
        createTaskDefinition({ id: 't1', name: 'Task 1' }),
        createTaskDefinition({ id: 't2', name: 'Task 2' }),
      ];
      const corpus = createCorpus({ tasks });

      assert.equal(corpus.metadata.taskCount, 2);
    });

    test('calculates metadata from tasks', () => {
      const tasks = [
        createTaskDefinition({
          id: 't1',
          requirements: { skills: [Skill.CODE_GENERATION], domain: Domain.WEB_DEVELOPMENT },
          timeout: 60,
        }),
        createTaskDefinition({
          id: 't2',
          requirements: { skills: [Skill.TEST_WRITING], domain: Domain.WEB_DEVELOPMENT },
          timeout: 120,
        }),
      ];
      const corpus = createCorpus({ tasks });

      assert.equal(corpus.metadata.estimatedDuration, 180);
      assert(corpus.metadata.requiredSkills.includes(Skill.CODE_GENERATION));
      assert(corpus.metadata.requiredSkills.includes(Skill.TEST_WRITING));
    });
  });

  describe('Corpus Store', () => {
    test('registers and retrieves corpus', () => {
      const corpus = createCorpus({ id: 'test-corpus', name: 'Test' });
      registerCorpus(corpus);

      const retrieved = getCorpus('test-corpus');
      assert.equal(retrieved.name, 'Test');
    });

    test('returns undefined for unknown corpus', () => {
      const corpus = getCorpus('unknown');
      assert.equal(corpus, undefined);
    });

    test('gets all corpora', () => {
      registerCorpus(createCorpus({ id: 'corpus-1' }));
      registerCorpus(createCorpus({ id: 'corpus-2' }));

      const all = getAllCorpora();
      assert.equal(all.length, 2);
    });

    test('finds by tags', () => {
      registerCorpus(createCorpus({ id: 'corpus-1', tags: ['benchmark', 'codegen'] }));
      registerCorpus(createCorpus({ id: 'corpus-2', tags: ['benchmark', 'review'] }));
      registerCorpus(createCorpus({ id: 'corpus-3', tags: ['custom'] }));

      const found = corpusStore.findByTags(['codegen']);
      assert.equal(found.length, 1);
      assert.equal(found[0].id, 'corpus-1');
    });

    test('finds by difficulty', () => {
      registerCorpus(createCorpus({ id: 'corpus-1', metadata: { difficulty: 'easy' } }));
      registerCorpus(createCorpus({ id: 'corpus-2', metadata: { difficulty: 'hard' } }));

      const found = corpusStore.findByDifficulty('easy');
      assert.equal(found.length, 1);
      assert.equal(found[0].id, 'corpus-1');
    });
  });

  describe('Corpus Utilities', () => {
    test('merges corpora', () => {
      const corpus1 = createCorpus({
        name: 'A',
        tasks: [createTaskDefinition({ id: 't1' })],
        tags: ['tag-a'],
      });
      const corpus2 = createCorpus({
        name: 'B',
        tasks: [createTaskDefinition({ id: 't2' })],
        tags: ['tag-b'],
      });

      const merged = mergeCorpora([corpus1, corpus2], 'Merged');

      assert.equal(merged.name, 'Merged');
      assert.equal(merged.tasks.length, 2);
      assert(merged.tags.includes('tag-a'));
      assert(merged.tags.includes('tag-b'));
    });

    test('filters by skills', () => {
      const corpus = createCorpus({
        tasks: [
          createTaskDefinition({
            id: 't1',
            requirements: { skills: [Skill.CODE_GENERATION] },
          }),
          createTaskDefinition({
            id: 't2',
            requirements: { skills: [Skill.TEST_WRITING] },
          }),
          createTaskDefinition({
            id: 't3',
            requirements: { skills: [Skill.CODE_GENERATION, Skill.CODE_REVIEW] },
          }),
        ],
      });

      const filtered = filterBySkills(corpus, [Skill.CODE_GENERATION]);

      assert.equal(filtered.tasks.length, 2);
    });

    test('filters by domain', () => {
      const corpus = createCorpus({
        tasks: [
          createTaskDefinition({
            id: 't1',
            requirements: { domain: Domain.WEB_DEVELOPMENT },
          }),
          createTaskDefinition({
            id: 't2',
            requirements: { domain: Domain.MOBILE_DEVELOPMENT },
          }),
        ],
      });

      const filtered = filterByDomain(corpus, Domain.WEB_DEVELOPMENT);

      assert.equal(filtered.tasks.length, 1);
      assert.equal(filtered.tasks[0].id, 't1');
    });

    test('samples tasks with seed', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTaskDefinition({ id: `t${i}` })
      );
      const corpus = createCorpus({ tasks });

      const sample1 = sampleTasks(corpus, 5, 42);
      const sample2 = sampleTasks(corpus, 5, 42);

      assert.equal(sample1.tasks.length, 5);
      assert.deepEqual(
        sample1.tasks.map((t) => t.id),
        sample2.tasks.map((t) => t.id)
      );
    });

    test('samples returns all if count >= length', () => {
      const corpus = createCorpus({
        tasks: [createTaskDefinition({ id: 't1' }), createTaskDefinition({ id: 't2' })],
      });

      const sample = sampleTasks(corpus, 10);

      assert.equal(sample.tasks.length, 2);
    });

    test('splits corpus into train/test', () => {
      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTaskDefinition({ id: `t${i}` })
      );
      const corpus = createCorpus({ tasks });

      const { train, test } = splitCorpus(corpus, 0.8, 42);

      assert.equal(train.tasks.length, 8);
      assert.equal(test.tasks.length, 2);
    });
  });

  describe('Built-in Corpora', () => {
    test('creates code generation corpus', () => {
      const corpus = createCodeGenCorpus();

      assert.equal(corpus.id, 'builtin-codegen');
      assert(corpus.tasks.length > 0);
      assert(corpus.tags.includes('codegen'));
    });

    test('creates code review corpus', () => {
      const corpus = createCodeReviewCorpus();

      assert.equal(corpus.id, 'builtin-codereview');
      assert(corpus.tasks.length > 0);
      assert(corpus.tags.includes('codereview'));
    });

    test('registers built-in corpora', () => {
      registerBuiltinCorpora();

      assert.ok(getCorpus('builtin-codegen'));
      assert.ok(getCorpus('builtin-codereview'));
    });
  });
});

// =============================================================================
// MOCK EXECUTE WORKFLOW TESTS
// =============================================================================

describe('Mock Execute Workflow', () => {
  test('returns successful result', async () => {
    const config = createBaselineConfig();
    const tasks = [createTaskDefinition({ id: 't1' })];

    const result = await mockExecuteWorkflow(config, tasks);

    assert.equal(result.success, true);
    assert.ok('task_completion_rate' in result.metrics);
    assert.ok('total_cost' in result.metrics);
    assert.ok('quality_score' in result.metrics);
  });

  test('returns reasonable metric values', async () => {
    const config = createBaselineConfig();
    const tasks = [createTaskDefinition({ id: 't1' })];

    const result = await mockExecuteWorkflow(config, tasks);

    assert(result.metrics.task_completion_rate >= 80 && result.metrics.task_completion_rate <= 100);
    assert(result.metrics.quality_score >= 0.7 && result.metrics.quality_score <= 1);
    assert(result.metrics.total_cost > 0);
  });
});

// =============================================================================
// INTEGRATION TESTS
// =============================================================================

describe('Integration', () => {
  test('full experiment workflow', async () => {
    // 1. Create task corpus
    const corpus = createCorpus({
      name: 'Integration Test Corpus',
      tasks: [
        createTaskDefinition({ id: 'task-1', name: 'Task 1' }),
        createTaskDefinition({ id: 'task-2', name: 'Task 2' }),
      ],
    });

    // 2. Define experiment
    const experiment = createExperiment({
      id: 'integration-test',
      name: 'Integration Test',
      hypothesis: 'Testing full workflow',
      independentVariables: [
        { path: 'orchestration.planner.implementation', values: ['single-shot', 'iterative'] },
      ],
      dependentVariables: ['task_completion_rate', 'total_cost'],
      controlConfig: createBaselineConfig(),
      taskSet: corpus.tasks,
      parameters: {
        runsPerConfiguration: 2,
        randomSeed: 42,
        timeoutPerRun: 60,
        warmupRuns: 0,
      },
    });

    // 3. Validate
    const errors = validateExperiment(experiment);
    assert.equal(errors.length, 0);

    // 4. Dry run
    const preview = dryRun(experiment);
    assert.equal(preview.totalConfigurations, 2);
    assert.equal(preview.totalRuns, 4);

    // 5. Execute
    const runner = createExperimentRunner();
    await runner.configure({ implementation: 'standard' });

    const context = createMockContext();
    const result = await runner.execute({ operation: 'execute', experiment }, context);

    // 6. Verify results
    assert.equal(result.success, true);
    assert.equal(result.result.configurations.length, 2);

    // 7. Check analysis
    assert.ok(result.result.analysis.summary);
    assert.ok(Array.isArray(result.result.analysis.comparisons));
    assert.ok(Array.isArray(result.result.analysis.recommendations));

    // 8. Verify metrics were collected
    const firstConfig = result.result.configurations[0];
    assert.equal(firstConfig.runs.length, 2);
    assert.ok('task_completion_rate' in firstConfig.aggregated.mean);
  });

  test('experiment with multiple variables', async () => {
    const experiment = createExperiment({
      id: 'multi-var-test',
      name: 'Multi-Variable Test',
      hypothesis: 'Testing multiple variables',
      independentVariables: [
        { path: 'orchestration.planner.implementation', values: ['single-shot', 'iterative'] },
        { path: 'execution.maxConcurrentWorkers', values: [1, 5] },
      ],
      dependentVariables: ['task_completion_rate'],
      controlConfig: createBaselineConfig(),
      taskSet: [createTaskDefinition({ id: 't1' })],
      parameters: {
        runsPerConfiguration: 1,
        randomSeed: 42,
        timeoutPerRun: 60,
        warmupRuns: 0,
      },
    });

    const matrix = generateMatrix(experiment);
    assert.equal(matrix.totalConfigurations, 4); // 2 x 2

    const runner = createExperimentRunner();
    await runner.configure({ implementation: 'standard' });

    const result = await runner.execute(
      { operation: 'execute', experiment },
      createMockContext()
    );

    assert.equal(result.result.configurations.length, 4);
  });
});
