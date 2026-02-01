/**
 * SWARM Framework - Configuration Loader
 * Load workflow configurations from JSON files
 * @module swarm/config/loader
 */

import { readFile } from 'node:fs/promises';
import { existsSync } from 'node:fs';

/**
 * @typedef {import('../types/workflow.js').WorkflowConfig} WorkflowConfig
 */

/**
 * Load a workflow configuration from a JSON file
 * @param {string} filePath - Path to the JSON configuration file
 * @returns {Promise<WorkflowConfig>}
 * @throws {Error} If file doesn't exist or contains invalid JSON
 */
export async function loadConfig(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`Configuration file not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');

  try {
    const config = JSON.parse(content);
    return config;
  } catch (error) {
    throw new Error(`Invalid JSON in configuration file: ${filePath} - ${error.message}`);
  }
}

/**
 * Load a workflow configuration from a JSON string
 * @param {string} jsonString - JSON configuration string
 * @returns {WorkflowConfig}
 * @throws {Error} If JSON is invalid
 */
export function loadConfigFromString(jsonString) {
  try {
    return JSON.parse(jsonString);
  } catch (error) {
    throw new Error(`Invalid JSON configuration: ${error.message}`);
  }
}

/**
 * Deep merge two objects, with source values overriding target
 * @param {Record<string, unknown>} target - Base object
 * @param {Record<string, unknown>} source - Override object
 * @returns {Record<string, unknown>}
 */
export function deepMerge(target, source) {
  const result = { ...target };

  for (const key of Object.keys(source)) {
    const sourceValue = source[key];
    const targetValue = result[key];

    if (
      sourceValue !== null &&
      typeof sourceValue === 'object' &&
      !Array.isArray(sourceValue) &&
      targetValue !== null &&
      typeof targetValue === 'object' &&
      !Array.isArray(targetValue)
    ) {
      result[key] = deepMerge(
        /** @type {Record<string, unknown>} */ (targetValue),
        /** @type {Record<string, unknown>} */ (sourceValue)
      );
    } else {
      result[key] = sourceValue;
    }
  }

  return result;
}

/**
 * Apply overrides to a base configuration
 * @param {WorkflowConfig} baseConfig - Base configuration
 * @param {Partial<WorkflowConfig>} overrides - Configuration overrides
 * @returns {WorkflowConfig}
 */
export function applyConfigOverrides(baseConfig, overrides) {
  return /** @type {WorkflowConfig} */ (deepMerge(
    /** @type {Record<string, unknown>} */ (baseConfig),
    /** @type {Record<string, unknown>} */ (overrides)
  ));
}

/**
 * Get a nested value from an object using dot notation
 * @param {Record<string, unknown>} obj - Object to query
 * @param {string} path - Dot-notation path (e.g., 'orchestration.planner.implementation')
 * @returns {unknown}
 */
export function getNestedValue(obj, path) {
  const keys = path.split('.');
  let current = obj;

  for (const key of keys) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = /** @type {Record<string, unknown>} */ (current)[key];
  }

  return current;
}

/**
 * Set a nested value in an object using dot notation
 * @param {Record<string, unknown>} obj - Object to modify
 * @param {string} path - Dot-notation path
 * @param {unknown} value - Value to set
 */
export function setNestedValue(obj, path, value) {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    const key = keys[i];
    if (!(key in current) || current[key] === null || typeof current[key] !== 'object') {
      current[key] = {};
    }
    current = /** @type {Record<string, unknown>} */ (current[key]);
  }

  current[keys[keys.length - 1]] = value;
}
