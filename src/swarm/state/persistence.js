/**
 * SWARM Framework - State Persistence
 * Save and load workflow state to/from disk
 * @module swarm/state/persistence
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { existsSync } from 'node:fs';
import { dirname } from 'node:path';

/**
 * @typedef {import('../types/workflow.js').WorkflowState} WorkflowState
 * @typedef {import('../types/task.js').TaskState} TaskState
 * @typedef {import('../types/workflow.js').WorkerInstance} WorkerInstance
 */

/**
 * @typedef {Object} SerializedWorkflowState
 * @property {string} status
 * @property {[string, TaskState][]} tasks
 * @property {[string, WorkerInstance][]} workers
 * @property {number} startedAt
 * @property {number} [completedAt]
 * @property {number} totalTokensUsed
 * @property {number} totalCost
 * @property {import('../types/workflow.js').WorkflowError[]} errors
 */

/**
 * Convert a Map to an array of entries for serialization
 * @template K, V
 * @param {Map<K, V>} map
 * @returns {[K, V][]}
 */
function mapToEntries(map) {
  return Array.from(map.entries());
}

/**
 * Convert an array of entries back to a Map
 * @template K, V
 * @param {[K, V][]} entries
 * @returns {Map<K, V>}
 */
function entriesToMap(entries) {
  return new Map(entries);
}

/**
 * Serialize workflow state for storage
 * @param {WorkflowState} state
 * @returns {SerializedWorkflowState}
 */
export function serializeState(state) {
  return {
    status: state.status,
    tasks: mapToEntries(state.tasks),
    workers: mapToEntries(state.workers),
    startedAt: state.startedAt,
    completedAt: state.completedAt,
    totalTokensUsed: state.totalTokensUsed,
    totalCost: state.totalCost,
    errors: state.errors,
  };
}

/**
 * Deserialize workflow state from storage
 * @param {SerializedWorkflowState} serialized
 * @returns {WorkflowState}
 */
export function deserializeState(serialized) {
  return {
    status: /** @type {import('../types/workflow.js').WorkflowStatusType} */ (serialized.status),
    tasks: entriesToMap(serialized.tasks),
    workers: entriesToMap(serialized.workers),
    startedAt: serialized.startedAt,
    completedAt: serialized.completedAt,
    totalTokensUsed: serialized.totalTokensUsed,
    totalCost: serialized.totalCost,
    errors: serialized.errors,
  };
}

/**
 * Save workflow state to a file
 * @param {WorkflowState} state - State to save
 * @param {string} filePath - Path to save to
 * @returns {Promise<void>}
 */
export async function saveState(state, filePath) {
  const dir = dirname(filePath);
  if (!existsSync(dir)) {
    await mkdir(dir, { recursive: true });
  }

  const serialized = serializeState(state);
  const json = JSON.stringify(serialized, null, 2);
  await writeFile(filePath, json, 'utf-8');
}

/**
 * Load workflow state from a file
 * @param {string} filePath - Path to load from
 * @returns {Promise<WorkflowState>}
 * @throws {Error} If file doesn't exist or is invalid
 */
export async function loadState(filePath) {
  if (!existsSync(filePath)) {
    throw new Error(`State file not found: ${filePath}`);
  }

  const content = await readFile(filePath, 'utf-8');

  try {
    const serialized = JSON.parse(content);
    return deserializeState(serialized);
  } catch (error) {
    throw new Error(`Invalid state file: ${filePath} - ${error.message}`);
  }
}

/**
 * Check if a state file exists
 * @param {string} filePath
 * @returns {boolean}
 */
export function stateExists(filePath) {
  return existsSync(filePath);
}

/**
 * Create a state file path for a workflow run
 * @param {string} baseDir - Base directory for state files
 * @param {string} workflowId - Workflow ID
 * @param {string} runId - Run ID
 * @returns {string}
 */
export function getStateFilePath(baseDir, workflowId, runId) {
  return `${baseDir}/${workflowId}/${runId}/state.json`;
}
