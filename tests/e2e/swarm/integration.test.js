/**
 * SWARM Framework - Integration E2E Tests
 * Tests full workflow lifecycle across all phases
 *
 * Note: Individual modules are thoroughly tested in their own test files.
 * This file focuses on integration patterns and end-to-end workflows.
 */

import { describe, test, before, beforeEach, after } from 'node:test';
import assert from 'node:assert/strict';
import { rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// =============================================================================
// IMPORTS
// =============================================================================

// Configuration
import {
  loadConfigFromString,
  validateConfig,
  createBaselineConfig,
  createGasTownConfig,
  createCostOptimizedConfig,
  createDefaultWorkerProfile,
} from '../../../src/swarm/index.js';

// State Management
import {
  saveState,
  loadState,
  stateExists,
  WorkflowStateManager,
  serializeState,
  deserializeState,
} from '../../../src/swarm/index.js';

// Registry
import {
  ModuleRegistry,
  globalRegistry,
  createModule,
} from '../../../src/swarm/index.js';

// Types
import {
  createWorkflowState,
  createTaskDefinition,
  createTaskState,
  createAcceptanceCriterion,
  createExecutionContext,
  createWorkerProfile,
  TaskStatus,
  WorkflowStatus,
  ModuleType,
} from '../../../src/swarm/index.js';

// Orchestration Layer
import {
  createSingleShotPlanner,
  createIterativePlanner,
  registerPlanners,
  createFifoScheduler,
  createPriorityScheduler,
  registerSchedulers,
  createStaticRouter,
  createCapabilityRouter,
  registerRouters,
  createDeterministicJudge,
  registerJudges,
  registerOrchestrationModules,
} from '../../../src/swarm/index.js';

// Execution Layer
import {
  createMinimalContextBuilder,
  registerContextBuilders,
  MINIMAL_TOOLS,
  DEFAULT_BLOCKLIST,
  isBlocked,
  createMinimalSandbox,
  registerSandboxes,
  MemoryOperation,
  createEphemeralMemory,
  createFileBasedMemory,
  registerMemoryManagers,
} from '../../../src/swarm/index.js';

// Measurement Layer
import {
  TASK_COMPLETION_RATE,
  TASK_COMPLETION_TIME,
  MetricsCollector,
  CostStore,
  QualityStore,
  registerMeasurementModules,
} from '../../../src/swarm/index.js';

// Experiment Framework
import {
  tTest,
  validateExperiment,
  dryRun,
  mockExecuteWorkflow,
  createCorpus,
  registerCorpus,
  getCorpus,
  registerBuiltinCorpora,
  registerExperimentModules,
  createExperiment,
} from '../../../src/swarm/index.js';

// =============================================================================
// TEST HELPERS
// =============================================================================

async function createTempDir() {
  const dir = join(tmpdir(), `swarm-integration-${Date.now()}-${Math.random().toString(36).slice(2)}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

async function removeTempDir(dir) {
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}

function createTestContext(config) {
  const cfg = config || createBaselineConfig();
  const context = createExecutionContext(cfg);
  context._events = [];
  context.emit = (event) => context._events.push(event);
  return context;
}

function createTestTasks() {
  return [
    createTaskDefinition({
      id: 'task-1',
      name: 'Implement feature A',
      description: 'Add new feature A',
      requiredSkills: ['code-generation'],
    }),
    createTaskDefinition({
      id: 'task-2',
      name: 'Write tests',
      description: 'Write test suite',
      requiredSkills: ['test-writing'],
      dependencies: ['task-1'],
    }),
  ];
}

const plannerConfig = {
  implementation: 'single-shot',
  model: { provider: 'anthropic', name: 'claude-sonnet', temperature: 0.2, maxOutputTokens: 2048, contextWindow: 32000 },
  maxDecompositionDepth: 1,
  taskGranularity: 'medium',
  parallelismHint: 'parallel',
  contextBudget: 4000,
};

// =============================================================================
// CONFIGURATION VALIDATION
// =============================================================================

describe('SWARM Integration - Configuration', () => {
  test('all default configs are valid', () => {
    const baseline = createBaselineConfig();
    const gastown = createGasTownConfig();
    const costOpt = createCostOptimizedConfig();

    assert.ok(validateConfig(baseline).valid, 'Baseline config should be valid');
    assert.ok(validateConfig(gastown).valid, 'GasTown config should be valid');
    assert.ok(validateConfig(costOpt).valid, 'CostOptimized config should be valid');
  });

  test('configs have distinct characteristics', () => {
    const baseline = createBaselineConfig();
    const gastown = createGasTownConfig();
    const costOpt = createCostOptimizedConfig();

    // Different IDs
    const ids = [baseline.id, gastown.id, costOpt.id];
    assert.strictEqual(new Set(ids).size, 3, 'All configs should have unique IDs');

    // Different planners
    assert.notStrictEqual(
      baseline.orchestration.planner.implementation,
      gastown.orchestration.planner.implementation
    );

    // GasTown is parallelism-focused
    assert.ok(gastown.execution.maxConcurrentWorkers > baseline.execution.maxConcurrentWorkers);

    // CostOptimized uses minimal resources
    assert.strictEqual(costOpt.configuration.contextBuilder.implementation, 'minimal');
  });

  test('config loads from JSON string', () => {
    const configJson = JSON.stringify(createBaselineConfig());
    const loaded = loadConfigFromString(configJson);

    assert.ok(loaded.id);
    assert.ok(loaded.orchestration);
    assert.ok(loaded.execution);
  });

  test('invalid config reports errors', () => {
    const validation = validateConfig({ id: 'incomplete' });
    assert.ok(!validation.valid);
    assert.ok(validation.errors.length > 0);
  });
});

// =============================================================================
// STATE MANAGEMENT
// =============================================================================

describe('SWARM Integration - State Management', () => {
  let tempDir;

  before(async () => {
    tempDir = await createTempDir();
  });

  after(async () => {
    await removeTempDir(tempDir);
  });

  test('workflow state manager tracks lifecycle', () => {
    const manager = new WorkflowStateManager();

    // Start pending
    assert.strictEqual(manager.getStatus(), WorkflowStatus.PENDING);

    // Transition to running
    manager.setStatus(WorkflowStatus.RUNNING);
    assert.strictEqual(manager.getStatus(), WorkflowStatus.RUNNING);

    // Add and track tasks
    const tasks = createTestTasks();
    for (const task of tasks) {
      manager.addTask(task);
    }

    assert.strictEqual(manager.getAllTasks().length, 2);

    // Start and complete task
    manager.startTask('task-1', 'worker-1');
    const started = manager.getTask('task-1');
    assert.strictEqual(started.status, TaskStatus.EXECUTING);

    manager.completeTask('task-1', { success: true, output: 'done' }, 100);
    const completed = manager.getTask('task-1');
    assert.strictEqual(completed.status, TaskStatus.COMPLETED);

    // Complete workflow
    manager.setStatus(WorkflowStatus.COMPLETED);
    assert.strictEqual(manager.getStatus(), WorkflowStatus.COMPLETED);
  });

  test('state serializes and deserializes', () => {
    const manager = new WorkflowStateManager();
    manager.setStatus(WorkflowStatus.RUNNING);

    const tasks = createTestTasks();
    for (const task of tasks) {
      manager.addTask(task);
    }
    manager.startTask('task-1', 'worker-1');

    // Get and verify state
    const state = manager.getState();
    assert.strictEqual(state.status, WorkflowStatus.RUNNING);

    // serializeState returns an object with tasks as array entries
    const serialized = serializeState(state);
    assert.ok(typeof serialized === 'object');
    assert.strictEqual(serialized.status, WorkflowStatus.RUNNING);
    assert.ok(Array.isArray(serialized.tasks));
    assert.strictEqual(serialized.tasks.length, 2);

    // Deserialize back to WorkflowState (tasks become Map again)
    const restored = deserializeState(serialized);
    assert.strictEqual(restored.status, WorkflowStatus.RUNNING);
    assert.strictEqual(restored.tasks.size, 2);
  });

  test('state persists to file', async () => {
    const manager = new WorkflowStateManager();
    manager.setStatus(WorkflowStatus.RUNNING);

    const statePath = join(tempDir, 'workflow-state.json');
    await saveState(manager.getState(), statePath);

    assert.ok(await stateExists(statePath));

    const loaded = await loadState(statePath);
    assert.strictEqual(loaded.status, WorkflowStatus.RUNNING);
  });
});

// =============================================================================
// ORCHESTRATION LAYER
// =============================================================================

describe('SWARM Integration - Orchestration Layer', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerPlanners();
    registerSchedulers();
    registerRouters();
    registerJudges();
  });

  test('planner decomposes goals into tasks', async () => {
    const planner = createSingleShotPlanner();
    await planner.configure(plannerConfig);

    const context = createTestContext();
    const result = await planner.execute({
      goal: 'Implement a REST API endpoint',
    }, context);

    assert.ok(Array.isArray(result.tasks));
    assert.ok(result.tasks.length > 0);
    assert.ok(result.reasoning);
  });

  test('scheduler orders tasks correctly', async () => {
    const scheduler = createFifoScheduler();
    await scheduler.configure({ implementation: 'fifo', maxQueueSize: 100 });

    const tasks = createTestTasks().map((t) => createTaskState(t));
    const context = createTestContext();

    const result = await scheduler.execute({ tasks, availableWorkers: 1 }, context);

    // Only task-1 should be scheduled (task-2 depends on it)
    assert.strictEqual(result.scheduled.length, 1);
    assert.strictEqual(result.scheduled[0].task.id, 'task-1');
  });

  test('router assigns workers based on capabilities', async () => {
    const router = createCapabilityRouter();
    await router.configure({
      implementation: 'capability',
      capabilityThreshold: 0.5,
    });

    const task = createTaskDefinition({
      id: 'task-1',
      requiredSkills: ['code-generation'],
    });

    const workers = [
      {
        ...createWorkerProfile(),
        id: 'worker-1',
        capabilities: {
          skills: ['code-generation'],
          domainExpertise: ['web-development'],
          toolAccess: [],
        },
      },
      {
        ...createWorkerProfile(),
        id: 'worker-2',
        capabilities: {
          skills: ['test-writing'],
          domainExpertise: ['web-development'],
          toolAccess: [],
        },
      },
    ];

    const context = createTestContext();
    const result = await router.execute({ task, workers }, context);

    assert.strictEqual(result.selectedWorker.id, 'worker-1');
  });

  test('judge evaluates task completion', async () => {
    const judge = createDeterministicJudge();
    await judge.configure({
      implementation: 'deterministic',
      retryOnFailure: false,
      maxRetries: 0,
      rubric: { dimensions: [], passingThreshold: 0.7 },
    });

    const context = createTestContext();
    const task = createTaskDefinition({ id: 'task-1' });
    const result = await judge.execute({
      task,
      output: 'function test() { return true; }',
      testResults: { passed: true, failures: [] },
      lintResults: { passed: true, errors: [] },
    }, context);

    assert.ok(result.passed);
    assert.ok(result.score >= 0);
  });
});

// =============================================================================
// EXECUTION LAYER
// =============================================================================

describe('SWARM Integration - Execution Layer', () => {
  let tempDir;

  before(async () => {
    tempDir = await createTempDir();
    globalRegistry.clear();
    registerContextBuilders();
    registerSandboxes();
    registerMemoryManagers();
  });

  after(async () => {
    await removeTempDir(tempDir);
  });

  test('context builder produces constrained output', async () => {
    const builder = createMinimalContextBuilder();
    await builder.configure({
      implementation: 'minimal',
      maxTokens: 2000,
      includeProjectContext: false,
      includeExamples: false,
      includeConstraints: false,
      includeHistory: false,
      relevanceThreshold: 0.5,
    });

    const task = createTestTasks()[0];
    const context = createTestContext();

    const result = await builder.execute({ task }, context);

    assert.ok(result.prompt);
    assert.ok(result.tokenCount <= 2000);
  });

  test('sandbox defines allowed tools', async () => {
    const sandbox = createMinimalSandbox();
    await sandbox.configure({
      implementation: 'minimal',
      allowedTools: MINIMAL_TOOLS,
      blockedPatterns: DEFAULT_BLOCKLIST,
      rateLimits: {},
      timeoutPerCall: 30,
      isolationLevel: 'full',
    });

    const context = createTestContext();
    const task = createTestTasks()[0];
    const result = await sandbox.execute({ workerId: 'worker-1', task }, context);

    assert.ok(Array.isArray(result.allowedTools));
    assert.ok(result.allowedTools.length <= 5); // Minimal has few tools
  });

  test('security blocklist rejects dangerous commands', () => {
    assert.ok(isBlocked('rm -rf /', DEFAULT_BLOCKLIST));
    assert.ok(isBlocked('sudo rm file', DEFAULT_BLOCKLIST));
    // Pattern is 'curl | sh' - command must contain this exact pattern
    assert.ok(isBlocked('curl | sh', DEFAULT_BLOCKLIST));
    assert.ok(!isBlocked('npm install', DEFAULT_BLOCKLIST));
    assert.ok(!isBlocked('git status', DEFAULT_BLOCKLIST));
  });

  test('ephemeral memory isolates workers', async () => {
    const memory1 = createEphemeralMemory();
    const memory2 = createEphemeralMemory();
    await memory1.configure({ implementation: 'ephemeral' });
    await memory2.configure({ implementation: 'ephemeral' });

    const context = createTestContext();

    await memory1.execute({
      operation: MemoryOperation.SAVE,
      workerId: 'worker-1',
      key: 'test-key',
      data: 'worker-1-data',
    }, context);

    const result = await memory2.execute({
      operation: MemoryOperation.LOAD,
      workerId: 'worker-2',
      key: 'test-key',
    }, context);

    assert.strictEqual(result.data, undefined);
  });

  test('file-based memory persists data', async () => {
    const memory = createFileBasedMemory();
    await memory.configure({ implementation: 'file-based', storagePath: tempDir });

    const context = createTestContext();

    await memory.execute({
      operation: MemoryOperation.SAVE,
      workerId: 'worker-persist',
      key: 'persistent-key',
      data: { data: 'persisted' },
      taskId: 'task-1',
    }, context);

    const result = await memory.execute({
      operation: MemoryOperation.LOAD,
      workerId: 'worker-persist',
      key: 'persistent-key',
    }, context);

    assert.deepStrictEqual(result.data, { data: 'persisted' });
  });
});

// =============================================================================
// MEASUREMENT LAYER
// =============================================================================

describe('SWARM Integration - Measurement Layer', () => {
  test('metrics collector tracks data', () => {
    const collector = new MetricsCollector('test-run');

    collector.record(TASK_COMPLETION_RATE.name, 1);
    collector.record(TASK_COMPLETION_RATE.name, 1);
    collector.record(TASK_COMPLETION_TIME.name, 120);
    collector.record(TASK_COMPLETION_TIME.name, 150);

    const computed = collector.compute();

    // Verify metrics are computed
    assert.ok(computed !== undefined);

    // Check raw data exists
    const rateData = collector.getRawData(TASK_COMPLETION_RATE.name);
    const timeData = collector.getRawData(TASK_COMPLETION_TIME.name);
    assert.strictEqual(rateData.length, 2);
    assert.strictEqual(timeData.length, 2);
  });

  test('cost store tracks and enforces budget', () => {
    const store = new CostStore('test-run', 0.01); // Small budget

    // Use haiku - cheapest model ($0.25/1M input, $1.25/1M output)
    // 1000 input = $0.00025, 500 output = $0.000625, total = $0.000875
    store.record('haiku', 1000, 500);
    assert.ok(store.totalCost > 0);
    assert.ok(!store.isBudgetExceeded());

    // Exceed budget with larger token counts
    // 100000 input = $0.025, 50000 output = $0.0625, total = $0.0875
    store.record('haiku', 100000, 50000);
    assert.ok(store.isBudgetExceeded());
    assert.ok(store.getBudgetRemaining() <= 0);

    // Breakdown by model
    const status = store.getStatus();
    assert.ok(status.byModel['haiku']);
  });

  test('quality store aggregates assessments', () => {
    const store = new QualityStore('test-run');

    // record expects JudgeResult objects
    store.record({
      taskId: 'task-1',
      workerId: 'worker-1',
      passed: true,
      score: 0.87,
      dimensionScores: { correctness: 0.9, completeness: 0.85 },
    });
    store.record({
      taskId: 'task-2',
      workerId: 'worker-1',
      passed: true,
      score: 0.92,
      dimensionScores: { correctness: 0.95, completeness: 0.9 },
    });

    const overall = store.computeRunningScore();
    assert.ok(overall > 0);
    assert.ok(overall <= 1);

    const report = store.generateReport();
    assert.strictEqual(report.taskCount, 2);
    assert.strictEqual(report.passedCount, 2);
  });
});

// =============================================================================
// EXPERIMENT FRAMEWORK
// =============================================================================

describe('SWARM Integration - Experiment Framework', () => {
  test('experiment validates correctly', () => {
    const experiment = createExperiment({
      id: 'test-exp',
      name: 'Test Experiment',
      hypothesis: 'Testing the framework',
      independentVariables: [
        {
          path: 'orchestration.planner.implementation',
          values: ['single-shot', 'iterative'],
        },
      ],
      dependentVariables: [TASK_COMPLETION_RATE.name],
      controlConfig: createBaselineConfig(),
      taskSet: createTestTasks(),
      parameters: {
        runsPerConfiguration: 2,
        randomSeed: 42,
        timeoutPerRun: 30000,
      },
    });

    // validateExperiment returns array of errors (empty = valid)
    const errors = validateExperiment(experiment);
    assert.strictEqual(errors.length, 0, `Validation errors: ${errors.join(', ')}`);
  });

  test('dry run calculates correct totals', () => {
    const experiment = createExperiment({
      id: 'dry-run-test',
      name: 'Dry Run Test',
      hypothesis: 'Testing dry run',
      independentVariables: [
        {
          path: 'orchestration.planner.implementation',
          values: ['single-shot', 'iterative'],
        },
      ],
      dependentVariables: [TASK_COMPLETION_RATE.name],
      controlConfig: createBaselineConfig(),
      taskSet: createTestTasks(),
      parameters: {
        runsPerConfiguration: 3,
        randomSeed: 42,
        timeoutPerRun: 30000,
      },
    });

    const result = dryRun(experiment);

    assert.strictEqual(result.totalConfigurations, 2); // 2 planner types
    assert.strictEqual(result.matrix.configurations.length, 2);
    assert.strictEqual(result.totalRuns, 6); // 2 configs * 3 runs
  });

  test('mock execution produces metrics', async () => {
    const config = createBaselineConfig();
    const tasks = createTestTasks();

    const result = await mockExecuteWorkflow(config, tasks);

    assert.ok(result.success);
    assert.ok(result.metrics);
    assert.ok(result.metrics.total_cost !== undefined);
    assert.ok(result.metrics.task_completion_rate !== undefined);
  });

  test('statistical analysis works', () => {
    // Use clearly different groups to ensure significance
    const group1 = [10, 12, 11, 13, 9, 11];
    const group2 = [100, 110, 105, 108, 102, 95];

    const result = tTest(group1, group2);

    assert.ok(result.t !== undefined);
    assert.ok(result.pValue !== undefined);
    assert.ok(result.significant); // Should be significant with this large difference
  });

  test('task corpus management works', () => {
    registerBuiltinCorpora();

    const testCorpus = createCorpus({
      id: 'integration-corpus',
      name: 'Integration Test Corpus',
      description: 'Test corpus',
      tasks: createTestTasks(),
    });

    registerCorpus(testCorpus);

    const retrieved = getCorpus('integration-corpus');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.tasks.length, 2);
  });
});

// =============================================================================
// MODULE REGISTRY
// =============================================================================

describe('SWARM Integration - Module Registry', () => {
  test('registers and retrieves modules', () => {
    const registry = new ModuleRegistry();

    const testModule = createModule({
      id: 'test-module',
      type: ModuleType.PLANNER,
      execute: async () => ({ tasks: [] }),
    });

    registry.register(ModuleType.PLANNER, 'test', () => testModule);

    const retrieved = registry.get(ModuleType.PLANNER, 'test');
    assert.ok(retrieved);
    assert.strictEqual(retrieved.id, 'test-module');
  });

  test('layer registration populates registry', () => {
    // Layer registration functions use globalRegistry
    globalRegistry.clear();

    // Use individual register functions (synchronous)
    registerPlanners();
    registerSchedulers();
    registerRouters();
    registerJudges();
    registerMeasurementModules();
    registerExperimentModules();

    // Verify orchestration modules registered to globalRegistry
    assert.ok(globalRegistry.get(ModuleType.PLANNER, 'single-shot'));
    assert.ok(globalRegistry.get(ModuleType.PLANNER, 'iterative'));
    assert.ok(globalRegistry.get(ModuleType.SCHEDULER, 'fifo'));
    assert.ok(globalRegistry.get(ModuleType.SCHEDULER, 'priority'));
    assert.ok(globalRegistry.get(ModuleType.ROUTER, 'static'));
    assert.ok(globalRegistry.get(ModuleType.ROUTER, 'capability'));
    assert.ok(globalRegistry.get(ModuleType.JUDGE, 'deterministic'));
    assert.ok(globalRegistry.get(ModuleType.JUDGE, 'hybrid'));
  });
});

// =============================================================================
// END-TO-END WORKFLOW
// =============================================================================

describe('SWARM Integration - End-to-End Workflow', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerOrchestrationModules(globalRegistry);
  });

  test('complete task workflow', async () => {
    // 1. Configuration
    const config = createBaselineConfig();
    assert.ok(validateConfig(config).valid);

    // 2. State management
    const stateManager = new WorkflowStateManager();
    stateManager.setStatus(WorkflowStatus.RUNNING);

    // 3. Planning
    const planner = createSingleShotPlanner();
    await planner.configure(plannerConfig);

    const context = createTestContext(config);
    const planResult = await planner.execute({
      goal: 'Create a utility function',
    }, context);

    // 4. Add tasks to state
    for (const task of planResult.tasks) {
      stateManager.addTask(task);
    }

    // 5. Scheduling
    const scheduler = createFifoScheduler();
    await scheduler.configure({ implementation: 'fifo', maxQueueSize: 100 });

    const taskStates = stateManager.getAllTasks();
    const scheduleResult = await scheduler.execute({
      tasks: taskStates,
      availableWorkers: 1,
    }, context);

    assert.ok(scheduleResult.scheduled.length > 0);

    // 6. Measurement
    const metricsCollector = new MetricsCollector('workflow-run');
    const costStore = new CostStore('workflow-run', 10);

    // 7. Execute tasks (simulated)
    for (const taskState of scheduleResult.scheduled) {
      stateManager.startTask(taskState.task.id, 'worker-1');

      // Simulate work
      costStore.record('claude-haiku-4-20250514', 500, 200);
      metricsCollector.record(TASK_COMPLETION_TIME.name, 30);

      stateManager.completeTask(taskState.task.id, { success: true }, 500);
      metricsCollector.record(TASK_COMPLETION_RATE.name, 1);
    }

    // 8. Complete workflow
    stateManager.setStatus(WorkflowStatus.COMPLETED);

    // 9. Verify
    assert.strictEqual(stateManager.getStatus(), WorkflowStatus.COMPLETED);
    assert.ok(!costStore.isBudgetExceeded());

    const computed = metricsCollector.compute();
    assert.ok(computed !== undefined);

    // Verify raw data was recorded
    const rateData = metricsCollector.getRawData(TASK_COMPLETION_RATE.name);
    const timeData = metricsCollector.getRawData(TASK_COMPLETION_TIME.name);
    assert.ok(rateData.length > 0);
    assert.ok(timeData.length > 0);
  });

  test('workflow with parallel task scheduling', async () => {
    const scheduler = createPriorityScheduler();
    await scheduler.configure({
      implementation: 'priority',
      maxQueueSize: 100,
      priorityWeights: { urgency: 0.5, complexity: 0.3, dependencies: 0.2 },
    });

    // Create independent tasks (no dependencies)
    const tasks = [
      createTaskState(createTaskDefinition({ id: 't1', name: 'Task 1' })),
      createTaskState(createTaskDefinition({ id: 't2', name: 'Task 2' })),
      createTaskState(createTaskDefinition({ id: 't3', name: 'Task 3' })),
    ];

    const context = createTestContext();
    const result = await scheduler.execute({ tasks, availableWorkers: 3 }, context);

    // All should be scheduled in parallel
    assert.strictEqual(result.scheduled.length, 3);
    assert.strictEqual(result.queued.length, 0);
  });

  test('workflow with cost constraints', () => {
    const costStore = new CostStore('constrained-run', 0.001); // Very small budget

    let tasksCompleted = 0;
    while (!costStore.isBudgetExceeded() && tasksCompleted < 100) {
      costStore.record('claude-sonnet-4-20250514', 1000, 500);
      tasksCompleted++;
    }

    assert.ok(costStore.isBudgetExceeded());
    assert.ok(tasksCompleted < 100); // Should stop early
  });
});
