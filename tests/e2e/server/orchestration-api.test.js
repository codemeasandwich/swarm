/**
 * @file E2E tests for orchestration API (STEP4-*, STEP5-*).
 * Tests plan generation and execution control.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const orchestrationApi = require('../../../src/server/api/orchestration.cjs');

describe('Orchestration API', () => {
  // Unique client ID counter for test isolation
  let clientIdCounter = 0;
  const getUniqueClientId = () => `orch-test-${Date.now()}-${++clientIdCounter}`;

  describe('action: generatePlan', () => {
    // STEP4-01: Plan generated from inputs
    test('STEP4-01: generates plan from description and answers', async () => {
      const result = await orchestrationApi({
        action: 'generatePlan',
        projectPath: '/test/project',
        description: 'Add a new login feature with authentication',
        answers: { 0: 'Medium (3-5 files)' },
      });

      assert.ok(result.plan, 'Should return plan object');
      assert.ok(result.plan.id, 'Plan should have ID');
      assert.ok(result.plan.projectPath, 'Plan should have projectPath');
      assert.ok(result.plan.createdAt, 'Plan should have createdAt');
    });

    // STEP4-02: Title extracted from description
    test('STEP4-02: extracts title from description', async () => {
      const result = await orchestrationApi({
        action: 'generatePlan',
        projectPath: '/test',
        description: 'Implement user registration. This is a detailed description.',
        answers: {},
      });

      assert.equal(result.plan.title, 'Implement user registration', 'Should extract first sentence as title');
    });

    test('truncates long titles', async () => {
      const longDescription =
        'This is a very long description that exceeds fifty characters and should be truncated properly for display';
      const result = await orchestrationApi({
        action: 'generatePlan',
        projectPath: '/test',
        description: longDescription,
        answers: {},
      });

      assert.ok(result.plan.title.length <= 50, 'Title should be 50 chars or less');
      assert.ok(result.plan.title.endsWith('...'), 'Should end with ellipsis when truncated');
    });

    // STEP4-03: Plan contains tasks array
    test('STEP4-03: plan contains tasks array with names and descriptions', async () => {
      const result = await orchestrationApi({
        action: 'generatePlan',
        projectPath: '/test',
        description: 'Add feature',
        answers: {},
      });

      assert.ok(Array.isArray(result.plan.tasks), 'Should have tasks array');
      assert.ok(result.plan.tasks.length > 0, 'Should have at least one task');

      for (const task of result.plan.tasks) {
        assert.ok(task.id, 'Task should have id');
        assert.ok(task.name, 'Task should have name');
        assert.ok('description' in task, 'Task should have description property');
      }
    });

    // STEP4-04: Agent assignments
    test('STEP4-04: tasks have agent assignments', async () => {
      const result = await orchestrationApi({
        action: 'generatePlan',
        projectPath: '/test',
        description: 'Add feature',
        answers: {},
      });

      for (const task of result.plan.tasks) {
        assert.ok(task.agent, 'Task should have agent assignment');
      }
    });
  });

  describe('action: start', () => {
    // STEP5-01: Execution start
    test('STEP5-01: starts execution and returns executionId', async () => {
      const clientId = getUniqueClientId();
      const plan = {
        id: 'test-plan',
        title: 'Test Plan',
        tasks: [{ id: 't1', name: 'Task 1', agent: 'Planner' }],
      };

      const result = await orchestrationApi(
        { action: 'start', projectPath: '/test', plan },
        { clientId }
      );

      assert.ok(result.executionId, 'Should return executionId');
      assert.equal(result.status, 'running', 'Status should be running');
    });

    // STEP5-12: Cannot start duplicate execution
    test('STEP5-12: returns error when starting while already running', async () => {
      const clientId = getUniqueClientId();
      const plan = {
        id: 'test-plan',
        title: 'Test Plan',
        tasks: [{ id: 't1', name: 'Task 1', agent: 'Planner' }],
      };

      // Start first execution
      await orchestrationApi({ action: 'start', projectPath: '/test', plan }, { clientId });

      // Try to start another
      const result = await orchestrationApi(
        { action: 'start', projectPath: '/test', plan },
        { clientId }
      );

      assert.ok(result.error, 'Should return error');
      assert.ok(result.error.includes('already'), 'Error should mention already in progress');
    });
  });

  describe('action: pause', () => {
    // STEP5-08: Pause execution
    test('STEP5-08: pauses running execution', async () => {
      const clientId = getUniqueClientId();
      const plan = { id: 'p1', title: 'Test', tasks: [{ id: 't1', name: 'T1', agent: 'A' }] };

      await orchestrationApi({ action: 'start', projectPath: '/test', plan }, { clientId });
      const result = await orchestrationApi({ action: 'pause' }, { clientId });

      assert.equal(result.status, 'paused', 'Status should be paused');
    });

    // STEP5-13: Error when not running
    test('STEP5-13: returns error when no active execution', async () => {
      const clientId = getUniqueClientId();
      const result = await orchestrationApi({ action: 'pause' }, { clientId });

      assert.ok(result.error, 'Should return error');
    });

    test('returns error when trying to pause non-running execution', async () => {
      const clientId = getUniqueClientId();
      const plan = { id: 'p1', title: 'Test', tasks: [{ id: 't1', name: 'T1', agent: 'A' }] };

      // Start then pause
      await orchestrationApi({ action: 'start', projectPath: '/test', plan }, { clientId });
      await orchestrationApi({ action: 'pause' }, { clientId });

      // Try to pause again
      const result = await orchestrationApi({ action: 'pause' }, { clientId });

      assert.ok(result.error, 'Should return error');
      assert.ok(result.error.includes('paused'), 'Error should mention current status');
    });
  });

  describe('action: resume', () => {
    // STEP5-09: Resume execution
    test('STEP5-09: resumes paused execution', async () => {
      const clientId = getUniqueClientId();
      const plan = { id: 'p1', title: 'Test', tasks: [{ id: 't1', name: 'T1', agent: 'A' }] };

      await orchestrationApi({ action: 'start', projectPath: '/test', plan }, { clientId });
      await orchestrationApi({ action: 'pause' }, { clientId });
      const result = await orchestrationApi({ action: 'resume' }, { clientId });

      assert.equal(result.status, 'running', 'Status should be running');
    });

    // STEP5-14: Error when not paused
    test('STEP5-14: returns error when execution is not paused', async () => {
      const clientId = getUniqueClientId();
      const plan = { id: 'p1', title: 'Test', tasks: [{ id: 't1', name: 'T1', agent: 'A' }] };

      // Start but don't pause
      await orchestrationApi({ action: 'start', projectPath: '/test', plan }, { clientId });
      const result = await orchestrationApi({ action: 'resume' }, { clientId });

      assert.ok(result.error, 'Should return error');
      assert.ok(result.error.includes('running'), 'Error should mention current status');
    });

    test('returns error when no active execution', async () => {
      const clientId = getUniqueClientId();
      const result = await orchestrationApi({ action: 'resume' }, { clientId });

      assert.ok(result.error, 'Should return error');
    });
  });

  describe('action: cancel', () => {
    // STEP5-10: Cancel execution
    test('STEP5-10: cancels execution', async () => {
      const clientId = getUniqueClientId();
      const plan = { id: 'p1', title: 'Test', tasks: [{ id: 't1', name: 'T1', agent: 'A' }] };

      await orchestrationApi({ action: 'start', projectPath: '/test', plan }, { clientId });
      const result = await orchestrationApi({ action: 'cancel' }, { clientId });

      assert.equal(result.status, 'cancelled', 'Status should be cancelled');
    });

    test('returns error when no active execution', async () => {
      const clientId = getUniqueClientId();
      const result = await orchestrationApi({ action: 'cancel' }, { clientId });

      assert.ok(result.error, 'Should return error');
    });
  });

  describe('action: status', () => {
    // STEP5-15: Get execution status
    test('STEP5-15: returns execution status', async () => {
      const clientId = getUniqueClientId();
      const plan = { id: 'p1', title: 'Test', tasks: [{ id: 't1', name: 'T1', agent: 'A' }] };

      await orchestrationApi({ action: 'start', projectPath: '/test', plan }, { clientId });
      const result = await orchestrationApi({ action: 'status' }, { clientId });

      assert.ok(result.status, 'Should have status');
      assert.ok(result.executionId, 'Should have executionId');
      assert.ok('progress' in result, 'Should have progress');
      assert.ok('completedTasks' in result, 'Should have completedTasks');
      assert.ok('totalTasks' in result, 'Should have totalTasks');
      assert.ok('agents' in result, 'Should have agents count');
      assert.ok('cost' in result, 'Should have cost');
    });

    test('returns idle status when no execution', async () => {
      const clientId = getUniqueClientId();
      const result = await orchestrationApi({ action: 'status' }, { clientId });

      assert.equal(result.status, 'idle', 'Status should be idle');
      assert.equal(result.hasSession, false, 'Should indicate no session');
    });
  });

  describe('unknown action', () => {
    test('returns error for unknown action', async () => {
      const clientId = getUniqueClientId();
      const result = await orchestrationApi({ action: 'unknown' }, { clientId });

      assert.ok(result.error);
      assert.ok(result.error.includes('Unknown'));
    });
  });
});
