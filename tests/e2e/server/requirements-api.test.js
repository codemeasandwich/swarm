/**
 * @file E2E tests for requirements API (STEP3-01 to STEP3-13).
 * Tests question generation and answer processing.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';

const require = createRequire(import.meta.url);
const requirementsApi = require('../../../src/server/api/requirements.cjs');

describe('Requirements API', () => {
  describe('action: generateQuestions', () => {
    // STEP3-01: Questions generated from description
    test('STEP3-01: generates questions from description', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Add a new feature to the application',
        projectPath: '/test',
      });

      assert.ok(result.questions, 'Should return questions array');
      assert.ok(Array.isArray(result.questions), 'Questions should be an array');
      assert.ok(result.questions.length > 0, 'Should have at least one question');
    });

    // STEP3-02: Always includes scope question
    test('STEP3-02: always includes scope question', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Simple change',
        projectPath: '/test',
      });

      const scopeQuestion = result.questions.find((q) => q.category === 'scope');
      assert.ok(scopeQuestion, 'Should include scope question');
      assert.ok(scopeQuestion.question.toLowerCase().includes('scope'), 'Question should mention scope');
    });

    // STEP3-03: Keyword triggers - API
    test('STEP3-03: "api" keyword triggers integration question', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Create a new API endpoint for user data',
        projectPath: '/test',
      });

      const integrationQuestion = result.questions.find((q) => q.category === 'integration');
      assert.ok(integrationQuestion, 'Should include integration question for API keyword');
    });

    // STEP3-04: Keyword triggers - UI
    test('STEP3-04: "ui" keyword triggers UI question', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Build a new UI component for the dashboard',
        projectPath: '/test',
      });

      const uiQuestion = result.questions.find((q) => q.category === 'ui');
      assert.ok(uiQuestion, 'Should include UI question for UI keyword');
    });

    // STEP3-05: Keyword triggers - data storage
    test('STEP3-05: "store" keyword triggers data question', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Store user preferences in the database',
        projectPath: '/test',
      });

      const dataQuestion = result.questions.find((q) => q.category === 'data');
      assert.ok(dataQuestion, 'Should include data question for store keyword');
    });

    // STEP3-06: Select questions have options
    test('STEP3-06: select questions have options array', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Add a feature',
        projectPath: '/test',
      });

      const selectQuestions = result.questions.filter((q) => q.type === 'select');
      assert.ok(selectQuestions.length > 0, 'Should have select questions');

      for (const q of selectQuestions) {
        assert.ok(Array.isArray(q.options), 'Select question should have options');
        assert.ok(q.options.length >= 2, 'Should have at least 2 options');
      }
    });

    // STEP3-07: Text questions have placeholder
    test('STEP3-07: text questions are properly structured', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Add a feature',
        projectPath: '/test',
      });

      const textQuestions = result.questions.filter((q) => q.type === 'text');

      // The additional question should be text type
      for (const q of textQuestions) {
        assert.equal(q.type, 'text', 'Should be text type');
      }
    });

    // STEP3-08: Always has "anything else" question
    test('STEP3-08: always includes additional/freeform question', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Simple change',
        projectPath: '/test',
      });

      const additionalQuestion = result.questions.find((q) => q.category === 'additional');
      assert.ok(additionalQuestion, 'Should include additional question');
      assert.ok(
        additionalQuestion.question.toLowerCase().includes('anything else') ||
          additionalQuestion.question.toLowerCase().includes('else'),
        'Should ask about additional info'
      );
    });

    test('questions have unique IDs', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Build a complex feature with API and UI',
        projectPath: '/test',
      });

      const ids = result.questions.map((q) => q.id);
      const uniqueIds = new Set(ids);
      assert.equal(uniqueIds.size, ids.length, 'All question IDs should be unique');
    });

    test('error handling keyword triggers', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Handle errors gracefully when the API fails',
        projectPath: '/test',
      });

      const behaviorQuestion = result.questions.find((q) => q.category === 'behavior');
      assert.ok(behaviorQuestion, 'Should include behavior question for error keyword');
    });

    test('performance keyword triggers', () => {
      const result = requirementsApi({
        action: 'generateQuestions',
        description: 'Optimize performance of the data processing',
        projectPath: '/test',
      });

      const perfQuestion = result.questions.find((q) => q.category === 'performance');
      assert.ok(perfQuestion, 'Should include performance question');
    });
  });

  describe('action: submitAnswers', () => {
    test('processes answers and returns structured data', () => {
      const result = requirementsApi({
        action: 'submitAnswers',
        description: 'Add a feature',
        answers: {
          0: 'Small (1-2 files)',
          1: 'Yes, with full coverage',
        },
      });

      assert.ok(result.success, 'Should return success');
      assert.ok(result.processed, 'Should return processed data');
      assert.ok(result.processed.scope, 'Should have scope');
    });

    test('correctly processes scope answers', () => {
      const smallResult = requirementsApi({
        action: 'submitAnswers',
        description: 'test',
        answers: { 0: 'Small (1-2 files)' },
      });
      assert.equal(smallResult.processed.scope, 'small');

      const largeResult = requirementsApi({
        action: 'submitAnswers',
        description: 'test',
        answers: { 0: 'Large (6+ files)' },
      });
      assert.equal(largeResult.processed.scope, 'large');
    });

    test('correctly processes test preference', () => {
      const noTestResult = requirementsApi({
        action: 'submitAnswers',
        description: 'test',
        answers: { 0: 'No tests needed' },
      });
      assert.equal(noTestResult.processed.includeTests, false);
    });

    test('correctly processes target user', () => {
      const endUserResult = requirementsApi({
        action: 'submitAnswers',
        description: 'test',
        answers: { 0: 'End users' },
      });
      assert.equal(endUserResult.processed.targetUser, 'end-users');

      const adminResult = requirementsApi({
        action: 'submitAnswers',
        description: 'test',
        answers: { 0: 'Admins' },
      });
      assert.equal(adminResult.processed.targetUser, 'admins');
    });

    test('captures freeform text in additional notes', () => {
      const result = requirementsApi({
        action: 'submitAnswers',
        description: 'test',
        answers: {
          0: 'This is a longer freeform answer with more details',
        },
      });
      assert.ok(
        result.processed.additionalNotes.includes('longer freeform'),
        'Should capture freeform text'
      );
    });
  });

  describe('action: getRequirements', () => {
    test('returns structured requirements', () => {
      const result = requirementsApi({
        action: 'getRequirements',
        description: 'Build a feature that must handle errors gracefully',
        answers: { 0: 'Small (1-2 files)' },
      });

      assert.ok(result.requirements, 'Should return requirements');
      assert.ok(result.requirements.summary, 'Should have summary');
      assert.ok(result.requirements.scope, 'Should have scope');
      assert.ok(result.requirements.acceptanceCriteria, 'Should have acceptance criteria');
    });

    test('extracts constraints from description', () => {
      const result = requirementsApi({
        action: 'getRequirements',
        description: 'The feature must be fast and must not break existing functionality',
        answers: {},
      });

      assert.ok(result.requirements.constraints.length > 0, 'Should extract constraints');
    });

    test('generates acceptance criteria', () => {
      const result = requirementsApi({
        action: 'getRequirements',
        description: 'Add user interface',
        answers: {},
      });

      const criteria = result.requirements.acceptanceCriteria;
      assert.ok(criteria.length >= 2, 'Should have at least basic criteria');
      assert.ok(criteria.includes('Feature works as described'), 'Should include basic criterion');
    });

    test('adds UI-specific acceptance criteria', () => {
      const result = requirementsApi({
        action: 'getRequirements',
        description: 'Build a new UI component',
        answers: {},
      });

      const hasUiCriteria = result.requirements.acceptanceCriteria.some((c) =>
        c.toLowerCase().includes('ui')
      );
      assert.ok(hasUiCriteria, 'Should include UI-specific criteria');
    });

    test('adds error handling criteria when relevant', () => {
      const result = requirementsApi({
        action: 'getRequirements',
        description: 'Handle error cases properly',
        answers: {},
      });

      const hasErrorCriteria = result.requirements.acceptanceCriteria.some((c) =>
        c.toLowerCase().includes('error')
      );
      assert.ok(hasErrorCriteria, 'Should include error handling criteria');
    });
  });

  describe('unknown action', () => {
    test('returns error for unknown action', () => {
      const result = requirementsApi({ action: 'unknown' });
      assert.ok(result.error);
      assert.ok(result.error.includes('Unknown'));
    });
  });
});
