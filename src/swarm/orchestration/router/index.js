/**
 * SWARM Framework - Router Module
 * Matches tasks to appropriate worker configurations
 * @module swarm/orchestration/router
 */

import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';

/**
 * @typedef {import('../../types/module.js').RouterConfig} RouterConfig
 * @typedef {import('../../types/task.js').TaskDefinition} TaskDefinition
 * @typedef {import('../../types/workflow.js').WorkerProfile} WorkerProfile
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 */

/**
 * @typedef {Object} RouterInput
 * @property {TaskDefinition} task - Task to route
 * @property {WorkerProfile[]} workers - Available worker profiles
 */

/**
 * @typedef {Object} RouterOutput
 * @property {WorkerProfile | null} selectedWorker - Best matching worker or null
 * @property {number} matchScore - How well the worker matches (0-1)
 * @property {string} [reason] - Explanation of selection
 */

/**
 * Base router implementation with common functionality
 * @param {string} id
 * @param {string} implementation
 * @param {(input: RouterInput, config: RouterConfig, context: ExecutionContext) => Promise<RouterOutput>} routeFn
 * @returns {import('../../types/module.js').Module<RouterConfig, RouterInput, RouterOutput>}
 */
export function createRouter(id, implementation, routeFn) {
  /** @type {RouterConfig | null} */
  let config = null;

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.ROUTER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Router not configured');
      }
      return routeFn(input, config, context);
    },
  });
}

/**
 * Static router - fixed task-type to worker-config mapping
 * Best for predictable workloads
 */
export function createStaticRouter() {
  return createRouter(
    'router-static',
    'static',
    async (input, config, context) => {
      const { task, workers } = input;

      // Use static mapping if provided
      if (config.staticMapping && config.staticMapping[task.type]) {
        const mappedWorkerId = config.staticMapping[task.type];
        const worker = workers.find((w) => w.id === mappedWorkerId);

        if (worker) {
          context.emit({
            timestamp: Date.now(),
            runId: context.runId,
            eventType: 'task.assigned',
            moduleId: 'router-static',
            taskId: task.id,
            payload: { workerId: worker.id, matchScore: 1.0 },
            level: 'info',
          });

          return {
            selectedWorker: worker,
            matchScore: 1.0,
            reason: `Static mapping: ${task.type} -> ${worker.id}`,
          };
        }
      }

      // Fallback: return first available worker
      const worker = workers[0] || null;

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'task.assigned',
        moduleId: 'router-static',
        taskId: task.id,
        payload: { workerId: worker?.id, matchScore: worker ? 0.5 : 0 },
        level: worker ? 'info' : 'warn',
      });

      return {
        selectedWorker: worker,
        matchScore: worker ? 0.5 : 0,
        reason: worker ? 'Fallback to first available worker' : 'No workers available',
      };
    }
  );
}

/**
 * Calculate skill match score between task and worker
 * @param {TaskDefinition} task
 * @param {WorkerProfile} worker
 * @returns {number}
 */
function calculateSkillMatch(task, worker) {
  if (task.requiredSkills.length === 0) {
    return 1.0; // No skills required = perfect match
  }

  const workerSkills = new Set(worker.capabilities.skills);
  let matchedSkills = 0;

  for (const skill of task.requiredSkills) {
    if (workerSkills.has(skill)) {
      matchedSkills++;
    }
  }

  return matchedSkills / task.requiredSkills.length;
}

/**
 * Calculate tool match score between task and worker
 * @param {TaskDefinition} task
 * @param {WorkerProfile} worker
 * @returns {number}
 */
function calculateToolMatch(task, worker) {
  if (task.toolRequirements.length === 0) {
    return 1.0; // No tools required = perfect match
  }

  const workerTools = new Set(worker.capabilities.toolAccess);
  let matchedTools = 0;

  for (const tool of task.toolRequirements) {
    if (workerTools.has(tool)) {
      matchedTools++;
    }
  }

  return matchedTools / task.toolRequirements.length;
}

/**
 * Calculate overall capability match
 * @param {TaskDefinition} task
 * @param {WorkerProfile} worker
 * @returns {number}
 */
function calculateCapabilityMatch(task, worker) {
  const skillMatch = calculateSkillMatch(task, worker);
  const toolMatch = calculateToolMatch(task, worker);

  // Weight skills higher than tools
  return skillMatch * 0.7 + toolMatch * 0.3;
}

/**
 * Capability router - matches required skills to worker capabilities
 * Best for heterogeneous task mix
 */
export function createCapabilityRouter() {
  return createRouter(
    'router-capability',
    'capability',
    async (input, config, context) => {
      const { task, workers } = input;
      const threshold = config.capabilityThreshold || 0.5;

      // Calculate match scores for all workers
      const scored = workers.map((worker) => ({
        worker,
        score: calculateCapabilityMatch(task, worker),
      }));

      // Sort by score descending
      scored.sort((a, b) => b.score - a.score);

      // Find best matching worker above threshold
      const best = scored.find((s) => s.score >= threshold);

      if (best) {
        context.emit({
          timestamp: Date.now(),
          runId: context.runId,
          eventType: 'task.assigned',
          moduleId: 'router-capability',
          taskId: task.id,
          payload: { workerId: best.worker.id, matchScore: best.score },
          level: 'info',
        });

        return {
          selectedWorker: best.worker,
          matchScore: best.score,
          reason: `Capability match: score ${best.score.toFixed(2)} (threshold: ${threshold})`,
        };
      }

      // No worker meets threshold - return best available with warning
      const fallback = scored[0];
      if (fallback) {
        context.emit({
          timestamp: Date.now(),
          runId: context.runId,
          eventType: 'task.assigned',
          moduleId: 'router-capability',
          taskId: task.id,
          payload: { workerId: fallback.worker.id, matchScore: fallback.score, belowThreshold: true },
          level: 'warn',
        });

        return {
          selectedWorker: fallback.worker,
          matchScore: fallback.score,
          reason: `Best available worker (below threshold ${threshold}): score ${fallback.score.toFixed(2)}`,
        };
      }

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'task.assigned',
        moduleId: 'router-capability',
        taskId: task.id,
        payload: { matchScore: 0 },
        level: 'error',
      });

      return {
        selectedWorker: null,
        matchScore: 0,
        reason: 'No workers available',
      };
    }
  );
}

/**
 * Register default router implementations
 */
export function registerRouters() {
  if (!globalRegistry.has(ModuleType.ROUTER, 'static')) {
    globalRegistry.register(ModuleType.ROUTER, 'static', createStaticRouter);
  }
  if (!globalRegistry.has(ModuleType.ROUTER, 'capability')) {
    globalRegistry.register(ModuleType.ROUTER, 'capability', createCapabilityRouter);
  }
}

// Auto-register on import
registerRouters();
