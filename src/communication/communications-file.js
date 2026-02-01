/**
 * @file Handler for the communications.json file.
 * Provides atomic read/write operations for agent coordination.
 * @module communication/communications-file
 */

import { readFile, writeFile, mkdir, access, constants } from 'node:fs/promises';
import { dirname } from 'node:path';
import { createHash } from 'node:crypto';
import { AgentStatus } from './agent-status.js';

/**
 * Handler for the communications.json file.
 * Uses atomic write operations for safety in async contexts.
 */
export class CommunicationsFile {
  /**
   * Create a CommunicationsFile handler.
   * @param {string} [filepath='communications.json'] - Path to communications file
   */
  constructor(filepath = 'communications.json') {
    /** @type {string} */
    this.filepath = filepath;
    /** @private @type {boolean} */
    this._initialized = false;
  }

  /**
   * Ensure the file exists with initial structure.
   * Creates the file and parent directories if they don't exist.
   * @returns {Promise<void>}
   */
  async _ensureFileExists() {
    if (this._initialized) return;

    try {
      await access(this.filepath, constants.F_OK);
    } catch {
      // File doesn't exist, create it
      await mkdir(dirname(this.filepath), { recursive: true });
      await this._writeData({
        _meta: {
          version: '1.0',
          lastUpdated: null,
          lastUpdatedBy: null,
        },
      });
    }
    this._initialized = true;
  }

  /**
   * Read and parse the JSON file.
   * @private
   * @returns {Promise<Object>}
   */
  async _readData() {
    await this._ensureFileExists();
    const content = await readFile(this.filepath, 'utf-8');
    return JSON.parse(content);
  }

  /**
   * Write data to the JSON file.
   * @private
   * @param {Object} data - Data to write
   * @returns {Promise<void>}
   */
  async _writeData(data) {
    await writeFile(this.filepath, JSON.stringify(data, null, 2), 'utf-8');
  }

  /**
   * Update metadata with timestamp and agent name.
   * @private
   * @param {Object} data - Data object to update
   * @param {string} agentName - Name of agent making the update
   * @returns {void}
   */
  _updateMeta(data, agentName) {
    if (!data._meta) {
      data._meta = { version: '1.0' };
    }
    data._meta.lastUpdated = new Date().toISOString();
    data._meta.lastUpdatedBy = agentName;
  }

  /**
   * Read and return the raw JSON data.
   * This is the public interface for reading the communications file.
   * @returns {Promise<Object>}
   */
  async readRaw() {
    return this._readData();
  }

  /**
   * Get status of all agents.
   * @returns {Promise<Map<string, AgentStatus>>}
   */
  async getAllAgents() {
    const data = await this._readData();
    const agents = new Map();

    for (const [key, value] of Object.entries(data)) {
      if (key !== '_meta' && typeof value === 'object') {
        agents.set(key, AgentStatus.fromDict(value));
      }
    }
    return agents;
  }

  /**
   * Get a specific agent's status.
   * @param {string} agentName - Name of the agent
   * @returns {Promise<AgentStatus|null>}
   */
  async getAgent(agentName) {
    const data = await this._readData();
    if (agentName in data && agentName !== '_meta') {
      return AgentStatus.fromDict(data[agentName]);
    }
    return null;
  }

  /**
   * Update an agent's status.
   * @param {string} agentName - Name of the agent
   * @param {AgentStatus} status - New status
   * @returns {Promise<Object>} The updated data
   */
  async updateAgent(agentName, status) {
    const data = await this._readData();

    const timestamp = new Date().toISOString();
    status.lastUpdated = timestamp;

    data[agentName] = status.toDict();
    this._updateMeta(data, agentName);

    await this._writeData(data);
    return data;
  }

  /**
   * Update a single field for an agent.
   * @param {string} agentName - Name of the agent
   * @param {string} field - Field name to update
   * @param {*} value - New value
   * @returns {Promise<Object>} The updated data
   */
  async updateField(agentName, field, value) {
    const data = await this._readData();

    if (!(agentName in data)) {
      data[agentName] = new AgentStatus().toDict();
    }

    const timestamp = new Date().toISOString();
    data[agentName][field] = value;
    data[agentName].lastUpdated = timestamp;
    this._updateMeta(data, agentName);

    await this._writeData(data);
    return data;
  }

  // ==================== REQUEST METHODS ====================

  /**
   * Add a request from one agent to another.
   * Adds [toAgent, request] to fromAgent's requests array.
   *
   * @param {string} fromAgent - The agent making the request
   * @param {string} toAgent - The agent who should fulfill the request
   * @param {string} request - Description of what is being requested
   * @returns {Promise<Object>} The updated data
   */
  async addRequest(fromAgent, toAgent, request) {
    const data = await this._readData();

    if (!(fromAgent in data)) {
      data[fromAgent] = new AgentStatus().toDict();
    }

    if (!data[fromAgent].requests) {
      data[fromAgent].requests = [];
    }

    data[fromAgent].requests.push([toAgent, request]);
    data[fromAgent].lastUpdated = new Date().toISOString();
    this._updateMeta(data, fromAgent);

    await this._writeData(data);
    return data;
  }

  /**
   * Get all requests directed at a specific agent.
   * @param {string} agentName - Name of the agent
   * @returns {Promise<Array<{fromAgent: string, request: string}>>}
   */
  async getRequestsForAgent(agentName) {
    const data = await this._readData();
    const requests = [];

    for (const [name, agentData] of Object.entries(data)) {
      if (name === '_meta' || typeof agentData !== 'object') {
        continue;
      }

      const agentRequests = agentData.requests ?? [];
      for (const req of agentRequests) {
        if (Array.isArray(req) && req.length >= 2 && req[0] === agentName) {
          requests.push({ fromAgent: name, request: req[1] });
        }
      }
    }

    return requests;
  }

  /**
   * Mark a request as completed.
   * Removes the request from requesting agent's requests and adds to their 'added'.
   *
   * @param {string} completingAgent - The agent completing the request
   * @param {string} requestingAgent - The agent who made the request
   * @param {string} originalRequest - The original request text
   * @param {string} description - Description of what was completed
   * @returns {Promise<Object>} The updated data
   */
  async completeRequest(completingAgent, requestingAgent, originalRequest, description) {
    const data = await this._readData();

    // Ensure requesting agent exists
    if (!(requestingAgent in data)) {
      data[requestingAgent] = new AgentStatus().toDict();
    }

    // Remove the request from requesting agent's requests
    if (data[requestingAgent].requests) {
      data[requestingAgent].requests = data[requestingAgent].requests.filter(
        (req) => !(Array.isArray(req) && req.length >= 2 && req[0] === completingAgent && req[1] === originalRequest)
      );
    }

    // Add to requesting agent's 'added' array
    if (!data[requestingAgent].added) {
      data[requestingAgent].added = [];
    }

    data[requestingAgent].added.push([completingAgent, description, originalRequest]);

    const timestamp = new Date().toISOString();
    data[requestingAgent].lastUpdated = timestamp;
    this._updateMeta(data, completingAgent);

    await this._writeData(data);
    return data;
  }

  /**
   * Clear the added array for an agent.
   * Called after an agent has processed their deliveries.
   *
   * @param {string} agentName - Name of the agent
   * @returns {Promise<Object>} The updated data
   */
  async clearAdded(agentName) {
    const data = await this._readData();

    if (agentName in data) {
      data[agentName].added = [];
      data[agentName].lastUpdated = new Date().toISOString();
      this._updateMeta(data, agentName);
    }

    await this._writeData(data);
    return data;
  }

  /**
   * Remove a specific request.
   * @param {string} fromAgent - Agent who made the request
   * @param {string} toAgent - Agent the request was for
   * @param {string} request - The request text
   * @returns {Promise<Object>} The updated data
   */
  async removeRequest(fromAgent, toAgent, request) {
    const data = await this._readData();

    if (fromAgent in data && data[fromAgent].requests) {
      data[fromAgent].requests = data[fromAgent].requests.filter(
        (req) => !(Array.isArray(req) && req.length >= 2 && req[0] === toAgent && req[1] === request)
      );
      data[fromAgent].lastUpdated = new Date().toISOString();
      this._updateMeta(data, fromAgent);
    }

    await this._writeData(data);
    return data;
  }

  /**
   * Remove an agent from the communications file.
   * @param {string} agentName - Name of the agent to remove
   * @returns {Promise<void>}
   */
  async removeAgent(agentName) {
    const data = await this._readData();
    if (agentName in data) {
      delete data[agentName];
      await this._writeData(data);
    }
  }

  /**
   * Get hash of file contents for change detection.
   * @returns {Promise<string>} MD5 hash of file contents
   */
  async getFileHash() {
    await this._ensureFileExists();
    const content = await readFile(this.filepath, 'utf-8');
    return createHash('md5').update(content).digest('hex');
  }

  /**
   * Reset the communications file to initial state.
   * Removes all agents but preserves meta structure.
   * @returns {Promise<void>}
   */
  async reset() {
    await this._writeData({
      _meta: {
        version: '1.0',
        lastUpdated: null,
        lastUpdatedBy: null,
      },
    });
    this._initialized = true;
  }
}
