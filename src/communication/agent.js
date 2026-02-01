/**
 * @file Base Agent class for participating in the communication system.
 * @module communication/agent
 */

import { AgentStatus } from './agent-status.js';

/**
 * @typedef {Object} RequestInfo
 * @property {string} fromAgent - Agent who made the request
 * @property {string} request - The request description
 */

/**
 * @typedef {Object} DeliveryInfo
 * @property {string} fromAgent - Agent who completed the work
 * @property {string} description - Description of what was delivered
 * @property {string} originalRequest - The original request
 */

/**
 * Base class for an agent that participates in the communication system.
 * Extend this class and implement the abstract methods to create a custom agent.
 */
export class Agent {
  /**
   * Create an Agent.
   * @param {string} name - Agent name
   * @param {import('./communications-file.js').CommunicationsFile} commFile - Communications file handler
   * @param {import('./file-watcher.js').FileWatcher} watcher - File watcher instance
   */
  constructor(name, commFile, watcher) {
    /** @type {string} */
    this.name = name;
    /** @type {import('./communications-file.js').CommunicationsFile} */
    this.commFile = commFile;
    /** @type {import('./file-watcher.js').FileWatcher} */
    this.watcher = watcher;
    /** @private @type {AgentStatus} */
    this._status = new AgentStatus();

    // Register with watcher
    this.watcher.register(this.name, this._onUpdate.bind(this));
  }

  /**
   * Internal handler for file updates.
   * @private
   * @param {string|null} updatedBy - Agent that made the update
   * @param {Object} data - Current file data
   * @returns {void}
   */
  _onUpdate(updatedBy, data) {
    // Call the user-implemented method
    this.onCommunicationUpdate(updatedBy, data);

    // Check if there are new requests for this agent
    const myData = data[this.name] ?? {};

    // Check requests from other agents
    for (const [agentName, agentData] of Object.entries(data)) {
      if (agentName === '_meta' || agentName === this.name || typeof agentData !== 'object') {
        continue;
      }
      const requests = agentData.requests ?? [];
      const myRequests = requests.filter(
        (req) => Array.isArray(req) && req.length >= 2 && req[0] === this.name
      );
      if (myRequests.length > 0) {
        const formatted = myRequests.map((req) => ({ fromAgent: agentName, request: req[1] }));
        this.onNewRequests(formatted);
      }
    }

    // Check if there are new deliveries
    const added = myData.added ?? [];
    if (added.length > 0) {
      const deliveries = added.map((d) => ({
        fromAgent: d[0],
        description: d[1],
        originalRequest: d[2],
      }));
      this.onDeliveries(deliveries);
    }
  }

  /**
   * Called when another agent updates the communications file.
   * Override this method to handle updates from other agents.
   * @param {string|null} updatedBy - Agent that made the update
   * @param {Object} data - Current file data
   * @returns {void}
   */
  onCommunicationUpdate(_updatedBy, _data) {
    // Default implementation does nothing
    // Override in subclass
  }

  /**
   * Called when there are new requests for this agent.
   * Override to handle incoming requests.
   * @param {RequestInfo[]} requests - Array of request info
   * @returns {void}
   */
  onNewRequests(requests) {
    // Default: print them
    for (const { fromAgent, request } of requests) {
      console.log(`[${this.name}] Request from ${fromAgent}: ${request}`);
    }
  }

  /**
   * Called when there are new deliveries for this agent.
   * Override to handle completed deliveries.
   * @param {DeliveryInfo[]} deliveries - Array of delivery info
   * @returns {void}
   */
  onDeliveries(deliveries) {
    // Default: print them
    for (const { fromAgent, description, originalRequest } of deliveries) {
      console.log(`[${this.name}] Delivery from ${fromAgent}: ${description}`);
      console.log(`           (for request: ${originalRequest})`);
    }
  }

  // ==================== STATUS METHODS ====================

  /**
   * Set the agent's mission.
   * @param {string} mission - Mission description
   * @returns {Promise<void>}
   */
  async setMission(mission) {
    this._status.mission = mission;
    await this.commFile.updateField(this.name, 'mission', mission);
  }

  /**
   * Set what the agent is currently working on.
   * @param {string} task - Current task description
   * @returns {Promise<void>}
   */
  async setWorkingOn(task) {
    this._status.workingOn = task;
    await this.commFile.updateField(this.name, 'workingOn', task);
  }

  /**
   * Set what the agent has completed.
   * @param {string} completed - Completed work description
   * @returns {Promise<void>}
   */
  async setDone(completed) {
    this._status.done = completed;
    await this.commFile.updateField(this.name, 'done', completed);
  }

  /**
   * Set what the agent plans to do next.
   * @param {string} nextTask - Next task description
   * @returns {Promise<void>}
   */
  async setNext(nextTask) {
    this._status.next = nextTask;
    await this.commFile.updateField(this.name, 'next', nextTask);
  }

  /**
   * Update multiple status fields at once.
   * @param {Object} updates - Fields to update
   * @param {string} [updates.mission] - Mission description
   * @param {string} [updates.workingOn] - Current task
   * @param {string} [updates.done] - Completed work
   * @param {string} [updates.next] - Next task
   * @returns {Promise<void>}
   */
  async updateAll({ mission, workingOn, done, next }) {
    if (mission !== undefined) {
      this._status.mission = mission;
    }
    if (workingOn !== undefined) {
      this._status.workingOn = workingOn;
    }
    if (done !== undefined) {
      this._status.done = done;
    }
    if (next !== undefined) {
      this._status.next = next;
    }

    await this.commFile.updateAgent(this.name, this._status);
  }

  // ==================== REQUEST METHODS ====================

  /**
   * Send a request to another agent.
   * @param {string} targetAgent - Name of the target agent
   * @param {string} requestDescription - Description of the request
   * @returns {Promise<void>}
   */
  async request(targetAgent, requestDescription) {
    await this.commFile.addRequest(this.name, targetAgent, requestDescription);
    console.log(`[${this.name}] Sent request to ${targetAgent}: ${requestDescription}`);
  }

  /**
   * Get all requests directed at this agent.
   * @returns {Promise<RequestInfo[]>}
   */
  async getPendingRequests() {
    return this.commFile.getRequestsForAgent(this.name);
  }

  /**
   * Complete a request from another agent.
   * Removes it from their requests and adds to their 'added'.
   *
   * @param {string} requestingAgent - Agent who made the request
   * @param {string} originalRequest - The original request text
   * @param {string} description - Description of what was completed
   * @returns {Promise<void>}
   */
  async completeRequest(requestingAgent, originalRequest, description) {
    await this.commFile.completeRequest(this.name, requestingAgent, originalRequest, description);
    console.log(`[${this.name}] Completed request for ${requestingAgent}: ${description}`);
  }

  /**
   * Get deliveries that have been added for this agent.
   * @returns {Promise<DeliveryInfo[]>}
   */
  async getMyDeliveries() {
    const status = await this.commFile.getAgent(this.name);
    if (!status) return [];

    return (status.added ?? []).map((d) => ({
      fromAgent: d[0],
      description: d[1],
      originalRequest: d[2],
    }));
  }

  /**
   * Clear the added array after processing deliveries.
   * @returns {Promise<void>}
   */
  async acknowledgeDeliveries() {
    await this.commFile.clearAdded(this.name);
  }

  // ==================== UTILITY METHODS ====================

  /**
   * Get status of all other agents.
   * @returns {Promise<Map<string, AgentStatus>>}
   */
  async getOtherAgents() {
    const allAgents = await this.commFile.getAllAgents();
    allAgents.delete(this.name);
    return allAgents;
  }

  /**
   * Get status of a specific agent.
   * @param {string} agentName - Name of the agent
   * @returns {Promise<AgentStatus|null>}
   */
  async getAgentStatus(agentName) {
    return this.commFile.getAgent(agentName);
  }

  /**
   * Get this agent's current status.
   * @returns {AgentStatus}
   */
  getStatus() {
    return this._status;
  }

  /**
   * Unregister this agent from the watcher.
   * Call this when the agent is shutting down.
   * @returns {void}
   */
  shutdown() {
    this.watcher.unregister(this.name);
  }
}

/**
 * Example concrete agent implementation that handles requests and updates.
 * Use this as a template for creating custom agents.
 * @extends Agent
 */
export class TaskAgent extends Agent {
  /**
   * Handle updates from other agents.
   * @param {string|null} updatedBy - Agent that made the update
   * @param {Object} data - Current file data
   * @returns {void}
   */
  onCommunicationUpdate(updatedBy, data) {
    if (!updatedBy) return;

    const otherStatus = data[updatedBy] ?? {};
    console.log(`\n[${this.name}] Update from ${updatedBy}:`);
    console.log(`  Working on: ${otherStatus.workingOn ?? otherStatus.working_on ?? 'N/A'}`);
  }
}
