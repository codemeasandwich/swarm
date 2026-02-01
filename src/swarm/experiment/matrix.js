/**
 * SWARM Framework - Configuration Matrix Generator
 * Generates configuration matrices from independent variables
 * @module swarm/experiment/matrix
 */

import { createBaselineConfig } from '../config/defaults.js';

// =============================================================================
// MATRIX TYPES
// =============================================================================

/**
 * @typedef {Object} MatrixConfiguration
 * @property {string} id - Unique configuration ID
 * @property {string} name - Human-readable name
 * @property {Record<string, unknown>} variables - Variable values for this config
 * @property {import('../types/workflow.js').WorkflowConfig} config - Full workflow config
 */

/**
 * @typedef {Object} ConfigurationMatrix
 * @property {string} experimentId - Parent experiment ID
 * @property {import('../types/experiment.js').IndependentVariable[]} variables - Variables being varied
 * @property {MatrixConfiguration[]} configurations - All configurations
 * @property {number} totalConfigurations - Total configuration count
 */

// =============================================================================
// PATH UTILITIES
// =============================================================================

/**
 * Get value from object by dot-notation path
 * @param {object} obj - Object to traverse
 * @param {string} path - Dot-notation path (e.g., "orchestration.planner.implementation")
 * @returns {unknown}
 */
export function getByPath(obj, path) {
  const parts = path.split('.');
  let current = obj;

  for (const part of parts) {
    if (current === null || current === undefined) {
      return undefined;
    }
    current = current[part];
  }

  return current;
}

/**
 * Set value in object by dot-notation path
 * @param {object} obj - Object to modify
 * @param {string} path - Dot-notation path
 * @param {unknown} value - Value to set
 * @returns {object} Modified object (same reference)
 */
export function setByPath(obj, path, value) {
  const parts = path.split('.');
  let current = obj;

  for (let i = 0; i < parts.length - 1; i++) {
    const part = parts[i];
    if (current[part] === undefined || current[part] === null) {
      current[part] = {};
    }
    current = current[part];
  }

  current[parts[parts.length - 1]] = value;
  return obj;
}

/**
 * Deep clone an object
 * @param {T} obj - Object to clone
 * @returns {T}
 * @template T
 */
export function deepClone(obj) {
  return JSON.parse(JSON.stringify(obj));
}

// =============================================================================
// CARTESIAN PRODUCT
// =============================================================================

/**
 * Generate cartesian product of arrays
 * @param {Array<Array<unknown>>} arrays - Arrays to combine
 * @returns {Array<Array<unknown>>}
 */
export function cartesianProduct(arrays) {
  if (arrays.length === 0) {
    return [[]];
  }

  if (arrays.length === 1) {
    return arrays[0].map((v) => [v]);
  }

  const result = [];
  const [first, ...rest] = arrays;
  const restProduct = cartesianProduct(rest);

  for (const value of first) {
    for (const restValues of restProduct) {
      result.push([value, ...restValues]);
    }
  }

  return result;
}

// =============================================================================
// MATRIX GENERATION
// =============================================================================

/**
 * Generate configuration ID from variable values
 * @param {Record<string, unknown>} variables
 * @returns {string}
 */
function generateConfigId(variables) {
  const parts = Object.entries(variables).map(([key, value]) => {
    const shortKey = key.split('.').pop();
    const shortValue = String(value).slice(0, 10);
    return `${shortKey}-${shortValue}`;
  });
  return parts.join('_');
}

/**
 * Generate human-readable name from variable values
 * @param {Record<string, unknown>} variables
 * @returns {string}
 */
function generateConfigName(variables) {
  const parts = Object.entries(variables).map(([key, value]) => {
    const name = key.split('.').pop();
    return `${name}=${value}`;
  });
  return parts.join(', ');
}

/**
 * Generate configuration matrix from experiment definition
 * @param {import('../types/experiment.js').Experiment} experiment
 * @returns {ConfigurationMatrix}
 */
export function generateMatrix(experiment) {
  const { independentVariables, controlConfig } = experiment;
  const baseConfig = controlConfig || createBaselineConfig();

  // Handle empty variables case
  if (!independentVariables || independentVariables.length === 0) {
    return {
      experimentId: experiment.id,
      variables: [],
      configurations: [
        {
          id: 'control',
          name: 'Control Configuration',
          variables: {},
          config: deepClone(baseConfig),
        },
      ],
      totalConfigurations: 1,
    };
  }

  // Generate cartesian product of all variable values
  const valueArrays = independentVariables.map((v) => v.values);
  const combinations = cartesianProduct(valueArrays);

  // Create configurations from combinations
  const configurations = combinations.map((values, index) => {
    // Build variables object
    const variables = {};
    independentVariables.forEach((variable, i) => {
      variables[variable.path] = values[i];
    });

    // Clone base config and apply variables
    const config = deepClone(baseConfig);
    independentVariables.forEach((variable, i) => {
      setByPath(config, variable.path, values[i]);
    });

    // Generate ID and name
    const id = generateConfigId(variables) || `config-${index}`;
    const name = generateConfigName(variables) || `Configuration ${index + 1}`;

    return {
      id,
      name,
      variables,
      config,
    };
  });

  return {
    experimentId: experiment.id,
    variables: independentVariables,
    configurations,
    totalConfigurations: configurations.length,
  };
}

/**
 * Generate matrix with control and treatment groups
 * @param {import('../types/experiment.js').Experiment} experiment
 * @returns {ConfigurationMatrix}
 */
export function generateMatrixWithControl(experiment) {
  const matrix = generateMatrix(experiment);

  // Add control configuration at the start if not already present
  const controlConfig = experiment.controlConfig || createBaselineConfig();
  const hasControl = matrix.configurations.some((c) => c.id === 'control');

  if (!hasControl) {
    matrix.configurations.unshift({
      id: 'control',
      name: 'Control (Baseline)',
      variables: {},
      config: deepClone(controlConfig),
    });
    matrix.totalConfigurations++;
  }

  return matrix;
}

/**
 * Filter matrix to specific configurations
 * @param {ConfigurationMatrix} matrix
 * @param {string[]} configIds - Configuration IDs to include
 * @returns {ConfigurationMatrix}
 */
export function filterMatrix(matrix, configIds) {
  const filtered = matrix.configurations.filter((c) => configIds.includes(c.id));
  return {
    ...matrix,
    configurations: filtered,
    totalConfigurations: filtered.length,
  };
}

/**
 * Get configuration by ID from matrix
 * @param {ConfigurationMatrix} matrix
 * @param {string} configId
 * @returns {MatrixConfiguration | undefined}
 */
export function getConfiguration(matrix, configId) {
  return matrix.configurations.find((c) => c.id === configId);
}

/**
 * Calculate total runs for a matrix given runs per configuration
 * @param {ConfigurationMatrix} matrix
 * @param {number} runsPerConfiguration
 * @returns {number}
 */
export function calculateTotalRuns(matrix, runsPerConfiguration) {
  return matrix.totalConfigurations * runsPerConfiguration;
}

// =============================================================================
// VARIABLE ANALYSIS
// =============================================================================

/**
 * Get unique values for a variable across configurations
 * @param {ConfigurationMatrix} matrix
 * @param {string} variablePath
 * @returns {unknown[]}
 */
export function getVariableValues(matrix, variablePath) {
  const values = new Set();
  for (const config of matrix.configurations) {
    const value = getByPath(config.config, variablePath);
    if (value !== undefined) {
      values.add(value);
    }
  }
  return [...values];
}

/**
 * Group configurations by a variable value
 * @param {ConfigurationMatrix} matrix
 * @param {string} variablePath
 * @returns {Map<unknown, MatrixConfiguration[]>}
 */
export function groupByVariable(matrix, variablePath) {
  const groups = new Map();

  for (const config of matrix.configurations) {
    const value = getByPath(config.config, variablePath);
    if (!groups.has(value)) {
      groups.set(value, []);
    }
    groups.get(value).push(config);
  }

  return groups;
}
