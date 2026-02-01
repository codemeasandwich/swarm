/**
 * SWARM Framework - Orchestration Layer E2E Tests
 * Tests for Planner, Scheduler, Router, and Judge modules
 */

import { describe, test, beforeEach } from 'node:test';
import assert from 'node:assert/strict';

// Import SWARM modules
import {
  // Planner
  createSingleShotPlanner,
  createIterativePlanner,
  registerPlanners,
  // Scheduler
  createFifoScheduler,
  createPriorityScheduler,
  registerSchedulers,
  // Router
  createStaticRouter,
  createCapabilityRouter,
  registerRouters,
  // Judge
  createDeterministicJudge,
  createLlmJudge,
  createHybridJudge,
  registerJudges,
  // Types and helpers
  createTaskDefinition,
  createTaskState,
  createWorkerProfile,
  createExecutionContext,
  createBaselineConfig,
  globalRegistry,
  ModuleType,
  TaskStatus,
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

  // Override emit to capture events
  context.emit = (event) => {
    events.push(event);
  };

  // Add helper to get events
  context._events = events;

  return context;
}

// =============================================================================
// Planner Tests
// =============================================================================

describe('SWARM Planner Module', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerPlanners();
  });

  describe('Single-Shot Planner', () => {
    test('decomposes goal into tasks', async () => {
      const planner = createSingleShotPlanner();
      await planner.configure({
        implementation: 'single-shot',
        model: { provider: 'anthropic', name: 'claude-sonnet', temperature: 0.2, maxOutputTokens: 2048, contextWindow: 32000 },
        maxDecompositionDepth: 1,
        taskGranularity: 'medium',
        parallelismHint: 'parallel',
        contextBudget: 4000,
      });

      const context = createTestContext();
      const result = await planner.execute({ goal: 'Implement a REST API endpoint' }, context);

      assert(result.tasks.length > 0);
      assert(result.reasoning.includes('Implement a REST API endpoint'));
      assert(context._events.some((e) => e.eventType === 'plan.completed'));
    });

    test('creates more tasks with fine granularity', async () => {
      const planner = createSingleShotPlanner();
      await planner.configure({
        implementation: 'single-shot',
        model: { provider: 'anthropic', name: 'claude-sonnet', temperature: 0.2, maxOutputTokens: 2048, contextWindow: 32000 },
        maxDecompositionDepth: 1,
        taskGranularity: 'fine',
        parallelismHint: 'parallel',
        contextBudget: 4000,
      });

      const context = createTestContext();
      const result = await planner.execute({ goal: 'Build a feature' }, context);

      assert(result.tasks.length >= 5, `Expected at least 5 tasks for fine granularity, got ${result.tasks.length}`);
    });

    test('creates sequential dependencies with sequential hint', async () => {
      const planner = createSingleShotPlanner();
      await planner.configure({
        implementation: 'single-shot',
        model: { provider: 'anthropic', name: 'claude-sonnet', temperature: 0.2, maxOutputTokens: 2048, contextWindow: 32000 },
        maxDecompositionDepth: 1,
        taskGranularity: 'medium',
        parallelismHint: 'sequential',
        contextBudget: 4000,
      });

      const context = createTestContext();
      const result = await planner.execute({ goal: 'Sequential task' }, context);

      // Check that tasks after the first have dependencies
      for (let i = 1; i < result.tasks.length; i++) {
        assert(result.tasks[i].dependencies.length > 0, `Task ${i} should have dependencies`);
      }
    });

    test('throws error when not configured', async () => {
      const planner = createSingleShotPlanner();
      const context = createTestContext();

      await assert.rejects(planner.execute({ goal: 'test' }, context), /not configured/);
    });
  });

  describe('Iterative Planner', () => {
    test('decomposes goal iteratively', async () => {
      const planner = createIterativePlanner();
      await planner.configure({
        implementation: 'iterative',
        model: { provider: 'anthropic', name: 'claude-sonnet', temperature: 0.2, maxOutputTokens: 2048, contextWindow: 32000 },
        maxDecompositionDepth: 2,
        taskGranularity: 'medium',
        parallelismHint: 'mixed',
        contextBudget: 4000,
      });

      const context = createTestContext();
      const result = await planner.execute({ goal: 'Refactor authentication module' }, context);

      assert(result.tasks.length > 0);
      assert(result.reasoning.includes('Iteratively planned'));
      assert(context._events.some((e) => e.eventType === 'plan.completed' && e.payload.waves));
    });
  });

  describe('Planner Registration', () => {
    test('registers planners in global registry', () => {
      assert(globalRegistry.has(ModuleType.PLANNER, 'single-shot'));
      assert(globalRegistry.has(ModuleType.PLANNER, 'iterative'));
    });

    test('retrieves planner from registry', () => {
      const planner = globalRegistry.get(ModuleType.PLANNER, 'single-shot');
      assert.equal(planner.id, 'planner-single-shot');
    });
  });
});

// =============================================================================
// Scheduler Tests
// =============================================================================

describe('SWARM Scheduler Module', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerSchedulers();
  });

  describe('FIFO Scheduler', () => {
    test('queues tasks in order', async () => {
      const scheduler = createFifoScheduler();
      await scheduler.configure({
        implementation: 'fifo',
        maxQueueSize: 100,
      });

      const tasks = [
        createTaskState(createTaskDefinition({ id: 'task-1' })),
        createTaskState(createTaskDefinition({ id: 'task-2' })),
        createTaskState(createTaskDefinition({ id: 'task-3' })),
      ];

      const context = createTestContext();
      const result = await scheduler.execute({ tasks, availableWorkers: 2 }, context);

      assert.equal(result.scheduled.length, 2);
      assert.equal(result.queued.length, 1);
      assert.equal(result.scheduled[0].task.id, 'task-1');
      assert.equal(result.scheduled[1].task.id, 'task-2');
    });

    test('respects dependencies', async () => {
      const scheduler = createFifoScheduler();
      await scheduler.configure({
        implementation: 'fifo',
        maxQueueSize: 100,
      });

      const tasks = [
        createTaskState(createTaskDefinition({ id: 'task-1', dependencies: [] })),
        createTaskState(createTaskDefinition({ id: 'task-2', dependencies: ['task-1'] })),
      ];

      const context = createTestContext();
      const result = await scheduler.execute({ tasks, availableWorkers: 10 }, context);

      // Only task-1 should be scheduled since task-2 depends on it
      assert.equal(result.scheduled.length, 1);
      assert.equal(result.scheduled[0].task.id, 'task-1');
    });

    test('schedules dependent task after dependency completes', async () => {
      const scheduler = createFifoScheduler();
      await scheduler.configure({
        implementation: 'fifo',
        maxQueueSize: 100,
      });

      const tasks = [
        { ...createTaskState(createTaskDefinition({ id: 'task-1', dependencies: [] })), status: TaskStatus.COMPLETED },
        createTaskState(createTaskDefinition({ id: 'task-2', dependencies: ['task-1'] })),
      ];

      const context = createTestContext();
      const result = await scheduler.execute({ tasks, availableWorkers: 10 }, context);

      // Now task-2 should be scheduled
      assert.equal(result.scheduled.length, 1);
      assert.equal(result.scheduled[0].task.id, 'task-2');
    });

    test('enforces queue size limit', async () => {
      const scheduler = createFifoScheduler();
      await scheduler.configure({
        implementation: 'fifo',
        maxQueueSize: 2,
      });

      const tasks = Array.from({ length: 10 }, (_, i) =>
        createTaskState(createTaskDefinition({ id: `task-${i}` }))
      );

      const context = createTestContext();
      const result = await scheduler.execute({ tasks, availableWorkers: 1 }, context);

      assert.equal(result.scheduled.length, 1);
      assert.equal(result.queued.length, 2); // Limited by maxQueueSize
    });
  });

  describe('Priority Scheduler', () => {
    test('schedules by priority weights', async () => {
      const scheduler = createPriorityScheduler();
      await scheduler.configure({
        implementation: 'priority',
        maxQueueSize: 100,
        priorityWeights: {
          urgency: 0.5,
          complexity: 0.3,
          dependencies: 0.2,
        },
      });

      const tasks = [
        createTaskState(createTaskDefinition({ id: 'low-priority', timeout: 600, estimatedComplexity: 'simple' })),
        createTaskState(createTaskDefinition({ id: 'high-priority', timeout: 60, estimatedComplexity: 'complex' })),
      ];

      const context = createTestContext();
      const result = await scheduler.execute({ tasks, availableWorkers: 1 }, context);

      // High-priority task (lower timeout = higher urgency) should be first
      assert.equal(result.scheduled[0].task.id, 'high-priority');
    });

    test('uses default weights when not provided', async () => {
      const scheduler = createPriorityScheduler();
      await scheduler.configure({
        implementation: 'priority',
        maxQueueSize: 100,
      });

      const tasks = [
        createTaskState(createTaskDefinition({ id: 'task-1' })),
        createTaskState(createTaskDefinition({ id: 'task-2' })),
      ];

      const context = createTestContext();
      const result = await scheduler.execute({ tasks, availableWorkers: 2 }, context);

      assert.equal(result.scheduled.length, 2);
    });
  });

  describe('Scheduler Registration', () => {
    test('registers schedulers in global registry', () => {
      assert(globalRegistry.has(ModuleType.SCHEDULER, 'fifo'));
      assert(globalRegistry.has(ModuleType.SCHEDULER, 'priority'));
    });
  });
});

// =============================================================================
// Router Tests
// =============================================================================

describe('SWARM Router Module', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerRouters();
  });

  describe('Static Router', () => {
    test('routes using static mapping', async () => {
      const router = createStaticRouter();
      await router.configure({
        implementation: 'static',
        staticMapping: {
          'code-generation': 'worker-coder',
          'test-writing': 'worker-tester',
        },
      });

      const task = createTaskDefinition({ id: 'task-1', type: 'code-generation' });
      const workers = [
        { ...createWorkerProfile(), id: 'worker-coder', name: 'Coder' },
        { ...createWorkerProfile(), id: 'worker-tester', name: 'Tester' },
      ];

      const context = createTestContext();
      const result = await router.execute({ task, workers }, context);

      assert.equal(result.selectedWorker.id, 'worker-coder');
      assert.equal(result.matchScore, 1.0);
    });

    test('falls back to first worker when no mapping', async () => {
      const router = createStaticRouter();
      await router.configure({
        implementation: 'static',
      });

      const task = createTaskDefinition({ id: 'task-1', type: 'unknown-type' });
      const workers = [createWorkerProfile()];

      const context = createTestContext();
      const result = await router.execute({ task, workers }, context);

      assert(result.selectedWorker);
      assert.equal(result.matchScore, 0.5);
      assert(result.reason.includes('Fallback'));
    });

    test('returns null when no workers available', async () => {
      const router = createStaticRouter();
      await router.configure({
        implementation: 'static',
      });

      const task = createTaskDefinition({ id: 'task-1' });

      const context = createTestContext();
      const result = await router.execute({ task, workers: [] }, context);

      assert.equal(result.selectedWorker, null);
      assert.equal(result.matchScore, 0);
    });
  });

  describe('Capability Router', () => {
    test('matches tasks to workers by skills', async () => {
      const router = createCapabilityRouter();
      await router.configure({
        implementation: 'capability',
        capabilityThreshold: 0.5,
      });

      const task = createTaskDefinition({
        id: 'task-1',
        requiredSkills: ['code-generation', 'debugging'],
        toolRequirements: ['file-editor'],
      });

      const workers = [
        {
          ...createWorkerProfile(),
          id: 'worker-1',
          capabilities: {
            skills: ['code-review'], // Wrong skills
            domainExpertise: [],
            toolAccess: ['file-editor'],
          },
        },
        {
          ...createWorkerProfile(),
          id: 'worker-2',
          capabilities: {
            skills: ['code-generation', 'debugging'], // Matching skills
            domainExpertise: [],
            toolAccess: ['file-editor'],
          },
        },
      ];

      const context = createTestContext();
      const result = await router.execute({ task, workers }, context);

      assert.equal(result.selectedWorker.id, 'worker-2');
      assert(result.matchScore > 0.5);
    });

    test('warns when best worker is below threshold', async () => {
      const router = createCapabilityRouter();
      await router.configure({
        implementation: 'capability',
        capabilityThreshold: 0.9,
      });

      const task = createTaskDefinition({
        id: 'task-1',
        requiredSkills: ['code-generation', 'debugging', 'security-analysis'],
      });

      const workers = [
        {
          ...createWorkerProfile(),
          id: 'worker-1',
          capabilities: {
            skills: ['code-generation'], // Only 1 of 3 skills
            domainExpertise: [],
            toolAccess: [],
          },
        },
      ];

      const context = createTestContext();
      const result = await router.execute({ task, workers }, context);

      assert(result.selectedWorker);
      assert(result.matchScore < 0.9);
      assert(result.reason.includes('below threshold'));
      assert(context._events.some((e) => e.level === 'warn'));
    });

    test('handles task with no required skills', async () => {
      const router = createCapabilityRouter();
      await router.configure({
        implementation: 'capability',
        capabilityThreshold: 0.5,
      });

      const task = createTaskDefinition({
        id: 'task-1',
        requiredSkills: [],
        toolRequirements: [],
      });

      const workers = [createWorkerProfile()];

      const context = createTestContext();
      const result = await router.execute({ task, workers }, context);

      assert.equal(result.matchScore, 1.0); // Perfect match when no requirements
    });
  });

  describe('Router Registration', () => {
    test('registers routers in global registry', () => {
      assert(globalRegistry.has(ModuleType.ROUTER, 'static'));
      assert(globalRegistry.has(ModuleType.ROUTER, 'capability'));
    });
  });
});

// =============================================================================
// Judge Tests
// =============================================================================

describe('SWARM Judge Module', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerJudges();
  });

  describe('Deterministic Judge', () => {
    test('passes when tests pass', async () => {
      const judge = createDeterministicJudge();
      await judge.configure({
        implementation: 'deterministic',
        retryOnFailure: true,
        maxRetries: 2,
        rubric: { dimensions: [], passingThreshold: 0.7 },
      });

      const task = createTaskDefinition({ id: 'task-1' });
      const context = createTestContext();

      const result = await judge.execute(
        {
          task,
          output: 'Generated code',
          testResults: { passed: true, failures: [] },
          lintResults: { passed: true, errors: [] },
        },
        context
      );

      assert.equal(result.passed, true);
      assert(result.score >= 0.7);
      assert(context._events.some((e) => e.eventType === 'judge.passed'));
    });

    test('fails when tests fail', async () => {
      const judge = createDeterministicJudge();
      await judge.configure({
        implementation: 'deterministic',
        retryOnFailure: true,
        maxRetries: 2,
        rubric: { dimensions: [], passingThreshold: 0.7 },
      });

      const task = createTaskDefinition({ id: 'task-1' });
      const context = createTestContext();

      const result = await judge.execute(
        {
          task,
          output: 'Generated code',
          testResults: { passed: false, failures: ['test-1', 'test-2'] },
          lintResults: { passed: true, errors: [] },
        },
        context
      );

      assert.equal(result.passed, false);
      assert(result.feedback.some((f) => f.includes('Tests failed')));
      assert.equal(result.shouldRetry, true);
      assert(context._events.some((e) => e.eventType === 'judge.failed'));
    });

    test('provides feedback on lint errors', async () => {
      const judge = createDeterministicJudge();
      await judge.configure({
        implementation: 'deterministic',
        retryOnFailure: false,
        maxRetries: 0,
        rubric: { dimensions: [], passingThreshold: 0.5 },
      });

      const task = createTaskDefinition({ id: 'task-1' });
      const context = createTestContext();

      const result = await judge.execute(
        {
          task,
          output: 'code',
          testResults: { passed: true, failures: [] },
          lintResults: { passed: false, errors: ['unused-var', 'no-console'] },
        },
        context
      );

      assert(result.feedback.some((f) => f.includes('Lint errors')));
    });

    test('fails when no output produced', async () => {
      const judge = createDeterministicJudge();
      await judge.configure({
        implementation: 'deterministic',
        retryOnFailure: false,
        maxRetries: 0,
        rubric: { dimensions: [], passingThreshold: 0.7 },
      });

      const task = createTaskDefinition({ id: 'task-1' });
      const context = createTestContext();

      const result = await judge.execute(
        {
          task,
          output: null,
          testResults: { passed: true, failures: [] },
        },
        context
      );

      assert(result.feedback.some((f) => f.includes('No output')));
    });
  });

  describe('LLM Judge', () => {
    test('evaluates with rubric dimensions', async () => {
      const judge = createLlmJudge();
      await judge.configure({
        implementation: 'llm-eval',
        retryOnFailure: true,
        maxRetries: 1,
        model: { provider: 'anthropic', name: 'claude-sonnet', temperature: 0.1, maxOutputTokens: 1024, contextWindow: 16000 },
        rubric: {
          dimensions: [
            { name: 'correctness', weight: 0.4, criteria: 'Code produces expected output' },
            { name: 'maintainability', weight: 0.3, criteria: 'Code is readable' },
            { name: 'completeness', weight: 0.3, criteria: 'All requirements met' },
          ],
          passingThreshold: 0.7,
        },
      });

      const task = createTaskDefinition({ id: 'task-1' });
      const context = createTestContext();

      const result = await judge.execute(
        {
          task,
          output: 'Good quality code',
          testResults: { passed: true, failures: [] },
        },
        context
      );

      // Check that rubric dimensions are in breakdown
      assert('correctness' in result.breakdown);
      assert('maintainability' in result.breakdown);
      assert('completeness' in result.breakdown);
    });
  });

  describe('Hybrid Judge', () => {
    test('fails fast when tests fail (hard gate)', async () => {
      const judge = createHybridJudge();
      await judge.configure({
        implementation: 'hybrid',
        retryOnFailure: true,
        maxRetries: 2,
        rubric: {
          dimensions: [
            { name: 'quality', weight: 1.0, criteria: 'Overall quality' },
          ],
          passingThreshold: 0.5,
        },
      });

      const task = createTaskDefinition({ id: 'task-1' });
      const context = createTestContext();

      const result = await judge.execute(
        {
          task,
          output: 'Code',
          testResults: { passed: false, failures: ['critical-test'] },
        },
        context
      );

      assert.equal(result.passed, false);
      assert(result.feedback.some((f) => f.includes('Hard gate failed')));
    });

    test('passes through to LLM evaluation when tests pass', async () => {
      const judge = createHybridJudge();
      await judge.configure({
        implementation: 'hybrid',
        retryOnFailure: false,
        maxRetries: 0,
        rubric: {
          dimensions: [
            { name: 'quality', weight: 1.0, criteria: 'Overall quality' },
          ],
          passingThreshold: 0.6,
        },
      });

      const task = createTaskDefinition({ id: 'task-1' });
      const context = createTestContext();

      const result = await judge.execute(
        {
          task,
          output: 'Good code',
          testResults: { passed: true, failures: [] },
          lintResults: { passed: true, errors: [] },
        },
        context
      );

      // Should have LLM quality dimension
      assert('quality' in result.breakdown);
    });
  });

  describe('Judge Registration', () => {
    test('registers judges in global registry', () => {
      assert(globalRegistry.has(ModuleType.JUDGE, 'deterministic'));
      assert(globalRegistry.has(ModuleType.JUDGE, 'llm-eval'));
      assert(globalRegistry.has(ModuleType.JUDGE, 'hybrid'));
    });
  });
});

// =============================================================================
// Module Metrics Tests
// =============================================================================

describe('SWARM Orchestration Module Metrics', () => {
  test('planner tracks execution metrics', async () => {
    const planner = createSingleShotPlanner();
    await planner.configure({
      implementation: 'single-shot',
      model: { provider: 'anthropic', name: 'claude-sonnet', temperature: 0.2, maxOutputTokens: 2048, contextWindow: 32000 },
      maxDecompositionDepth: 1,
      taskGranularity: 'coarse',
      parallelismHint: 'parallel',
      contextBudget: 4000,
    });

    const context = createTestContext();
    await planner.execute({ goal: 'Task 1' }, context);
    await planner.execute({ goal: 'Task 2' }, context);

    const metrics = planner.getMetrics();
    assert.equal(metrics.executionCount, 2);
    assert(metrics.totalDuration >= 0); // May be 0 for very fast executions
  });

  test('scheduler tracks execution metrics', async () => {
    const scheduler = createFifoScheduler();
    await scheduler.configure({
      implementation: 'fifo',
      maxQueueSize: 100,
    });

    const context = createTestContext();
    const tasks = [createTaskState(createTaskDefinition({ id: 'task-1' }))];

    await scheduler.execute({ tasks, availableWorkers: 1 }, context);

    const metrics = scheduler.getMetrics();
    assert.equal(metrics.executionCount, 1);
  });

  test('router tracks execution metrics', async () => {
    const router = createCapabilityRouter();
    await router.configure({
      implementation: 'capability',
      capabilityThreshold: 0.5,
    });

    const context = createTestContext();
    const task = createTaskDefinition({ id: 'task-1' });
    const workers = [createWorkerProfile()];

    await router.execute({ task, workers }, context);

    const metrics = router.getMetrics();
    assert.equal(metrics.executionCount, 1);
  });

  test('judge tracks execution metrics', async () => {
    const judge = createDeterministicJudge();
    await judge.configure({
      implementation: 'deterministic',
      retryOnFailure: false,
      maxRetries: 0,
      rubric: { dimensions: [], passingThreshold: 0.5 },
    });

    const context = createTestContext();
    const task = createTaskDefinition({ id: 'task-1' });

    await judge.execute(
      {
        task,
        output: 'code',
        testResults: { passed: true, failures: [] },
      },
      context
    );

    const metrics = judge.getMetrics();
    assert.equal(metrics.executionCount, 1);
  });
});
