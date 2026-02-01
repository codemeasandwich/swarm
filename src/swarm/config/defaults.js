/**
 * SWARM Framework - Default Configurations
 * Pre-built configurations for common use cases
 * @module swarm/config/defaults
 */

import { createModelSpec, createRetryPolicy } from '../types/foundation.js';

/**
 * @typedef {import('../types/workflow.js').WorkflowConfig} WorkflowConfig
 * @typedef {import('../types/workflow.js').WorkerProfile} WorkerProfile
 */

/**
 * Default worker profile for single agent baseline
 * @returns {WorkerProfile}
 */
export function createDefaultWorkerProfile() {
  return {
    id: 'worker-default',
    name: 'Default Worker',
    model: createModelSpec({
      provider: 'anthropic',
      name: 'claude-sonnet-4-20250514',
      temperature: 0.3,
      maxOutputTokens: 4096,
      contextWindow: 200000,
    }),
    capabilities: {
      skills: ['code-generation', 'code-review', 'debugging'],
      domainExpertise: ['web-development', 'saas'],
      toolAccess: ['file-editor', 'test-runner', 'typescript-compiler'],
    },
    operational: {
      maxRuntime: 600,
      contextWindow: 32000,
      episodicReset: true,
      retryPolicy: createRetryPolicy(),
    },
    instrumentation: {
      traceLevel: 'detailed',
      captureIntermediates: true,
      qualityCheckpoints: [25, 50, 75, 100],
    },
  };
}

/**
 * Baseline configuration - single agent, simple orchestration
 * Good for comparison and cost-sensitive deployments
 * @returns {WorkflowConfig}
 */
export function createBaselineConfig() {
  return {
    id: 'baseline',
    name: 'Baseline Configuration',
    version: '1.0.0',
    description: 'Single agent baseline for comparison',

    orchestration: {
      planner: {
        implementation: 'single-shot',
        model: createModelSpec({
          provider: 'anthropic',
          name: 'claude-sonnet-4-20250514',
          temperature: 0.2,
          maxOutputTokens: 2048,
          contextWindow: 32000,
        }),
        maxDecompositionDepth: 1,
        taskGranularity: 'coarse',
        parallelismHint: 'sequential',
        contextBudget: 4000,
      },
      scheduler: {
        implementation: 'fifo',
        maxQueueSize: 100,
      },
      router: {
        implementation: 'static',
      },
      judge: {
        implementation: 'deterministic',
        retryOnFailure: true,
        maxRetries: 2,
      },
    },

    configuration: {
      contextBuilder: {
        implementation: 'full',
        maxTokens: 32000,
        includeProjectContext: true,
        includeExamples: true,
        includeConstraints: true,
        includeHistory: false,
        relevanceThreshold: 0.5,
      },
      toolSandbox: {
        implementation: 'extended',
        allowedTools: ['file-editor', 'test-runner', 'typescript-compiler', 'git'],
        blockedPatterns: ['rm -rf', 'sudo', 'chmod 777'],
        rateLimits: {},
        timeoutPerCall: 60,
        isolationLevel: 'process',
      },
      memoryManager: {
        implementation: 'ephemeral',
        storagePath: './.swarm/memory',
      },
      securityGuardrail: {
        implementation: 'standard',
        blocklist: ['rm -rf', 'sudo', 'chmod 777', 'DROP TABLE'],
        requireApprovalFor: ['git push', 'npm publish'],
        auditLog: true,
      },
    },

    execution: {
      workerProfiles: [createDefaultWorkerProfile()],
      maxConcurrentWorkers: 1,
      workerSelectionStrategy: 'capability-match',
    },

    measurement: {
      metrics: {
        enabled: true,
        collectInterval: 1000,
        exportFormat: 'json',
        exportPath: './.swarm/metrics',
        customMetrics: [],
      },
      tracer: {
        enabled: true,
        traceLevel: 'detailed',
        exportFormat: 'json',
        sampleRate: 1.0,
      },
      costTracker: {
        enabled: true,
        tokenPricing: {
          'claude-sonnet-4-20250514': { input: 0.003, output: 0.015 },
          'claude-haiku-4-20250514': { input: 0.00025, output: 0.00125 },
        },
        budgetLimit: 50,
        alertThreshold: 0.8,
      },
      qualityAssessor: {
        dimensions: [
          { name: 'correctness', weight: 0.4, evaluator: 'deterministic', config: {} },
          { name: 'completeness', weight: 0.3, evaluator: 'deterministic', config: {} },
          { name: 'maintainability', weight: 0.3, evaluator: 'llm', config: {} },
        ],
        aggregationMethod: 'weighted-mean',
        passingThreshold: 0.7,
      },
    },

    constraints: {
      maxTotalTokens: 500000,
      maxTotalCost: 50,
      maxTotalRuntime: 3600,
      qualityThreshold: 0.7,
    },
  };
}

/**
 * Gas Town Pattern - optimized for parallel execution
 * Many specialist workers with minimal context
 * @returns {WorkflowConfig}
 */
export function createGasTownConfig() {
  const baseConfig = createBaselineConfig();

  return {
    ...baseConfig,
    id: 'gas-town',
    name: 'Gas Town Pattern',
    description: 'Optimized for parallel execution with specialist workers',

    orchestration: {
      ...baseConfig.orchestration,
      planner: {
        ...baseConfig.orchestration.planner,
        implementation: 'hierarchical',
        taskGranularity: 'fine',
        parallelismHint: 'parallel',
      },
      scheduler: {
        implementation: 'adaptive',
        maxQueueSize: 500,
        adaptiveWindow: 10,
      },
      router: {
        implementation: 'specialist',
        capabilityThreshold: 0.8,
      },
      judge: {
        implementation: 'hybrid',
        model: createModelSpec({
          provider: 'anthropic',
          name: 'claude-sonnet-4-20250514',
          temperature: 0.1,
          maxOutputTokens: 1024,
          contextWindow: 16000,
        }),
        rubric: {
          dimensions: [
            { name: 'correctness', weight: 0.4, criteria: 'Code produces expected output' },
            { name: 'completeness', weight: 0.3, criteria: 'All requirements addressed' },
            { name: 'maintainability', weight: 0.3, criteria: 'Code is readable and well-structured' },
          ],
          passingThreshold: 0.7,
        },
        retryOnFailure: true,
        maxRetries: 1,
      },
    },

    configuration: {
      ...baseConfig.configuration,
      contextBuilder: {
        ...baseConfig.configuration.contextBuilder,
        implementation: 'minimal',
        maxTokens: 2000,
      },
      toolSandbox: {
        ...baseConfig.configuration.toolSandbox,
        implementation: 'minimal',
        allowedTools: ['file-editor', 'test-runner'],
      },
      memoryManager: {
        implementation: 'file-based',
        storagePath: './.swarm/memory',
      },
    },

    execution: {
      workerProfiles: [
        {
          ...createDefaultWorkerProfile(),
          id: 'worker-coder',
          name: 'Code Generation Specialist',
          capabilities: {
            skills: ['code-generation'],
            domainExpertise: ['web-development'],
            toolAccess: ['file-editor', 'typescript-compiler'],
          },
        },
        {
          ...createDefaultWorkerProfile(),
          id: 'worker-tester',
          name: 'Test Writing Specialist',
          capabilities: {
            skills: ['test-writing'],
            domainExpertise: ['web-development'],
            toolAccess: ['file-editor', 'test-runner'],
          },
        },
        {
          ...createDefaultWorkerProfile(),
          id: 'worker-reviewer',
          name: 'Code Review Specialist',
          capabilities: {
            skills: ['code-review'],
            domainExpertise: ['web-development'],
            toolAccess: ['file-editor'],
          },
        },
      ],
      maxConcurrentWorkers: 20,
      workerSelectionStrategy: 'capability-match',
    },
  };
}

/**
 * Cost-optimized configuration
 * Minimizes token usage while maintaining quality
 * @returns {WorkflowConfig}
 */
export function createCostOptimizedConfig() {
  const baseConfig = createBaselineConfig();

  return {
    ...baseConfig,
    id: 'cost-optimized',
    name: 'Cost Optimized Configuration',
    description: 'Minimizes token usage while maintaining quality',

    orchestration: {
      ...baseConfig.orchestration,
      planner: {
        ...baseConfig.orchestration.planner,
        model: createModelSpec({
          provider: 'anthropic',
          name: 'claude-haiku-4-20250514',
          temperature: 0.1,
          maxOutputTokens: 1024,
          contextWindow: 32000,
        }),
        contextBudget: 2000,
      },
      scheduler: {
        implementation: 'cost-aware',
        maxQueueSize: 100,
        priorityWeights: {
          urgency: 0.2,
          complexity: 0.3,
          dependencies: 0.5,
        },
      },
      judge: {
        implementation: 'deterministic',
        retryOnFailure: false,
        maxRetries: 0,
      },
    },

    configuration: {
      ...baseConfig.configuration,
      contextBuilder: {
        ...baseConfig.configuration.contextBuilder,
        implementation: 'minimal',
        maxTokens: 2000,
        includeExamples: false,
      },
      toolSandbox: {
        ...baseConfig.configuration.toolSandbox,
        implementation: 'minimal',
        allowedTools: ['file-editor', 'test-runner'],
      },
      memoryManager: {
        implementation: 'structured',
        storagePath: './.swarm/memory',
        maxEntries: 100,
      },
      securityGuardrail: {
        ...baseConfig.configuration.securityGuardrail,
        implementation: 'permissive',
      },
    },

    execution: {
      workerProfiles: [
        {
          ...createDefaultWorkerProfile(),
          id: 'worker-haiku',
          name: 'Cost-Efficient Worker',
          model: createModelSpec({
            provider: 'anthropic',
            name: 'claude-haiku-4-20250514',
            temperature: 0.2,
            maxOutputTokens: 2048,
            contextWindow: 32000,
          }),
          operational: {
            maxRuntime: 300,
            contextWindow: 8000,
            episodicReset: true,
            retryPolicy: createRetryPolicy({ maxRetries: 1 }),
          },
        },
      ],
      maxConcurrentWorkers: 10,
      workerSelectionStrategy: 'capability-match',
    },

    constraints: {
      ...baseConfig.constraints,
      maxTotalCost: 10,
      maxTotalTokens: 100000,
    },
  };
}

/**
 * Get a default configuration by name
 * @param {'baseline' | 'gas-town' | 'cost-optimized'} name
 * @returns {WorkflowConfig}
 */
export function getDefaultConfig(name) {
  switch (name) {
    case 'baseline':
      return createBaselineConfig();
    case 'gas-town':
      return createGasTownConfig();
    case 'cost-optimized':
      return createCostOptimizedConfig();
    default:
      throw new Error(`Unknown default configuration: ${name}`);
  }
}
