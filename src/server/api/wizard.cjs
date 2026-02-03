/**
 * @fileoverview Wizard API Endpoint
 *
 * Manages wizard state and navigation.
 *
 * @module server/api/wizard
 */

/**
 * Wizard state storage (per-session in memory)
 * In production, this would be persisted
 * @type {Map<string, Object>}
 */
const wizardStates = new Map();

/**
 * Wizard endpoint handler
 *
 * @param {Object} data - Request data
 * @param {string} data.action - Action to perform
 * @param {Object} embed - Embedded data from api-ape (includes clientId)
 * @returns {Object} Response data
 */
module.exports = function wizard(data, embed) {
  const clientId = embed?.clientId || 'default';
  const { action } = data;

  switch (action) {
    case 'getState':
      return getState(clientId);

    case 'setState':
      return setState(clientId, data.state);

    case 'getCurrentStep':
      return { step: getState(clientId).currentStep };

    case 'goToStep':
      return goToStep(clientId, data.step);

    case 'reset':
      return resetState(clientId);

    default:
      return { error: `Unknown action: ${action}` };
  }
};

/**
 * Get wizard state for a client
 *
 * @param {string} clientId - Client identifier
 * @returns {Object} Current wizard state
 */
function getState(clientId) {
  if (!wizardStates.has(clientId)) {
    wizardStates.set(clientId, createInitialState());
  }
  return wizardStates.get(clientId);
}

/**
 * Update wizard state
 *
 * @param {string} clientId - Client identifier
 * @param {Object} updates - State updates to apply
 * @returns {Object} Updated state
 */
function setState(clientId, updates) {
  const current = getState(clientId);
  const updated = { ...current, ...updates };
  wizardStates.set(clientId, updated);
  return updated;
}

/**
 * Navigate to a specific step
 *
 * @param {string} clientId - Client identifier
 * @param {number} step - Step number (1-5)
 * @returns {Object} Result with validation
 */
function goToStep(clientId, step) {
  const state = getState(clientId);

  // Validate step transition
  if (step < 1 || step > 5) {
    return { error: 'Invalid step number', valid: false };
  }

  // Can only go forward if previous steps are complete
  if (step > state.currentStep + 1) {
    return {
      error: 'Cannot skip steps',
      valid: false,
      currentStep: state.currentStep,
    };
  }

  // Validate requirements for moving forward
  if (step > state.currentStep) {
    const validation = validateStepComplete(state, state.currentStep);
    if (!validation.valid) {
      return validation;
    }
  }

  state.currentStep = step;
  wizardStates.set(clientId, state);

  return { valid: true, step, state };
}

/**
 * Reset wizard state
 *
 * @param {string} clientId - Client identifier
 * @returns {Object} Fresh initial state
 */
function resetState(clientId) {
  const initial = createInitialState();
  wizardStates.set(clientId, initial);
  return initial;
}

/**
 * Create initial wizard state
 *
 * @returns {Object} Initial state
 */
function createInitialState() {
  return {
    currentStep: 1,
    projectPath: null,
    projectInfo: null,
    description: '',
    questions: [],
    answers: {},
    plan: null,
    executionId: null,
    isExecuting: false,
    completedSteps: [],
  };
}

/**
 * Validate that a step is complete
 *
 * @param {Object} state - Current wizard state
 * @param {number} step - Step to validate
 * @returns {Object} Validation result
 */
function validateStepComplete(state, step) {
  switch (step) {
    case 1:
      if (!state.projectPath) {
        return { valid: false, error: 'Please select a project' };
      }
      break;

    case 2:
      if (!state.description || state.description.length < 10) {
        return { valid: false, error: 'Please provide a description (at least 10 characters)' };
      }
      break;

    case 3:
      // Questions may be optional
      break;

    case 4:
      if (!state.plan) {
        return { valid: false, error: 'Plan not generated' };
      }
      break;
  }

  return { valid: true };
}
