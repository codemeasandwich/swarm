/**
 * @file Task-to-persona matching and assignment.
 * @module personas/matcher
 */

import { TaskStatus } from '../types/index.js';

/**
 * Matcher for assigning tasks to personas/agents.
 */
export class PersonaMatcher {
  /**
   * Create a PersonaMatcher.
   * @param {import('../plan/models.js').ProjectPlan} plan - Project plan
   */
  constructor(plan) {
    /** @type {import('../plan/models.js').ProjectPlan} */
    this.plan = plan;
  }

  /**
   * Get all tasks that can be claimed by a specific persona role.
   * Tasks must be available and not blocked by dependencies.
   *
   * @param {string} role - Persona role
   * @returns {import('../plan/models.js').Task[]}
   */
  getClaimableTasks(role) {
    const completedTaskIds = new Set(
      this.plan.getAllTasks()
        .filter((t) => t.status === TaskStatus.COMPLETE)
        .map((t) => t.id)
    );

    const available = [];

    for (const epic of this.plan.epics) {
      for (const story of epic.stories) {
        for (const task of story.tasks) {
          // Must be for this role
          if (task.role !== role) continue;

          // Must be available
          if (task.status !== TaskStatus.AVAILABLE) continue;

          // Must not be blocked
          const blockedBy = task.isBlockedBy(completedTaskIds);
          if (blockedBy.length === 0) {
            available.push(task);
          }
        }
      }
    }

    return available;
  }

  /**
   * Claim a task for an agent.
   * Updates the task status and assigns the agent.
   *
   * @param {string} taskId - Task ID to claim
   * @param {string} agentId - Agent claiming the task
   * @param {string} branch - Git branch for the task
   * @returns {import('../plan/models.js').Task|null} The claimed task or null if not found
   */
  claimTask(taskId, agentId, branch) {
    const task = this.plan.getTaskById(taskId);
    if (!task) return null;

    if (task.status !== TaskStatus.AVAILABLE) {
      return null; // Already claimed
    }

    task.status = TaskStatus.CLAIMED;
    task.assignedAgent = agentId;
    task.branch = branch;
    task.claimedAt = new Date();

    return task;
  }

  /**
   * Release a claimed task back to available.
   * @param {string} taskId - Task ID to release
   * @returns {boolean} True if released
   */
  releaseTask(taskId) {
    const task = this.plan.getTaskById(taskId);
    if (!task) return false;

    if (task.status === TaskStatus.CLAIMED || task.status === TaskStatus.IN_PROGRESS) {
      task.status = TaskStatus.AVAILABLE;
      task.assignedAgent = null;
      task.branch = null;
      task.claimedAt = null;
      return true;
    }

    return false;
  }

  /**
   * Mark a task as in progress.
   * @param {string} taskId - Task ID
   * @returns {boolean} True if updated
   */
  startTask(taskId) {
    const task = this.plan.getTaskById(taskId);
    if (!task) return false;

    if (task.status === TaskStatus.CLAIMED) {
      task.status = TaskStatus.IN_PROGRESS;
      return true;
    }

    return false;
  }

  /**
   * Mark a task as complete.
   * @param {string} taskId - Task ID
   * @param {string} [prUrl] - PR URL if applicable
   * @returns {boolean} True if updated
   */
  completeTask(taskId, prUrl) {
    const task = this.plan.getTaskById(taskId);
    if (!task) return false;

    task.status = TaskStatus.COMPLETE;
    task.completedAt = new Date();
    if (prUrl) {
      task.prUrl = prUrl;
    }

    return true;
  }

  /**
   * Mark a task as blocked.
   * @param {string} taskId - Task ID
   * @returns {boolean} True if updated
   */
  blockTask(taskId) {
    const task = this.plan.getTaskById(taskId);
    if (!task) return false;

    task.status = TaskStatus.BLOCKED;
    return true;
  }

  /**
   * Mark a task as PR pending.
   * @param {string} taskId - Task ID
   * @param {string} prUrl - PR URL
   * @returns {boolean} True if updated
   */
  setTaskPRPending(taskId, prUrl) {
    const task = this.plan.getTaskById(taskId);
    if (!task) return false;

    task.status = TaskStatus.PR_PENDING;
    task.prUrl = prUrl;
    return true;
  }

  /**
   * Get all tasks currently assigned to an agent.
   * @param {string} agentId - Agent ID
   * @returns {import('../plan/models.js').Task[]}
   */
  getTasksForAgent(agentId) {
    return this.plan.getAllTasks().filter((t) => t.assignedAgent === agentId);
  }

  /**
   * Get blocked dependencies for a task.
   * @param {string} taskId - Task ID
   * @returns {string[]} IDs of blocking tasks
   */
  getBlockedDependencies(taskId) {
    const task = this.plan.getTaskById(taskId);
    if (!task) return [];

    const completedTaskIds = new Set(
      this.plan.getAllTasks()
        .filter((t) => t.status === TaskStatus.COMPLETE)
        .map((t) => t.id)
    );

    return task.isBlockedBy(completedTaskIds);
  }

  /**
   * Check if all dependencies for a task are complete.
   * @param {string} taskId - Task ID
   * @returns {boolean}
   */
  areDependenciesComplete(taskId) {
    return this.getBlockedDependencies(taskId).length === 0;
  }

  /**
   * Get the next available task for a role, prioritized by dependencies.
   * Tasks with fewer or no dependencies are prioritized.
   *
   * @param {string} role - Persona role
   * @returns {import('../plan/models.js').Task|null}
   */
  getNextTask(role) {
    const claimable = this.getClaimableTasks(role);
    if (claimable.length === 0) return null;

    // Sort by number of dependencies (fewer first)
    claimable.sort((a, b) => a.dependencies.length - b.dependencies.length);

    return claimable[0];
  }

  /**
   * Get statistics about task status.
   * @returns {{total: number, available: number, claimed: number, inProgress: number, blocked: number, complete: number}}
   */
  getTaskStats() {
    const tasks = this.plan.getAllTasks();
    return {
      total: tasks.length,
      available: tasks.filter((t) => t.status === TaskStatus.AVAILABLE).length,
      claimed: tasks.filter((t) => t.status === TaskStatus.CLAIMED).length,
      inProgress: tasks.filter((t) => t.status === TaskStatus.IN_PROGRESS).length,
      blocked: tasks.filter((t) => t.status === TaskStatus.BLOCKED).length,
      complete: tasks.filter((t) => t.status === TaskStatus.COMPLETE).length,
    };
  }

  /**
   * Get statistics by role.
   * @returns {Map<string, {total: number, available: number, complete: number}>}
   */
  getStatsByRole() {
    const stats = new Map();

    for (const persona of this.plan.personas) {
      const roleTasks = this.plan.getTasksByRole(persona.role);
      stats.set(persona.role, {
        total: roleTasks.length,
        available: roleTasks.filter((t) => t.status === TaskStatus.AVAILABLE).length,
        complete: roleTasks.filter((t) => t.status === TaskStatus.COMPLETE).length,
      });
    }

    return stats;
  }
}
