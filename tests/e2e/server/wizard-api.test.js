/**
 * @file E2E tests for wizard API (WIZ-01 to WIZ-09).
 * Tests wizard state management and navigation.
 */

import { test, describe, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const wizardApi = require('../../../src/server/api/wizard.cjs');

describe('Wizard API', () => {
  // Create unique client IDs for each test to ensure isolation
  let clientIdCounter = 0;
  const getUniqueClientId = () => `test-client-${Date.now()}-${++clientIdCounter}`;

  describe('WIZ-01: session isolation', () => {
    test('different clients have independent wizard states', () => {
      const client1 = getUniqueClientId();
      const client2 = getUniqueClientId();

      // Set different states for each client
      wizardApi({ action: 'setState', state: { projectPath: '/path/a' } }, { clientId: client1 });
      wizardApi({ action: 'setState', state: { projectPath: '/path/b' } }, { clientId: client2 });

      // Verify isolation
      const state1 = wizardApi({ action: 'getState' }, { clientId: client1 });
      const state2 = wizardApi({ action: 'getState' }, { clientId: client2 });

      assert.equal(state1.projectPath, '/path/a');
      assert.equal(state2.projectPath, '/path/b');
    });
  });

  describe('WIZ-02: getState', () => {
    test('returns full wizard state', () => {
      const clientId = getUniqueClientId();
      const state = wizardApi({ action: 'getState' }, { clientId });

      assert.ok('currentStep' in state, 'Should have currentStep');
      assert.ok('projectPath' in state, 'Should have projectPath');
      assert.ok('description' in state, 'Should have description');
      assert.ok('questions' in state, 'Should have questions');
      assert.ok('answers' in state, 'Should have answers');
      assert.ok('plan' in state, 'Should have plan');
      assert.ok('isExecuting' in state, 'Should have isExecuting');
    });

    test('returns initial state for new client', () => {
      const clientId = getUniqueClientId();
      const state = wizardApi({ action: 'getState' }, { clientId });

      assert.equal(state.currentStep, 1, 'Initial step should be 1');
      assert.equal(state.projectPath, null, 'Initial projectPath should be null');
      assert.equal(state.description, '', 'Initial description should be empty');
      assert.equal(state.isExecuting, false, 'Initial isExecuting should be false');
    });
  });

  describe('WIZ-03: setState', () => {
    test('merges state updates', () => {
      const clientId = getUniqueClientId();

      // Set initial values
      wizardApi({ action: 'setState', state: { projectPath: '/test' } }, { clientId });
      wizardApi({ action: 'setState', state: { description: 'Test feature' } }, { clientId });

      const state = wizardApi({ action: 'getState' }, { clientId });
      assert.equal(state.projectPath, '/test', 'projectPath should be set');
      assert.equal(state.description, 'Test feature', 'description should be set');
    });

    test('returns updated state', () => {
      const clientId = getUniqueClientId();
      const result = wizardApi({ action: 'setState', state: { projectPath: '/new' } }, { clientId });

      assert.equal(result.projectPath, '/new');
    });
  });

  describe('WIZ-04: getCurrentStep', () => {
    test('returns current step number', () => {
      const clientId = getUniqueClientId();
      const result = wizardApi({ action: 'getCurrentStep' }, { clientId });

      assert.ok('step' in result, 'Should have step property');
      assert.equal(result.step, 1, 'Initial step should be 1');
    });
  });

  describe('WIZ-05: navigate to completed steps', () => {
    test('can go back to previous steps', () => {
      const clientId = getUniqueClientId();

      // Advance to step 2 by completing step 1
      wizardApi({ action: 'setState', state: { projectPath: '/test' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 2 }, { clientId });

      // Go back to step 1
      const result = wizardApi({ action: 'goToStep', step: 1 }, { clientId });

      assert.equal(result.valid, true);
      assert.equal(result.step, 1);
    });
  });

  describe('WIZ-06: cannot skip ahead', () => {
    test('cannot jump more than 1 step forward', () => {
      const clientId = getUniqueClientId();

      // Try to jump from step 1 to step 3
      const result = wizardApi({ action: 'goToStep', step: 3 }, { clientId });

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('skip'), 'Error should mention skipping');
    });
  });

  describe('WIZ-07: step validation', () => {
    test('cannot advance from step 1 without projectPath', () => {
      const clientId = getUniqueClientId();

      // Try to go to step 2 without setting projectPath
      const result = wizardApi({ action: 'goToStep', step: 2 }, { clientId });

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('project'), 'Error should mention project');
    });

    test('cannot advance from step 2 without description', () => {
      const clientId = getUniqueClientId();

      // Complete step 1
      wizardApi({ action: 'setState', state: { projectPath: '/test' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 2 }, { clientId });

      // Try to go to step 3 without description
      const result = wizardApi({ action: 'goToStep', step: 3 }, { clientId });

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('description'), 'Error should mention description');
    });

    test('description must be at least 10 characters', () => {
      const clientId = getUniqueClientId();

      // Complete step 1
      wizardApi({ action: 'setState', state: { projectPath: '/test' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 2 }, { clientId });

      // Set short description
      wizardApi({ action: 'setState', state: { description: 'short' } }, { clientId });

      // Try to advance
      const result = wizardApi({ action: 'goToStep', step: 3 }, { clientId });

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('10'), 'Error should mention 10 characters');
    });

    test('can advance from step 3 (questions optional)', () => {
      const clientId = getUniqueClientId();

      // Complete steps 1 and 2
      wizardApi({ action: 'setState', state: { projectPath: '/test' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 2 }, { clientId });
      wizardApi({ action: 'setState', state: { description: 'A valid description for testing' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 3 }, { clientId });

      // Step 3 questions are optional, should be able to advance
      const result = wizardApi({ action: 'goToStep', step: 4 }, { clientId });

      assert.equal(result.valid, true);
    });

    test('cannot advance from step 4 without plan', () => {
      const clientId = getUniqueClientId();

      // Complete steps 1, 2, 3
      wizardApi({ action: 'setState', state: { projectPath: '/test' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 2 }, { clientId });
      wizardApi({ action: 'setState', state: { description: 'A valid description for testing' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 3 }, { clientId });
      wizardApi({ action: 'goToStep', step: 4 }, { clientId });

      // Try to go to step 5 without plan
      const result = wizardApi({ action: 'goToStep', step: 5 }, { clientId });

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('Plan'), 'Error should mention plan');
    });
  });

  describe('WIZ-08: reset', () => {
    test('resets to initial state', () => {
      const clientId = getUniqueClientId();

      // Set some state
      wizardApi({ action: 'setState', state: { projectPath: '/test', description: 'Test' } }, { clientId });
      wizardApi({ action: 'goToStep', step: 2 }, { clientId });

      // Reset
      const result = wizardApi({ action: 'reset' }, { clientId });

      assert.equal(result.currentStep, 1);
      assert.equal(result.projectPath, null);
      assert.equal(result.description, '');
    });
  });

  describe('WIZ-09: invalid step numbers', () => {
    test('returns error for step < 1', () => {
      const clientId = getUniqueClientId();
      const result = wizardApi({ action: 'goToStep', step: 0 }, { clientId });

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('Invalid'), 'Error should mention invalid');
    });

    test('returns error for step > 5', () => {
      const clientId = getUniqueClientId();
      const result = wizardApi({ action: 'goToStep', step: 6 }, { clientId });

      assert.equal(result.valid, false);
      assert.ok(result.error.includes('Invalid'), 'Error should mention invalid');
    });

    test('returns error for negative step', () => {
      const clientId = getUniqueClientId();
      const result = wizardApi({ action: 'goToStep', step: -1 }, { clientId });

      assert.equal(result.valid, false);
    });
  });

  describe('unknown action', () => {
    test('returns error for unknown action', () => {
      const clientId = getUniqueClientId();
      const result = wizardApi({ action: 'unknownAction' }, { clientId });

      assert.ok(result.error);
      assert.ok(result.error.includes('Unknown'));
    });
  });

  describe('default client handling', () => {
    test('uses default client when embed is missing', () => {
      // Call without embed parameter
      const state = wizardApi({ action: 'getState' });
      assert.ok(state.currentStep, 'Should return state with default client');
    });
  });
});
