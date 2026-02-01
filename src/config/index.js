/**
 * @file Configuration management for the orchestration system.
 * Provides centralized configuration with environment variable overrides.
 * @module config
 */

/**
 * Get environment variable as integer with fallback.
 * @param {string} name - Environment variable name
 * @param {number} defaultValue - Default value if not set or invalid
 * @returns {number} The parsed integer or default value
 */
function getEnvInt(name, defaultValue) {
  const value = process.env[name];
  if (value !== undefined) {
    const parsed = parseInt(value, 10);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * Get environment variable as float with fallback.
 * @param {string} name - Environment variable name
 * @param {number} defaultValue - Default value if not set or invalid
 * @returns {number} The parsed float or default value
 */
function getEnvFloat(name, defaultValue) {
  const value = process.env[name];
  if (value !== undefined) {
    const parsed = parseFloat(value);
    if (!Number.isNaN(parsed)) {
      return parsed;
    }
  }
  return defaultValue;
}

/**
 * Get environment variable as string with fallback.
 * @param {string} name - Environment variable name
 * @param {string} defaultValue - Default value if not set
 * @returns {string} The environment variable value or default
 */
function getEnvString(name, defaultValue) {
  return process.env[name] ?? defaultValue;
}

/**
 * @typedef {Object} AgentConfig
 * @property {string} commFile - Path to communications.json file
 * @property {number} pollInterval - Polling interval in milliseconds
 * @property {number} breakpointCheckInterval - Breakpoint check interval in milliseconds
 * @property {number} maxRetries - Maximum number of retries before giving up
 * @property {number} retryInterval - Interval between retries in milliseconds
 * @property {number} prMergeTimeout - Timeout for PR merge in milliseconds
 * @property {number} processTimeout - Timeout for agent process in milliseconds
 * @property {string} integrationBranch - Name of the integration branch
 * @property {number} maxConcurrentAgents - Maximum number of concurrent agents
 * @property {string} snapshotDir - Directory for context snapshots
 * @property {string} sandboxBaseDir - Base directory for agent sandboxes
 */

/** @type {AgentConfig|null} */
let _config = null;

/**
 * Get the global configuration instance.
 * Creates a frozen configuration object on first call.
 * Configuration values can be overridden via environment variables.
 *
 * Environment variables:
 * - ORCHESTRATION_COMM_FILE: Path to communications.json
 * - ORCHESTRATION_POLL_INTERVAL: Polling interval (ms)
 * - ORCHESTRATION_BREAKPOINT_CHECK_INTERVAL: Breakpoint check interval (ms)
 * - ORCHESTRATION_MAX_RETRIES: Maximum retries
 * - ORCHESTRATION_RETRY_INTERVAL: Retry interval (ms)
 * - ORCHESTRATION_PR_MERGE_TIMEOUT: PR merge timeout (ms)
 * - ORCHESTRATION_PROCESS_TIMEOUT: Process timeout (ms)
 * - ORCHESTRATION_INTEGRATION_BRANCH: Integration branch name
 * - ORCHESTRATION_MAX_CONCURRENT_AGENTS: Max concurrent agents
 * - ORCHESTRATION_SNAPSHOT_DIR: Snapshot directory
 * - ORCHESTRATION_SANDBOX_BASE_DIR: Sandbox base directory
 *
 * @returns {AgentConfig} The frozen configuration object
 */
export function getConfig() {
  if (!_config) {
    _config = Object.freeze({
      commFile: getEnvString('ORCHESTRATION_COMM_FILE', 'communications.json'),
      pollInterval: getEnvFloat('ORCHESTRATION_POLL_INTERVAL', 500),
      breakpointCheckInterval: getEnvFloat('ORCHESTRATION_BREAKPOINT_CHECK_INTERVAL', 2000),
      maxRetries: getEnvInt('ORCHESTRATION_MAX_RETRIES', 100),
      retryInterval: getEnvFloat('ORCHESTRATION_RETRY_INTERVAL', 30000),
      prMergeTimeout: getEnvInt('ORCHESTRATION_PR_MERGE_TIMEOUT', 600000),
      processTimeout: getEnvInt('ORCHESTRATION_PROCESS_TIMEOUT', 300000),
      integrationBranch: getEnvString('ORCHESTRATION_INTEGRATION_BRANCH', 'integration'),
      maxConcurrentAgents: getEnvInt('ORCHESTRATION_MAX_CONCURRENT_AGENTS', 5),
      snapshotDir: getEnvString('ORCHESTRATION_SNAPSHOT_DIR', '.state/snapshots'),
      sandboxBaseDir: getEnvString('ORCHESTRATION_SANDBOX_BASE_DIR', '.state/sandboxes'),
    });
  }
  return _config;
}

/**
 * Reset configuration to allow reloading.
 * Useful for testing with different configurations.
 * @returns {void}
 */
export function resetConfig() {
  _config = null;
}

/**
 * Create a custom configuration with specific values.
 * Useful for testing or programmatic configuration.
 *
 * @param {Partial<AgentConfig>} overrides - Values to override
 * @returns {AgentConfig} A new frozen configuration object
 */
export function createConfig(overrides = {}) {
  const defaults = {
    commFile: 'communications.json',
    pollInterval: 500,
    breakpointCheckInterval: 2000,
    maxRetries: 100,
    retryInterval: 30000,
    prMergeTimeout: 600000,
    processTimeout: 300000,
    integrationBranch: 'integration',
    maxConcurrentAgents: 5,
    snapshotDir: '.state/snapshots',
    sandboxBaseDir: '.state/sandboxes',
  };

  return Object.freeze({ ...defaults, ...overrides });
}
