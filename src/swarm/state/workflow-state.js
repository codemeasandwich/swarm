/**
 * SWARM Framework - Workflow State Manager
 * Manages workflow state with Map-based task/worker tracking
 * @module swarm/state/workflow-state
 */

import { WorkflowStatus, createWorkflowState, createWorkerInstance } from '../types/workflow.js';
import { TaskStatus, createTaskState } from '../types/task.js';

/**
 * @typedef {import('../types/workflow.js').WorkflowState} WorkflowState
 * @typedef {import('../types/workflow.js').WorkflowConfig} WorkflowConfig
 * @typedef {import('../types/workflow.js').WorkerInstance} WorkerInstance
 * @typedef {import('../types/workflow.js').WorkflowError} WorkflowError
 * @typedef {import('../types/task.js').TaskDefinition} TaskDefinition
 * @typedef {import('../types/task.js').TaskState} TaskState
 * @typedef {import('../types/task.js').TaskResult} TaskResult
 */

/**
 * WorkflowStateManager provides methods for manipulating workflow state
 */
export class WorkflowStateManager {
  /** @type {WorkflowState} */
  #state;

  /**
   * Create a new WorkflowStateManager
   * @param {WorkflowState} [initialState]
   */
  constructor(initialState) {
    this.#state = initialState || createWorkflowState();
  }

  /**
   * Get the current state
   * @returns {WorkflowState}
   */
  getState() {
    return this.#state;
  }

  /**
   * Get the current status
   * @returns {import('../types/workflow.js').WorkflowStatusType}
   */
  getStatus() {
    return this.#state.status;
  }

  /**
   * Set the workflow status
   * @param {import('../types/workflow.js').WorkflowStatusType} status
   */
  setStatus(status) {
    this.#state.status = status;
    if (status === WorkflowStatus.COMPLETED || status === WorkflowStatus.FAILED) {
      this.#state.completedAt = Date.now();
    }
  }

  // ==========================================================================
  // Task Management
  // ==========================================================================

  /**
   * Add a task to the workflow
   * @param {TaskDefinition} task
   */
  addTask(task) {
    const taskState = createTaskState(task);
    this.#state.tasks.set(task.id, taskState);
  }

  /**
   * Add multiple tasks
   * @param {TaskDefinition[]} tasks
   */
  addTasks(tasks) {
    for (const task of tasks) {
      this.addTask(task);
    }
  }

  /**
   * Get a task by ID
   * @param {string} taskId
   * @returns {TaskState | undefined}
   */
  getTask(taskId) {
    return this.#state.tasks.get(taskId);
  }

  /**
   * Get all tasks
   * @returns {TaskState[]}
   */
  getAllTasks() {
    return Array.from(this.#state.tasks.values());
  }

  /**
   * Get tasks by status
   * @param {import('../types/task.js').TaskStatusType} status
   * @returns {TaskState[]}
   */
  getTasksByStatus(status) {
    return this.getAllTasks().filter((t) => t.status === status);
  }

  /**
   * Get pending tasks that have all dependencies satisfied
   * @returns {TaskState[]}
   */
  getAvailableTasks() {
    return this.getAllTasks().filter((taskState) => {
      if (taskState.status !== TaskStatus.PENDING) {
        return false;
      }

      // Check all dependencies are completed
      for (const depId of taskState.task.dependencies) {
        const dep = this.getTask(depId);
        if (!dep || dep.status !== TaskStatus.COMPLETED) {
          return false;
        }
      }

      return true;
    });
  }

  /**
   * Update task status
   * @param {string} taskId
   * @param {import('../types/task.js').TaskStatusType} status
   */
  setTaskStatus(taskId, status) {
    const task = this.#state.tasks.get(taskId);
    if (task) {
      task.status = status;
    }
  }

  /**
   * Assign a task to a worker
   * @param {string} taskId
   * @param {string} workerId
   */
  assignTask(taskId, workerId) {
    const task = this.#state.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.ASSIGNED;
      task.assignedWorkerId = workerId;
    }
  }

  /**
   * Mark task as started
   * @param {string} taskId
   * @param {string} workerId
   */
  startTask(taskId, workerId) {
    const task = this.#state.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.EXECUTING;
      task.attempts.push({
        workerId,
        startedAt: Date.now(),
        tokensUsed: 0,
      });
    }
  }

  /**
   * Complete a task with result
   * @param {string} taskId
   * @param {TaskResult} result
   * @param {number} tokensUsed
   */
  completeTask(taskId, result, tokensUsed) {
    const task = this.#state.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.COMPLETED;
      task.result = result;

      // Update the last attempt
      const lastAttempt = task.attempts[task.attempts.length - 1];
      if (lastAttempt) {
        lastAttempt.completedAt = Date.now();
        lastAttempt.tokensUsed = tokensUsed;
      }

      // Update totals
      this.#state.totalTokensUsed += tokensUsed;
    }
  }

  /**
   * Fail a task with error
   * @param {string} taskId
   * @param {string} error
   * @param {number} tokensUsed
   */
  failTask(taskId, error, tokensUsed) {
    const task = this.#state.tasks.get(taskId);
    if (task) {
      task.status = TaskStatus.FAILED;

      // Update the last attempt
      const lastAttempt = task.attempts[task.attempts.length - 1];
      if (lastAttempt) {
        lastAttempt.completedAt = Date.now();
        lastAttempt.tokensUsed = tokensUsed;
        lastAttempt.error = error;
      }

      // Update totals
      this.#state.totalTokensUsed += tokensUsed;
    }
  }

  // ==========================================================================
  // Worker Management
  // ==========================================================================

  /**
   * Add a worker instance
   * @param {string} profileId
   * @returns {WorkerInstance}
   */
  addWorker(profileId) {
    const worker = createWorkerInstance(profileId);
    this.#state.workers.set(worker.id, worker);
    return worker;
  }

  /**
   * Get a worker by ID
   * @param {string} workerId
   * @returns {WorkerInstance | undefined}
   */
  getWorker(workerId) {
    return this.#state.workers.get(workerId);
  }

  /**
   * Get all workers
   * @returns {WorkerInstance[]}
   */
  getAllWorkers() {
    return Array.from(this.#state.workers.values());
  }

  /**
   * Get idle workers
   * @returns {WorkerInstance[]}
   */
  getIdleWorkers() {
    return this.getAllWorkers().filter((w) => w.status === 'idle');
  }

  /**
   * Update worker status
   * @param {string} workerId
   * @param {import('../types/workflow.js').WorkerStatusType} status
   */
  setWorkerStatus(workerId, status) {
    const worker = this.#state.workers.get(workerId);
    if (worker) {
      worker.status = status;
    }
  }

  /**
   * Assign a worker to a task
   * @param {string} workerId
   * @param {string} taskId
   */
  assignWorkerToTask(workerId, taskId) {
    const worker = this.#state.workers.get(workerId);
    if (worker) {
      worker.status = 'working';
      worker.currentTaskId = taskId;
      worker.startedAt = Date.now();
    }
  }

  /**
   * Mark worker as completed
   * @param {string} workerId
   * @param {number} tokensUsed
   * @param {number} qualityScore
   */
  completeWorker(workerId, tokensUsed, qualityScore) {
    const worker = this.#state.workers.get(workerId);
    if (worker) {
      worker.status = 'completed';
      worker.metrics.tasksCompleted += 1;
      worker.metrics.totalTokensUsed += tokensUsed;

      // Update average quality score
      const total = worker.metrics.tasksCompleted;
      const oldAvg = worker.metrics.averageQualityScore;
      worker.metrics.averageQualityScore = (oldAvg * (total - 1) + qualityScore) / total;

      if (worker.startedAt) {
        worker.metrics.totalRuntime += (Date.now() - worker.startedAt) / 1000;
      }
    }
  }

  /**
   * Mark worker as failed
   * @param {string} workerId
   */
  failWorker(workerId) {
    const worker = this.#state.workers.get(workerId);
    if (worker) {
      worker.status = 'failed';
      worker.metrics.tasksFailed += 1;
    }
  }

  // ==========================================================================
  // Error Management
  // ==========================================================================

  /**
   * Add an error to the workflow
   * @param {Omit<WorkflowError, 'timestamp'>} error
   */
  addError(error) {
    this.#state.errors.push({
      timestamp: Date.now(),
      ...error,
    });
  }

  /**
   * Get all errors
   * @returns {WorkflowError[]}
   */
  getErrors() {
    return this.#state.errors;
  }

  // ==========================================================================
  // Cost Tracking
  // ==========================================================================

  /**
   * Add to the total cost
   * @param {number} cost
   */
  addCost(cost) {
    this.#state.totalCost += cost;
  }

  /**
   * Get total cost
   * @returns {number}
   */
  getTotalCost() {
    return this.#state.totalCost;
  }

  /**
   * Get total tokens used
   * @returns {number}
   */
  getTotalTokensUsed() {
    return this.#state.totalTokensUsed;
  }

  // ==========================================================================
  // Summary
  // ==========================================================================

  /**
   * Get workflow summary statistics
   * @returns {import('../types/workflow.js').WorkflowSummary}
   */
  getSummary() {
    const tasks = this.getAllTasks();
    const completed = tasks.filter((t) => t.status === TaskStatus.COMPLETED);
    const failed = tasks.filter((t) => t.status === TaskStatus.FAILED);

    const qualityScores = completed
      .filter((t) => t.result?.qualityScore !== undefined)
      .map((t) => t.result?.qualityScore || 0);

    const averageQuality =
      qualityScores.length > 0
        ? qualityScores.reduce((a, b) => a + b, 0) / qualityScores.length
        : 0;

    const runtimeMs = this.#state.completedAt
      ? this.#state.completedAt - this.#state.startedAt
      : Date.now() - this.#state.startedAt;

    return {
      totalTasks: tasks.length,
      completedTasks: completed.length,
      failedTasks: failed.length,
      totalRuntime: runtimeMs / 1000,
      totalTokens: this.#state.totalTokensUsed,
      totalCost: this.#state.totalCost,
      averageQuality,
    };
  }
}
