/**
 * @file Main orchestrator for coordinating multiple agents.
 * @module orchestrator/orchestrator
 */

import { resolve } from 'node:path';
import { getConfig } from '../config/index.js';
import { PlanParser } from '../plan/parser.js';
import { PlanValidator } from '../plan/validator.js';
import { PersonaMatcher } from '../personas/matcher.js';
import { PersonaConfig, AgentInstance } from '../personas/models.js';
import { ClaudeMdGenerator } from '../personas/generator.js';
import { TerminalManager } from '../runtime/process.js';
import { BranchManager } from '../runtime/branches.js';
import { WorkspaceManager } from '../runtime/workspace.js';
import { LocalCIProvider } from '../ci/local.js';
import { AgentLifecycleLoop } from '../lifecycle/loop.js';
import { LifecycleState, LoopResultType } from '../types/index.js';
import {
  OrchestratorError,
  PlanValidationError,
  AgentSpawnError,
} from './errors.js';

/**
 * @typedef {Object} OrchestratorConfig
 * @property {string} repoDir - Repository directory
 * @property {string} planDir - Plan directory
 * @property {boolean} [autoSpawn=true] - Whether to auto-spawn agents
 * @property {number} [maxConcurrentAgents=5] - Maximum concurrent agents
 * @property {string} [integrationBranch='integration'] - Integration branch name
 * @property {string} [commFilePath] - Path to communications.json
 */

/**
 * @typedef {Object} OrchestratorStatus
 * @property {boolean} running - Whether orchestrator is running
 * @property {number} agentCount - Number of active agents
 * @property {Object} taskStats - Task statistics
 * @property {Array<{agentId: string, role: string, state: string, taskId: string|null}>} agents - Agent statuses
 */

/**
 * Main orchestrator that coordinates multiple agents.
 */
export class Orchestrator {
  /**
   * Create an Orchestrator.
   * @param {OrchestratorConfig} config - Configuration
   */
  constructor(config) {
    const globalConfig = getConfig();

    /** @type {string} */
    this.repoDir = resolve(config.repoDir);
    /** @type {string} */
    this.planDir = resolve(config.planDir);
    /** @type {boolean} */
    this.autoSpawn = config.autoSpawn ?? true;
    /** @type {number} */
    this.maxConcurrentAgents = config.maxConcurrentAgents ?? globalConfig.maxConcurrentAgents;
    /** @type {string} */
    this.integrationBranch = config.integrationBranch ?? globalConfig.integrationBranch;
    /** @type {string} */
    this.commFilePath = config.commFilePath ?? resolve(this.repoDir, globalConfig.commFile);

    /** @type {import('../plan/models.js').ProjectPlan|null} */
    this.plan = null;
    /** @type {PersonaMatcher|null} */
    this.personaMatcher = null;
    /** @type {ClaudeMdGenerator|null} */
    this.claudeMdGenerator = null;
    /** @type {TerminalManager} */
    this.terminalManager = new TerminalManager(resolve(this.repoDir, globalConfig.sandboxBaseDir));
    /** @type {BranchManager} */
    this.branchManager = new BranchManager(this.repoDir, this.integrationBranch);
    /** @type {WorkspaceManager} */
    this.workspaceManager = new WorkspaceManager(
      resolve(this.repoDir, globalConfig.sandboxBaseDir),
      this.repoDir
    );
    /** @type {LocalCIProvider} */
    this.ciProvider = new LocalCIProvider({
      repoDir: this.repoDir,
      integrationBranch: this.integrationBranch,
    });

    /** @private @type {Map<string, AgentInstance>} */
    this._agents = new Map();
    /** @private @type {Map<string, Promise<LoopResult>>} */
    this._agentLoops = new Map();
    /** @private @type {boolean} */
    this._running = false;
    /** @private @type {boolean} */
    this._started = false;
  }

  /**
   * Start the orchestrator.
   * Parses and validates the plan, then spawns initial agents.
   *
   * @returns {Promise<void>}
   * @throws {PlanParseError} If plan parsing fails
   * @throws {PlanValidationError} If plan validation fails
   */
  async start() {
    if (this._started) {
      throw new OrchestratorError('Orchestrator already started');
    }

    console.log('[Orchestrator] Starting...');

    // Parse the plan
    const parser = new PlanParser(this.planDir);
    this.plan = await parser.parsePlan();
    console.log(`[Orchestrator] Parsed plan: ${this.plan.name}`);

    // Validate the plan
    const validator = new PlanValidator();
    const validationResult = validator.validate(this.plan);

    if (!validationResult.isValid) {
      throw new PlanValidationError('Plan validation failed', {
        errors: validationResult.errors,
        warnings: validationResult.warnings,
      });
    }

    if (validationResult.warnings.length > 0) {
      console.warn('[Orchestrator] Plan validation warnings:');
      for (const warning of validationResult.warnings) {
        console.warn(`  - ${warning}`);
      }
    }

    // Initialize helpers
    this.personaMatcher = new PersonaMatcher(this.plan);
    this.claudeMdGenerator = new ClaudeMdGenerator(this.plan);

    this._running = true;
    this._started = true;

    // Auto-spawn agents if enabled
    if (this.autoSpawn) {
      await this._spawnInitialAgents();
    }

    console.log('[Orchestrator] Started');
  }

  /**
   * Spawn initial agents for available tasks.
   * @private
   * @returns {Promise<void>}
   */
  async _spawnInitialAgents() {
    const roles = this.plan.getRoles();

    for (const role of roles) {
      if (this._agents.size >= this.maxConcurrentAgents) {
        break;
      }

      const tasks = this.personaMatcher.getClaimableTasks(role);
      if (tasks.length > 0) {
        const task = tasks[0];
        try {
          await this.spawnAgent(role, task.id);
        } catch (error) {
          console.error(`[Orchestrator] Failed to spawn agent for ${role}: ${error.message}`);
        }
      }
    }
  }

  /**
   * Spawn a new agent for a specific role and task.
   *
   * @param {string} role - Agent role
   * @param {string} taskId - Task ID to claim
   * @returns {Promise<AgentInstance>}
   * @throws {AgentSpawnError} If spawning fails
   */
  async spawnAgent(role, taskId) {
    if (!this._running) {
      throw new OrchestratorError('Orchestrator not running');
    }

    if (this._agents.size >= this.maxConcurrentAgents) {
      throw new AgentSpawnError('Maximum concurrent agents reached', { taskId });
    }

    const persona = this.plan.getPersonaByRole(role);
    if (!persona) {
      throw new AgentSpawnError(`No persona found for role: ${role}`, { taskId });
    }

    const task = this.plan.getTaskById(taskId);
    if (!task) {
      throw new AgentSpawnError(`Task not found: ${taskId}`, { taskId });
    }

    // Generate agent ID
    const agentId = `${role}-${Date.now().toString(36)}`;

    // Create branch for agent
    const branchInfo = await this.branchManager.createAgentBranch(agentId, taskId);

    // Claim the task
    this.personaMatcher.claimTask(taskId, agentId, branchInfo.name);

    // Create agent instance
    const personaConfig = PersonaConfig.fromPersona(persona);
    const agent = new AgentInstance({
      agentId,
      role,
      branch: branchInfo.name,
      lifecycleState: LifecycleState.WORKING,
      currentTaskId: taskId,
      personaConfig,
    });

    this._agents.set(agentId, agent);

    // Start the lifecycle loop
    const loop = new AgentLifecycleLoop({
      repoDir: this.repoDir,
      plan: this.plan,
      ciProvider: this.ciProvider,
      terminalManager: this.terminalManager,
      branchManager: this.branchManager,
      workspaceManager: this.workspaceManager,
      commFilePath: this.commFilePath,
      claudeMdGenerator: this.claudeMdGenerator,
    });

    const loopPromise = this._runAgentLoop(agent, task, loop);
    this._agentLoops.set(agentId, loopPromise);

    console.log(`[Orchestrator] Spawned agent ${agentId} for task ${taskId}`);
    return agent;
  }

  /**
   * Run the agent loop and handle completion.
   * @private
   * @param {AgentInstance} agent
   * @param {import('../plan/models.js').Task} task
   * @param {AgentLifecycleLoop} loop
   * @returns {Promise<LoopResult>}
   */
  async _runAgentLoop(agent, task, loop) {
    try {
      const result = await loop.runAgentLoop(agent, task);

      // Handle result
      if (result.resultType === LoopResultType.TASK_COMPLETE) {
        this.personaMatcher.completeTask(task.id);
        await this._checkMilestoneCompletion();
      }

      // Cleanup
      this._agents.delete(agent.agentId);
      this._agentLoops.delete(agent.agentId);

      // Try to spawn replacement agent
      if (this._running && this.autoSpawn) {
        await this._trySpawnReplacementAgent(agent.role);
      }

      return result;
    } catch (error) {
      console.error(`[Orchestrator] Agent ${agent.agentId} loop error:`, error);
      this._agents.delete(agent.agentId);
      this._agentLoops.delete(agent.agentId);
      throw error;
    }
  }

  /**
   * Try to spawn a replacement agent for a role.
   * @private
   * @param {string} role
   * @returns {Promise<void>}
   */
  async _trySpawnReplacementAgent(role) {
    if (this._agents.size >= this.maxConcurrentAgents) {
      return;
    }

    const tasks = this.personaMatcher.getClaimableTasks(role);
    if (tasks.length > 0) {
      try {
        await this.spawnAgent(role, tasks[0].id);
      } catch (error) {
        console.error(`[Orchestrator] Failed to spawn replacement: ${error.message}`);
      }
    }
  }

  /**
   * Check if any milestones are complete and create PRs.
   * @private
   * @returns {Promise<void>}
   */
  async _checkMilestoneCompletion() {
    for (const milestone of this.plan.milestones) {
      if (milestone.completed) continue;

      if (this.plan.isMilestoneComplete(milestone.id)) {
        console.log(`[Orchestrator] Milestone ${milestone.id} complete!`);

        // Create PR for milestone
        try {
          const prInfo = await this.ciProvider.createPR({
            title: `Milestone: ${milestone.name}`,
            body: `Completed milestone ${milestone.id}: ${milestone.description}`,
            sourceBranch: this.integrationBranch,
            targetBranch: 'main',
          });

          milestone.completed = true;
          milestone.prUrl = prInfo.url;
        } catch (error) {
          console.error(`[Orchestrator] Failed to create milestone PR: ${error.message}`);
        }
      }
    }
  }

  /**
   * Get the current status of the orchestrator.
   * @returns {OrchestratorStatus}
   */
  status() {
    const agents = Array.from(this._agents.values()).map((agent) => ({
      agentId: agent.agentId,
      role: agent.role,
      state: agent.lifecycleState,
      taskId: agent.currentTaskId,
    }));

    const taskStats = this.personaMatcher?.getTaskStats() ?? {
      total: 0,
      available: 0,
      claimed: 0,
      inProgress: 0,
      blocked: 0,
      complete: 0,
    };

    return {
      running: this._running,
      agentCount: this._agents.size,
      taskStats,
      agents,
    };
  }

  /**
   * Wait for all agents to complete.
   * @returns {Promise<LoopResult[]>}
   */
  async waitForCompletion() {
    const results = [];

    while (this._agentLoops.size > 0) {
      const entries = Array.from(this._agentLoops.entries());
      const [agentId, promise] = entries[0];

      try {
        const result = await promise;
        results.push(result);
      } catch (error) {
        console.error(`[Orchestrator] Agent ${agentId} failed:`, error);
      }
    }

    return results;
  }

  /**
   * Stop the orchestrator.
   * Terminates all agents and cleans up resources.
   *
   * @returns {Promise<void>}
   */
  async stop() {
    console.log('[Orchestrator] Stopping...');
    this._running = false;

    // Terminate all agents
    await this.terminalManager.terminateAll();

    // Cleanup workspaces
    await this.workspaceManager.cleanupAll();

    // Clear tracking
    this._agents.clear();
    this._agentLoops.clear();

    this._started = false;
    console.log('[Orchestrator] Stopped');
  }

  /**
   * Get an agent by ID.
   * @param {string} agentId - Agent identifier
   * @returns {AgentInstance|undefined}
   */
  getAgent(agentId) {
    return this._agents.get(agentId);
  }

  /**
   * Get all active agents.
   * @returns {AgentInstance[]}
   */
  getAllAgents() {
    return Array.from(this._agents.values());
  }

  /**
   * Check if orchestrator is running.
   * @returns {boolean}
   */
  isRunning() {
    return this._running;
  }
}
