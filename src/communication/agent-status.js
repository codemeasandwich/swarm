/**
 * @file Agent status models for the communication system.
 * Contains AgentStatus and EnhancedAgentStatus classes.
 * @module communication/agent-status
 */

import { Breakpoint } from '../personas/models.js';

/**
 * Status structure for each agent in the communications file.
 * Contains basic status information that agents update.
 */
export class AgentStatus {
  /**
   * Create an AgentStatus.
   * @param {Object} [props={}] - Properties
   * @param {string} [props.mission=''] - Agent's overall goal
   * @param {string} [props.workingOn=''] - Current task description
   * @param {string} [props.done=''] - What has been completed
   * @param {string} [props.next=''] - What is planned next
   * @param {Array<[string, string]>} [props.requests=[]] - Array of [targetAgent, request] pairs
   * @param {Array<[string, string, string]>} [props.added=[]] - Array of [fromAgent, description, originalRequest] tuples
   * @param {string} [props.lastUpdated=''] - ISO timestamp of last update
   */
  constructor({
    mission = '',
    workingOn = '',
    done = '',
    next = '',
    requests = [],
    added = [],
    lastUpdated = '',
  } = {}) {
    /** @type {string} */
    this.mission = mission;
    /** @type {string} */
    this.workingOn = workingOn;
    /** @type {string} */
    this.done = done;
    /** @type {string} */
    this.next = next;
    /** @type {Array<[string, string]>} */
    this.requests = requests;
    /** @type {Array<[string, string, string]>} */
    this.added = added;
    /** @type {string} */
    this.lastUpdated = lastUpdated;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').AgentStatusData}
   */
  toDict() {
    return {
      mission: this.mission,
      workingOn: this.workingOn,
      done: this.done,
      next: this.next,
      requests: this.requests,
      added: this.added,
      lastUpdated: this.lastUpdated,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').AgentStatusData} data - Plain object data
   * @returns {AgentStatus}
   */
  static fromDict(data) {
    return new AgentStatus({
      mission: data.mission ?? '',
      workingOn: data.workingOn ?? data.working_on ?? '',
      done: data.done ?? '',
      next: data.next ?? '',
      requests: data.requests ?? [],
      added: data.added ?? [],
      lastUpdated: data.lastUpdated ?? data.last_updated ?? '',
    });
  }
}

/**
 * Extended agent status with orchestration support.
 * Contains additional fields for lifecycle management, task tracking, and breakpoints.
 * @extends AgentStatus
 */
export class EnhancedAgentStatus extends AgentStatus {
  /**
   * Create an EnhancedAgentStatus.
   * @param {Object} [props={}] - Properties
   * @param {string} [props.mission=''] - Agent's overall goal
   * @param {string} [props.workingOn=''] - Current task description
   * @param {string} [props.done=''] - What has been completed
   * @param {string} [props.next=''] - What is planned next
   * @param {Array<[string, string]>} [props.requests=[]] - Array of [targetAgent, request] pairs
   * @param {Array<[string, string, string]>} [props.added=[]] - Array of [fromAgent, description, originalRequest] tuples
   * @param {string} [props.lastUpdated=''] - ISO timestamp of last update
   * @param {string} [props.agentId=''] - Agent identifier
   * @param {string} [props.role=''] - Agent role
   * @param {string} [props.branch=''] - Git branch
   * @param {string} [props.lifecycleState='idle'] - Current lifecycle state
   * @param {string} [props.currentTaskId=''] - Current task ID
   * @param {string[]} [props.blockedOn=[]] - Task IDs blocking this agent
   * @param {number} [props.retryCount=0] - Number of retries
   * @param {number} [props.spawnCount=1] - Number of spawns
   * @param {string} [props.prUrl=''] - PR URL if any
   * @param {Breakpoint|null} [props.breakpoint=null] - Current breakpoint info
   */
  constructor({
    mission = '',
    workingOn = '',
    done = '',
    next = '',
    requests = [],
    added = [],
    lastUpdated = '',
    agentId = '',
    role = '',
    branch = '',
    lifecycleState = 'idle',
    currentTaskId = '',
    blockedOn = [],
    retryCount = 0,
    spawnCount = 1,
    prUrl = '',
    breakpoint = null,
  } = {}) {
    super({ mission, workingOn, done, next, requests, added, lastUpdated });

    /** @type {string} */
    this.agentId = agentId;
    /** @type {string} */
    this.role = role;
    /** @type {string} */
    this.branch = branch;
    /** @type {string} */
    this.lifecycleState = lifecycleState;
    /** @type {string} */
    this.currentTaskId = currentTaskId;
    /** @type {string[]} */
    this.blockedOn = blockedOn;
    /** @type {number} */
    this.retryCount = retryCount;
    /** @type {number} */
    this.spawnCount = spawnCount;
    /** @type {string} */
    this.prUrl = prUrl;
    /** @type {Breakpoint|null} */
    this.breakpoint = breakpoint;
  }

  /**
   * Check if agent is in blocked state.
   * @returns {boolean}
   */
  isBlocked() {
    return this.lifecycleState === 'blocked';
  }

  /**
   * Check if agent is actively working.
   * @returns {boolean}
   */
  isActive() {
    return this.lifecycleState === 'working';
  }

  /**
   * Check if agent has completed all work.
   * @returns {boolean}
   */
  isComplete() {
    return this.lifecycleState === 'complete';
  }

  /**
   * Check if agent is idle.
   * @returns {boolean}
   */
  isIdle() {
    return this.lifecycleState === 'idle';
  }

  /**
   * Check if agent has a PR pending.
   * @returns {boolean}
   */
  isPRPending() {
    return this.lifecycleState === 'pr_pending';
  }

  /**
   * Set agent to blocked state with breakpoint.
   * @param {string[]} blockedOn - Task IDs blocking this agent
   * @param {string} [reason=''] - Reason for blocking
   * @returns {void}
   */
  setBlocked(blockedOn, reason = '') {
    this.lifecycleState = 'blocked';
    this.blockedOn = blockedOn;
    this.breakpoint = new Breakpoint({
      type: 'blocked',
      blockedOn,
      reason,
    });
  }

  /**
   * Signal task completion with breakpoint.
   * @param {string} taskId - Completed task ID
   * @param {string} [summary=''] - Summary of work done
   * @returns {void}
   */
  setTaskComplete(taskId, summary = '') {
    this.breakpoint = new Breakpoint({
      type: 'task_complete',
      taskId,
      summary,
    });
    this.lifecycleState = 'idle';
    this.currentTaskId = '';
  }

  /**
   * Set agent to PR pending state with breakpoint.
   * @param {string} prUrl - PR URL
   * @param {string} [taskId=''] - Related task ID
   * @returns {void}
   */
  setPRPending(prUrl, taskId = '') {
    this.lifecycleState = 'pr_pending';
    this.prUrl = prUrl;
    this.breakpoint = new Breakpoint({
      type: 'pr_created',
      taskId: taskId || null,
      prUrl,
    });
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').EnhancedAgentStatusData}
   */
  toDict() {
    const base = super.toDict();
    return {
      ...base,
      agentId: this.agentId,
      role: this.role,
      branch: this.branch,
      lifecycleState: this.lifecycleState,
      currentTaskId: this.currentTaskId,
      blockedOn: this.blockedOn,
      retryCount: this.retryCount,
      spawnCount: this.spawnCount,
      prUrl: this.prUrl,
      breakpoint: this.breakpoint?.toDict() ?? null,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').EnhancedAgentStatusData} data - Plain object data
   * @returns {EnhancedAgentStatus}
   */
  static fromDict(data) {
    const breakpointData = data.breakpoint;
    return new EnhancedAgentStatus({
      mission: data.mission ?? '',
      workingOn: data.workingOn ?? data.working_on ?? '',
      done: data.done ?? '',
      next: data.next ?? '',
      requests: data.requests ?? [],
      added: data.added ?? [],
      lastUpdated: data.lastUpdated ?? data.last_updated ?? '',
      agentId: data.agentId ?? data.agent_id ?? '',
      role: data.role ?? '',
      branch: data.branch ?? '',
      lifecycleState: data.lifecycleState ?? data.lifecycle_state ?? 'idle',
      currentTaskId: data.currentTaskId ?? data.current_task_id ?? '',
      blockedOn: data.blockedOn ?? data.blocked_on ?? [],
      retryCount: data.retryCount ?? data.retry_count ?? 0,
      spawnCount: data.spawnCount ?? data.spawn_count ?? 1,
      prUrl: data.prUrl ?? data.pr_url ?? '',
      breakpoint: breakpointData ? Breakpoint.fromDict(breakpointData) : null,
    });
  }
}
