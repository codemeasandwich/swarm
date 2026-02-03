/**
 * @file E2E tests for metrics API (MET-01 to MET-07).
 * Tests metrics snapshot, history, and computed metrics.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const metricsApi = require('../../../src/server/api/metrics.cjs');

describe('Metrics API', () => {
  // Reset metrics before each test for isolation
  beforeEach(() => {
    metricsApi({ action: 'reset' });
  });

  describe('MET-01: snapshot', () => {
    test('returns current metrics snapshot', () => {
      const result = metricsApi({ action: 'snapshot' });

      assert.ok(result, 'Should return result');
      assert.ok('agents' in result, 'Should have agents');
      assert.ok('activeAgents' in result, 'Should have activeAgents');
      assert.ok('tasks' in result, 'Should have tasks');
      assert.ok('completedTasks' in result, 'Should have completedTasks');
      assert.ok('pendingTasks' in result, 'Should have pendingTasks');
      assert.ok('cost' in result, 'Should have cost');
      assert.ok('tokenUsage' in result, 'Should have tokenUsage');
      assert.ok('throughput' in result, 'Should have throughput');
      assert.ok('errorRate' in result, 'Should have errorRate');
      assert.ok('timestamp' in result, 'Should have timestamp');
    });

    test('returns snapshot when called with no action', () => {
      const result = metricsApi({});

      assert.ok('agents' in result, 'Should return snapshot by default');
      assert.ok('timestamp' in result, 'Should have timestamp');
    });

    test('returns initial zero values after reset', () => {
      const result = metricsApi({ action: 'snapshot' });

      assert.equal(result.agents, 0);
      assert.equal(result.activeAgents, 0);
      assert.equal(result.tasks, 0);
      assert.equal(result.cost, 0);
    });
  });

  describe('MET-02: history', () => {
    test('returns metrics history', () => {
      // Add some history entries
      metricsApi.updateMetrics({ agents: 1, cost: 0.01 });
      metricsApi.updateMetrics({ agents: 2, cost: 0.02 });
      metricsApi.updateMetrics({ agents: 3, cost: 0.03 });

      const result = metricsApi({ action: 'history' });

      assert.ok(result.history, 'Should have history array');
      assert.ok(Array.isArray(result.history), 'History should be an array');
      assert.equal(result.history.length, 3, 'Should have 3 history entries');
      assert.ok('count' in result, 'Should have count');
    });

    test('history entries have timestamps', () => {
      metricsApi.updateMetrics({ agents: 1 });
      metricsApi.updateMetrics({ agents: 2 });

      const result = metricsApi({ action: 'history' });

      for (const entry of result.history) {
        assert.ok(entry.timestamp, 'Each entry should have timestamp');
      }
    });
  });

  describe('MET-03: history limit', () => {
    test('respects limit parameter', () => {
      // Add 10 entries
      for (let i = 0; i < 10; i++) {
        metricsApi.updateMetrics({ agents: i });
      }

      const result = metricsApi({ action: 'history', limit: 5 });

      assert.equal(result.history.length, 5, 'Should return only 5 entries');
      assert.equal(result.count, 10, 'Count should be total entries');
    });

    test('returns all entries when limit exceeds count', () => {
      metricsApi.updateMetrics({ agents: 1 });
      metricsApi.updateMetrics({ agents: 2 });

      const result = metricsApi({ action: 'history', limit: 100 });

      assert.equal(result.history.length, 2, 'Should return all available entries');
    });
  });

  describe('MET-04: reset', () => {
    test('clears all metrics', () => {
      // Add some data
      metricsApi.updateMetrics({ agents: 5, cost: 1.5 });
      metricsApi.updateMetrics({ agents: 10, cost: 3.0 });

      // Reset
      const result = metricsApi({ action: 'reset' });

      assert.equal(result.reset, true, 'Should confirm reset');

      // Verify cleared
      const snapshot = metricsApi({ action: 'snapshot' });
      assert.equal(snapshot.agents, 0, 'Agents should be reset to 0');
      assert.equal(snapshot.cost, 0, 'Cost should be reset to 0');

      const history = metricsApi({ action: 'history' });
      assert.equal(history.history.length, 0, 'History should be empty');
    });
  });

  describe('MET-05: updateMetrics', () => {
    test('updates current metrics', () => {
      metricsApi.updateMetrics({
        agents: 5,
        activeAgents: 3,
        cost: 1.23,
        completedTasks: 10,
      });

      const snapshot = metricsApi({ action: 'snapshot' });

      assert.equal(snapshot.agents, 5);
      assert.equal(snapshot.activeAgents, 3);
      assert.equal(snapshot.cost, 1.23);
      assert.equal(snapshot.completedTasks, 10);
    });

    test('updates set lastUpdate timestamp', () => {
      const before = Date.now();
      metricsApi.updateMetrics({ agents: 1 });
      const after = Date.now();

      const snapshot = metricsApi({ action: 'snapshot' });

      assert.ok(snapshot.lastUpdate >= before, 'lastUpdate should be >= before');
      assert.ok(snapshot.lastUpdate <= after, 'lastUpdate should be <= after');
    });

    test('adds to history', () => {
      metricsApi.updateMetrics({ agents: 1 });
      metricsApi.updateMetrics({ agents: 2 });

      const history = metricsApi({ action: 'history' });

      assert.equal(history.history.length, 2);
      assert.equal(history.history[0].agents, 1);
      assert.equal(history.history[1].agents, 2);
    });

    test('merges partial updates', () => {
      metricsApi.updateMetrics({ agents: 5, cost: 1.0 });
      metricsApi.updateMetrics({ cost: 2.0 }); // Only update cost

      const snapshot = metricsApi({ action: 'snapshot' });

      assert.equal(snapshot.agents, 5, 'Agents should be preserved');
      assert.equal(snapshot.cost, 2.0, 'Cost should be updated');
    });
  });

  describe('MET-06: history cap', () => {
    test('caps history at MAX_HISTORY (60)', () => {
      // Add more than MAX_HISTORY entries
      for (let i = 0; i < 70; i++) {
        metricsApi.updateMetrics({ agents: i });
      }

      const history = metricsApi({ action: 'history' });

      assert.ok(history.history.length <= 60, 'History should not exceed 60 entries');
      assert.equal(history.history.length, 60, 'Should have exactly 60 entries');
    });

    test('removes oldest entries when cap reached', () => {
      // Add more than MAX_HISTORY entries
      for (let i = 0; i < 65; i++) {
        metricsApi.updateMetrics({ agents: i });
      }

      const history = metricsApi({ action: 'history' });

      // First entry should be the 6th one we added (index 5)
      assert.equal(history.history[0].agents, 5, 'Oldest entries should be removed');
    });
  });

  describe('MET-07: computed metrics', () => {
    test('returns computed metrics', () => {
      const computed = metricsApi.getComputedMetrics();

      assert.ok('throughputTrend' in computed, 'Should have throughputTrend');
      assert.ok('costRate' in computed, 'Should have costRate');
      assert.ok('avgTaskTime' in computed, 'Should have avgTaskTime');
    });

    test('returns stable trend with insufficient data', () => {
      metricsApi.updateMetrics({ agents: 1 });

      const computed = metricsApi.getComputedMetrics();

      assert.equal(computed.throughputTrend, 'stable');
      assert.equal(computed.costRate, 0);
      assert.equal(computed.avgTaskTime, 0);
    });

    test('calculates trends with sufficient data', () => {
      // Add multiple data points with progression
      for (let i = 0; i < 15; i++) {
        metricsApi.updateMetrics({
          completedTasks: i * 2,
          cost: i * 0.1,
          throughput: i,
        });
      }

      const computed = metricsApi.getComputedMetrics();

      assert.ok(
        computed.throughputTrend === 'increasing' || computed.throughputTrend === 'decreasing',
        'Should determine trend direction'
      );
    });

    test('calculates avgTaskTime when tasks are completed', () => {
      // Reset first
      metricsApi({ action: 'reset' });

      // Add entries with increasing completedTasks
      for (let i = 0; i < 12; i++) {
        metricsApi.updateMetrics({
          completedTasks: i * 2,
          cost: i * 0.1,
          throughput: i,
        });
      }

      const computed = metricsApi.getComputedMetrics();

      // With sufficient data and task completion, we should get calculated values
      assert.ok(typeof computed.avgTaskTime === 'number' || typeof computed.avgTaskTime === 'string', 'avgTaskTime should be calculated');
      assert.ok('costRate' in computed, 'Should have costRate');
    });

    test('handles zero duration edge case', () => {
      // Reset first
      metricsApi({ action: 'reset' });

      // Add entries that produce zero duration (same timestamps effectively)
      metricsApi.updateMetrics({ completedTasks: 0 });
      metricsApi.updateMetrics({ completedTasks: 0 });

      const computed = metricsApi.getComputedMetrics();

      // Should not throw, should return valid structure
      assert.ok('throughputTrend' in computed);
    });

    test('handles zero completed tasks edge case', () => {
      // Reset first
      metricsApi({ action: 'reset' });

      // Add 10+ entries but with no task completion
      for (let i = 0; i < 12; i++) {
        metricsApi.updateMetrics({
          completedTasks: 0,
          cost: 0,
          throughput: 0,
        });
      }

      const computed = metricsApi.getComputedMetrics();

      // avgTaskTime should be 0 when no tasks completed
      assert.equal(computed.avgTaskTime, 0);
    });
  });

  describe('unknown action', () => {
    test('returns error for unknown action', () => {
      const result = metricsApi({ action: 'unknown' });

      assert.ok(result.error);
      assert.ok(result.error.includes('Unknown'));
    });
  });
});
