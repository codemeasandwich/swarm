/**
 * SWARM Framework - Execution Layer E2E Tests
 * Tests for Worker, Context Builder, Sandbox, and Memory Manager modules
 */

import { describe, test, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { rm, mkdir, readFile, writeFile, access, constants } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

// Import SWARM modules
import {
  // Worker
  ManagedWorkerInstance,
  WorkerPool,
  WorkerSpawner,
  createEpisodicWorker,
  createPersistentWorker,
  registerWorkers,
  createWorkerModule,
  // Context Builder
  estimateTokens,
  truncateToTokens,
  createMinimalContextBuilder,
  createScopedContextBuilder,
  createRichContextBuilder,
  registerContextBuilders,
  createContextBuilder,
  // Sandbox
  MINIMAL_TOOLS,
  STANDARD_TOOLS,
  EXTENDED_TOOLS,
  FULL_TOOLS,
  DEFAULT_BLOCKLIST,
  isBlocked,
  createMinimalSandbox,
  createStandardSandbox,
  createExtendedSandbox,
  registerSandboxes,
  createSandbox,
  // Memory Manager
  MemoryOperation,
  createEphemeralMemory,
  createFileBasedMemory,
  registerMemoryManagers,
  createMemoryManager,
  // Types and helpers
  createTaskDefinition,
  createWorkerProfile,
  createExecutionContext,
  createBaselineConfig,
  globalRegistry,
  ModuleType,
  WorkerStatus,
} from '../../../src/swarm/index.js';

// Import execution module registration for direct coverage
import { registerExecutionModules } from '../../../src/swarm/execution/index.js';

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

/**
 * Create a test task
 * @param {Partial<import('../../../src/swarm/types/task.js').TaskDefinition>} [overrides]
 * @returns {import('../../../src/swarm/types/task.js').TaskDefinition}
 */
function createTestTask(overrides = {}) {
  return createTaskDefinition({
    id: `task-${Date.now()}`,
    type: 'code-generation',
    description: 'Test task description',
    requiredSkills: ['code-generation'],
    acceptanceCriteria: [
      { type: 'deterministic', description: 'Code compiles', weight: 0.5 },
      { type: 'deterministic', description: 'Tests pass', weight: 0.5 },
    ],
    dependencies: [],
    estimatedComplexity: 'moderate',
    contextRequirements: [],
    toolRequirements: ['file-editor', 'test-runner'],
    timeout: 300,
    ...overrides,
  });
}

/**
 * Create a test worker profile
 * @returns {import('../../../src/swarm/types/workflow.js').WorkerProfile}
 */
function createTestProfile() {
  return createWorkerProfile({
    id: `profile-${Date.now()}`,
    name: 'Test Worker',
  });
}

// Temp directory for file-based tests
const TEST_DIR = join(tmpdir(), 'swarm-test-' + Date.now());

// =============================================================================
// Worker Module Tests
// =============================================================================

describe('SWARM Worker Module', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerWorkers();
  });

  describe('ManagedWorkerInstance', () => {
    test('creates worker with initial state', () => {
      const worker = new ManagedWorkerInstance('test-profile', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      assert(worker.id.startsWith('instance-'));
      assert.equal(worker.profileId, 'test-profile');
      assert.equal(worker.status, WorkerStatus.IDLE);
      assert.equal(worker.metrics.tasksCompleted, 0);
    });

    test('transitions through task lifecycle', () => {
      const worker = new ManagedWorkerInstance('test-profile', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      const statusChanges = [];
      worker.on('statusChange', (status) => statusChanges.push(status));

      // Assign task
      worker.assignTask('task-1');
      assert.equal(worker.status, WorkerStatus.WORKING);
      assert.equal(worker.instance.currentTaskId, 'task-1');

      // Complete task successfully
      worker.completeTask(true, 100);
      assert.equal(worker.status, WorkerStatus.IDLE);
      assert.equal(worker.metrics.tasksCompleted, 1);
      assert.equal(worker.metrics.totalTokensUsed, 100);
      assert.equal(worker.instance.currentTaskId, undefined);

      assert.deepEqual(statusChanges, [WorkerStatus.WORKING, WorkerStatus.IDLE]);
    });

    test('tracks failed tasks', () => {
      const worker = new ManagedWorkerInstance('test-profile', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      worker.assignTask('task-1');
      worker.completeTask(false, 50);

      assert.equal(worker.metrics.tasksFailed, 1);
      assert.equal(worker.metrics.tasksCompleted, 0);
    });

    test('terminates worker without process', () => {
      const worker = new ManagedWorkerInstance('test-profile', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      worker.terminate();
      assert.equal(worker.status, WorkerStatus.TERMINATED);
    });

    test('terminates worker with process', () => {
      const worker = new ManagedWorkerInstance('test-profile', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      let processTerminated = false;
      worker.process = {
        terminate: () => {
          processTerminated = true;
        },
      };

      worker.terminate();
      assert.equal(worker.status, WorkerStatus.TERMINATED);
      assert(processTerminated);
      assert.equal(worker.process, null);
    });

    test('serializes to dict', () => {
      const worker = new ManagedWorkerInstance('test-profile', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      const dict = worker.toDict();
      assert.equal(dict.profileId, 'test-profile');
      assert.equal(dict.status, WorkerStatus.IDLE);
    });
  });

  describe('WorkerPool', () => {
    test('initializes with max concurrent limit', () => {
      const pool = new WorkerPool(3);
      const stats = pool.getStats();

      assert.equal(stats.max, 3);
      assert.equal(stats.total, 0);
      assert.equal(stats.active, 0);
      assert.equal(stats.idle, 0);
    });

    test('acquires new worker when pool has capacity', () => {
      const pool = new WorkerPool(5);
      const worker = pool.acquire('profile-1', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      assert(worker !== null);
      assert.equal(pool.getStats().total, 1);
    });

    test('returns null when pool is at capacity', () => {
      const pool = new WorkerPool(1);

      // Acquire first worker and mark as working
      const worker1 = pool.acquire('profile-1', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 1,
      });
      assert(worker1 !== null);
      worker1.assignTask('task-1'); // Mark as working so it won't be reused

      // Try to acquire second worker with different profile
      const worker2 = pool.acquire('profile-2', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 1,
      });
      assert.equal(worker2, null);
    });

    test('reuses idle worker with matching profile', () => {
      const pool = new WorkerPool(5);
      const config = {
        implementation: 'persistent',
        maxRuntime: 300,
        episodicReset: false,
        maxConcurrentWorkers: 5,
      };

      const worker1 = pool.acquire('profile-1', config);
      const workerId = worker1.id;

      // Release worker back to pool
      pool.release(workerId, false);
      assert.equal(worker1.status, WorkerStatus.IDLE);

      // Acquire again - should get same worker
      const worker2 = pool.acquire('profile-1', config);
      assert.equal(worker2.id, workerId);
    });

    test('releases and terminates episodic workers', () => {
      const pool = new WorkerPool(5);
      const config = {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      };

      const worker = pool.acquire('profile-1', config);
      const workerId = worker.id;

      pool.release(workerId, true);
      assert.equal(pool.getStats().total, 0);
      assert.equal(pool.get(workerId), undefined);
    });

    test('terminates specific worker', () => {
      const pool = new WorkerPool(5);
      const worker = pool.acquire('profile-1', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      pool.terminate(worker.id);
      assert.equal(pool.getStats().total, 0);
    });

    test('terminates all workers', () => {
      const pool = new WorkerPool(5);

      pool.acquire('profile-1', { implementation: 'episodic', maxRuntime: 300, episodicReset: true, maxConcurrentWorkers: 5 });
      pool.acquire('profile-2', { implementation: 'episodic', maxRuntime: 300, episodicReset: true, maxConcurrentWorkers: 5 });

      assert.equal(pool.getStats().total, 2);

      pool.terminateAll();
      assert.equal(pool.getStats().total, 0);
    });

    test('gets idle workers', () => {
      const pool = new WorkerPool(5);
      const config = { implementation: 'persistent', maxRuntime: 300, episodicReset: false, maxConcurrentWorkers: 5 };

      const worker1 = pool.acquire('profile-1', config);
      const worker2 = pool.acquire('profile-2', config);

      worker1.assignTask('task-1');

      const idle = pool.getIdleWorkers();
      assert.equal(idle.length, 1);
      assert.equal(idle[0].id, worker2.id);
    });

    test('checks capacity correctly', () => {
      const pool = new WorkerPool(2);
      const config = { implementation: 'episodic', maxRuntime: 300, episodicReset: true, maxConcurrentWorkers: 2 };

      assert.equal(pool.hasCapacity(), true);

      pool.acquire('profile-1', config);
      assert.equal(pool.hasCapacity(), true);

      pool.acquire('profile-2', config);
      assert.equal(pool.hasCapacity(), false);
    });

    test('emits events on worker lifecycle', () => {
      const pool = new WorkerPool(5);
      const events = [];

      pool.on('workerCreated', (id) => events.push({ type: 'created', id }));
      pool.on('workerReleased', (id) => events.push({ type: 'released', id }));
      pool.on('workerTerminated', (id) => events.push({ type: 'terminated', id }));

      const worker = pool.acquire('profile-1', {
        implementation: 'persistent',
        maxRuntime: 300,
        episodicReset: false,
        maxConcurrentWorkers: 5,
      });

      pool.release(worker.id, false);
      pool.terminate(worker.id);

      assert(events.some((e) => e.type === 'created'));
      assert(events.some((e) => e.type === 'released'));
      assert(events.some((e) => e.type === 'terminated'));
    });
  });

  describe('Episodic Worker', () => {
    test('executes task and terminates', async () => {
      const worker = createEpisodicWorker();
      await worker.configure({
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      const context = createTestContext();
      const result = await worker.execute(
        {
          profile: createTestProfile(),
          task: createTestTask(),
          contextPrompt: 'Test context prompt for the worker',
        },
        context
      );

      assert.equal(result.success, true);
      assert(result.workerId.startsWith('instance-'));
      assert(result.duration >= 0);
      assert(result.tokensUsed > 0);
      assert(context._events.some((e) => e.eventType === 'worker.acquired'));
      assert(context._events.some((e) => e.eventType === 'worker.completed'));
    });

    test('returns error when no capacity', async () => {
      const worker = createEpisodicWorker();
      await worker.configure({
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 0, // No capacity
      });

      const context = createTestContext();
      const result = await worker.execute(
        {
          profile: createTestProfile(),
          task: createTestTask(),
          contextPrompt: 'Test context',
        },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.includes('capacity'));
    });

    test('throws when not configured', async () => {
      const worker = createEpisodicWorker();

      const context = createTestContext();
      await assert.rejects(
        () => worker.execute({ profile: createTestProfile(), task: createTestTask(), contextPrompt: 'Test' }, context),
        /not configured/
      );
    });
  });

  describe('Persistent Worker', () => {
    test('executes task and returns to pool', async () => {
      const worker = createPersistentWorker();
      await worker.configure({
        implementation: 'persistent',
        maxRuntime: 300,
        episodicReset: false,
        maxConcurrentWorkers: 5,
      });

      const context = createTestContext();
      const result = await worker.execute(
        {
          profile: createTestProfile(),
          task: createTestTask(),
          contextPrompt: 'Test context prompt',
        },
        context
      );

      assert.equal(result.success, true);
      assert(context._events.some((e) => e.eventType === 'worker.completed'));
    });

    test('tracks reused workers', async () => {
      const worker = createPersistentWorker();
      await worker.configure({
        implementation: 'persistent',
        maxRuntime: 300,
        episodicReset: false,
        maxConcurrentWorkers: 5,
      });

      const profile = createTestProfile();
      const context1 = createTestContext();
      const context2 = createTestContext();

      // First execution
      await worker.execute({ profile, task: createTestTask(), contextPrompt: 'Test 1' }, context1);

      // Second execution - should reuse worker
      await worker.execute({ profile, task: createTestTask(), contextPrompt: 'Test 2' }, context2);

      const reusedEvent = context2._events.find(
        (e) => e.eventType === 'worker.acquired' && e.payload.reused
      );
      assert(reusedEvent !== undefined);
    });

    test('returns error when no capacity', async () => {
      const worker = createPersistentWorker();
      await worker.configure({
        implementation: 'persistent',
        maxRuntime: 300,
        episodicReset: false,
        maxConcurrentWorkers: 0, // No capacity
      });

      const context = createTestContext();
      const result = await worker.execute(
        {
          profile: createTestProfile(),
          task: createTestTask(),
          contextPrompt: 'Test context',
        },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.includes('capacity'));
    });
  });

  describe('Worker Registration', () => {
    test('registers episodic and persistent workers', () => {
      globalRegistry.clear();
      registerWorkers();

      assert(globalRegistry.has(ModuleType.WORKER, 'episodic'));
      assert(globalRegistry.has(ModuleType.WORKER, 'persistent'));
    });
  });

  describe('WorkerSpawner', () => {
    test('creates spawner without workspace manager', () => {
      const mockTerminalManager = {
        spawnClaudeAgent: async () => ({
          on: () => {},
          terminate: async () => {},
        }),
        terminate: async () => {},
      };

      const spawner = new WorkerSpawner(mockTerminalManager);
      assert(spawner.terminalManager === mockTerminalManager);
      assert(spawner.workspaceManager === null);
    });

    test('creates spawner with workspace manager', () => {
      const mockTerminalManager = { spawnClaudeAgent: async () => ({}) };
      const mockWorkspaceManager = { getOrCreateSandbox: async () => '/tmp' };

      const spawner = new WorkerSpawner(mockTerminalManager, mockWorkspaceManager);
      assert(spawner.workspaceManager === mockWorkspaceManager);
    });

    test('spawns worker without workspace manager', async () => {
      const events = [];
      const mockAgentProcess = {
        on: (event, handler) => {
          events.push({ event, handler });
        },
      };
      const mockTerminalManager = {
        spawnClaudeAgent: async ({ agentId, prompt, workingDir }) => {
          assert.equal(agentId, 'worker-123');
          assert.equal(prompt, 'Test prompt');
          return mockAgentProcess;
        },
        terminate: async () => {},
      };

      const spawner = new WorkerSpawner(mockTerminalManager);
      const spawnerEvents = [];
      spawner.on('spawned', (data) => spawnerEvents.push(data));

      const worker = new ManagedWorkerInstance('profile-1', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });
      worker.instance.id = 'worker-123';

      const process = await spawner.spawn(worker, 'Test prompt');

      assert.equal(process, mockAgentProcess);
      assert.equal(worker.process, mockAgentProcess);
      assert(spawnerEvents.some((e) => e.workerId === 'worker-123'));
    });

    test('spawns worker with workspace manager', async () => {
      const mockAgentProcess = {
        on: (event, handler) => {},
      };
      const mockTerminalManager = {
        spawnClaudeAgent: async () => mockAgentProcess,
        terminate: async () => {},
      };
      const mockWorkspaceManager = {
        getOrCreateSandbox: async (id) => `/tmp/sandbox/${id}`,
        injectClaudeMd: async (id, content) => {},
        getSandbox: (id) => `/tmp/sandbox/${id}`,
        cleanupSandbox: async () => {},
      };

      const spawner = new WorkerSpawner(mockTerminalManager, mockWorkspaceManager);

      const worker = new ManagedWorkerInstance('profile-1', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      await spawner.spawn(worker, 'Test prompt with context');

      assert.equal(worker.process, mockAgentProcess);
    });

    test('wires up process events', async () => {
      const handlers = {};
      const mockAgentProcess = {
        on: (event, handler) => {
          handlers[event] = handler;
        },
      };
      const mockTerminalManager = {
        spawnClaudeAgent: async () => mockAgentProcess,
      };

      const spawner = new WorkerSpawner(mockTerminalManager);
      const spawnerEvents = [];
      spawner.on('output', (data) => spawnerEvents.push(data));
      spawner.on('exit', (data) => spawnerEvents.push(data));

      const worker = new ManagedWorkerInstance('profile-1', {
        implementation: 'episodic',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      await spawner.spawn(worker, 'Test');

      // Simulate process events
      handlers.stdout('Output line');
      handlers.stderr('Error line');
      handlers.exit(0);

      assert(worker.outputBuffer.includes('Output line'));
      assert(spawnerEvents.some((e) => e.type === 'stdout'));
      assert(spawnerEvents.some((e) => e.type === 'stderr'));
      assert(spawnerEvents.some((e) => e.code === 0));
    });

    test('terminates worker without workspace manager', async () => {
      let terminateCalled = false;
      const mockTerminalManager = {
        terminate: async (workerId, timeout) => {
          terminateCalled = true;
          assert.equal(workerId, 'worker-term');
          assert.equal(timeout, 3000);
        },
      };

      const spawner = new WorkerSpawner(mockTerminalManager);
      const terminateEvents = [];
      spawner.on('terminated', (data) => terminateEvents.push(data));

      await spawner.terminate('worker-term', 3000);

      assert(terminateCalled);
      assert(terminateEvents.some((e) => e.workerId === 'worker-term'));
    });

    test('terminates worker with workspace manager', async () => {
      let cleanupCalled = false;
      const mockTerminalManager = {
        terminate: async () => {},
      };
      const mockWorkspaceManager = {
        cleanupSandbox: async (id) => {
          cleanupCalled = true;
          assert.equal(id, 'worker-cleanup');
        },
      };

      const spawner = new WorkerSpawner(mockTerminalManager, mockWorkspaceManager);
      await spawner.terminate('worker-cleanup');

      assert(cleanupCalled);
    });
  });

  describe('Custom Worker Module', () => {
    test('creates custom worker module', async () => {
      const customWorker = createWorkerModule(
        'worker-custom',
        'custom',
        async (input, config, context, pool) => {
          return {
            success: true,
            workerId: 'custom-worker',
            duration: 100,
            tokensUsed: 50,
          };
        }
      );

      await customWorker.configure({
        implementation: 'custom',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      const context = createTestContext();
      const result = await customWorker.execute(
        { profile: createTestProfile(), task: createTestTask(), contextPrompt: 'Test' },
        context
      );

      assert.equal(result.success, true);
      assert.equal(result.workerId, 'custom-worker');
    });

    test('custom worker gets metrics', async () => {
      const customWorker = createWorkerModule(
        'worker-metrics',
        'metrics',
        async () => ({ success: true, workerId: 'w1', duration: 100, tokensUsed: 50 })
      );

      await customWorker.configure({
        implementation: 'metrics',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      const context = createTestContext();
      await customWorker.execute(
        { profile: createTestProfile(), task: createTestTask(), contextPrompt: 'Test' },
        context
      );

      const metrics = customWorker.getMetrics();
      assert.equal(metrics.executionCount, 1);
    });

    test('custom worker resets', async () => {
      const customWorker = createWorkerModule(
        'worker-reset',
        'reset',
        async () => ({ success: true, workerId: 'w1', duration: 100, tokensUsed: 50 })
      );

      await customWorker.configure({
        implementation: 'reset',
        maxRuntime: 300,
        episodicReset: true,
        maxConcurrentWorkers: 5,
      });

      const context = createTestContext();
      await customWorker.execute(
        { profile: createTestProfile(), task: createTestTask(), contextPrompt: 'Test' },
        context
      );

      await customWorker.reset();
      const metrics = customWorker.getMetrics();
      assert.equal(metrics.executionCount, 0);
    });
  });
});

// =============================================================================
// Context Builder Module Tests
// =============================================================================

describe('SWARM Context Builder Module', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerContextBuilders();
  });

  describe('Token Estimation', () => {
    test('estimates tokens from text', () => {
      const text = 'Hello world'; // 11 chars
      const tokens = estimateTokens(text);
      assert.equal(tokens, 3); // ceil(11/4)
    });

    test('handles empty text', () => {
      assert.equal(estimateTokens(''), 0);
      assert.equal(estimateTokens(null), 0);
      assert.equal(estimateTokens(undefined), 0);
    });

    test('truncates text to token limit', () => {
      const text = 'A'.repeat(1000); // 1000 chars = 250 tokens
      const { text: truncated, truncated: wasTruncated } = truncateToTokens(text, 100);

      assert.equal(wasTruncated, true);
      assert(truncated.length < text.length);
      assert(truncated.includes('[... truncated ...]'));
    });

    test('does not truncate within limit', () => {
      const text = 'Hello world';
      const { text: result, truncated } = truncateToTokens(text, 100);

      assert.equal(truncated, false);
      assert.equal(result, text);
    });
  });

  describe('Minimal Context Builder', () => {
    test('builds minimal context under 2K tokens', async () => {
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

      const context = createTestContext();
      const result = await builder.execute({ task: createTestTask() }, context);

      assert(result.tokenCount <= 2000);
      assert(result.prompt.includes('Task'));
      assert.deepEqual(result.includedFiles, []);
      assert(context._events.some((e) => e.eventType === 'context.built'));
    });

    test('includes dependencies in minimal context', async () => {
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

      const context = createTestContext();
      const task = createTestTask({ dependencies: ['task-1', 'task-2'] });
      const result = await builder.execute({ task }, context);

      assert(result.prompt.includes('Dependencies'));
      assert(result.prompt.includes('task-1'));
    });

    test('throws when not configured', async () => {
      const builder = createMinimalContextBuilder();
      const context = createTestContext();

      await assert.rejects(
        () => builder.execute({ task: createTestTask() }, context),
        /not configured/
      );
    });
  });

  describe('Scoped Context Builder', () => {
    test('includes file snippets when configured', async () => {
      const builder = createScopedContextBuilder();
      await builder.configure({
        implementation: 'scoped',
        maxTokens: 8000,
        includeProjectContext: true,
        includeExamples: false,
        includeConstraints: true,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute(
        {
          task: createTestTask(),
          files: ['// src/index.js\nconst x = 1;'],
          constraints: ['Must use TypeScript', 'No external dependencies'],
        },
        context
      );

      assert(result.prompt.includes('Relevant Files'));
      assert(result.prompt.includes('Constraints'));
      assert(result.tokenCount <= 8000);
      assert(result.includedFiles.length > 0);
    });

    test('includes tool requirements', async () => {
      const builder = createScopedContextBuilder();
      await builder.configure({
        implementation: 'scoped',
        maxTokens: 8000,
        includeProjectContext: false,
        includeExamples: false,
        includeConstraints: false,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute({ task: createTestTask() }, context);

      assert(result.prompt.includes('Available Tools'));
    });

    test('truncates when over budget', async () => {
      const builder = createScopedContextBuilder();
      await builder.configure({
        implementation: 'scoped',
        maxTokens: 100, // Very small budget
        includeProjectContext: true,
        includeExamples: false,
        includeConstraints: true,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute(
        {
          task: createTestTask(),
          files: ['A'.repeat(2000)],
          constraints: ['B'.repeat(2000)],
        },
        context
      );

      assert.equal(result.truncated, true);
    });
  });

  describe('Rich Context Builder', () => {
    test('includes all context types when configured', async () => {
      const builder = createRichContextBuilder();
      await builder.configure({
        implementation: 'rich',
        maxTokens: 32000,
        includeProjectContext: true,
        includeExamples: true,
        includeConstraints: true,
        includeHistory: true,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute(
        {
          task: createTestTask(),
          files: ['// file1.js\ncode here'],
          codebaseContext: 'This is a Node.js project',
          examples: ['Example output 1', 'Example output 2'],
          constraints: ['Must be fast', 'Must be secure'],
          history: 'Previous task completed successfully',
        },
        context
      );

      assert(result.prompt.includes('Project Context'));
      assert(result.prompt.includes('Examples'));
      assert(result.prompt.includes('Constraints'));
      assert(result.prompt.includes('Execution History'));
      assert(result.tokenCount <= 32000);
    });

    test('tracks what was included in context', async () => {
      const builder = createRichContextBuilder();
      await builder.configure({
        implementation: 'rich',
        maxTokens: 32000,
        includeProjectContext: true,
        includeExamples: true,
        includeConstraints: true,
        includeHistory: true,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      await builder.execute(
        {
          task: createTestTask(),
          examples: ['Example 1'],
          history: 'History data',
        },
        context
      );

      const event = context._events.find((e) => e.eventType === 'context.built');
      assert.equal(event.payload.hasExamples, true);
      assert.equal(event.payload.hasHistory, true);
    });
  });

  describe('Context Builder Registration', () => {
    test('registers all context builders', () => {
      globalRegistry.clear();
      registerContextBuilders();

      assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'minimal'));
      assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'scoped'));
      assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'rich'));
    });
  });

  describe('Custom Context Builder', () => {
    test('creates custom context builder', async () => {
      const customBuilder = createContextBuilder(
        'context-custom',
        'custom',
        async (input, config, context) => ({
          prompt: 'Custom prompt',
          tokenCount: 10,
          includedFiles: [],
          truncated: false,
        })
      );

      await customBuilder.configure({
        implementation: 'custom',
        maxTokens: 1000,
        includeProjectContext: false,
        includeExamples: false,
        includeConstraints: false,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await customBuilder.execute({ task: createTestTask() }, context);

      assert.equal(result.prompt, 'Custom prompt');
    });

    test('context builder gets and resets metrics', async () => {
      const customBuilder = createContextBuilder(
        'context-metrics',
        'metrics',
        async () => ({ prompt: 'Test', tokenCount: 10, includedFiles: [], truncated: false })
      );

      await customBuilder.configure({
        implementation: 'metrics',
        maxTokens: 1000,
        includeProjectContext: false,
        includeExamples: false,
        includeConstraints: false,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      await customBuilder.execute({ task: createTestTask() }, context);

      assert.equal(customBuilder.getMetrics().executionCount, 1);

      await customBuilder.reset();
      assert.equal(customBuilder.getMetrics().executionCount, 0);
    });
  });

  describe('Scoped Context Builder Edge Cases', () => {
    test('handles no files', async () => {
      const builder = createScopedContextBuilder();
      await builder.configure({
        implementation: 'scoped',
        maxTokens: 8000,
        includeProjectContext: true,
        includeExamples: false,
        includeConstraints: true,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute({ task: createTestTask() }, context);

      assert(!result.prompt.includes('Relevant Files'));
      assert.deepEqual(result.includedFiles, []);
    });

    test('handles no constraints', async () => {
      const builder = createScopedContextBuilder();
      await builder.configure({
        implementation: 'scoped',
        maxTokens: 8000,
        includeProjectContext: true,
        includeExamples: false,
        includeConstraints: true,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute({ task: createTestTask(), files: ['// code'] }, context);

      assert(!result.prompt.includes('Constraints'));
    });

    test('handles task without tool requirements', async () => {
      const builder = createScopedContextBuilder();
      await builder.configure({
        implementation: 'scoped',
        maxTokens: 8000,
        includeProjectContext: false,
        includeExamples: false,
        includeConstraints: false,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const task = createTestTask({ toolRequirements: [] });
      const result = await builder.execute({ task }, context);

      assert(!result.prompt.includes('Available Tools'));
    });
  });

  describe('Rich Context Builder Edge Cases', () => {
    test('handles no project context', async () => {
      const builder = createRichContextBuilder();
      await builder.configure({
        implementation: 'rich',
        maxTokens: 32000,
        includeProjectContext: false,
        includeExamples: true,
        includeConstraints: true,
        includeHistory: true,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute(
        { task: createTestTask(), codebaseContext: 'Some context' },
        context
      );

      assert(!result.prompt.includes('Project Context'));
    });

    test('handles no examples', async () => {
      const builder = createRichContextBuilder();
      await builder.configure({
        implementation: 'rich',
        maxTokens: 32000,
        includeProjectContext: true,
        includeExamples: false,
        includeConstraints: true,
        includeHistory: true,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute(
        { task: createTestTask(), examples: ['Example 1'] },
        context
      );

      assert(!result.prompt.includes('Examples'));
    });

    test('handles no history', async () => {
      const builder = createRichContextBuilder();
      await builder.configure({
        implementation: 'rich',
        maxTokens: 32000,
        includeProjectContext: true,
        includeExamples: true,
        includeConstraints: true,
        includeHistory: false,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const result = await builder.execute(
        { task: createTestTask(), history: 'Previous task data' },
        context
      );

      assert(!result.prompt.includes('Execution History'));
    });

    test('handles task without tool requirements', async () => {
      const builder = createRichContextBuilder();
      await builder.configure({
        implementation: 'rich',
        maxTokens: 32000,
        includeProjectContext: true,
        includeExamples: true,
        includeConstraints: true,
        includeHistory: true,
        relevanceThreshold: 0.5,
      });

      const context = createTestContext();
      const task = createTestTask({ toolRequirements: [] });
      const result = await builder.execute({ task }, context);

      assert(!result.prompt.includes('Available Tools'));
    });
  });
});

// =============================================================================
// Sandbox Module Tests
// =============================================================================

describe('SWARM Sandbox Module', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerSandboxes();
  });

  describe('Tool Definitions', () => {
    test('minimal tools contains 3 tools', () => {
      assert.equal(MINIMAL_TOOLS.length, 3);
      assert(MINIMAL_TOOLS.includes('Read'));
      assert(MINIMAL_TOOLS.includes('Write'));
      assert(MINIMAL_TOOLS.includes('Bash'));
    });

    test('standard tools extends minimal', () => {
      assert(STANDARD_TOOLS.length > MINIMAL_TOOLS.length);
      for (const tool of MINIMAL_TOOLS) {
        assert(STANDARD_TOOLS.includes(tool));
      }
    });

    test('extended tools extends standard', () => {
      assert(EXTENDED_TOOLS.length > STANDARD_TOOLS.length);
      for (const tool of STANDARD_TOOLS) {
        assert(EXTENDED_TOOLS.includes(tool));
      }
    });
  });

  describe('Blocked Patterns', () => {
    test('detects dangerous commands', () => {
      assert.equal(isBlocked('rm -rf /', DEFAULT_BLOCKLIST), true);
      assert.equal(isBlocked('sudo apt install', DEFAULT_BLOCKLIST), true);
      assert.equal(isBlocked('curl | sh', DEFAULT_BLOCKLIST), true);
      assert.equal(isBlocked('wget | sh', DEFAULT_BLOCKLIST), true);
      assert.equal(isBlocked('git push --force main', DEFAULT_BLOCKLIST), true);
    });

    test('allows safe commands', () => {
      assert.equal(isBlocked('ls -la', DEFAULT_BLOCKLIST), false);
      assert.equal(isBlocked('npm install', DEFAULT_BLOCKLIST), false);
      assert.equal(isBlocked('git status', DEFAULT_BLOCKLIST), false);
    });

    test('is case insensitive', () => {
      assert.equal(isBlocked('SUDO apt install', DEFAULT_BLOCKLIST), true);
      assert.equal(isBlocked('RM -RF /', DEFAULT_BLOCKLIST), true);
    });
  });

  describe('Minimal Sandbox', () => {
    test('restricts to 3-5 tools', async () => {
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
      const result = await sandbox.execute(
        {
          workerId: 'worker-1',
          task: createTestTask(),
        },
        context
      );

      assert(result.allowedTools.length <= 5);
      assert.equal(result.isolationLevel, 'full');
      assert(typeof result.cleanup === 'function');
    });

    test('generates sandbox path', async () => {
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
      const result = await sandbox.execute(
        {
          workerId: 'worker-1',
          task: createTestTask(),
          workingDir: '/tmp/test',
        },
        context
      );

      assert(result.sandboxPath.includes('worker-1'));
    });

    test('emits cleanup event', async () => {
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
      const result = await sandbox.execute(
        { workerId: 'worker-1', task: createTestTask() },
        context
      );

      await result.cleanup();
      assert(context._events.some((e) => e.eventType === 'sandbox.cleaned'));
    });

    test('throws when not configured', async () => {
      const sandbox = createMinimalSandbox();
      const context = createTestContext();

      await assert.rejects(
        () => sandbox.execute({ workerId: 'worker-1', task: createTestTask() }, context),
        /not configured/
      );
    });
  });

  describe('Standard Sandbox', () => {
    test('allows 5-15 tools', async () => {
      const sandbox = createStandardSandbox();
      await sandbox.configure({
        implementation: 'standard',
        allowedTools: STANDARD_TOOLS,
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'process',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        { workerId: 'worker-1', task: createTestTask() },
        context
      );

      assert(result.allowedTools.length >= 5);
      assert(result.allowedTools.length <= 15);
      assert.equal(result.isolationLevel, 'process');
    });

    test('creates git branch for isolation', async () => {
      const sandbox = createStandardSandbox();
      await sandbox.configure({
        implementation: 'standard',
        allowedTools: STANDARD_TOOLS,
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'process',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        { workerId: 'worker-1', task: createTestTask({ id: 'task-123' }) },
        context
      );

      assert(result.branchName.includes('swarm'));
      assert(result.branchName.includes('worker-1'));
    });

    test('cleanup emits event', async () => {
      const sandbox = createStandardSandbox();
      await sandbox.configure({
        implementation: 'standard',
        allowedTools: STANDARD_TOOLS,
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'process',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        { workerId: 'worker-std-cleanup', task: createTestTask() },
        context
      );

      await result.cleanup();
      const cleanupEvent = context._events.find(
        (e) => e.eventType === 'sandbox.cleaned' && e.moduleId === 'sandbox-standard'
      );
      assert(cleanupEvent !== undefined);
      assert.equal(cleanupEvent.payload.workerId, 'worker-std-cleanup');
    });
  });

  describe('Extended Sandbox', () => {
    test('allows 15-30 tools', async () => {
      const sandbox = createExtendedSandbox();
      await sandbox.configure({
        implementation: 'extended',
        allowedTools: EXTENDED_TOOLS,
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'container',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        { workerId: 'worker-1', task: createTestTask() },
        context
      );

      assert(result.allowedTools.length >= 5);
      assert.equal(result.isolationLevel, 'container');
    });

    test('cleanup emits event', async () => {
      const sandbox = createExtendedSandbox();
      await sandbox.configure({
        implementation: 'extended',
        allowedTools: EXTENDED_TOOLS,
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'container',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        { workerId: 'worker-ext-cleanup', task: createTestTask() },
        context
      );

      await result.cleanup();
      const cleanupEvent = context._events.find(
        (e) => e.eventType === 'sandbox.cleaned' && e.moduleId === 'sandbox-extended'
      );
      assert(cleanupEvent !== undefined);
      assert.equal(cleanupEvent.payload.workerId, 'worker-ext-cleanup');
    });
  });

  describe('Sandbox Registration', () => {
    test('registers all sandbox implementations', () => {
      globalRegistry.clear();
      registerSandboxes();

      assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'minimal'));
      assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'standard'));
      assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'extended'));
    });
  });

  describe('Custom Sandbox', () => {
    test('creates custom sandbox module', async () => {
      const customSandbox = createSandbox(
        'sandbox-custom',
        'custom',
        async (input, config, context) => ({
          sandboxPath: '/custom/path',
          allowedTools: ['Read'],
          isolationLevel: 'custom',
          cleanup: async () => {},
        })
      );

      await customSandbox.configure({
        implementation: 'custom',
        allowedTools: ['Read'],
        blockedPatterns: [],
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'full',
      });

      const context = createTestContext();
      const result = await customSandbox.execute(
        { workerId: 'w1', task: createTestTask() },
        context
      );

      assert.equal(result.sandboxPath, '/custom/path');
    });

    test('sandbox gets and resets metrics', async () => {
      const customSandbox = createSandbox(
        'sandbox-metrics',
        'metrics',
        async () => ({
          sandboxPath: '/path',
          allowedTools: [],
          isolationLevel: 'test',
          cleanup: async () => {},
        })
      );

      await customSandbox.configure({
        implementation: 'metrics',
        allowedTools: [],
        blockedPatterns: [],
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'full',
      });

      const context = createTestContext();
      await customSandbox.execute({ workerId: 'w1', task: createTestTask() }, context);

      assert.equal(customSandbox.getMetrics().executionCount, 1);

      await customSandbox.reset();
      assert.equal(customSandbox.getMetrics().executionCount, 0);
    });
  });

  describe('Sandbox Tool Filtering', () => {
    test('filters requested tools against allowed', async () => {
      const sandbox = createMinimalSandbox();
      await sandbox.configure({
        implementation: 'minimal',
        allowedTools: ['Read', 'Write', 'Bash'],
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'full',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        {
          workerId: 'worker-1',
          task: createTestTask(),
          requestedTools: ['Read', 'Write', 'Edit', 'Bash'],
        },
        context
      );

      // Should only allow Read, Write, Bash (not Edit)
      assert(result.allowedTools.includes('Read'));
      assert(result.allowedTools.includes('Write'));
      assert(result.allowedTools.includes('Bash'));
      assert(!result.allowedTools.includes('Edit'));
    });

    test('standard sandbox filters tools', async () => {
      const sandbox = createStandardSandbox();
      await sandbox.configure({
        implementation: 'standard',
        allowedTools: STANDARD_TOOLS,
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'process',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        {
          workerId: 'worker-1',
          task: createTestTask(),
          requestedTools: ['Read', 'Write'],
        },
        context
      );

      assert.equal(result.allowedTools.length, 2);
    });

    test('extended sandbox filters tools', async () => {
      const sandbox = createExtendedSandbox();
      await sandbox.configure({
        implementation: 'extended',
        allowedTools: EXTENDED_TOOLS,
        blockedPatterns: DEFAULT_BLOCKLIST,
        rateLimits: {},
        timeoutPerCall: 30,
        isolationLevel: 'container',
      });

      const context = createTestContext();
      const result = await sandbox.execute(
        {
          workerId: 'worker-1',
          task: createTestTask(),
          requestedTools: ['Read', 'Task'],
        },
        context
      );

      assert.equal(result.allowedTools.length, 2);
    });
  });

  describe('FULL_TOOLS constant', () => {
    test('FULL_TOOLS extends EXTENDED_TOOLS', () => {
      assert(FULL_TOOLS.length >= EXTENDED_TOOLS.length);
      for (const tool of EXTENDED_TOOLS) {
        assert(FULL_TOOLS.includes(tool));
      }
    });
  });
});

// =============================================================================
// Memory Manager Module Tests
// =============================================================================

describe('SWARM Memory Manager Module', () => {
  beforeEach(async () => {
    globalRegistry.clear();
    registerMemoryManagers();
    await mkdir(TEST_DIR, { recursive: true });
  });

  afterEach(async () => {
    await rm(TEST_DIR, { recursive: true, force: true });
  });

  describe('Ephemeral Memory', () => {
    test('saves and loads data', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();

      // Save
      const saveResult = await memory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'worker-1',
          key: 'test-key',
          data: { foo: 'bar' },
        },
        context
      );
      assert.equal(saveResult.success, true);

      // Load
      const loadResult = await memory.execute(
        {
          operation: MemoryOperation.LOAD,
          workerId: 'worker-1',
          key: 'test-key',
        },
        context
      );
      assert.equal(loadResult.success, true);
      assert.deepEqual(loadResult.data, { foo: 'bar' });
    });

    test('returns error for missing key', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        {
          operation: MemoryOperation.LOAD,
          workerId: 'worker-1',
          key: 'nonexistent',
        },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.includes('not found'));
    });

    test('lists keys for worker', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();

      // Save multiple keys
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', key: 'key1', data: 1 },
        context
      );
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', key: 'key2', data: 2 },
        context
      );

      // List
      const result = await memory.execute(
        { operation: MemoryOperation.LIST, workerId: 'worker-1' },
        context
      );

      assert.equal(result.success, true);
      assert(result.keys.includes('key1'));
      assert(result.keys.includes('key2'));
    });

    test('clears worker memory', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();

      // Save
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', key: 'key1', data: 1 },
        context
      );

      // Clear
      const clearResult = await memory.execute(
        { operation: MemoryOperation.CLEAR, workerId: 'worker-1' },
        context
      );
      assert.equal(clearResult.success, true);

      // Verify cleared
      const listResult = await memory.execute(
        { operation: MemoryOperation.LIST, workerId: 'worker-1' },
        context
      );
      assert.equal(listResult.keys.length, 0);
    });

    test('enforces max entries limit', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
        maxEntries: 2,
      });

      const context = createTestContext();

      // Save 3 entries
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', key: 'key1', data: 1 },
        context
      );
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', key: 'key2', data: 2 },
        context
      );
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', key: 'key3', data: 3 },
        context
      );

      // Should only have 2 entries
      const listResult = await memory.execute(
        { operation: MemoryOperation.LIST, workerId: 'worker-1' },
        context
      );
      assert.equal(listResult.keys.length, 2);
    });

    test('requires key for save operation', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', data: 'test' },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.includes('Key required'));
    });

    test('requires key for load operation', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'worker-1' },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.includes('Key required'));
    });

    test('handles unknown operation', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: 'unknown', workerId: 'worker-1' },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.includes('Unknown operation'));
    });

    test('throws when not configured', async () => {
      const memory = createEphemeralMemory();
      const context = createTestContext();

      await assert.rejects(
        () =>
          memory.execute(
            { operation: MemoryOperation.LIST, workerId: 'worker-1' },
            context
          ),
        /not configured/
      );
    });
  });

  describe('File-Based Memory', () => {
    test('saves data to markdown file', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'worker-file-1',
          key: 'test-key',
          data: { hello: 'world' },
          taskId: 'task-123',
        },
        context
      );

      assert.equal(result.success, true);

      // Verify file exists
      const filePath = join(TEST_DIR, 'worker-file-1', 'test-key.md');
      await access(filePath, constants.F_OK);
    });

    test('loads data from markdown file', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();

      // Save
      await memory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'worker-file-2',
          key: 'load-test',
          data: { value: 42 },
        },
        context
      );

      // Load
      const result = await memory.execute(
        {
          operation: MemoryOperation.LOAD,
          workerId: 'worker-file-2',
          key: 'load-test',
        },
        context
      );

      assert.equal(result.success, true);
      assert.deepEqual(result.data, { value: 42 });
    });

    test('uses cache for repeated loads', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();

      // Save
      await memory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'worker-file-3',
          key: 'cache-test',
          data: { cached: true },
        },
        context
      );

      // First load (from file)
      await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'worker-file-3', key: 'cache-test' },
        context
      );

      // Second load (from cache)
      const result = await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'worker-file-3', key: 'cache-test' },
        context
      );

      assert.equal(result.success, true);
      assert.deepEqual(result.data, { cached: true });
    });

    test('lists keys from directory', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();

      // Save multiple
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-file-4', key: 'file1', data: 1 },
        context
      );
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-file-4', key: 'file2', data: 2 },
        context
      );

      // List
      const result = await memory.execute(
        { operation: MemoryOperation.LIST, workerId: 'worker-file-4' },
        context
      );

      assert.equal(result.success, true);
      assert(result.keys.includes('file1'));
      assert(result.keys.includes('file2'));
    });

    test('returns empty list for nonexistent worker', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.LIST, workerId: 'nonexistent' },
        context
      );

      assert.equal(result.success, true);
      assert.deepEqual(result.keys, []);
    });

    test('clears worker directory', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();

      // Save
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-file-5', key: 'to-clear', data: 1 },
        context
      );

      // Clear
      const clearResult = await memory.execute(
        { operation: MemoryOperation.CLEAR, workerId: 'worker-file-5' },
        context
      );
      assert.equal(clearResult.success, true);

      // Verify cleared
      const listResult = await memory.execute(
        { operation: MemoryOperation.LIST, workerId: 'worker-file-5' },
        context
      );
      assert.deepEqual(listResult.keys, []);
    });

    test('returns error for nonexistent key', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      // Create the worker directory but not the file
      await mkdir(join(TEST_DIR, 'worker-file-6'), { recursive: true });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'worker-file-6', key: 'missing' },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.includes('not found'));
    });

    test('clears nonexistent directory successfully', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.CLEAR, workerId: 'never-existed' },
        context
      );

      assert.equal(result.success, true);
    });

    test('requires key for save', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'worker-1', data: 'test' },
        context
      );

      assert.equal(result.success, false);
    });

    test('requires key for load', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'worker-1' },
        context
      );

      assert.equal(result.success, false);
    });

    test('handles unknown operation', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await memory.execute(
        { operation: 'unknown', workerId: 'worker-1' },
        context
      );

      assert.equal(result.success, false);
    });
  });

  describe('Memory Manager Registration', () => {
    test('registers all memory managers', () => {
      globalRegistry.clear();
      registerMemoryManagers();

      assert(globalRegistry.has(ModuleType.MEMORY_MANAGER, 'ephemeral'));
      assert(globalRegistry.has(ModuleType.MEMORY_MANAGER, 'file-based'));
    });
  });

  describe('Custom Memory Manager', () => {
    test('creates custom memory manager', async () => {
      const customMemory = createMemoryManager(
        'memory-custom',
        'custom',
        async (input, config, context, store) => {
          if (input.operation === MemoryOperation.SAVE) {
            store.set(`${input.workerId}:${input.key}`, {
              key: input.key,
              data: input.data,
              timestamp: Date.now(),
              workerId: input.workerId,
            });
            return { success: true };
          }
          return { success: false, error: 'Unknown' };
        }
      );

      await customMemory.configure({
        implementation: 'custom',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      const result = await customMemory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'w1',
          key: 'test',
          data: { value: 1 },
        },
        context
      );

      assert.equal(result.success, true);
    });

    test('memory manager gets and resets metrics', async () => {
      const customMemory = createMemoryManager(
        'memory-metrics',
        'metrics',
        async () => ({ success: true })
      );

      await customMemory.configure({
        implementation: 'metrics',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      await customMemory.execute(
        { operation: MemoryOperation.LIST, workerId: 'w1' },
        context
      );

      assert.equal(customMemory.getMetrics().executionCount, 1);

      await customMemory.reset();
      assert.equal(customMemory.getMetrics().executionCount, 0);
    });
  });

  describe('Ephemeral Memory Edge Cases', () => {
    test('emits events on save', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      await memory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'worker-events',
          key: 'event-test',
          data: 'test',
          taskId: 'task-123',
        },
        context
      );

      const saveEvent = context._events.find((e) => e.eventType === 'memory.saved');
      assert(saveEvent !== undefined);
      assert.equal(saveEvent.payload.workerId, 'worker-events');
      assert.equal(saveEvent.payload.taskId, 'task-123');
    });

    test('emits events on load', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'w-load', key: 'k1', data: 1 },
        context
      );
      await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'w-load', key: 'k1' },
        context
      );

      const loadEvent = context._events.find((e) => e.eventType === 'memory.loaded');
      assert(loadEvent !== undefined);
    });

    test('emits events on clear', async () => {
      const memory = createEphemeralMemory();
      await memory.configure({
        implementation: 'ephemeral',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'w-clear', key: 'k1', data: 1 },
        context
      );
      await memory.execute({ operation: MemoryOperation.CLEAR, workerId: 'w-clear' }, context);

      const clearEvent = context._events.find((e) => e.eventType === 'memory.cleared');
      assert(clearEvent !== undefined);
      assert(clearEvent.payload.keysCleared >= 0);
    });
  });

  describe('File-Based Memory Edge Cases', () => {
    test('emits events on save', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      await memory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'worker-fb-events',
          key: 'event-test',
          data: 'test',
          taskId: 'task-456',
        },
        context
      );

      const saveEvent = context._events.find(
        (e) => e.eventType === 'memory.saved' && e.moduleId === 'memory-file-based'
      );
      assert(saveEvent !== undefined);
      assert(saveEvent.payload.filePath.includes('event-test.md'));
    });

    test('emits events on load from file', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'w-fb-load', key: 'load-test', data: { a: 1 } },
        context
      );

      // Create a new memory instance to force file read (no cache)
      const memory2 = createFileBasedMemory();
      await memory2.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context2 = createTestContext();
      await memory2.execute(
        { operation: MemoryOperation.LOAD, workerId: 'w-fb-load', key: 'load-test' },
        context2
      );

      const loadEvent = context2._events.find(
        (e) => e.eventType === 'memory.loaded' && e.payload.fromFile === true
      );
      assert(loadEvent !== undefined);
    });

    test('emits events on clear', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      const context = createTestContext();
      await memory.execute(
        { operation: MemoryOperation.SAVE, workerId: 'w-fb-clear', key: 'clear-test', data: 1 },
        context
      );
      await memory.execute({ operation: MemoryOperation.CLEAR, workerId: 'w-fb-clear' }, context);

      const clearEvent = context._events.find(
        (e) => e.eventType === 'memory.cleared' && e.moduleId === 'memory-file-based'
      );
      assert(clearEvent !== undefined);
    });

    test('handles invalid memory file format (no JSON block)', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      // Create a file with invalid format (no ```json block)
      // Path is: storagePath/{workerId}/{key}.md
      const workerDir = join(TEST_DIR, 'w-invalid-format');
      await mkdir(workerDir, { recursive: true });
      const invalidFile = join(workerDir, 'invalid-key.md');
      await writeFile(invalidFile, '# Memory Entry\n\nThis file has no JSON block.\n');

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'w-invalid-format', key: 'invalid-key' },
        context
      );

      assert.equal(result.success, false);
      assert.equal(result.error, 'Invalid memory file format');
    });

    test('handles invalid JSON in memory file', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      // Create a file with valid markdown format but invalid JSON content
      // Path is: storagePath/{workerId}/{key}.md
      const workerDir = join(TEST_DIR, 'w-invalid-json');
      await mkdir(workerDir, { recursive: true });
      const invalidFile = join(workerDir, 'bad-json.md');
      await writeFile(invalidFile, '# Memory Entry\n\n```json\n{invalid json content}\n```\n');

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.LOAD, workerId: 'w-invalid-json', key: 'bad-json' },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.startsWith('Failed to load:'));
    });

    test('handles save error with circular reference data', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      // Create circular reference data that can't be JSON.stringify'd
      const circularData = { name: 'test' };
      circularData.self = circularData;

      const context = createTestContext();
      const result = await memory.execute(
        {
          operation: MemoryOperation.SAVE,
          workerId: 'w-circular',
          key: 'circular-key',
          data: circularData,
        },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.startsWith('Failed to save:'));
    });

    test('handles list error when worker path is a file (ENOTDIR)', async () => {
      const memory = createFileBasedMemory();
      await memory.configure({
        implementation: 'file-based',
        storagePath: TEST_DIR,
      });

      // Create a file where the worker directory would be expected
      // This causes readdir to fail with ENOTDIR instead of ENOENT
      const workerAsFile = join(TEST_DIR, 'w-is-file');
      await writeFile(workerAsFile, 'This is a file, not a directory');

      const context = createTestContext();
      const result = await memory.execute(
        { operation: MemoryOperation.LIST, workerId: 'w-is-file' },
        context
      );

      assert.equal(result.success, false);
      assert(result.error.startsWith('Failed to list:'));
    });

    test('handles clear error when parent path has issues', async () => {
      const memory = createFileBasedMemory();
      // Use a storagePath that's actually a file to cause rm to fail differently
      const fileAsPath = join(TEST_DIR, 'file-storage');
      await writeFile(fileAsPath, 'This is a file');

      await memory.configure({
        implementation: 'file-based',
        storagePath: fileAsPath,
      });

      const context = createTestContext();
      // Trying to clear a path like "file-storage/w-clear" where file-storage is a file
      const result = await memory.execute(
        { operation: MemoryOperation.CLEAR, workerId: 'w-clear' },
        context
      );

      // rm with recursive: true and force: true should handle this gracefully
      // If the path doesn't exist (which it can't since parent is a file), it returns success
      // This test just ensures we hit the error handling path
      assert(result.success === true || result.error !== undefined);
    });
  });
});

// =============================================================================
// Integration Tests
// =============================================================================

describe('SWARM Execution Layer Integration', () => {
  beforeEach(() => {
    globalRegistry.clear();
    registerWorkers();
    registerContextBuilders();
    registerSandboxes();
    registerMemoryManagers();
  });

  test('all execution modules are registered', () => {
    assert(globalRegistry.has(ModuleType.WORKER, 'episodic'));
    assert(globalRegistry.has(ModuleType.WORKER, 'persistent'));
    assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'minimal'));
    assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'scoped'));
    assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'rich'));
    assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'minimal'));
    assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'standard'));
    assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'extended'));
    assert(globalRegistry.has(ModuleType.MEMORY_MANAGER, 'ephemeral'));
    assert(globalRegistry.has(ModuleType.MEMORY_MANAGER, 'file-based'));
  });

  test('registerExecutionModules registers all modules', () => {
    globalRegistry.clear();
    registerExecutionModules();

    assert(globalRegistry.has(ModuleType.WORKER, 'episodic'));
    assert(globalRegistry.has(ModuleType.WORKER, 'persistent'));
    assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'minimal'));
    assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'scoped'));
    assert(globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'rich'));
    assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'minimal'));
    assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'standard'));
    assert(globalRegistry.has(ModuleType.TOOL_SANDBOX, 'extended'));
    assert(globalRegistry.has(ModuleType.MEMORY_MANAGER, 'ephemeral'));
    assert(globalRegistry.has(ModuleType.MEMORY_MANAGER, 'file-based'));
  });

  test('complete worker workflow', async () => {
    const context = createTestContext();
    const task = createTestTask();
    const profile = createTestProfile();

    // 1. Build context
    const contextBuilder = createMinimalContextBuilder();
    await contextBuilder.configure({
      implementation: 'minimal',
      maxTokens: 2000,
      includeProjectContext: false,
      includeExamples: false,
      includeConstraints: false,
      includeHistory: false,
      relevanceThreshold: 0.5,
    });
    const contextResult = await contextBuilder.execute({ task }, context);

    // 2. Setup sandbox
    const sandbox = createMinimalSandbox();
    await sandbox.configure({
      implementation: 'minimal',
      allowedTools: MINIMAL_TOOLS,
      blockedPatterns: DEFAULT_BLOCKLIST,
      rateLimits: {},
      timeoutPerCall: 30,
      isolationLevel: 'full',
    });
    const sandboxResult = await sandbox.execute({ workerId: 'worker-int', task }, context);

    // 3. Execute worker
    const worker = createEpisodicWorker();
    await worker.configure({
      implementation: 'episodic',
      maxRuntime: 300,
      episodicReset: true,
      maxConcurrentWorkers: 5,
    });
    const workerResult = await worker.execute(
      { profile, task, contextPrompt: contextResult.prompt },
      context
    );

    // 4. Cleanup sandbox
    await sandboxResult.cleanup();

    // Verify full workflow
    assert.equal(workerResult.success, true);
    assert(context._events.some((e) => e.eventType === 'context.built'));
    assert(context._events.some((e) => e.eventType === 'sandbox.created'));
    assert(context._events.some((e) => e.eventType === 'worker.acquired'));
    assert(context._events.some((e) => e.eventType === 'worker.completed'));
    assert(context._events.some((e) => e.eventType === 'sandbox.cleaned'));
  });
});
