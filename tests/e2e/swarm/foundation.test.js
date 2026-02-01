/**
 * SWARM Framework - Foundation E2E Tests
 * Tests for types, config, state, and registry modules
 */

import { describe, test, before, after, beforeEach } from 'node:test';
import assert from 'node:assert/strict';
import { writeFile, rm, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import SWARM modules
import {
  // Config
  loadConfig,
  loadConfigFromString,
  applyConfigOverrides,
  getNestedValue,
  setNestedValue,
  validateConfig,
  createBaselineConfig,
  createGasTownConfig,
  createCostOptimizedConfig,
  getDefaultConfig,
  createDefaultWorkerProfile,

  // State
  saveState,
  loadState,
  stateExists,
  getStateFilePath,
  WorkflowStateManager,
  serializeState,
  deserializeState,

  // Registry
  ModuleRegistry,
  globalRegistry,
  createModule,

  // Types
  createWorkflowState,
  createTaskDefinition,
  createTaskState,
  createAcceptanceCriterion,
  createContextRequirement,
  createModuleMetrics,
  createWorkerProfile,
  createWorkerInstance,
  createExecutionContext,
  createTraceEvent,
  createTraceSpan,
  createExperiment,
  createDescriptiveStats,
  createExperimentProgress,
  createModelSpec,
  createRetryPolicy,
  TaskStatus,
  WorkflowStatus,
  ModuleType,
  TraceEventType,
  LogLevel,
  TraceLevel,
  IsolationLevel,
} from '../../../src/swarm/index.js';

// =============================================================================
// Test Helpers
// =============================================================================

/**
 * Create a temporary directory for tests
 * @returns {Promise<string>}
 */
async function createTempDir() {
  const dir = join(tmpdir(), `swarm-test-${Date.now()}`);
  await mkdir(dir, { recursive: true });
  return dir;
}

/**
 * Remove a temporary directory
 * @param {string} dir
 */
async function removeTempDir(dir) {
  if (existsSync(dir)) {
    await rm(dir, { recursive: true, force: true });
  }
}

// =============================================================================
// Configuration Tests
// =============================================================================

describe('SWARM Configuration', () => {
  /** @type {string} */
  let tempDir;

  before(async () => {
    tempDir = await createTempDir();
  });

  after(async () => {
    await removeTempDir(tempDir);
  });

  describe('loadConfig', () => {
    test('loads valid workflow configuration from JSON file', async () => {
      const config = createBaselineConfig();
      const filePath = join(tempDir, 'config.json');
      await writeFile(filePath, JSON.stringify(config, null, 2));

      const loaded = await loadConfig(filePath);

      assert.equal(loaded.id, config.id);
      assert.equal(loaded.name, config.name);
      assert.equal(loaded.orchestration.planner.implementation, 'single-shot');
    });

    test('throws error for non-existent file', async () => {
      await assert.rejects(
        loadConfig(join(tempDir, 'nonexistent.json')),
        /Configuration file not found/
      );
    });

    test('throws error for invalid JSON', async () => {
      const filePath = join(tempDir, 'invalid.json');
      await writeFile(filePath, '{ invalid json }');

      await assert.rejects(loadConfig(filePath), /Invalid JSON/);
    });
  });

  describe('loadConfigFromString', () => {
    test('parses valid JSON string', () => {
      const config = createBaselineConfig();
      const loaded = loadConfigFromString(JSON.stringify(config));

      assert.equal(loaded.id, config.id);
    });

    test('throws error for invalid JSON string', () => {
      assert.throws(() => loadConfigFromString('not json'), /Invalid JSON/);
    });
  });

  describe('applyConfigOverrides', () => {
    test('merges override values into base config', () => {
      const base = createBaselineConfig();
      const overrides = {
        id: 'custom-id',
        orchestration: {
          planner: {
            implementation: 'iterative',
          },
        },
      };

      const result = applyConfigOverrides(base, overrides);

      assert.equal(result.id, 'custom-id');
      assert.equal(result.orchestration.planner.implementation, 'iterative');
      // Original values preserved
      assert.equal(result.orchestration.scheduler.implementation, 'fifo');
    });
  });

  describe('getNestedValue and setNestedValue', () => {
    test('gets nested values using dot notation', () => {
      const config = createBaselineConfig();

      assert.equal(
        getNestedValue(config, 'orchestration.planner.implementation'),
        'single-shot'
      );
      assert.equal(getNestedValue(config, 'constraints.maxTotalCost'), 50);
    });

    test('returns undefined for non-existent paths', () => {
      const config = createBaselineConfig();

      assert.equal(getNestedValue(config, 'nonexistent.path'), undefined);
    });

    test('sets nested values using dot notation', () => {
      const obj = { a: { b: { c: 1 } } };

      setNestedValue(obj, 'a.b.c', 2);
      assert.equal(obj.a.b.c, 2);

      setNestedValue(obj, 'a.b.d', 3);
      assert.equal(obj.a.b.d, 3);
    });
  });
});

// =============================================================================
// Validation Tests
// =============================================================================

describe('SWARM Configuration Validation', () => {
  test('validates valid baseline configuration', () => {
    const config = createBaselineConfig();
    const result = validateConfig(config);

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test('validates valid gas-town configuration', () => {
    const config = createGasTownConfig();
    const result = validateConfig(config);

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test('validates valid cost-optimized configuration', () => {
    const config = createCostOptimizedConfig();
    const result = validateConfig(config);

    assert.equal(result.valid, true);
    assert.equal(result.errors.length, 0);
  });

  test('reports error for missing required fields', () => {
    const result = validateConfig({});

    assert.equal(result.valid, false);
    assert(result.errors.length > 0);
    assert(result.errors.some((e) => e.path === 'id'));
    assert(result.errors.some((e) => e.path === 'name'));
  });

  test('reports error for invalid enum values', () => {
    const config = createBaselineConfig();
    config.orchestration.planner.implementation = 'invalid-implementation';

    const result = validateConfig(config);

    assert.equal(result.valid, false);
    assert(
      result.errors.some(
        (e) =>
          e.path === 'orchestration.planner.implementation' &&
          e.message.includes('Invalid implementation')
      )
    );
  });

  test('reports error for invalid numeric values', () => {
    const config = createBaselineConfig();
    config.constraints.qualityThreshold = 2.0; // Should be 0-1

    const result = validateConfig(config);

    assert.equal(result.valid, false);
    assert(
      result.errors.some(
        (e) =>
          e.path === 'constraints.qualityThreshold' &&
          e.message.includes('between 0 and 1')
      )
    );
  });

  test('reports warning for high concurrency', () => {
    const config = createBaselineConfig();
    config.execution.maxConcurrentWorkers = 50;

    const result = validateConfig(config);

    assert(result.warnings.length > 0);
    assert(
      result.warnings.some((w) => w.path === 'execution.maxConcurrentWorkers')
    );
  });

  test('validates model specification', () => {
    const config = createBaselineConfig();
    config.orchestration.planner.model.temperature = 5.0; // Invalid

    const result = validateConfig(config);

    assert.equal(result.valid, false);
    assert(
      result.errors.some(
        (e) =>
          e.path === 'orchestration.planner.model.temperature' &&
          e.message.includes('between 0 and 2')
      )
    );
  });
});

// =============================================================================
// Default Configurations Tests
// =============================================================================

describe('SWARM Default Configurations', () => {
  test('createDefaultWorkerProfile returns valid profile', () => {
    const profile = createDefaultWorkerProfile();

    assert.equal(profile.id, 'worker-default');
    assert.equal(profile.model.provider, 'anthropic');
    assert(profile.capabilities.skills.length > 0);
    assert.equal(profile.operational.episodicReset, true);
  });

  test('getDefaultConfig returns correct configurations', () => {
    const baseline = getDefaultConfig('baseline');
    assert.equal(baseline.id, 'baseline');

    const gasTown = getDefaultConfig('gas-town');
    assert.equal(gasTown.id, 'gas-town');

    const costOptimized = getDefaultConfig('cost-optimized');
    assert.equal(costOptimized.id, 'cost-optimized');
  });

  test('getDefaultConfig throws for unknown config', () => {
    assert.throws(() => getDefaultConfig('unknown'), /Unknown default configuration/);
  });

  test('baseline config has single worker', () => {
    const config = createBaselineConfig();

    assert.equal(config.execution.maxConcurrentWorkers, 1);
    assert.equal(config.orchestration.planner.parallelismHint, 'sequential');
  });

  test('gas-town config is optimized for parallelism', () => {
    const config = createGasTownConfig();

    assert.equal(config.execution.maxConcurrentWorkers, 20);
    assert.equal(config.orchestration.planner.parallelismHint, 'parallel');
    assert.equal(config.orchestration.planner.implementation, 'hierarchical');
    assert(config.execution.workerProfiles.length > 1);
  });

  test('cost-optimized config uses cheaper model', () => {
    const config = createCostOptimizedConfig();

    assert(config.orchestration.planner.model.name.includes('haiku'));
    assert.equal(config.configuration.contextBuilder.implementation, 'minimal');
  });
});

// =============================================================================
// State Persistence Tests
// =============================================================================

describe('SWARM State Persistence', () => {
  /** @type {string} */
  let tempDir;

  before(async () => {
    tempDir = await createTempDir();
  });

  after(async () => {
    await removeTempDir(tempDir);
  });

  test('saves and loads workflow state', async () => {
    const state = createWorkflowState();
    state.status = WorkflowStatus.EXECUTING;
    state.totalTokensUsed = 1000;
    state.totalCost = 0.05;

    const filePath = join(tempDir, 'state.json');
    await saveState(state, filePath);

    const loaded = await loadState(filePath);

    assert.equal(loaded.status, WorkflowStatus.EXECUTING);
    assert.equal(loaded.totalTokensUsed, 1000);
    assert.equal(loaded.totalCost, 0.05);
  });

  test('serializes and deserializes Maps correctly', async () => {
    const state = createWorkflowState();
    const task = createTaskDefinition({ id: 'task-1', description: 'Test task' });
    state.tasks.set(task.id, { task, status: TaskStatus.PENDING, attempts: [] });

    const serialized = serializeState(state);
    const deserialized = deserializeState(serialized);

    assert(deserialized.tasks instanceof Map);
    assert(deserialized.tasks.has('task-1'));
    assert.equal(deserialized.tasks.get('task-1').task.description, 'Test task');
  });

  test('creates directory if it does not exist', async () => {
    const state = createWorkflowState();
    const deepPath = join(tempDir, 'deep', 'nested', 'state.json');

    await saveState(state, deepPath);

    assert(existsSync(deepPath));
  });

  test('stateExists returns correct value', async () => {
    const state = createWorkflowState();
    const filePath = join(tempDir, 'exists-test.json');

    assert.equal(stateExists(filePath), false);

    await saveState(state, filePath);

    assert.equal(stateExists(filePath), true);
  });

  test('getStateFilePath generates correct path', () => {
    const path = getStateFilePath('/base', 'workflow-1', 'run-1');

    assert.equal(path, '/base/workflow-1/run-1/state.json');
  });

  test('throws error for non-existent state file', async () => {
    await assert.rejects(
      loadState(join(tempDir, 'nonexistent-state.json')),
      /State file not found/
    );
  });
});

// =============================================================================
// WorkflowStateManager Tests
// =============================================================================

describe('SWARM WorkflowStateManager', () => {
  test('creates with default state', () => {
    const manager = new WorkflowStateManager();
    const state = manager.getState();

    assert.equal(state.status, WorkflowStatus.PENDING);
    assert(state.tasks instanceof Map);
    assert(state.workers instanceof Map);
  });

  test('creates with initial state', () => {
    const initial = createWorkflowState();
    initial.status = WorkflowStatus.EXECUTING;

    const manager = new WorkflowStateManager(initial);

    assert.equal(manager.getStatus(), WorkflowStatus.EXECUTING);
  });

  describe('task management', () => {
    test('adds and retrieves tasks', () => {
      const manager = new WorkflowStateManager();
      const task = createTaskDefinition({ id: 'task-1' });

      manager.addTask(task);

      const retrieved = manager.getTask('task-1');
      assert(retrieved);
      assert.equal(retrieved.task.id, 'task-1');
      assert.equal(retrieved.status, TaskStatus.PENDING);
    });

    test('adds multiple tasks', () => {
      const manager = new WorkflowStateManager();
      const tasks = [
        createTaskDefinition({ id: 'task-1' }),
        createTaskDefinition({ id: 'task-2' }),
      ];

      manager.addTasks(tasks);

      assert.equal(manager.getAllTasks().length, 2);
    });

    test('gets tasks by status', () => {
      const manager = new WorkflowStateManager();
      manager.addTask(createTaskDefinition({ id: 'task-1' }));
      manager.addTask(createTaskDefinition({ id: 'task-2' }));
      manager.setTaskStatus('task-1', TaskStatus.COMPLETED);

      const pending = manager.getTasksByStatus(TaskStatus.PENDING);
      const completed = manager.getTasksByStatus(TaskStatus.COMPLETED);

      assert.equal(pending.length, 1);
      assert.equal(completed.length, 1);
    });

    test('gets available tasks with satisfied dependencies', () => {
      const manager = new WorkflowStateManager();
      manager.addTask(createTaskDefinition({ id: 'task-1', dependencies: [] }));
      manager.addTask(createTaskDefinition({ id: 'task-2', dependencies: ['task-1'] }));

      // Initially only task-1 is available
      let available = manager.getAvailableTasks();
      assert.equal(available.length, 1);
      assert.equal(available[0].task.id, 'task-1');

      // Complete task-1, now task-2 is available
      manager.setTaskStatus('task-1', TaskStatus.COMPLETED);
      available = manager.getAvailableTasks();
      assert.equal(available.length, 1);
      assert.equal(available[0].task.id, 'task-2');
    });

    test('tracks task completion with result', () => {
      const manager = new WorkflowStateManager();
      manager.addTask(createTaskDefinition({ id: 'task-1' }));
      manager.startTask('task-1', 'worker-1');

      const result = {
        success: true,
        output: 'done',
        qualityScore: 0.9,
        qualityBreakdown: { correctness: 0.9 },
        artifacts: [],
      };

      manager.completeTask('task-1', result, 500);

      const task = manager.getTask('task-1');
      assert.equal(task.status, TaskStatus.COMPLETED);
      assert.equal(task.result.qualityScore, 0.9);
      assert.equal(manager.getTotalTokensUsed(), 500);
    });

    test('tracks task failure', () => {
      const manager = new WorkflowStateManager();
      manager.addTask(createTaskDefinition({ id: 'task-1' }));
      manager.startTask('task-1', 'worker-1');
      manager.failTask('task-1', 'Something went wrong', 100);

      const task = manager.getTask('task-1');
      assert.equal(task.status, TaskStatus.FAILED);
      assert.equal(task.attempts[0].error, 'Something went wrong');
    });
  });

  describe('worker management', () => {
    test('adds and retrieves workers', () => {
      const manager = new WorkflowStateManager();
      const worker = manager.addWorker('profile-1');

      assert(worker.id);
      assert.equal(worker.profileId, 'profile-1');
      assert.equal(worker.status, 'idle');

      const retrieved = manager.getWorker(worker.id);
      assert.equal(retrieved.profileId, 'profile-1');
    });

    test('gets idle workers', () => {
      const manager = new WorkflowStateManager();
      const w1 = manager.addWorker('profile-1');
      const w2 = manager.addWorker('profile-1');
      manager.setWorkerStatus(w1.id, 'working');

      const idle = manager.getIdleWorkers();
      assert.equal(idle.length, 1);
      assert.equal(idle[0].id, w2.id);
    });

    test('tracks worker completion with metrics', () => {
      const manager = new WorkflowStateManager();
      const worker = manager.addWorker('profile-1');
      manager.assignWorkerToTask(worker.id, 'task-1');
      manager.completeWorker(worker.id, 500, 0.85);

      const updated = manager.getWorker(worker.id);
      assert.equal(updated.status, 'completed');
      assert.equal(updated.metrics.tasksCompleted, 1);
      assert.equal(updated.metrics.totalTokensUsed, 500);
      assert.equal(updated.metrics.averageQualityScore, 0.85);
    });
  });

  describe('error management', () => {
    test('adds and retrieves errors', () => {
      const manager = new WorkflowStateManager();

      manager.addError({
        error: 'Test error',
        taskId: 'task-1',
        recoverable: true,
      });

      const errors = manager.getErrors();
      assert.equal(errors.length, 1);
      assert.equal(errors[0].error, 'Test error');
      assert(errors[0].timestamp);
    });
  });

  describe('summary statistics', () => {
    test('calculates workflow summary', () => {
      const manager = new WorkflowStateManager();

      manager.addTask(createTaskDefinition({ id: 'task-1' }));
      manager.addTask(createTaskDefinition({ id: 'task-2' }));
      manager.addTask(createTaskDefinition({ id: 'task-3' }));

      manager.completeTask('task-1', { success: true, output: '', qualityScore: 0.8, qualityBreakdown: {}, artifacts: [] }, 100);
      manager.completeTask('task-2', { success: true, output: '', qualityScore: 0.9, qualityBreakdown: {}, artifacts: [] }, 100);
      manager.failTask('task-3', 'Failed', 50);

      manager.addCost(0.05);

      const summary = manager.getSummary();

      assert.equal(summary.totalTasks, 3);
      assert.equal(summary.completedTasks, 2);
      assert.equal(summary.failedTasks, 1);
      assert.equal(summary.totalTokens, 250);
      assert.equal(summary.totalCost, 0.05);
      assert(Math.abs(summary.averageQuality - 0.85) < 0.0001);
    });
  });
});

// =============================================================================
// Module Registry Tests
// =============================================================================

describe('SWARM Module Registry', () => {
  /** @type {ModuleRegistry} */
  let registry;

  beforeEach(() => {
    registry = new ModuleRegistry();
  });

  test('registers and retrieves modules', () => {
    const mockModule = createModule({
      id: 'test-planner',
      version: '1.0.0',
      type: ModuleType.PLANNER,
      configure: async () => {},
      execute: async () => ({ tasks: [] }),
    });

    registry.register(ModuleType.PLANNER, 'test', () => mockModule);

    const retrieved = registry.get(ModuleType.PLANNER, 'test');
    assert.equal(retrieved.id, 'test-planner');
  });

  test('caches module instances', () => {
    let createCount = 0;
    registry.register(ModuleType.PLANNER, 'cached', () => {
      createCount++;
      return createModule({
        id: `planner-${createCount}`,
        version: '1.0.0',
        type: ModuleType.PLANNER,
        configure: async () => {},
        execute: async () => ({}),
      });
    });

    const first = registry.get(ModuleType.PLANNER, 'cached');
    const second = registry.get(ModuleType.PLANNER, 'cached');

    assert.equal(first, second);
    assert.equal(createCount, 1);
  });

  test('throws error for duplicate registration', () => {
    registry.register(ModuleType.PLANNER, 'dup', () => ({}));

    assert.throws(
      () => registry.register(ModuleType.PLANNER, 'dup', () => ({})),
      /already registered/
    );
  });

  test('throws error for unregistered module', () => {
    assert.throws(
      () => registry.get(ModuleType.PLANNER, 'nonexistent'),
      /not registered/
    );
  });

  test('checks if module is registered', () => {
    registry.register(ModuleType.SCHEDULER, 'fifo', () => ({}));

    assert.equal(registry.has(ModuleType.SCHEDULER, 'fifo'), true);
    assert.equal(registry.has(ModuleType.SCHEDULER, 'priority'), false);
  });

  test('lists implementations for a type', () => {
    registry.register(ModuleType.SCHEDULER, 'fifo', () => ({}));
    registry.register(ModuleType.SCHEDULER, 'priority', () => ({}));
    registry.register(ModuleType.PLANNER, 'single-shot', () => ({}));

    const schedulers = registry.list(ModuleType.SCHEDULER);

    assert.equal(schedulers.length, 2);
    assert(schedulers.includes('fifo'));
    assert(schedulers.includes('priority'));
  });

  test('lists all registered modules', () => {
    registry.register(ModuleType.SCHEDULER, 'fifo', () => ({}));
    registry.register(ModuleType.PLANNER, 'single-shot', () => ({}));

    const all = registry.listAll();

    assert.equal(all.length, 2);
    assert(all.some((m) => m.type === 'scheduler' && m.implementation === 'fifo'));
    assert(all.some((m) => m.type === 'planner' && m.implementation === 'single-shot'));
  });

  test('unregisters modules', () => {
    registry.register(ModuleType.SCHEDULER, 'fifo', () => ({}));
    registry.get(ModuleType.SCHEDULER, 'fifo'); // Create instance

    registry.unregister(ModuleType.SCHEDULER, 'fifo');

    assert.equal(registry.has(ModuleType.SCHEDULER, 'fifo'), false);
  });

  test('clears instances but keeps factories', () => {
    let createCount = 0;
    registry.register(ModuleType.PLANNER, 'test', () => {
      createCount++;
      return {};
    });

    registry.get(ModuleType.PLANNER, 'test');
    assert.equal(createCount, 1);

    registry.clearInstances();
    registry.get(ModuleType.PLANNER, 'test');
    assert.equal(createCount, 2);
  });

  test('clears everything', () => {
    registry.register(ModuleType.PLANNER, 'test', () => ({}));
    registry.get(ModuleType.PLANNER, 'test');

    registry.clear();

    assert.equal(registry.size, 0);
    assert.equal(registry.has(ModuleType.PLANNER, 'test'), false);
  });

  test('tracks module metrics', async () => {
    const module = createModule({
      id: 'metrics-test',
      version: '1.0.0',
      type: ModuleType.PLANNER,
      configure: async () => {},
      execute: async () => ({ result: 'done' }),
    });

    await module.execute({}, /** @type {any} */ ({}));
    await module.execute({}, /** @type {any} */ ({}));

    const metrics = module.getMetrics();

    assert.equal(metrics.executionCount, 2);
    assert(metrics.totalDuration >= 0);
  });

  test('tracks module errors', async () => {
    const module = createModule({
      id: 'error-test',
      version: '1.0.0',
      type: ModuleType.PLANNER,
      configure: async () => {},
      execute: async () => {
        throw new Error('Test error');
      },
    });

    await assert.rejects(module.execute({}, /** @type {any} */ ({})), /Test error/);

    const metrics = module.getMetrics();
    assert.equal(metrics.errorCount, 1);
  });

  test('resets module metrics', async () => {
    const module = createModule({
      id: 'reset-test',
      version: '1.0.0',
      type: ModuleType.PLANNER,
      configure: async () => {},
      execute: async () => ({}),
    });

    await module.execute({}, /** @type {any} */ ({}));
    await module.reset();

    const metrics = module.getMetrics();
    assert.equal(metrics.executionCount, 0);
  });
});

describe('SWARM Global Registry', () => {
  beforeEach(() => {
    globalRegistry.clear();
  });

  test('globalRegistry is a ModuleRegistry instance', () => {
    assert(globalRegistry instanceof ModuleRegistry);
  });

  test('globalRegistry can register and retrieve modules', () => {
    globalRegistry.register(ModuleType.JUDGE, 'deterministic', () =>
      createModule({
        id: 'det-judge',
        version: '1.0.0',
        type: ModuleType.JUDGE,
        configure: async () => {},
        execute: async () => ({ passed: true }),
      })
    );

    const judge = globalRegistry.get(ModuleType.JUDGE, 'deterministic');
    assert.equal(judge.id, 'det-judge');
  });
});

// =============================================================================
// Type Factory Tests (for 100% coverage)
// =============================================================================

describe('SWARM Type Factories', () => {
  describe('foundation types', () => {
    test('createModelSpec creates model with defaults and overrides', () => {
      const defaultModel = createModelSpec();
      assert.equal(defaultModel.provider, 'anthropic');
      assert.equal(defaultModel.temperature, 0.3);

      const customModel = createModelSpec({ temperature: 0.5, name: 'custom' });
      assert.equal(customModel.temperature, 0.5);
      assert.equal(customModel.name, 'custom');
    });

    test('createRetryPolicy creates policy with defaults and overrides', () => {
      const defaultPolicy = createRetryPolicy();
      assert.equal(defaultPolicy.maxRetries, 2);
      assert.equal(defaultPolicy.backoffStrategy, 'exponential');

      const customPolicy = createRetryPolicy({ maxRetries: 5 });
      assert.equal(customPolicy.maxRetries, 5);
    });
  });

  describe('task types', () => {
    test('createTaskState creates state from task', () => {
      const task = createTaskDefinition({ id: 'test-task' });
      const state = createTaskState(task);

      assert.equal(state.task.id, 'test-task');
      assert.equal(state.status, TaskStatus.PENDING);
      assert.deepEqual(state.attempts, []);
    });

    test('createAcceptanceCriterion creates criterion with defaults', () => {
      const criterion = createAcceptanceCriterion();
      assert.equal(criterion.type, 'deterministic');
      assert.equal(criterion.weight, 1.0);

      const custom = createAcceptanceCriterion({ type: 'llm-evaluated', weight: 0.5 });
      assert.equal(custom.type, 'llm-evaluated');
      assert.equal(custom.weight, 0.5);
    });

    test('createContextRequirement creates requirement with defaults', () => {
      const requirement = createContextRequirement();
      assert.equal(requirement.type, 'file');
      assert.equal(requirement.required, false);

      const custom = createContextRequirement({ type: 'directory', required: true });
      assert.equal(custom.type, 'directory');
      assert.equal(custom.required, true);
    });
  });

  describe('module types', () => {
    test('createModuleMetrics creates empty metrics', () => {
      const metrics = createModuleMetrics();
      assert.equal(metrics.executionCount, 0);
      assert.equal(metrics.totalDuration, 0);
      assert.equal(metrics.errorCount, 0);
      assert.deepEqual(metrics.customMetrics, {});
    });
  });

  describe('workflow types', () => {
    test('createWorkerProfile creates profile with defaults', () => {
      const profile = createWorkerProfile();
      assert(profile.id.startsWith('worker-'));
      assert.equal(profile.model.provider, 'anthropic');
      assert(profile.capabilities.skills.length > 0);
    });

    test('createWorkerInstance creates instance with unique id', () => {
      const instance1 = createWorkerInstance('profile-1');
      const instance2 = createWorkerInstance('profile-1');

      assert(instance1.id.startsWith('instance-'));
      assert.notEqual(instance1.id, instance2.id);
      assert.equal(instance1.profileId, 'profile-1');
      assert.equal(instance1.status, 'idle');
    });

    test('createExecutionContext creates context with emit and metric functions', () => {
      const config = createBaselineConfig();
      const context = createExecutionContext(config);

      assert.equal(context.workflowId, config.id);
      assert(context.runId.startsWith('run-'));
      assert.equal(typeof context.emit, 'function');

      context.setMetric('test', 42);
      assert.equal(context.getMetric('test'), 42);
      assert.equal(context.getMetric('nonexistent'), undefined);
    });
  });

  describe('trace types', () => {
    test('createTraceEvent creates event with defaults', () => {
      const event = createTraceEvent(TraceEventType.TASK_STARTED, 'run-123');

      assert.equal(event.eventType, TraceEventType.TASK_STARTED);
      assert.equal(event.runId, 'run-123');
      assert.equal(event.level, LogLevel.INFO);
      assert(event.timestamp > 0);
    });

    test('createTraceSpan creates span with unique id', () => {
      const span = createTraceSpan('test-span');

      assert(span.id.startsWith('span-'));
      assert.equal(span.name, 'test-span');
      assert(span.startTime > 0);
      assert.deepEqual(span.events, []);
    });
  });

  describe('experiment types', () => {
    test('createExperiment creates experiment with defaults', () => {
      const exp = createExperiment();

      assert(exp.id.startsWith('exp-'));
      assert.equal(exp.name, 'Unnamed Experiment');
      assert(exp.dependentVariables.includes('task_completion_rate'));
      assert.equal(exp.parameters.runsPerConfiguration, 3);
    });

    test('createDescriptiveStats creates empty stats', () => {
      const stats = createDescriptiveStats();

      assert.equal(stats.mean, 0);
      assert.equal(stats.stdDev, 0);
      assert.equal(stats.n, 0);
    });

    test('createExperimentProgress creates progress with defaults', () => {
      const progress = createExperimentProgress();

      assert.equal(progress.totalConfigurations, 0);
      assert.equal(progress.completedRuns, 0);
    });
  });
});

// =============================================================================
// Additional Validation Tests (for 100% coverage)
// =============================================================================

describe('SWARM Validation - Additional Coverage', () => {
  test('validates missing orchestration layer', () => {
    const config = createBaselineConfig();
    delete config.orchestration;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'orchestration'));
  });

  test('validates missing configuration layer', () => {
    const config = createBaselineConfig();
    delete config.configuration;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'configuration'));
  });

  test('validates missing execution layer', () => {
    const config = createBaselineConfig();
    delete config.execution;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'execution'));
  });

  test('validates missing measurement layer', () => {
    const config = createBaselineConfig();
    delete config.measurement;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'measurement'));
  });

  test('validates missing constraints', () => {
    const config = createBaselineConfig();
    delete config.constraints;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'constraints'));
  });

  test('validates null config', () => {
    const result = validateConfig(null);
    assert.equal(result.valid, false);
  });

  test('validates missing planner model fields', () => {
    const config = createBaselineConfig();
    config.orchestration.planner.model = {
      provider: 'anthropic',
      name: '',
      temperature: 0.5,
      maxOutputTokens: -1,
      contextWindow: 0,
    };

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path.includes('model.name')));
    assert(result.errors.some((e) => e.path.includes('maxOutputTokens')));
    assert(result.errors.some((e) => e.path.includes('contextWindow')));
  });

  test('validates invalid tracer sample rate', () => {
    const config = createBaselineConfig();
    config.measurement.tracer.sampleRate = 1.5;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path.includes('sampleRate')));
  });

  test('validates empty worker profiles', () => {
    const config = createBaselineConfig();
    config.execution.workerProfiles = [];

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path.includes('workerProfiles')));
  });

  test('validates negative maxConcurrentWorkers', () => {
    const config = createBaselineConfig();
    config.execution.maxConcurrentWorkers = -1;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid worker selection strategy', () => {
    const config = createBaselineConfig();
    config.execution.workerSelectionStrategy = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates negative constraints', () => {
    const config = createBaselineConfig();
    config.constraints.maxTotalTokens = -1;
    config.constraints.maxTotalCost = -1;
    config.constraints.maxTotalRuntime = -1;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.length >= 3);
  });

  test('validates invalid metrics export format', () => {
    const config = createBaselineConfig();
    config.measurement.metrics.exportFormat = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid tracer trace level', () => {
    const config = createBaselineConfig();
    config.measurement.tracer.traceLevel = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid quality aggregation method', () => {
    const config = createBaselineConfig();
    config.measurement.qualityAssessor.aggregationMethod = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid tool sandbox isolation level', () => {
    const config = createBaselineConfig();
    config.configuration.toolSandbox.isolationLevel = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates missing context builder max tokens', () => {
    const config = createBaselineConfig();
    config.configuration.contextBuilder.maxTokens = 0;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates missing planner model', () => {
    const config = createBaselineConfig();
    delete config.orchestration.planner.model;

    const result = validateConfig(config);
    // Should still be valid since model is optional for some planners
    assert.equal(result.valid, true);
  });

  test('validates missing planner', () => {
    const config = createBaselineConfig();
    delete config.orchestration.planner;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'orchestration.planner'));
  });

  test('validates missing scheduler', () => {
    const config = createBaselineConfig();
    delete config.orchestration.scheduler;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'orchestration.scheduler'));
  });

  test('validates missing router', () => {
    const config = createBaselineConfig();
    delete config.orchestration.router;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'orchestration.router'));
  });

  test('validates missing judge', () => {
    const config = createBaselineConfig();
    delete config.orchestration.judge;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'orchestration.judge'));
  });

  test('validates missing context builder', () => {
    const config = createBaselineConfig();
    delete config.configuration.contextBuilder;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'configuration.contextBuilder'));
  });

  test('validates missing tool sandbox', () => {
    const config = createBaselineConfig();
    delete config.configuration.toolSandbox;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'configuration.toolSandbox'));
  });

  test('validates missing memory manager', () => {
    const config = createBaselineConfig();
    delete config.configuration.memoryManager;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'configuration.memoryManager'));
  });

  test('validates missing security guardrail', () => {
    const config = createBaselineConfig();
    delete config.configuration.securityGuardrail;

    const result = validateConfig(config);
    assert.equal(result.valid, false);
    assert(result.errors.some((e) => e.path === 'configuration.securityGuardrail'));
  });

  test('validates invalid tool sandbox implementation', () => {
    const config = createBaselineConfig();
    config.configuration.toolSandbox.implementation = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid memory manager implementation', () => {
    const config = createBaselineConfig();
    config.configuration.memoryManager.implementation = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid security guardrail implementation', () => {
    const config = createBaselineConfig();
    config.configuration.securityGuardrail.implementation = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid scheduler implementation', () => {
    const config = createBaselineConfig();
    config.orchestration.scheduler.implementation = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid router implementation', () => {
    const config = createBaselineConfig();
    config.orchestration.router.implementation = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid judge implementation', () => {
    const config = createBaselineConfig();
    config.orchestration.judge.implementation = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });

  test('validates invalid model provider', () => {
    const config = createBaselineConfig();
    config.orchestration.planner.model.provider = 'invalid';

    const result = validateConfig(config);
    assert.equal(result.valid, false);
  });
});

// =============================================================================
// Additional WorkflowStateManager Tests (for 100% coverage)
// =============================================================================

describe('SWARM WorkflowStateManager - Additional Coverage', () => {
  test('setStatus marks completion time when completed', () => {
    const manager = new WorkflowStateManager();
    manager.setStatus(WorkflowStatus.COMPLETED);

    const state = manager.getState();
    assert.equal(state.status, WorkflowStatus.COMPLETED);
    assert(state.completedAt);
  });

  test('setStatus marks completion time when failed', () => {
    const manager = new WorkflowStateManager();
    manager.setStatus(WorkflowStatus.FAILED);

    const state = manager.getState();
    assert.equal(state.status, WorkflowStatus.FAILED);
    assert(state.completedAt);
  });

  test('setTaskStatus handles non-existent task', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.setTaskStatus('nonexistent', TaskStatus.COMPLETED);
  });

  test('assignTask handles non-existent task', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.assignTask('nonexistent', 'worker-1');
  });

  test('startTask handles non-existent task', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.startTask('nonexistent', 'worker-1');
  });

  test('completeTask handles non-existent task', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.completeTask('nonexistent', { success: true }, 100);
  });

  test('failTask handles non-existent task', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.failTask('nonexistent', 'error', 100);
  });

  test('setWorkerStatus handles non-existent worker', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.setWorkerStatus('nonexistent', 'working');
  });

  test('assignWorkerToTask handles non-existent worker', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.assignWorkerToTask('nonexistent', 'task-1');
  });

  test('completeWorker handles non-existent worker', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.completeWorker('nonexistent', 100, 0.9);
  });

  test('failWorker handles non-existent worker', () => {
    const manager = new WorkflowStateManager();
    // Should not throw
    manager.failWorker('nonexistent');
  });

  test('getSummary handles empty workflow', () => {
    const manager = new WorkflowStateManager();
    const summary = manager.getSummary();

    assert.equal(summary.totalTasks, 0);
    assert.equal(summary.averageQuality, 0);
  });

  test('getSummary calculates runtime for incomplete workflow', () => {
    const manager = new WorkflowStateManager();
    manager.addTask(createTaskDefinition({ id: 'task-1' }));

    const summary = manager.getSummary();
    assert(summary.totalRuntime >= 0);
  });
});
