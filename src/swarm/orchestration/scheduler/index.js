/**
 * SWARM Framework - Scheduler Module
 * Assigns tasks to workers and manages execution order
 * @module swarm/orchestration/scheduler
 */

import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';
import { TaskStatus } from '../../types/task.js';

/**
 * @typedef {import('../../types/module.js').SchedulerConfig} SchedulerConfig
 * @typedef {import('../../types/task.js').TaskDefinition} TaskDefinition
 * @typedef {import('../../types/task.js').TaskState} TaskState
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 */

/**
 * @typedef {Object} SchedulerInput
 * @property {TaskState[]} tasks - Tasks to schedule
 * @property {number} availableWorkers - Number of available workers
 */

/**
 * @typedef {Object} SchedulerOutput
 * @property {TaskState[]} scheduled - Tasks ready to be assigned
 * @property {TaskState[]} queued - Tasks waiting in queue
 */

/**
 * Base scheduler implementation with common functionality
 * @param {string} id
 * @param {string} implementation
 * @param {(input: SchedulerInput, config: SchedulerConfig, context: ExecutionContext) => Promise<SchedulerOutput>} scheduleFn
 * @returns {import('../../types/module.js').Module<SchedulerConfig, SchedulerInput, SchedulerOutput>}
 */
export function createScheduler(id, implementation, scheduleFn) {
  /** @type {SchedulerConfig | null} */
  let config = null;

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.SCHEDULER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Scheduler not configured');
      }
      return scheduleFn(input, config, context);
    },
  });
}

/**
 * Check if a task has all dependencies satisfied
 * @param {TaskState} taskState
 * @param {Map<string, TaskState>} taskMap
 * @returns {boolean}
 */
function areDependenciesSatisfied(taskState, taskMap) {
  for (const depId of taskState.task.dependencies) {
    const dep = taskMap.get(depId);
    if (!dep || dep.status !== TaskStatus.COMPLETED) {
      return false;
    }
  }
  return true;
}

/**
 * FIFO scheduler - first-in-first-out, simple queue
 * Best for baseline comparison
 */
export function createFifoScheduler() {
  return createScheduler(
    'scheduler-fifo',
    'fifo',
    async (input, config, context) => {
      const { tasks, availableWorkers } = input;

      // Build task map for dependency checking
      const taskMap = new Map(tasks.map((t) => [t.task.id, t]));

      // Filter to pending tasks with satisfied dependencies
      const available = tasks.filter(
        (t) => t.status === TaskStatus.PENDING && areDependenciesSatisfied(t, taskMap)
      );

      // Take up to availableWorkers tasks in FIFO order
      const scheduled = available.slice(0, availableWorkers);
      const queued = available.slice(availableWorkers);

      // Enforce queue size limit
      const maxQueue = config.maxQueueSize || 100;
      const limitedQueue = queued.slice(0, maxQueue);

      // Record batch sizing decision if profiler is available
      if (context.profiler) {
        context.profiler.recordBatchSizing(
          scheduled.length,
          available.length,
          availableWorkers,
          {
            strategy: 'fifo',
            rule: 'Take up to availableWorkers tasks in FIFO order',
            dependencyBlocked: tasks.length - available.length,
            queueLimitApplied: queued.length > maxQueue,
          },
          {
            implementation: config.implementation,
            maxQueueSize: config.maxQueueSize,
          }
        );

        // Record parallelism snapshot
        const completedCount = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        context.profiler.recordParallelismSnapshot(
          scheduled.length,           // activeWorkers (tasks about to be assigned)
          {},                          // tasksByWorker (populated by router)
          limitedQueue.length,         // pendingTasks
          completedCount               // completedTasks
        );
      }

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'task.queued',
        moduleId: 'scheduler-fifo',
        payload: { scheduled: scheduled.length, queued: limitedQueue.length },
        level: 'info',
      });

      return {
        scheduled,
        queued: limitedQueue,
      };
    }
  );
}

/**
 * Calculate priority score for a task
 * @param {TaskState} taskState
 * @param {import('../../types/module.js').PriorityWeights} weights
 * @returns {number}
 */
function calculatePriority(taskState, weights) {
  const task = taskState.task;

  // Urgency: based on timeout (lower timeout = higher urgency)
  const urgencyScore = 1 / (task.timeout / 60); // Normalize to minutes

  // Complexity: based on estimated complexity
  const complexityMap = {
    trivial: 0.1,
    simple: 0.3,
    moderate: 0.5,
    complex: 0.7,
    'very-complex': 1.0,
  };
  const complexityScore = complexityMap[task.estimatedComplexity] || 0.5;

  // Dependencies: more dependencies = lower priority (needs more coordination)
  const dependencyScore = 1 / (task.dependencies.length + 1);

  return (
    weights.urgency * urgencyScore +
    weights.complexity * complexityScore +
    weights.dependencies * dependencyScore
  );
}

/**
 * Priority scheduler - weighted by task importance/dependencies
 * Best for critical path optimization
 */
export function createPriorityScheduler() {
  return createScheduler(
    'scheduler-priority',
    'priority',
    async (input, config, context) => {
      const { tasks, availableWorkers } = input;

      // Build task map for dependency checking
      const taskMap = new Map(tasks.map((t) => [t.task.id, t]));

      // Filter to pending tasks with satisfied dependencies
      const available = tasks.filter(
        (t) => t.status === TaskStatus.PENDING && areDependenciesSatisfied(t, taskMap)
      );

      // Default weights
      const weights = config.priorityWeights || {
        urgency: 0.3,
        complexity: 0.4,
        dependencies: 0.3,
      };

      // Sort by priority (descending)
      const sorted = [...available].sort((a, b) => {
        const priorityA = calculatePriority(a, weights);
        const priorityB = calculatePriority(b, weights);
        return priorityB - priorityA;
      });

      // Take up to availableWorkers tasks
      const scheduled = sorted.slice(0, availableWorkers);
      const queued = sorted.slice(availableWorkers);

      // Enforce queue size limit
      const maxQueue = config.maxQueueSize || 100;
      const limitedQueue = queued.slice(0, maxQueue);

      // Record batch sizing decision if profiler is available
      if (context.profiler) {
        const topPriority = scheduled.length > 0 ? calculatePriority(scheduled[0], weights) : 0;
        context.profiler.recordBatchSizing(
          scheduled.length,
          available.length,
          availableWorkers,
          {
            strategy: 'priority',
            rule: 'Sort by priority score, take top availableWorkers',
            weights,
            topPriorityScore: topPriority,
            lowestScheduledScore: scheduled.length > 0 ? calculatePriority(scheduled[scheduled.length - 1], weights) : 0,
            dependencyBlocked: tasks.length - available.length,
            queueLimitApplied: queued.length > maxQueue,
          },
          {
            implementation: config.implementation,
            maxQueueSize: config.maxQueueSize,
            priorityWeights: weights,
          }
        );

        // Record parallelism snapshot
        const completedCount = tasks.filter(t => t.status === TaskStatus.COMPLETED).length;
        context.profiler.recordParallelismSnapshot(
          scheduled.length,           // activeWorkers (tasks about to be assigned)
          {},                          // tasksByWorker (populated by router)
          limitedQueue.length,         // pendingTasks
          completedCount               // completedTasks
        );
      }

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'task.queued',
        moduleId: 'scheduler-priority',
        payload: {
          scheduled: scheduled.length,
          queued: limitedQueue.length,
          topPriority: scheduled.length > 0 ? calculatePriority(scheduled[0], weights) : 0,
        },
        level: 'info',
      });

      return {
        scheduled,
        queued: limitedQueue,
      };
    }
  );
}

/**
 * Register default scheduler implementations
 */
export function registerSchedulers() {
  if (!globalRegistry.has(ModuleType.SCHEDULER, 'fifo')) {
    globalRegistry.register(ModuleType.SCHEDULER, 'fifo', createFifoScheduler);
  }
  if (!globalRegistry.has(ModuleType.SCHEDULER, 'priority')) {
    globalRegistry.register(ModuleType.SCHEDULER, 'priority', createPriorityScheduler);
  }
}

// Auto-register on import
registerSchedulers();
