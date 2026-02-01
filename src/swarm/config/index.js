/**
 * SWARM Framework - Configuration Module
 * @module swarm/config
 */

export {
  loadConfig,
  loadConfigFromString,
  deepMerge,
  applyConfigOverrides,
  getNestedValue,
  setNestedValue,
} from './loader.js';

export { validateConfig } from './validator.js';

export {
  createDefaultWorkerProfile,
  createBaselineConfig,
  createGasTownConfig,
  createCostOptimizedConfig,
  getDefaultConfig,
} from './defaults.js';
