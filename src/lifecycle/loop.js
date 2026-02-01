/**
 * @file Agent lifecycle loop - continuous retry with context reset.
 * @module lifecycle/loop
 */

import { readFile } from 'node:fs/promises';
import { LoopResultType } from '../types/index.js';
import { LifecycleState } from '../types/index.js';
import { getConfig } from '../config/index.js';
import { ContextBuilder } from './context.js';
import { CIEventType } from '../ci/events.js';

/**
 * Utility to sleep for a given time.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Result of a loop iteration.
 */
export class LoopResult {
  /**
   * Create a LoopResult.
   * @param {Object} props - Properties
   * @param {string} props.resultType - Result type (LoopResultType value)
   * @param {string|null} [props.taskId=null] - Task ID if applicable
   * @param {string} [props.summary=''] - Result summary
   * @param {string[]} [props.blockedOn=[]] - Task IDs if blocked
   * @param {string|null} [props.prUrl=null] - PR URL if created
   * @param {string|null} [props.error=null] - Error message if any
   * @param {number} [props.spawnCount=0] - Number of spawns
   * @param {number} [props.retryCount=0] - Number of retries
   */
  constructor({
    resultType,
    taskId = null,
    summary = '',
    blockedOn = [],
    prUrl = null,
    error = null,
    spawnCount = 0,
    retryCount = 0,
  }) {
    /** @type {string} */
    this.resultType = resultType;
    /** @type {string|null} */
    this.taskId = taskId;
    /** @type {string} */
    this.summary = summary;
    /** @type {string[]} */
    this.blockedOn = blockedOn;
    /** @type {string|null} */
    this.prUrl = prUrl;
    /** @type {string|null} */
    this.error = error;
    /** @type {number} */
    this.spawnCount = spawnCount;
    /** @type {number} */
    this.retryCount = retryCount;
  }

  /**
   * Check if result indicates success.
   * @returns {boolean}
   */
  isSuccess() {
    return this.resultType === LoopResultType.TASK_COMPLETE || this.resultType === LoopResultType.PR_CREATED;
  }

  /**
   * Check if result indicates failure.
   * @returns {boolean}
   */
  isFailure() {
    return this.resultType === LoopResultType.MAX_RETRIES || this.resultType === LoopResultType.ERROR;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').LoopResultData}
   */
  toDict() {
    return {
      resultType: this.resultType,
      taskId: this.taskId,
      summary: this.summary,
      blockedOn: this.blockedOn,
      prUrl: this.prUrl,
      error: this.error,
      spawnCount: this.spawnCount,
      retryCount: this.retryCount,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').LoopResultData} data
   * @returns {LoopResult}
   */
  static fromDict(data) {
    return new LoopResult({
      resultType: data.resultType,
      taskId: data.taskId ?? null,
      summary: data.summary ?? '',
      blockedOn: data.blockedOn ?? [],
      prUrl: data.prUrl ?? null,
      error: data.error ?? null,
      spawnCount: data.spawnCount ?? 0,
      retryCount: data.retryCount ?? 0,
    });
  }
}

/**
 * The agent lifecycle loop - continuous retry mechanism with context reset.
 *
 * Key features:
 * - Agents work until they hit a natural breakpoint
 * - At breakpoints (task complete, blocked, PR created), agents are terminated
 * - Fresh agents are spawned with a context summary, preventing context rot
 * - CI events trigger immediate retry checks for blocked agents
 */
export class AgentLifecycleLoop {
  /**
   * Create an AgentLifecycleLoop.
   * @param {Object} props - Properties
   * @param {string} props.repoDir - Repository directory
   * @param {import('../plan/models.js').ProjectPlan} props.plan - Project plan
   * @param {import('../ci/interface.js').CIProvider} props.ciProvider - CI provider
   * @param {import('../runtime/process.js').TerminalManager} props.terminalManager - Terminal manager
   * @param {import('../runtime/branches.js').BranchManager} props.branchManager - Branch manager
   * @param {import('../runtime/workspace.js').WorkspaceManager} props.workspaceManager - Workspace manager
   * @param {string} props.commFilePath - Path to communications.json
   * @param {import('../personas/generator.js').ClaudeMdGenerator} props.claudeMdGenerator - Claude MD generator
   * @param {number} [props.maxRetries=100] - Maximum retries
   * @param {number} [props.retryInterval=30000] - Retry interval in ms
   * @param {string} [props.snapshotDir] - Directory for context snapshots
   */
  constructor({
    repoDir,
    plan,
    ciProvider,
    terminalManager,
    branchManager,
    workspaceManager,
    commFilePath,
    claudeMdGenerator,
    maxRetries = 100,
    retryInterval = 30000,
    snapshotDir,
  }) {
    /** @type {string} */
    this.repoDir = repoDir;
    /** @type {import('../plan/models.js').ProjectPlan} */
    this.plan = plan;
    /** @type {import('../ci/interface.js').CIProvider} */
    this.ciProvider = ciProvider;
    /** @type {import('../runtime/process.js').TerminalManager} */
    this.terminalManager = terminalManager;
    /** @type {import('../runtime/branches.js').BranchManager} */
    this.branchManager = branchManager;
    /** @type {import('../runtime/workspace.js').WorkspaceManager} */
    this.workspaceManager = workspaceManager;
    /** @type {string} */
    this.commFilePath = commFilePath;
    /** @type {import('../personas/generator.js').ClaudeMdGenerator} */
    this.claudeMdGenerator = claudeMdGenerator;
    /** @type {number} */
    this.maxRetries = maxRetries;
    /** @type {number} */
    this.retryInterval = retryInterval;
    /** @type {string} */
    this.snapshotDir = snapshotDir ?? `${repoDir}/.state/snapshots`;

    /** @type {ContextBuilder} */
    this.contextBuilder = new ContextBuilder(repoDir);

    /** @private @type {boolean} */
    this._running = false;
    /** @private @type {import('../ci/interface.js').CIEvent[]} */
    this._ciEventQueue = [];
  }

  /**
   * Run the lifecycle loop for an agent.
   *
   * @param {import('../personas/models.js').AgentInstance} agent - Agent instance
   * @param {import('../plan/models.js').Task} task - Initial task
   * @returns {Promise<LoopResult>}
   */
  async runAgentLoop(agent, task) {
    this._running = true;
    let currentTask = task;

    // Subscribe to CI events
    await this.ciProvider.subscribe(this._onCIEvent.bind(this));

    try {
      while (this._running && agent.retryCount < this.maxRetries) {
        // 1. Capture snapshot
        const snapshot = await this.contextBuilder.captureSnapshot(
          agent,
          currentTask,
          this.commFilePath
        );
        await this.contextBuilder.saveSnapshot(snapshot, this.snapshotDir);

        // 2. Build context summary
        const contextSummary = this.contextBuilder.buildContextSummary(snapshot);

        // 3. Spawn fresh agent with context
        const agentProcess = await this._spawnFreshAgent(agent, currentTask, contextSummary);
        agent.incrementSpawn();

        // 4. Wait for breakpoint
        const result = await this._waitForBreakpoint(agent, agentProcess);

        // 5. Handle breakpoint
        if (result.resultType === LoopResultType.TASK_COMPLETE) {
          console.log(`[Loop] Agent ${agent.agentId} completed task ${result.taskId}`);

          const nextTask = this._getNextTask(agent);
          if (nextTask) {
            currentTask = nextTask;
            agent.setWorking(currentTask);
            continue;
          } else {
            agent.setComplete();
            return result;
          }
        } else if (result.resultType === LoopResultType.BLOCKED) {
          console.log(`[Loop] Agent ${agent.agentId} blocked on ${result.blockedOn.join(', ')}`);
          agent.setBlocked(result.blockedOn, result.summary);

          // Terminate agent
          await this.terminalManager.terminate(agent.agentId);

          // Wait for unblock
          const unblocked = await this._waitForUnblock(agent, result.blockedOn);
          if (!unblocked) {
            return result;
          }

          agent.setIdle();
          continue;
        } else if (result.resultType === LoopResultType.PR_CREATED) {
          console.log(`[Loop] Agent ${agent.agentId} created PR: ${result.prUrl}`);
          agent.setPRPending(result.prUrl, result.taskId);

          // Terminate agent
          await this.terminalManager.terminate(agent.agentId);

          // Wait for PR merge
          const merged = await this._waitForPRMerge(result.prUrl);
          if (!merged) {
            return result;
          }

          const nextTask = this._getNextTask(agent);
          if (nextTask) {
            currentTask = nextTask;
            agent.setWorking(currentTask);
            continue;
          } else {
            agent.setComplete();
            return result;
          }
        } else if (result.resultType === LoopResultType.ERROR) {
          console.error(`[Loop] Agent ${agent.agentId} error: ${result.error}`);
          agent.incrementRetry();
          await this.terminalManager.terminate(agent.agentId);
          continue;
        } else {
          return result;
        }
      }

      // Max retries exceeded
      return new LoopResult({
        resultType: LoopResultType.MAX_RETRIES,
        taskId: currentTask?.id ?? null,
        spawnCount: agent.spawnCount,
        retryCount: agent.retryCount,
      });
    } finally {
      await this.ciProvider.unsubscribe(this._onCIEvent.bind(this));
      await this.terminalManager.terminate(agent.agentId);
    }
  }

  /**
   * Spawn a fresh agent with context summary.
   * @private
   * @param {import('../personas/models.js').AgentInstance} agent
   * @param {import('../plan/models.js').Task} task
   * @param {string} contextSummary
   * @returns {Promise<import('../runtime/process.js').AgentProcess>}
   */
  async _spawnFreshAgent(agent, task, contextSummary) {
    // Generate .claude.md with context
    const claudeMdContent = this.claudeMdGenerator.generate(
      agent.personaConfig,
      task,
      agent.branch,
      contextSummary
    );

    // Inject into workspace
    let workspacePath = this.workspaceManager.getSandbox(agent.agentId);
    if (!workspacePath) {
      workspacePath = await this.workspaceManager.createSandbox(agent.agentId);
    }

    await this.workspaceManager.injectClaudeMd(agent.agentId, claudeMdContent);

    // Build initial prompt
    const prompt = this._buildAgentPrompt(agent, task);

    // Spawn the agent
    return this.terminalManager.spawnClaudeAgent({
      agentId: agent.agentId,
      prompt,
      workingDir: workspacePath,
    });
  }

  /**
   * Build the initial prompt for a Claude agent.
   * @private
   * @param {import('../personas/models.js').AgentInstance} agent
   * @param {import('../plan/models.js').Task} task
   * @returns {string}
   */
  _buildAgentPrompt(agent, task) {
    return `You are agent "${agent.agentId}" (${agent.role}).

Your current task is: ${task.id} - ${task.description}

IMPORTANT: Read your .claude.md file for full context and instructions.

When you reach a natural stopping point (task complete, blocked, or PR created),
update communications.json with your breakpoint status.

Start by reading .claude.md and the current state of communications.json.`;
  }

  /**
   * Wait for an agent to reach a breakpoint.
   * @private
   * @param {import('../personas/models.js').AgentInstance} agent
   * @param {import('../runtime/process.js').AgentProcess} process
   * @returns {Promise<LoopResult>}
   */
  async _waitForBreakpoint(agent, process) {
    const config = getConfig();
    const checkInterval = config.breakpointCheckInterval;

    while (this._running && process.isRunning) {
      // Check communications.json for breakpoint
      const breakpoint = await this._checkForBreakpoint(agent.agentId);
      if (breakpoint) {
        return this._breakpointToResult(breakpoint);
      }

      await sleep(checkInterval);
    }

    // Process ended without breakpoint
    if (!this._running) {
      return new LoopResult({ resultType: LoopResultType.SHUTDOWN });
    }

    // Check one more time for breakpoint
    const breakpoint = await this._checkForBreakpoint(agent.agentId);
    if (breakpoint) {
      return this._breakpointToResult(breakpoint);
    }

    // Process ended without proper breakpoint - treat as error
    return new LoopResult({
      resultType: LoopResultType.ERROR,
      error: 'Agent process ended without signaling breakpoint',
    });
  }

  /**
   * Check communications.json for a breakpoint from an agent.
   * @private
   * @param {string} agentId
   * @returns {Promise<Object|null>}
   */
  async _checkForBreakpoint(agentId) {
    try {
      const content = await readFile(this.commFilePath, 'utf-8');
      const data = JSON.parse(content);
      const agentData = data[agentId] ?? {};

      const lifecycleState = agentData.lifecycleState ?? agentData.lifecycle_state ?? '';
      const breakpoint = agentData.breakpoint;

      if (['complete', 'blocked', 'pr_pending'].includes(lifecycleState) && breakpoint) {
        return breakpoint;
      }

      return null;
    } catch {
      return null;
    }
  }

  /**
   * Convert a breakpoint dict to a LoopResult.
   * @private
   * @param {Object} breakpoint
   * @returns {LoopResult}
   */
  _breakpointToResult(breakpoint) {
    const bpType = breakpoint.type ?? '';

    if (bpType === 'task_complete') {
      return new LoopResult({
        resultType: LoopResultType.TASK_COMPLETE,
        taskId: breakpoint.taskId ?? breakpoint.task_id ?? null,
        summary: breakpoint.summary ?? '',
      });
    } else if (bpType === 'blocked') {
      return new LoopResult({
        resultType: LoopResultType.BLOCKED,
        blockedOn: breakpoint.blockedOn ?? breakpoint.blocked_on ?? [],
        summary: breakpoint.reason ?? '',
      });
    } else if (bpType === 'pr_created') {
      return new LoopResult({
        resultType: LoopResultType.PR_CREATED,
        prUrl: breakpoint.prUrl ?? breakpoint.pr_url ?? null,
        taskId: breakpoint.taskId ?? breakpoint.task_id ?? null,
      });
    } else {
      return new LoopResult({
        resultType: LoopResultType.ERROR,
        error: `Unknown breakpoint type: ${bpType}`,
      });
    }
  }

  /**
   * Wait for blocking dependencies to be resolved.
   * @private
   * @param {import('../personas/models.js').AgentInstance} agent
   * @param {string[]} blockedOn
   * @returns {Promise<boolean>}
   */
  async _waitForUnblock(agent, blockedOn) {
    while (this._running && agent.retryCount < this.maxRetries) {
      // Check if all blockers are resolved
      if (this._areBlockersResolved(blockedOn)) {
        return true;
      }

      // Wait for CI event or timeout
      const event = await this._waitForCIEvent(this.retryInterval);

      if (event && this._eventResolvesBlockers(event, blockedOn)) {
        return true;
      }

      agent.incrementRetry();
    }

    return false;
  }

  /**
   * Check if all blocking tasks are complete.
   * @private
   * @param {string[]} blockedOn
   * @returns {boolean}
   */
  _areBlockersResolved(blockedOn) {
    const { TaskStatus } = require('../types/index.js');

    for (const taskId of blockedOn) {
      const task = this.plan.getTaskById(taskId);
      if (task && task.status !== TaskStatus.COMPLETE) {
        return false;
      }
    }
    return true;
  }

  /**
   * Check if a CI event resolves our blockers.
   * @private
   * @param {import('../ci/interface.js').CIEvent} event
   * @param {string[]} blockedOn
   * @returns {boolean}
   */
  _eventResolvesBlockers(event, blockedOn) {
    if (
      event.eventType === CIEventType.BUILD_SUCCESS ||
      event.eventType === CIEventType.PR_MERGED
    ) {
      return this._areBlockersResolved(blockedOn);
    }
    return false;
  }

  /**
   * Wait for a CI event with timeout.
   * @private
   * @param {number} timeoutMs
   * @returns {Promise<import('../ci/interface.js').CIEvent|null>}
   */
  async _waitForCIEvent(timeoutMs) {
    const startTime = Date.now();

    while (Date.now() - startTime < timeoutMs) {
      if (this._ciEventQueue.length > 0) {
        return this._ciEventQueue.shift();
      }
      await sleep(100);
    }

    return null;
  }

  /**
   * Extract PR number from a GitHub PR URL.
   * @private
   * @param {string} prUrl
   * @returns {number|null}
   */
  _extractPRNumber(prUrl) {
    const match = prUrl.match(/\/pull\/(\d+)/);
    if (match) {
      return parseInt(match[1], 10);
    }
    return null;
  }

  /**
   * Wait for a PR to be merged.
   * @private
   * @param {string} prUrl
   * @returns {Promise<boolean>}
   */
  async _waitForPRMerge(prUrl) {
    const prNumber = this._extractPRNumber(prUrl);
    if (prNumber === null) {
      console.error(`[Loop] Could not extract PR number from URL: ${prUrl}`);
      return false;
    }

    const config = getConfig();
    try {
      const prInfo = await this.ciProvider.waitForPRMerge(prNumber, config.prMergeTimeout);
      return prInfo.isMerged();
    } catch (error) {
      console.error(`[Loop] Error waiting for PR merge: ${error.message}`);
      return false;
    }
  }

  /**
   * Get the next available task for an agent.
   * @private
   * @param {import('../personas/models.js').AgentInstance} agent
   * @returns {import('../plan/models.js').Task|null}
   */
  _getNextTask(agent) {
    const available = this.plan.getAvailableTasksForRole(agent.role);
    return available.length > 0 ? available[0] : null;
  }

  /**
   * Handle CI events.
   * @private
   * @param {import('../ci/interface.js').CIEvent} event
   * @returns {void}
   */
  _onCIEvent(event) {
    this._ciEventQueue.push(event);
  }

  /**
   * Stop the loop.
   * @returns {void}
   */
  stop() {
    this._running = false;
  }
}

// Backwards compatibility alias
export const RalphWiggumLoop = AgentLifecycleLoop;
