/**
 * @file File watcher for communications.json changes.
 * Uses chokidar for reliable cross-platform file watching.
 * @module communication/file-watcher
 */

import chokidar from 'chokidar';

/**
 * @callback FileWatcherCallback
 * @param {string|null} updatedBy - Agent that made the update
 * @param {Object} data - Current file data
 * @returns {void}
 */

/**
 * Watches the communications.json file for changes
 * and notifies registered agents.
 */
export class FileWatcher {
  /**
   * Create a FileWatcher.
   * @param {import('./communications-file.js').CommunicationsFile} commFile - Communications file handler
   * @param {number} [debounceMs=100] - Debounce interval in milliseconds
   */
  constructor(commFile, debounceMs = 100) {
    /** @type {import('./communications-file.js').CommunicationsFile} */
    this.commFile = commFile;
    /** @type {number} */
    this.debounceMs = debounceMs;
    /** @private @type {Map<string, FileWatcherCallback>} */
    this._callbacks = new Map();
    /** @private @type {chokidar.FSWatcher|null} */
    this._watcher = null;
    /** @private @type {string} */
    this._lastHash = '';
    /** @private @type {boolean} */
    this._running = false;
  }

  /**
   * Register an agent to receive notifications.
   * @param {string} agentName - Name of the agent
   * @param {FileWatcherCallback} callback - Callback function to invoke on changes
   * @returns {void}
   */
  register(agentName, callback) {
    this._callbacks.set(agentName, callback);
    console.log(`[Watcher] Registered agent: ${agentName}`);
  }

  /**
   * Unregister an agent from notifications.
   * @param {string} agentName - Name of the agent
   * @returns {void}
   */
  unregister(agentName) {
    if (this._callbacks.has(agentName)) {
      this._callbacks.delete(agentName);
      console.log(`[Watcher] Unregistered agent: ${agentName}`);
    }
  }

  /**
   * Get the list of registered agents.
   * @returns {string[]}
   */
  getRegisteredAgents() {
    return Array.from(this._callbacks.keys());
  }

  /**
   * Start watching the file.
   * @returns {Promise<void>}
   */
  async start() {
    if (this._watcher || this._running) return;

    this._running = true;
    this._lastHash = await this.commFile.getFileHash();

    this._watcher = chokidar.watch(this.commFile.filepath, {
      persistent: true,
      awaitWriteFinish: {
        stabilityThreshold: this.debounceMs,
        pollInterval: 50,
      },
    });

    this._watcher.on('change', () => this._handleChange());
    this._watcher.on('error', (error) => console.error('[Watcher] Error:', error));

    console.log('[Watcher] Started watching communications.json');
  }

  /**
   * Handle file change event.
   * @private
   * @returns {Promise<void>}
   */
  async _handleChange() {
    if (!this._running) return;

    try {
      const currentHash = await this.commFile.getFileHash();

      if (currentHash !== this._lastHash) {
        const data = await this.commFile.readRaw();
        const updatedBy = data._meta?.lastUpdatedBy ?? null;

        // Notify all agents EXCEPT the one who made the update
        for (const [agentName, callback] of this._callbacks) {
          if (agentName !== updatedBy) {
            try {
              callback(updatedBy, data);
            } catch (err) {
              console.error(`[Watcher] Error notifying ${agentName}:`, err);
            }
          }
        }

        this._lastHash = currentHash;
      }
    } catch (err) {
      console.error('[Watcher] Error in change handler:', err);
    }
  }

  /**
   * Stop watching the file.
   * @returns {Promise<void>}
   */
  async stop() {
    this._running = false;
    if (this._watcher) {
      await this._watcher.close();
      this._watcher = null;
    }
    console.log('[Watcher] Stopped');
  }

  /**
   * Check if the watcher is currently running.
   * @returns {boolean}
   */
  isRunning() {
    return this._running && this._watcher !== null;
  }
}
