/**
 * @file Central coordinator that manages the communication system.
 * @module communication/coordinator
 */

import { CommunicationsFile } from './communications-file.js';
import { FileWatcher } from './file-watcher.js';
// Agent imported for JSDoc type reference only
/** @typedef {import('./agent.js').Agent} Agent */

/**
 * Central coordinator that manages the communication system.
 * Creates and manages the communications file and file watcher,
 * and provides methods for creating and managing agents.
 */
export class Coordinator {
  /**
   * Create a Coordinator.
   * @param {string} [filepath='communications.json'] - Path to communications file
   * @param {Object} [options={}] - Options
   * @param {number} [options.pollInterval=500] - Poll interval for file watcher in ms
   */
  constructor(filepath = 'communications.json', options = {}) {
    /** @type {CommunicationsFile} */
    this.commFile = new CommunicationsFile(filepath);
    /** @type {FileWatcher} */
    this.watcher = new FileWatcher(this.commFile, options.pollInterval ?? 100);
    /** @private @type {Map<string, Agent>} */
    this._agents = new Map();
    /** @private @type {boolean} */
    this._started = false;
  }

  /**
   * Start the coordination system.
   * Initializes the file watcher.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._started) return;

    await this.watcher.start();
    this._started = true;
    console.log('[Coordinator] System started');
  }

  /**
   * Stop the coordination system.
   * Stops the file watcher and cleans up agents.
   * @returns {Promise<void>}
   */
  async stop() {
    // Shutdown all agents
    for (const agent of this._agents.values()) {
      agent.shutdown();
    }
    this._agents.clear();

    // Stop watcher
    await this.watcher.stop();
    this._started = false;
    console.log('[Coordinator] System stopped');
  }

  /**
   * Create a new agent of the specified type.
   * @template {typeof Agent} T
   * @param {T} AgentClass - Agent class to instantiate
   * @param {string} name - Name for the agent
   * @param {Object} [kwargs={}] - Additional arguments to pass to the agent constructor
   * @returns {InstanceType<T>}
   */
  createAgent(AgentClass, name, kwargs = {}) {
    const agent = new AgentClass(name, this.commFile, this.watcher, kwargs);
    this._agents.set(name, agent);
    return agent;
  }

  /**
   * Get an existing agent by name.
   * @param {string} name - Agent name
   * @returns {Agent|undefined}
   */
  getAgent(name) {
    return this._agents.get(name);
  }

  /**
   * Remove an agent from the coordinator.
   * @param {string} name - Agent name
   * @returns {boolean} True if agent was removed
   */
  removeAgent(name) {
    const agent = this._agents.get(name);
    if (agent) {
      agent.shutdown();
      this._agents.delete(name);
      return true;
    }
    return false;
  }

  /**
   * Get all managed agents.
   * @returns {Map<string, Agent>}
   */
  getAllAgents() {
    return new Map(this._agents);
  }

  /**
   * Get the names of all managed agents.
   * @returns {string[]}
   */
  getAgentNames() {
    return Array.from(this._agents.keys());
  }

  /**
   * Get status of all agents from the communications file.
   * @returns {Promise<Map<string, import('./agent-status.js').AgentStatus>>}
   */
  async getAllStatus() {
    return this.commFile.getAllAgents();
  }

  /**
   * Check if the coordinator is running.
   * @returns {boolean}
   */
  isRunning() {
    return this._started;
  }

  /**
   * Reset the communications file to initial state.
   * Warning: This removes all agent data.
   * @returns {Promise<void>}
   */
  async reset() {
    await this.commFile.reset();
    console.log('[Coordinator] Communications file reset');
  }
}
