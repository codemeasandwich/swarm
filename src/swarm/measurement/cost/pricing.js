/**
 * SWARM Framework - Token Pricing
 * Pricing tables and cost calculation for different models
 * @module swarm/measurement/cost/pricing
 */

// =============================================================================
// PRICING TABLE
// =============================================================================

/**
 * @typedef {Object} ModelPricing
 * @property {number} inputPer1M - Cost per 1M input tokens
 * @property {number} outputPer1M - Cost per 1M output tokens
 */

/**
 * Pricing for Claude models (as of Jan 2025)
 * @type {Record<string, ModelPricing>}
 */
export const CLAUDE_PRICING = Object.freeze({
  // Claude 3.5 models
  'claude-3-5-sonnet-20241022': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-5-haiku-20241022': { inputPer1M: 0.80, outputPer1M: 4.0 },
  'claude-3-5-haiku': { inputPer1M: 0.80, outputPer1M: 4.0 },

  // Claude 3 models
  'claude-3-opus-20240229': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-3-opus': { inputPer1M: 15.0, outputPer1M: 75.0 },
  'claude-3-sonnet-20240229': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-sonnet': { inputPer1M: 3.0, outputPer1M: 15.0 },
  'claude-3-haiku-20240307': { inputPer1M: 0.25, outputPer1M: 1.25 },
  'claude-3-haiku': { inputPer1M: 0.25, outputPer1M: 1.25 },

  // Shorthand aliases
  opus: { inputPer1M: 15.0, outputPer1M: 75.0 },
  sonnet: { inputPer1M: 3.0, outputPer1M: 15.0 },
  haiku: { inputPer1M: 0.25, outputPer1M: 1.25 },
});

/**
 * Default pricing (uses Sonnet pricing)
 * @type {ModelPricing}
 */
export const DEFAULT_PRICING = CLAUDE_PRICING.sonnet;

// =============================================================================
// COST CALCULATION
// =============================================================================

/**
 * Calculate cost for token usage
 * @param {number} inputTokens - Number of input tokens
 * @param {number} outputTokens - Number of output tokens
 * @param {ModelPricing} [pricing=DEFAULT_PRICING] - Pricing to use
 * @returns {number} Cost in dollars
 */
export function calculateCost(inputTokens, outputTokens, pricing = DEFAULT_PRICING) {
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;
  return inputCost + outputCost;
}

/**
 * Get pricing for a model
 * @param {string} modelName - Model name or alias
 * @returns {ModelPricing}
 */
export function getModelPricing(modelName) {
  const normalized = modelName.toLowerCase().trim();
  return CLAUDE_PRICING[normalized] || DEFAULT_PRICING;
}

/**
 * Calculate cost for a specific model
 * @param {string} modelName - Model name
 * @param {number} inputTokens - Input tokens
 * @param {number} outputTokens - Output tokens
 * @returns {number}
 */
export function calculateModelCost(modelName, inputTokens, outputTokens) {
  const pricing = getModelPricing(modelName);
  return calculateCost(inputTokens, outputTokens, pricing);
}

/**
 * @typedef {Object} CostBreakdown
 * @property {number} inputCost - Cost from input tokens
 * @property {number} outputCost - Cost from output tokens
 * @property {number} totalCost - Total cost
 * @property {number} inputTokens - Input token count
 * @property {number} outputTokens - Output token count
 * @property {string} model - Model name
 */

/**
 * Get detailed cost breakdown
 * @param {string} modelName
 * @param {number} inputTokens
 * @param {number} outputTokens
 * @returns {CostBreakdown}
 */
export function getCostBreakdown(modelName, inputTokens, outputTokens) {
  const pricing = getModelPricing(modelName);
  const inputCost = (inputTokens / 1_000_000) * pricing.inputPer1M;
  const outputCost = (outputTokens / 1_000_000) * pricing.outputPer1M;

  return {
    inputCost,
    outputCost,
    totalCost: inputCost + outputCost,
    inputTokens,
    outputTokens,
    model: modelName,
  };
}

/**
 * Format cost for display
 * @param {number} cost - Cost in dollars
 * @param {number} [precision=4] - Decimal precision
 * @returns {string}
 */
export function formatCost(cost, precision = 4) {
  if (cost < 0.0001) {
    return '$0.0000';
  }
  return `$${cost.toFixed(precision)}`;
}

/**
 * Estimate tokens from character count (rough estimate)
 * @param {number} charCount
 * @returns {number}
 */
export function estimateTokensFromChars(charCount) {
  // Rough estimate: ~4 chars per token
  return Math.ceil(charCount / 4);
}
