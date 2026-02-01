/**
 * SWARM Framework - Worker Module
 * Manages worker lifecycle, pooling, and Claude CLI spawning
 * @module swarm/execution/worker
 */

import { EventEmitter } from 'node:events';
import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';
import {
  WorkerStatus,
  createWorkerInstance,
} from '../../types/workflow.js';

/**
 * @typedef {import('../../types/module.js').WorkerConfig} WorkerConfig
 * @typedef {import('../../types/workflow.js').WorkerProfile} WorkerProfile
 * @typedef {import('../../types/workflow.js').WorkerInstance} WorkerInstance
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 * @typedef {import('../../types/task.js').TaskDefinition} TaskDefinition
 */

/**
 * @typedef {Object} WorkerInput
 * @property {WorkerProfile} profile - Worker profile to use
 * @property {TaskDefinition} task - Task to execute
 * @property {string} contextPrompt - Built context prompt for the worker
 * @property {string} [workingDir] - Working directory
 */

/**
 * @typedef {Object} WorkerOutput
 * @property {boolean} success - Whether task completed successfully
 * @property {string} workerId - ID of the worker that executed
 * @property {string} [result] - Task result/output
 * @property {number} duration - Execution duration in ms
 * @property {number} tokensUsed - Estimated tokens consumed
 * @property {string} [error] - Error message if failed
 */

// =============================================================================
// WORKER INSTANCE (Enhanced for execution)
// =============================================================================

/**
 * Enhanced WorkerInstance with process management
 */
export class ManagedWorkerInstance extends EventEmitter {
  /**
   * @param {string} profileId
   * @param {WorkerConfig} config
   */
  constructor(profileId, config) {
    super();
    /** @type {WorkerInstance} */
    this.instance = createWorkerInstance(profileId);
    /** @type {WorkerConfig} */
    this.config = config;
    /** @type {import('../../../../runtime/process.js').AgentProcess | null} */
    this.process = null;
    /** @type {string[]} */
    this.outputBuffer = [];
  }

  get id() {
    return this.instance.id;
  }

  get status() {
    return this.instance.status;
  }

  get profileId() {
    return this.instance.profileId;
  }

  get metrics() {
    return this.instance.metrics;
  }

  /**
   * Update worker status
   * @param {import('../../types/workflow.js').WorkerStatusType} status
   */
  setStatus(status) {
    this.instance.status = status;
    this.emit('statusChange', status);
  }

  /**
   * Assign a task to this worker
   * @param {string} taskId
   */
  assignTask(taskId) {
    this.instance.currentTaskId = taskId;
    this.instance.startedAt = Date.now();
    this.setStatus(WorkerStatus.WORKING);
  }

  /**
   * Complete the current task
   * @param {boolean} success
   * @param {number} tokensUsed
   */
  completeTask(success, tokensUsed = 0) {
    if (success) {
      this.instance.metrics.tasksCompleted += 1;
    } else {
      this.instance.metrics.tasksFailed += 1;
    }

    if (this.instance.startedAt) {
      this.instance.metrics.totalRuntime += (Date.now() - this.instance.startedAt) / 1000;
    }

    this.instance.metrics.totalTokensUsed += tokensUsed;
    this.instance.currentTaskId = undefined;
    this.instance.startedAt = undefined;
    this.setStatus(WorkerStatus.IDLE);
  }

  /**
   * Terminate the worker
   */
  terminate() {
    this.setStatus(WorkerStatus.TERMINATED);
    if (this.process) {
      this.process.terminate();
      this.process = null;
    }
  }

  /**
   * Get serializable representation
   * @returns {WorkerInstance}
   */
  toDict() {
    return { ...this.instance };
  }
}

// =============================================================================
// WORKER POOL
// =============================================================================

/**
 * Manages a pool of worker instances with concurrency control
 */
export class WorkerPool extends EventEmitter {
  /**
   * @param {number} maxConcurrent - Maximum concurrent workers
   */
  constructor(maxConcurrent = 5) {
    super();
    /** @type {number} */
    this.maxConcurrent = maxConcurrent;
    /** @private @type {Map<string, ManagedWorkerInstance>} */
    this._workers = new Map();
    /** @private @type {Map<string, WorkerConfig>} */
    this._configs = new Map();
  }

  /**
   * Get pool statistics
   * @returns {{active: number, idle: number, total: number, max: number}}
   */
  getStats() {
    let active = 0;
    let idle = 0;

    for (const worker of this._workers.values()) {
      if (worker.status === WorkerStatus.WORKING) {
        active++;
      } else if (worker.status === WorkerStatus.IDLE) {
        idle++;
      }
    }

    return {
      active,
      idle,
      total: this._workers.size,
      max: this.maxConcurrent,
    };
  }

  /**
   * Acquire a worker from the pool
   * @param {string} profileId - Worker profile to use
   * @param {WorkerConfig} config - Worker configuration
   * @returns {ManagedWorkerInstance | null} Worker instance or null if at capacity
   */
  acquire(profileId, config) {
    // First try to find an idle worker with matching profile
    for (const worker of this._workers.values()) {
      if (worker.profileId === profileId && worker.status === WorkerStatus.IDLE) {
        return worker;
      }
    }

    // Check capacity
    const stats = this.getStats();
    if (stats.total >= this.maxConcurrent) {
      return null;
    }

    // Create new worker
    const worker = new ManagedWorkerInstance(profileId, config);
    this._workers.set(worker.id, worker);
    this._configs.set(worker.id, config);

    this.emit('workerCreated', worker.id);
    return worker;
  }

  /**
   * Release a worker back to the pool
   * @param {string} workerId
   * @param {boolean} [terminate=false] - Terminate instead of returning to pool
   */
  release(workerId, terminate = false) {
    const worker = this._workers.get(workerId);
    if (!worker) return;

    if (terminate || worker.config.episodicReset) {
      worker.terminate();
      this._workers.delete(workerId);
      this._configs.delete(workerId);
      this.emit('workerTerminated', workerId);
    } else {
      worker.setStatus(WorkerStatus.IDLE);
      this.emit('workerReleased', workerId);
    }
  }

  /**
   * Get a worker by ID
   * @param {string} workerId
   * @returns {ManagedWorkerInstance | undefined}
   */
  get(workerId) {
    return this._workers.get(workerId);
  }

  /**
   * Get all idle workers
   * @returns {ManagedWorkerInstance[]}
   */
  getIdleWorkers() {
    return Array.from(this._workers.values())
      .filter(w => w.status === WorkerStatus.IDLE);
  }

  /**
   * Terminate a specific worker
   * @param {string} workerId
   */
  terminate(workerId) {
    this.release(workerId, true);
  }

  /**
   * Terminate all workers
   */
  terminateAll() {
    for (const workerId of this._workers.keys()) {
      this.terminate(workerId);
    }
  }

  /**
   * Check if pool has capacity
   * @returns {boolean}
   */
  hasCapacity() {
    return this.getStats().total < this.maxConcurrent;
  }
}

// =============================================================================
// SPAWNER
// =============================================================================

/**
 * Wraps TerminalManager for worker spawning
 */
export class WorkerSpawner extends EventEmitter {
  /**
   * @param {import('../../../../runtime/process.js').TerminalManager} terminalManager
   * @param {import('../../../../runtime/workspace.js').WorkspaceManager} [workspaceManager]
   */
  constructor(terminalManager, workspaceManager = null) {
    super();
    /** @type {import('../../../../runtime/process.js').TerminalManager} */
    this.terminalManager = terminalManager;
    /** @type {import('../../../../runtime/workspace.js').WorkspaceManager | null} */
    this.workspaceManager = workspaceManager;
  }

  /**
   * Spawn a worker process
   * @param {ManagedWorkerInstance} worker
   * @param {string} prompt - Context prompt to inject
   * @param {Object} [options]
   * @param {string} [options.workingDir]
   * @param {boolean} [options.dangerouslySkipPermissions=true]
   * @returns {Promise<import('../../../../runtime/process.js').AgentProcess>}
   */
  async spawn(worker, prompt, options = {}) {
    const { workingDir, dangerouslySkipPermissions = true } = options;

    // Setup workspace if available
    if (this.workspaceManager) {
      await this.workspaceManager.getOrCreateSandbox(worker.id);
      await this.workspaceManager.injectClaudeMd(worker.id, prompt);
    }

    // Spawn the Claude agent
    const agentProcess = await this.terminalManager.spawnClaudeAgent({
      agentId: worker.id,
      prompt,
      workingDir: workingDir ?? this.workspaceManager?.getSandbox(worker.id),
      dangerouslySkipPermissions,
    });

    worker.process = agentProcess;

    // Wire up events
    agentProcess.on('stdout', (line) => {
      worker.outputBuffer.push(line);
      this.emit('output', { workerId: worker.id, line, type: 'stdout' });
    });

    agentProcess.on('stderr', (line) => {
      this.emit('output', { workerId: worker.id, line, type: 'stderr' });
    });

    agentProcess.on('exit', (code) => {
      this.emit('exit', { workerId: worker.id, code });
    });

    this.emit('spawned', { workerId: worker.id });
    return agentProcess;
  }

  /**
   * Terminate a worker's process
   * @param {string} workerId
   * @param {number} [timeoutMs=5000]
   */
  async terminate(workerId, timeoutMs = 5000) {
    await this.terminalManager.terminate(workerId, timeoutMs);

    if (this.workspaceManager) {
      await this.workspaceManager.cleanupSandbox(workerId);
    }

    this.emit('terminated', { workerId });
  }
}

// =============================================================================
// WORKER MODULE FACTORY
// =============================================================================

/**
 * Create a worker module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: WorkerInput, config: WorkerConfig, context: ExecutionContext, pool: WorkerPool, spawner: WorkerSpawner | null) => Promise<WorkerOutput>} executeFn
 * @returns {import('../../types/module.js').Module<WorkerConfig, WorkerInput, WorkerOutput>}
 */
export function createWorkerModule(id, implementation, executeFn) {
  /** @type {WorkerConfig | null} */
  let config = null;
  /** @type {WorkerPool | null} */
  let pool = null;
  /** @type {WorkerSpawner | null} */
  let spawner = null;

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.WORKER,

    async configure(cfg) {
      config = cfg;
      pool = new WorkerPool(cfg.maxConcurrentWorkers ?? 5);
    },

    async execute(input, context) {
      if (!config || !pool) {
        throw new Error('Worker module not configured');
      }
      return executeFn(input, config, context, pool, spawner);
    },
  });
}

/**
 * Episodic worker - terminates after each task
 */
export function createEpisodicWorker() {
  return createWorkerModule(
    'worker-episodic',
    'episodic',
    async (input, config, context, pool) => {
      const startTime = Date.now();

      // Acquire worker
      const worker = pool.acquire(input.profile.id, { ...config, episodicReset: true });
      if (!worker) {
        return {
          success: false,
          workerId: '',
          duration: 0,
          tokensUsed: 0,
          error: 'No worker capacity available',
        };
      }

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'worker.acquired',
        moduleId: 'worker-episodic',
        payload: { workerId: worker.id, taskId: input.task.id },
        level: 'info',
      });

      worker.assignTask(input.task.id);

      // Simulate execution (in production, this would use the spawner)
      // For testing, we just return success after a brief delay
      await new Promise(r => setTimeout(r, 10));

      const duration = Date.now() - startTime;
      const tokensUsed = Math.floor(input.contextPrompt.length / 4);

      worker.completeTask(true, tokensUsed);

      // Episodic: release and terminate
      pool.release(worker.id, true);

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'worker.completed',
        moduleId: 'worker-episodic',
        payload: { workerId: worker.id, taskId: input.task.id, duration },
        level: 'info',
      });

      return {
        success: true,
        workerId: worker.id,
        result: worker.outputBuffer.join('\n'),
        duration,
        tokensUsed,
      };
    }
  );
}

/**
 * Persistent worker - reuses worker across tasks
 */
export function createPersistentWorker() {
  return createWorkerModule(
    'worker-persistent',
    'persistent',
    async (input, config, context, pool) => {
      const startTime = Date.now();

      // Acquire worker (may reuse existing)
      const worker = pool.acquire(input.profile.id, { ...config, episodicReset: false });
      if (!worker) {
        return {
          success: false,
          workerId: '',
          duration: 0,
          tokensUsed: 0,
          error: 'No worker capacity available',
        };
      }

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'worker.acquired',
        moduleId: 'worker-persistent',
        payload: { workerId: worker.id, taskId: input.task.id, reused: worker.metrics.tasksCompleted > 0 },
        level: 'info',
      });

      worker.assignTask(input.task.id);

      // Simulate execution
      await new Promise(r => setTimeout(r, 10));

      const duration = Date.now() - startTime;
      const tokensUsed = Math.floor(input.contextPrompt.length / 4);

      worker.completeTask(true, tokensUsed);

      // Persistent: release back to pool
      pool.release(worker.id, false);

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'worker.completed',
        moduleId: 'worker-persistent',
        payload: { workerId: worker.id, taskId: input.task.id, duration },
        level: 'info',
      });

      return {
        success: true,
        workerId: worker.id,
        result: worker.outputBuffer.join('\n'),
        duration,
        tokensUsed,
      };
    }
  );
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register default worker implementations
 */
export function registerWorkers() {
  if (!globalRegistry.has(ModuleType.WORKER, 'episodic')) {
    globalRegistry.register(ModuleType.WORKER, 'episodic', createEpisodicWorker);
  }
  if (!globalRegistry.has(ModuleType.WORKER, 'persistent')) {
    globalRegistry.register(ModuleType.WORKER, 'persistent', createPersistentWorker);
  }
}

// Auto-register on import
registerWorkers();
