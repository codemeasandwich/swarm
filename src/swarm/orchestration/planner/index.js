/**
 * SWARM Framework - Planner Module
 * Decomposes high-level goals into discrete, parallelisable tasks
 * @module swarm/orchestration/planner
 */

import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';

/**
 * @typedef {import('../../types/module.js').PlannerConfig} PlannerConfig
 * @typedef {import('../../types/task.js').TaskDefinition} TaskDefinition
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 */

/**
 * @typedef {Object} PlannerInput
 * @property {string} goal - High-level goal to decompose
 * @property {string} [context] - Additional context for planning
 * @property {TaskDefinition[]} [existingTasks] - Tasks already created
 */

/**
 * @typedef {Object} PlannerOutput
 * @property {TaskDefinition[]} tasks - Decomposed tasks
 * @property {string} [reasoning] - Explanation of decomposition
 */

/**
 * Base planner implementation with common functionality
 * @param {string} id
 * @param {string} implementation
 * @param {(input: PlannerInput, config: PlannerConfig, context: ExecutionContext) => Promise<PlannerOutput>} planFn
 * @returns {import('../../types/module.js').Module<PlannerConfig, PlannerInput, PlannerOutput>}
 */
export function createPlanner(id, implementation, planFn) {
  /** @type {PlannerConfig | null} */
  let config = null;

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.PLANNER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Planner not configured');
      }
      return planFn(input, config, context);
    },
  });
}

/**
 * Single-shot planner - creates complete plan in one LLM call
 * Best for well-defined tasks and cost-sensitive deployments
 */
export function createSingleShotPlanner() {
  return createPlanner(
    'planner-single-shot',
    'single-shot',
    async (input, config, context) => {
      // For now, create a simple decomposition based on the goal
      // In production, this would call the LLM via Claude CLI
      const tasks = decomposeGoal(input.goal, config);

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'plan.completed',
        moduleId: 'planner-single-shot',
        payload: { taskCount: tasks.length },
        level: 'info',
      });

      return {
        tasks,
        reasoning: `Decomposed "${input.goal}" into ${tasks.length} tasks using single-shot planning`,
      };
    }
  );
}

/**
 * Iterative planner - plans in waves, refines based on results
 * Best for exploratory work and unknown scope
 */
export function createIterativePlanner() {
  return createPlanner(
    'planner-iterative',
    'iterative',
    async (input, config, context) => {
      // First wave: initial decomposition
      const initialTasks = decomposeGoal(input.goal, config);

      // In production, this would iterate based on feedback
      // For now, just return the initial decomposition
      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'plan.completed',
        moduleId: 'planner-iterative',
        payload: { taskCount: initialTasks.length, waves: 1 },
        level: 'info',
      });

      return {
        tasks: initialTasks,
        reasoning: `Iteratively planned "${input.goal}" - initial wave produced ${initialTasks.length} tasks`,
      };
    }
  );
}

/**
 * Decompose a goal into tasks based on configuration
 * @param {string} goal
 * @param {PlannerConfig} config
 * @returns {TaskDefinition[]}
 */
function decomposeGoal(goal, config) {
  const tasks = [];
  const now = Date.now();

  // Determine how many tasks based on granularity
  const taskCount = config.taskGranularity === 'fine' ? 5 :
                    config.taskGranularity === 'medium' ? 3 : 1;

  for (let i = 0; i < taskCount; i++) {
    const taskId = `task-${now}-${i}`;
    const isParallel = config.parallelismHint === 'parallel' ||
                      (config.parallelismHint === 'mixed' && i % 2 === 0);

    tasks.push({
      id: taskId,
      type: 'code-generation',
      description: `Subtask ${i + 1} of: ${goal}`,
      requiredSkills: ['code-generation'],
      acceptanceCriteria: [
        {
          type: 'deterministic',
          description: 'Code compiles without errors',
          weight: 0.5,
        },
        {
          type: 'deterministic',
          description: 'Tests pass',
          weight: 0.5,
        },
      ],
      dependencies: isParallel || i === 0 ? [] : [tasks[i - 1].id],
      estimatedComplexity: 'moderate',
      contextRequirements: [],
      toolRequirements: ['file-editor', 'test-runner'],
      timeout: 300,
    });
  }

  return tasks;
}

/**
 * Register default planner implementations
 */
export function registerPlanners() {
  if (!globalRegistry.has(ModuleType.PLANNER, 'single-shot')) {
    globalRegistry.register(ModuleType.PLANNER, 'single-shot', createSingleShotPlanner);
  }
  if (!globalRegistry.has(ModuleType.PLANNER, 'iterative')) {
    globalRegistry.register(ModuleType.PLANNER, 'iterative', createIterativePlanner);
  }
}

// Auto-register on import
registerPlanners();
