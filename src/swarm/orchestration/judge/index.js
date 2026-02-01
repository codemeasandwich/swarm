/**
 * SWARM Framework - Judge Module
 * Evaluates worker outputs against acceptance criteria
 * @module swarm/orchestration/judge
 */

import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';

/**
 * @typedef {import('../../types/module.js').JudgeConfig} JudgeConfig
 * @typedef {import('../../types/task.js').TaskDefinition} TaskDefinition
 * @typedef {import('../../types/task.js').TaskResult} TaskResult
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 */

/**
 * @typedef {Object} JudgeInput
 * @property {TaskDefinition} task - Task that was executed
 * @property {unknown} output - Worker's output
 * @property {Object} [testResults] - Results from deterministic tests
 * @property {boolean} [testResults.passed] - Whether tests passed
 * @property {string[]} [testResults.failures] - List of failed tests
 * @property {Object} [lintResults] - Results from linting
 * @property {boolean} [lintResults.passed] - Whether linting passed
 * @property {string[]} [lintResults.errors] - List of lint errors
 */

/**
 * @typedef {Object} JudgeOutput
 * @property {boolean} passed - Whether the task passed evaluation
 * @property {number} score - Overall quality score (0-1)
 * @property {Record<string, number>} breakdown - Scores by criterion
 * @property {string[]} feedback - Feedback for improvement
 * @property {boolean} shouldRetry - Whether to retry on failure
 */

/**
 * Base judge implementation with common functionality
 * @param {string} id
 * @param {string} implementation
 * @param {(input: JudgeInput, config: JudgeConfig, context: ExecutionContext) => Promise<JudgeOutput>} judgeFn
 * @returns {import('../../types/module.js').Module<JudgeConfig, JudgeInput, JudgeOutput>}
 */
export function createJudge(id, implementation, judgeFn) {
  /** @type {JudgeConfig | null} */
  let config = null;

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.JUDGE,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Judge not configured');
      }
      return judgeFn(input, config, context);
    },
  });
}

/**
 * Evaluate deterministic criteria
 * @param {JudgeInput} input
 * @returns {{score: number, breakdown: Record<string, number>, feedback: string[]}}
 */
function evaluateDeterministic(input) {
  const breakdown = {};
  const feedback = [];
  let totalWeight = 0;
  let weightedScore = 0;

  // Evaluate tests
  if (input.testResults) {
    const testScore = input.testResults.passed ? 1.0 : 0.0;
    breakdown.tests = testScore;
    totalWeight += 0.5;
    weightedScore += testScore * 0.5;

    if (!input.testResults.passed && input.testResults.failures) {
      feedback.push(`Tests failed: ${input.testResults.failures.join(', ')}`);
    }
  }

  // Evaluate linting
  if (input.lintResults) {
    const lintScore = input.lintResults.passed ? 1.0 : 0.0;
    breakdown.lint = lintScore;
    totalWeight += 0.3;
    weightedScore += lintScore * 0.3;

    if (!input.lintResults.passed && input.lintResults.errors) {
      feedback.push(`Lint errors: ${input.lintResults.errors.join(', ')}`);
    }
  }

  // Check if output exists
  const hasOutput = input.output !== null && input.output !== undefined;
  breakdown.output = hasOutput ? 1.0 : 0.0;
  totalWeight += 0.2;
  weightedScore += (hasOutput ? 1.0 : 0.0) * 0.2;

  if (!hasOutput) {
    feedback.push('No output produced');
  }

  const score = totalWeight > 0 ? weightedScore / totalWeight * (1 / 0.5 + 0.3 + 0.2) : 0;
  const normalizedScore = Math.min(1, Math.max(0, weightedScore));

  return { score: normalizedScore, breakdown, feedback };
}

/**
 * Deterministic judge - rule-based checks (tests pass, linting, etc.)
 * Best for objective criteria
 */
export function createDeterministicJudge() {
  return createJudge(
    'judge-deterministic',
    'deterministic',
    async (input, config, context) => {
      const { score, breakdown, feedback } = evaluateDeterministic(input);
      const threshold = config.rubric?.passingThreshold || 0.7;
      const passed = score >= threshold;

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: passed ? 'judge.passed' : 'judge.failed',
        moduleId: 'judge-deterministic',
        taskId: input.task.id,
        payload: { score, passed, breakdown },
        level: passed ? 'info' : 'warn',
      });

      return {
        passed,
        score,
        breakdown,
        feedback,
        shouldRetry: !passed && config.retryOnFailure,
      };
    }
  );
}

/**
 * LLM-based judge - uses LLM to assess quality against rubric
 * Best for subjective quality assessment
 */
export function createLlmJudge() {
  return createJudge(
    'judge-llm-eval',
    'llm-eval',
    async (input, config, context) => {
      // In production, this would call Claude CLI to evaluate
      // For now, simulate LLM evaluation with deterministic baseline

      const { score: baseScore, breakdown, feedback } = evaluateDeterministic(input);

      // Simulate LLM evaluation adding quality dimensions
      const rubric = config.rubric;
      if (rubric) {
        for (const dimension of rubric.dimensions) {
          // Simulate LLM scoring (in production, call Claude)
          const dimScore = baseScore * (0.8 + Math.random() * 0.2); // Add variance
          breakdown[dimension.name] = Math.round(dimScore * 100) / 100;
        }
      }

      // Recalculate score with rubric weights
      let finalScore = baseScore;
      if (rubric && rubric.dimensions.length > 0) {
        let weightedSum = 0;
        let totalWeight = 0;
        for (const dim of rubric.dimensions) {
          if (breakdown[dim.name] !== undefined) {
            weightedSum += breakdown[dim.name] * dim.weight;
            totalWeight += dim.weight;
          }
        }
        if (totalWeight > 0) {
          finalScore = weightedSum / totalWeight;
        }
      }

      const threshold = rubric?.passingThreshold || 0.7;
      const passed = finalScore >= threshold;

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: passed ? 'judge.passed' : 'judge.failed',
        moduleId: 'judge-llm-eval',
        taskId: input.task.id,
        payload: { score: finalScore, passed, breakdown },
        level: passed ? 'info' : 'warn',
      });

      return {
        passed,
        score: finalScore,
        breakdown,
        feedback,
        shouldRetry: !passed && config.retryOnFailure,
      };
    }
  );
}

/**
 * Hybrid judge - combines deterministic gates with LLM evaluation
 * Best for production deployments
 */
export function createHybridJudge() {
  return createJudge(
    'judge-hybrid',
    'hybrid',
    async (input, config, context) => {
      // First: deterministic gates must pass
      const deterministicResult = evaluateDeterministic(input);
      const breakdown = { ...deterministicResult.breakdown };
      const feedback = [...deterministicResult.feedback];

      // Check hard gates (tests must pass)
      const testsPass = input.testResults?.passed !== false;
      if (!testsPass) {
        context.emit({
          timestamp: Date.now(),
          runId: context.runId,
          eventType: 'judge.failed',
          moduleId: 'judge-hybrid',
          taskId: input.task.id,
          payload: { score: deterministicResult.score, passed: false, reason: 'tests_failed' },
          level: 'warn',
        });

        return {
          passed: false,
          score: deterministicResult.score,
          breakdown,
          feedback: ['Hard gate failed: tests must pass', ...feedback],
          shouldRetry: config.retryOnFailure,
        };
      }

      // Second: LLM evaluation for quality
      const rubric = config.rubric;
      if (rubric) {
        for (const dimension of rubric.dimensions) {
          // Simulate LLM scoring
          const dimScore = deterministicResult.score * (0.85 + Math.random() * 0.15);
          breakdown[dimension.name] = Math.round(dimScore * 100) / 100;
        }
      }

      // Calculate final score
      let finalScore = deterministicResult.score;
      if (rubric && rubric.dimensions.length > 0) {
        let weightedSum = 0;
        let totalWeight = 0;
        for (const dim of rubric.dimensions) {
          if (breakdown[dim.name] !== undefined) {
            weightedSum += breakdown[dim.name] * dim.weight;
            totalWeight += dim.weight;
          }
        }
        if (totalWeight > 0) {
          finalScore = weightedSum / totalWeight;
        }
      }

      const threshold = rubric?.passingThreshold || 0.7;
      const passed = finalScore >= threshold;

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: passed ? 'judge.passed' : 'judge.failed',
        moduleId: 'judge-hybrid',
        taskId: input.task.id,
        payload: { score: finalScore, passed, breakdown },
        level: passed ? 'info' : 'warn',
      });

      return {
        passed,
        score: finalScore,
        breakdown,
        feedback,
        shouldRetry: !passed && config.retryOnFailure,
      };
    }
  );
}

/**
 * Register default judge implementations
 */
export function registerJudges() {
  if (!globalRegistry.has(ModuleType.JUDGE, 'deterministic')) {
    globalRegistry.register(ModuleType.JUDGE, 'deterministic', createDeterministicJudge);
  }
  if (!globalRegistry.has(ModuleType.JUDGE, 'llm-eval')) {
    globalRegistry.register(ModuleType.JUDGE, 'llm-eval', createLlmJudge);
  }
  if (!globalRegistry.has(ModuleType.JUDGE, 'hybrid')) {
    globalRegistry.register(ModuleType.JUDGE, 'hybrid', createHybridJudge);
  }
}

// Auto-register on import
registerJudges();
