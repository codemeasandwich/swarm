/**
 * SWARM Framework - Orchestration Layer
 * Planner, Scheduler, Router, Judge modules
 * @module swarm/orchestration
 */

// Planner
export {
  createPlanner,
  createSingleShotPlanner,
  createIterativePlanner,
  registerPlanners,
} from './planner/index.js';

// Scheduler
export {
  createScheduler,
  createFifoScheduler,
  createPriorityScheduler,
  registerSchedulers,
} from './scheduler/index.js';

// Router
export {
  createRouter,
  createStaticRouter,
  createCapabilityRouter,
  registerRouters,
} from './router/index.js';

// Judge
export {
  createJudge,
  createDeterministicJudge,
  createLlmJudge,
  createHybridJudge,
  registerJudges,
} from './judge/index.js';

/**
 * Register all orchestration modules in the global registry
 */
export function registerOrchestrationModules() {
  // Import modules to trigger auto-registration
  import('./planner/index.js');
  import('./scheduler/index.js');
  import('./router/index.js');
  import('./judge/index.js');
}
