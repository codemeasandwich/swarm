/**
 * @file CI event emitter for pub/sub.
 * @module ci/events
 */

import { CIEventType } from '../types/index.js';
import { CIEvent } from './interface.js';

/**
 * @callback CIEventHandler
 * @param {CIEvent} event
 * @returns {void|Promise<void>}
 */

/**
 * @typedef {Object} EventSubscription
 * @property {CIEventHandler} handler - Event handler
 * @property {string[]} [eventTypes] - Filter by event types (empty = all)
 * @property {string[]} [branches] - Filter by branches (empty = all)
 */

/**
 * CI event emitter for pub/sub pattern.
 */
export class CIEventEmitter {
  /**
   * Create a CIEventEmitter.
   * @param {Object} [options] - Options
   * @param {number} [options.maxHistory=100] - Maximum event history size
   */
  constructor(options = {}) {
    /** @private @type {Set<EventSubscription>} */
    this._subscriptions = new Set();
    /** @private @type {CIEvent[]} */
    this._history = [];
    /** @private @type {number} */
    this._maxHistory = options.maxHistory ?? 100;
  }

  /**
   * Subscribe to events with optional filtering.
   *
   * @param {CIEventHandler} handler - Event handler
   * @param {Object} [filters] - Optional filters
   * @param {string[]} [filters.eventTypes] - Filter by event types
   * @param {string[]} [filters.branches] - Filter by branches
   * @returns {EventSubscription} The subscription object (for unsubscribing)
   */
  subscribe(handler, filters = {}) {
    const subscription = {
      handler,
      eventTypes: filters.eventTypes ?? [],
      branches: filters.branches ?? [],
    };

    this._subscriptions.add(subscription);
    return subscription;
  }

  /**
   * Unsubscribe from events.
   * @param {EventSubscription|CIEventHandler} subscriptionOrHandler - Subscription or handler
   * @returns {boolean} True if unsubscribed
   */
  unsubscribe(subscriptionOrHandler) {
    if (typeof subscriptionOrHandler === 'function') {
      // Find by handler function
      for (const sub of this._subscriptions) {
        if (sub.handler === subscriptionOrHandler) {
          this._subscriptions.delete(sub);
          return true;
        }
      }
      return false;
    }

    return this._subscriptions.delete(subscriptionOrHandler);
  }

  /**
   * Emit an event to all matching subscribers.
   *
   * @param {CIEvent} event - Event to emit
   * @returns {Promise<void>}
   */
  async emit(event) {
    // Add to history
    this._history.push(event);
    if (this._history.length > this._maxHistory) {
      this._history.shift();
    }

    // Notify matching subscribers
    const promises = [];

    for (const subscription of this._subscriptions) {
      if (this._matchesFilters(event, subscription)) {
        try {
          const result = subscription.handler(event);
          if (result instanceof Promise) {
            promises.push(result.catch((err) => {
              console.error('[CIEventEmitter] Handler error:', err);
            }));
          }
        } catch (err) {
          console.error('[CIEventEmitter] Handler error:', err);
        }
      }
    }

    await Promise.all(promises);
  }

  /**
   * Check if event matches subscription filters.
   * @private
   * @param {CIEvent} event
   * @param {EventSubscription} subscription
   * @returns {boolean}
   */
  _matchesFilters(event, subscription) {
    // Check event type filter
    if (subscription.eventTypes.length > 0) {
      if (!subscription.eventTypes.includes(event.eventType)) {
        return false;
      }
    }

    // Check branch filter
    if (subscription.branches.length > 0) {
      if (event.branch && !subscription.branches.includes(event.branch)) {
        return false;
      }
    }

    return true;
  }

  /**
   * Emit a build started event.
   * @param {string} runId - Build run ID
   * @param {string} branch - Branch name
   * @returns {Promise<void>}
   */
  async emitBuildStarted(runId, branch) {
    await this.emit(new CIEvent({
      eventType: CIEventType.BUILD_STARTED,
      runId,
      branch,
    }));
  }

  /**
   * Emit a build success event.
   * @param {string} runId - Build run ID
   * @param {string} branch - Branch name
   * @returns {Promise<void>}
   */
  async emitBuildSuccess(runId, branch) {
    await this.emit(new CIEvent({
      eventType: CIEventType.BUILD_SUCCESS,
      runId,
      branch,
    }));
  }

  /**
   * Emit a build failure event.
   * @param {string} runId - Build run ID
   * @param {string} branch - Branch name
   * @param {string} [errorMessage] - Error message
   * @returns {Promise<void>}
   */
  async emitBuildFailure(runId, branch, errorMessage) {
    await this.emit(new CIEvent({
      eventType: CIEventType.BUILD_FAILURE,
      runId,
      branch,
      metadata: errorMessage ? { errorMessage } : {},
    }));
  }

  /**
   * Emit a PR opened event.
   * @param {number} prNumber - PR number
   * @param {string} branch - Branch name
   * @returns {Promise<void>}
   */
  async emitPROpened(prNumber, branch) {
    await this.emit(new CIEvent({
      eventType: CIEventType.PR_OPENED,
      prNumber,
      branch,
    }));
  }

  /**
   * Emit a PR merged event.
   * @param {number} prNumber - PR number
   * @param {string} branch - Branch name
   * @returns {Promise<void>}
   */
  async emitPRMerged(prNumber, branch) {
    await this.emit(new CIEvent({
      eventType: CIEventType.PR_MERGED,
      prNumber,
      branch,
    }));
  }

  /**
   * Get event history.
   * @param {Object} [filters] - Optional filters
   * @param {string[]} [filters.eventTypes] - Filter by event types
   * @param {string[]} [filters.branches] - Filter by branches
   * @param {number} [filters.limit] - Limit number of events
   * @returns {CIEvent[]}
   */
  getHistory(filters = {}) {
    let events = [...this._history];

    if (filters.eventTypes?.length > 0) {
      events = events.filter((e) => filters.eventTypes.includes(e.eventType));
    }

    if (filters.branches?.length > 0) {
      events = events.filter((e) => e.branch && filters.branches.includes(e.branch));
    }

    if (filters.limit) {
      events = events.slice(-filters.limit);
    }

    return events;
  }

  /**
   * Clear event history.
   * @returns {void}
   */
  clearHistory() {
    this._history = [];
  }

  /**
   * Get subscriber count.
   * @returns {number}
   */
  get subscriberCount() {
    return this._subscriptions.size;
  }
}

// Re-export CIEventType for convenience
export { CIEventType };
