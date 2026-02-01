/**
 * @file Persona models for agent lifecycle management.
 * Contains Breakpoint, PersonaConfig, and AgentInstance classes.
 * @module personas/models
 */

import { LifecycleState, BreakpointType } from '../types/index.js';

/**
 * A breakpoint representing a natural stopping point in agent execution.
 * Agents signal breakpoints when they complete a task, get blocked, or create a PR.
 */
export class Breakpoint {
  /**
   * Create a Breakpoint.
   * @param {Object} props - Properties
   * @param {string} props.type - Breakpoint type (task_complete, blocked, pr_created)
   * @param {string|null} [props.taskId=null] - Task ID if applicable
   * @param {string} [props.summary=''] - Summary of work done
   * @param {string[]} [props.blockedOn=[]] - Task IDs blocking this agent
   * @param {string} [props.reason=''] - Reason for breakpoint
   * @param {string|null} [props.prUrl=null] - PR URL if PR was created
   * @param {Date|null} [props.timestamp=null] - When the breakpoint occurred
   */
  constructor({
    type,
    taskId = null,
    summary = '',
    blockedOn = [],
    reason = '',
    prUrl = null,
    timestamp = null,
  }) {
    /** @type {string} */
    this.type = type;
    /** @type {string|null} */
    this.taskId = taskId;
    /** @type {string} */
    this.summary = summary;
    /** @type {string[]} */
    this.blockedOn = blockedOn;
    /** @type {string} */
    this.reason = reason;
    /** @type {string|null} */
    this.prUrl = prUrl;
    /** @type {Date} */
    this.timestamp = timestamp ?? new Date();
  }

  /**
   * Check if this is a task completion breakpoint.
   * @returns {boolean}
   */
  isTaskComplete() {
    return this.type === BreakpointType.TASK_COMPLETE;
  }

  /**
   * Check if this is a blocked breakpoint.
   * @returns {boolean}
   */
  isBlocked() {
    return this.type === BreakpointType.BLOCKED;
  }

  /**
   * Check if this is a PR created breakpoint.
   * @returns {boolean}
   */
  isPRCreated() {
    return this.type === BreakpointType.PR_CREATED;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').BreakpointData}
   */
  toDict() {
    return {
      type: this.type,
      taskId: this.taskId,
      summary: this.summary,
      blockedOn: this.blockedOn,
      reason: this.reason,
      prUrl: this.prUrl,
      timestamp: this.timestamp.toISOString(),
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').BreakpointData} data - Plain object data
   * @returns {Breakpoint}
   */
  static fromDict(data) {
    return new Breakpoint({
      type: data.type ?? BreakpointType.TASK_COMPLETE,
      taskId: data.taskId ?? null,
      summary: data.summary ?? '',
      blockedOn: data.blockedOn ?? [],
      reason: data.reason ?? '',
      prUrl: data.prUrl ?? null,
      timestamp: data.timestamp ? new Date(data.timestamp) : null,
    });
  }
}

/**
 * Runtime configuration extending a plan Persona.
 * Contains additional runtime settings for agent execution.
 */
export class PersonaConfig {
  /**
   * Create a PersonaConfig.
   * @param {Object} props - Properties
   * @param {string} props.id - Persona ID
   * @param {string} props.name - Persona name
   * @param {string} props.role - Role identifier
   * @param {string[]} [props.capabilities=[]] - List of capabilities
   * @param {string[]} [props.constraints=[]] - List of constraints
   * @param {string} [props.claudeMdTemplate=''] - Template for .claude.md file
   * @param {number} [props.maxConcurrentTasks=1] - Max tasks this persona can work on
   * @param {string[]} [props.preferredTaskTypes=[]] - Preferred task types
   * @param {Object} [props.customSettings={}] - Custom runtime settings
   */
  constructor({
    id,
    name,
    role,
    capabilities = [],
    constraints = [],
    claudeMdTemplate = '',
    maxConcurrentTasks = 1,
    preferredTaskTypes = [],
    customSettings = {},
  }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.role = role;
    /** @type {string[]} */
    this.capabilities = capabilities;
    /** @type {string[]} */
    this.constraints = constraints;
    /** @type {string} */
    this.claudeMdTemplate = claudeMdTemplate;
    /** @type {number} */
    this.maxConcurrentTasks = maxConcurrentTasks;
    /** @type {string[]} */
    this.preferredTaskTypes = preferredTaskTypes;
    /** @type {Object} */
    this.customSettings = customSettings;
  }

  /**
   * Check if this persona has a specific capability.
   * @param {string} capability - Capability to check
   * @returns {boolean}
   */
  hasCapability(capability) {
    return this.capabilities.includes(capability);
  }

  /**
   * Check if this persona is constrained from something.
   * @param {string} constraint - Constraint to check
   * @returns {boolean}
   */
  hasConstraint(constraint) {
    return this.constraints.includes(constraint);
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {Object}
   */
  toDict() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      capabilities: this.capabilities,
      constraints: this.constraints,
      claudeMdTemplate: this.claudeMdTemplate,
      maxConcurrentTasks: this.maxConcurrentTasks,
      preferredTaskTypes: this.preferredTaskTypes,
      customSettings: this.customSettings,
    };
  }

  /**
   * Create from plain object.
   * @param {Object} data - Plain object data
   * @returns {PersonaConfig}
   */
  static fromDict(data) {
    return new PersonaConfig({
      id: data.id ?? '',
      name: data.name ?? '',
      role: data.role ?? '',
      capabilities: data.capabilities ?? [],
      constraints: data.constraints ?? [],
      claudeMdTemplate: data.claudeMdTemplate ?? '',
      maxConcurrentTasks: data.maxConcurrentTasks ?? 1,
      preferredTaskTypes: data.preferredTaskTypes ?? [],
      customSettings: data.customSettings ?? {},
    });
  }

  /**
   * Create from a Persona instance.
   * @param {import('../plan/models.js').Persona} persona - Persona to convert
   * @param {Object} [runtimeConfig={}] - Additional runtime configuration
   * @returns {PersonaConfig}
   */
  static fromPersona(persona, runtimeConfig = {}) {
    return new PersonaConfig({
      id: persona.id,
      name: persona.name,
      role: persona.role,
      capabilities: persona.capabilities,
      constraints: persona.constraints,
      claudeMdTemplate: persona.claudeMdTemplate,
      ...runtimeConfig,
    });
  }
}

/**
 * An active agent instance with state, task, and lifecycle tracking.
 * Represents a running or paused agent in the orchestration system.
 */
export class AgentInstance {
  /**
   * Create an AgentInstance.
   * @param {Object} props - Properties
   * @param {string} props.agentId - Unique agent identifier
   * @param {string} props.role - Agent role
   * @param {string} props.branch - Git branch for this agent
   * @param {string} [props.lifecycleState='idle'] - Current lifecycle state
   * @param {string|null} [props.currentTaskId=null] - Current task ID
   * @param {string[]} [props.blockedOn=[]] - Task IDs blocking this agent
   * @param {number} [props.retryCount=0] - Number of retries
   * @param {number} [props.spawnCount=1] - Number of process spawns
   * @param {string|null} [props.prUrl=null] - PR URL if pending
   * @param {Breakpoint|null} [props.breakpoint=null] - Current breakpoint
   * @param {PersonaConfig|null} [props.personaConfig=null] - Persona configuration
   * @param {Date|null} [props.createdAt=null] - Creation timestamp
   * @param {Date|null} [props.lastActiveAt=null] - Last activity timestamp
   */
  constructor({
    agentId,
    role,
    branch,
    lifecycleState = LifecycleState.IDLE,
    currentTaskId = null,
    blockedOn = [],
    retryCount = 0,
    spawnCount = 1,
    prUrl = null,
    breakpoint = null,
    personaConfig = null,
    createdAt = null,
    lastActiveAt = null,
  }) {
    /** @type {string} */
    this.agentId = agentId;
    /** @type {string} */
    this.role = role;
    /** @type {string} */
    this.branch = branch;
    /** @type {string} */
    this.lifecycleState = lifecycleState;
    /** @type {string|null} */
    this.currentTaskId = currentTaskId;
    /** @type {string[]} */
    this.blockedOn = blockedOn;
    /** @type {number} */
    this.retryCount = retryCount;
    /** @type {number} */
    this.spawnCount = spawnCount;
    /** @type {string|null} */
    this.prUrl = prUrl;
    /** @type {Breakpoint|null} */
    this.breakpoint = breakpoint;
    /** @type {PersonaConfig|null} */
    this.personaConfig = personaConfig;
    /** @type {Date} */
    this.createdAt = createdAt ?? new Date();
    /** @type {Date} */
    this.lastActiveAt = lastActiveAt ?? new Date();
  }

  /**
   * Check if agent is in blocked state.
   * @returns {boolean}
   */
  isBlocked() {
    return this.lifecycleState === LifecycleState.BLOCKED;
  }

  /**
   * Check if agent is actively working.
   * @returns {boolean}
   */
  isActive() {
    return this.lifecycleState === LifecycleState.WORKING;
  }

  /**
   * Check if agent has completed all work.
   * @returns {boolean}
   */
  isComplete() {
    return this.lifecycleState === LifecycleState.COMPLETE;
  }

  /**
   * Check if agent is idle and ready for work.
   * @returns {boolean}
   */
  isIdle() {
    return this.lifecycleState === LifecycleState.IDLE;
  }

  /**
   * Check if agent has a PR pending.
   * @returns {boolean}
   */
  isPRPending() {
    return this.lifecycleState === LifecycleState.PR_PENDING;
  }

  /**
   * Check if agent has failed.
   * @returns {boolean}
   */
  isFailed() {
    return this.lifecycleState === LifecycleState.FAILED;
  }

  /**
   * Set agent to blocked state with breakpoint.
   * @param {string[]} blockedOn - Task IDs blocking this agent
   * @param {string} [reason=''] - Reason for blocking
   * @returns {void}
   */
  setBlocked(blockedOn, reason = '') {
    this.lifecycleState = LifecycleState.BLOCKED;
    this.blockedOn = blockedOn;
    this.breakpoint = new Breakpoint({
      type: BreakpointType.BLOCKED,
      blockedOn,
      reason,
    });
    this.lastActiveAt = new Date();
  }

  /**
   * Signal task completion with breakpoint.
   * @param {string} taskId - Completed task ID
   * @param {string} [summary=''] - Summary of work done
   * @returns {void}
   */
  setTaskComplete(taskId, summary = '') {
    this.breakpoint = new Breakpoint({
      type: BreakpointType.TASK_COMPLETE,
      taskId,
      summary,
    });
    this.lifecycleState = LifecycleState.IDLE;
    this.currentTaskId = null;
    this.lastActiveAt = new Date();
  }

  /**
   * Set agent to PR pending state with breakpoint.
   * @param {string} prUrl - PR URL
   * @param {string} [taskId=''] - Related task ID
   * @returns {void}
   */
  setPRPending(prUrl, taskId = '') {
    this.lifecycleState = LifecycleState.PR_PENDING;
    this.prUrl = prUrl;
    this.breakpoint = new Breakpoint({
      type: BreakpointType.PR_CREATED,
      taskId: taskId || null,
      prUrl,
    });
    this.lastActiveAt = new Date();
  }

  /**
   * Set agent to working state on a task.
   * @param {import('../plan/models.js').Task} task - Task to work on
   * @returns {void}
   */
  setWorking(task) {
    this.lifecycleState = LifecycleState.WORKING;
    this.currentTaskId = task.id;
    this.blockedOn = [];
    this.breakpoint = null;
    this.lastActiveAt = new Date();
  }

  /**
   * Set agent to idle state.
   * @returns {void}
   */
  setIdle() {
    this.lifecycleState = LifecycleState.IDLE;
    this.currentTaskId = null;
    this.blockedOn = [];
    this.lastActiveAt = new Date();
  }

  /**
   * Set agent to failed state.
   * @param {string} [reason=''] - Reason for failure
   * @returns {void}
   */
  setFailed(reason = '') {
    this.lifecycleState = LifecycleState.FAILED;
    this.breakpoint = new Breakpoint({
      type: BreakpointType.BLOCKED,
      reason,
    });
    this.lastActiveAt = new Date();
  }

  /**
   * Set agent to complete state.
   * @returns {void}
   */
  setComplete() {
    this.lifecycleState = LifecycleState.COMPLETE;
    this.currentTaskId = null;
    this.lastActiveAt = new Date();
  }

  /**
   * Increment retry count.
   * @returns {void}
   */
  incrementRetry() {
    this.retryCount++;
    this.lastActiveAt = new Date();
  }

  /**
   * Increment spawn count.
   * @returns {void}
   */
  incrementSpawn() {
    this.spawnCount++;
    this.lastActiveAt = new Date();
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').AgentInstanceData}
   */
  toDict() {
    return {
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
      personaConfig: this.personaConfig?.toDict() ?? null,
      createdAt: this.createdAt.toISOString(),
      lastActiveAt: this.lastActiveAt.toISOString(),
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').AgentInstanceData} data - Plain object data
   * @returns {AgentInstance}
   */
  static fromDict(data) {
    return new AgentInstance({
      agentId: data.agentId ?? '',
      role: data.role ?? '',
      branch: data.branch ?? '',
      lifecycleState: data.lifecycleState ?? LifecycleState.IDLE,
      currentTaskId: data.currentTaskId ?? null,
      blockedOn: data.blockedOn ?? [],
      retryCount: data.retryCount ?? 0,
      spawnCount: data.spawnCount ?? 1,
      prUrl: data.prUrl ?? null,
      breakpoint: data.breakpoint ? Breakpoint.fromDict(data.breakpoint) : null,
      personaConfig: data.personaConfig ? PersonaConfig.fromDict(data.personaConfig) : null,
      createdAt: data.createdAt ? new Date(data.createdAt) : null,
      lastActiveAt: data.lastActiveAt ? new Date(data.lastActiveAt) : null,
    });
  }
}
