/**
 * @file CI provider interface and status models.
 * @module ci/interface
 */

import { BuildStatusType, PRStatusType } from '../types/index.js';

/**
 * Build status information.
 */
export class BuildStatus {
  /**
   * Create a BuildStatus.
   * @param {Object} props - Properties
   * @param {string} props.runId - Build run identifier
   * @param {string} [props.status='pending'] - Build status
   * @param {Date|null} [props.startedAt=null] - Start timestamp
   * @param {Date|null} [props.completedAt=null] - Completion timestamp
   * @param {string|null} [props.url=null] - Build URL
   * @param {string|null} [props.errorMessage=null] - Error message if failed
   */
  constructor({
    runId,
    status = BuildStatusType.PENDING,
    startedAt = null,
    completedAt = null,
    url = null,
    errorMessage = null,
  }) {
    /** @type {string} */
    this.runId = runId;
    /** @type {string} */
    this.status = status;
    /** @type {Date|null} */
    this.startedAt = startedAt;
    /** @type {Date|null} */
    this.completedAt = completedAt;
    /** @type {string|null} */
    this.url = url;
    /** @type {string|null} */
    this.errorMessage = errorMessage;
  }

  /**
   * Check if build is complete (success or failure).
   * @returns {boolean}
   */
  isComplete() {
    return (
      this.status === BuildStatusType.SUCCESS ||
      this.status === BuildStatusType.FAILURE ||
      this.status === BuildStatusType.CANCELLED
    );
  }

  /**
   * Check if build succeeded.
   * @returns {boolean}
   */
  isSuccess() {
    return this.status === BuildStatusType.SUCCESS;
  }

  /**
   * Check if build failed.
   * @returns {boolean}
   */
  isFailure() {
    return this.status === BuildStatusType.FAILURE;
  }

  /**
   * Check if build is running.
   * @returns {boolean}
   */
  isRunning() {
    return this.status === BuildStatusType.RUNNING;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').BuildStatusData}
   */
  toDict() {
    return {
      runId: this.runId,
      status: this.status,
      startedAt: this.startedAt?.toISOString() ?? null,
      completedAt: this.completedAt?.toISOString() ?? null,
      url: this.url,
      errorMessage: this.errorMessage,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').BuildStatusData} data
   * @returns {BuildStatus}
   */
  static fromDict(data) {
    return new BuildStatus({
      runId: data.runId,
      status: data.status ?? BuildStatusType.PENDING,
      startedAt: data.startedAt ? new Date(data.startedAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
      url: data.url ?? null,
      errorMessage: data.errorMessage ?? null,
    });
  }
}

/**
 * Pull request information.
 */
export class PRInfo {
  /**
   * Create a PRInfo.
   * @param {Object} props - Properties
   * @param {number} props.number - PR number
   * @param {string} props.title - PR title
   * @param {string} [props.status='open'] - PR status
   * @param {string} props.url - PR URL
   * @param {string} props.sourceBranch - Source branch
   * @param {string} props.targetBranch - Target branch
   * @param {Date|null} [props.mergedAt=null] - Merge timestamp
   */
  constructor({
    number,
    title,
    status = PRStatusType.OPEN,
    url,
    sourceBranch,
    targetBranch,
    mergedAt = null,
  }) {
    /** @type {number} */
    this.number = number;
    /** @type {string} */
    this.title = title;
    /** @type {string} */
    this.status = status;
    /** @type {string} */
    this.url = url;
    /** @type {string} */
    this.sourceBranch = sourceBranch;
    /** @type {string} */
    this.targetBranch = targetBranch;
    /** @type {Date|null} */
    this.mergedAt = mergedAt;
  }

  /**
   * Check if PR is merged.
   * @returns {boolean}
   */
  isMerged() {
    return this.status === PRStatusType.MERGED;
  }

  /**
   * Check if PR is open.
   * @returns {boolean}
   */
  isOpen() {
    return this.status === PRStatusType.OPEN;
  }

  /**
   * Check if PR is closed without merge.
   * @returns {boolean}
   */
  isClosed() {
    return this.status === PRStatusType.CLOSED;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').PRInfoData}
   */
  toDict() {
    return {
      number: this.number,
      title: this.title,
      status: this.status,
      url: this.url,
      sourceBranch: this.sourceBranch,
      targetBranch: this.targetBranch,
      mergedAt: this.mergedAt?.toISOString() ?? null,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').PRInfoData} data
   * @returns {PRInfo}
   */
  static fromDict(data) {
    return new PRInfo({
      number: data.number,
      title: data.title,
      status: data.status ?? PRStatusType.OPEN,
      url: data.url,
      sourceBranch: data.sourceBranch,
      targetBranch: data.targetBranch,
      mergedAt: data.mergedAt ? new Date(data.mergedAt) : null,
    });
  }
}

/**
 * Base CI event class.
 */
export class CIEvent {
  /**
   * Create a CIEvent.
   * @param {Object} props - Properties
   * @param {string} props.eventType - Event type
   * @param {Date} [props.timestamp] - Event timestamp
   * @param {string|null} [props.branch=null] - Related branch
   * @param {string|null} [props.runId=null] - Build run ID if applicable
   * @param {number|null} [props.prNumber=null] - PR number if applicable
   * @param {Object} [props.metadata={}] - Additional metadata
   */
  constructor({
    eventType,
    timestamp,
    branch = null,
    runId = null,
    prNumber = null,
    metadata = {},
  }) {
    /** @type {string} */
    this.eventType = eventType;
    /** @type {Date} */
    this.timestamp = timestamp ?? new Date();
    /** @type {string|null} */
    this.branch = branch;
    /** @type {string|null} */
    this.runId = runId;
    /** @type {number|null} */
    this.prNumber = prNumber;
    /** @type {Object} */
    this.metadata = metadata;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').CIEventData}
   */
  toDict() {
    return {
      eventType: this.eventType,
      timestamp: this.timestamp.toISOString(),
      branch: this.branch,
      runId: this.runId,
      prNumber: this.prNumber,
      metadata: this.metadata,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').CIEventData} data
   * @returns {CIEvent}
   */
  static fromDict(data) {
    return new CIEvent({
      eventType: data.eventType,
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
      branch: data.branch ?? null,
      runId: data.runId ?? null,
      prNumber: data.prNumber ?? null,
      metadata: data.metadata ?? {},
    });
  }
}

/**
 * @callback CIEventHandler
 * @param {CIEvent} event
 * @returns {void|Promise<void>}
 */

/**
 * Abstract CI provider interface.
 * Implement this interface to integrate with different CI systems.
 */
export class CIProvider {
  /**
   * Trigger a build on a branch.
   * @param {string} branch - Branch name
   * @returns {Promise<BuildStatus>}
   */
  async triggerBuild(branch) {
    throw new Error('Not implemented');
  }

  /**
   * Get the status of a build.
   * @param {string} runId - Build run ID
   * @returns {Promise<BuildStatus>}
   */
  async getBuildStatus(runId) {
    throw new Error('Not implemented');
  }

  /**
   * Wait for a build to complete.
   * @param {string} runId - Build run ID
   * @param {number} [timeout=300000] - Timeout in milliseconds
   * @returns {Promise<BuildStatus>}
   */
  async waitForBuild(runId, timeout = 300000) {
    throw new Error('Not implemented');
  }

  /**
   * Create a pull request.
   * @param {Object} props - Properties
   * @param {string} props.title - PR title
   * @param {string} props.body - PR body
   * @param {string} props.sourceBranch - Source branch
   * @param {string} props.targetBranch - Target branch
   * @returns {Promise<PRInfo>}
   */
  async createPR({ title, body, sourceBranch, targetBranch }) {
    throw new Error('Not implemented');
  }

  /**
   * Get the status of a pull request.
   * @param {number} prNumber - PR number
   * @returns {Promise<PRInfo>}
   */
  async getPRStatus(prNumber) {
    throw new Error('Not implemented');
  }

  /**
   * Merge a pull request.
   * @param {number} prNumber - PR number
   * @returns {Promise<PRInfo>}
   */
  async mergePR(prNumber) {
    throw new Error('Not implemented');
  }

  /**
   * Wait for a PR to be merged.
   * @param {number} prNumber - PR number
   * @param {number} [timeout=600000] - Timeout in milliseconds
   * @returns {Promise<PRInfo>}
   */
  async waitForPRMerge(prNumber, timeout = 600000) {
    throw new Error('Not implemented');
  }

  /**
   * Subscribe to CI events.
   * @param {CIEventHandler} handler - Event handler
   * @returns {Promise<void>}
   */
  async subscribe(handler) {
    throw new Error('Not implemented');
  }

  /**
   * Unsubscribe from CI events.
   * @param {CIEventHandler} handler - Event handler
   * @returns {Promise<void>}
   */
  async unsubscribe(handler) {
    throw new Error('Not implemented');
  }
}
