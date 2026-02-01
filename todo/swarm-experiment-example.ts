/**
 * SWARM Framework - Experiment Example
 * Demonstrating systematic measurement of agent configurations
 */

import type {
  WorkflowConfig,
  Experiment,
  TaskDefinition,
  WorkerProfile,
  PlannerConfig,
  ContextBuilderConfig,
} from './swarm-framework-types';

// =============================================================================
// RESEARCH QUESTION: What is the optimal context budget for code generation?
// =============================================================================

/**
 * Hypothesis: Minimal context (< 2K tokens) will outperform rich context
 * (8-32K tokens) for well-specified tasks due to reduced signal dilution,
 * while rich context will be necessary for tasks requiring broader understanding.
 */

// Define the task corpus for testing
const codeGenerationTasks: TaskDefinition[] = [
  {
    id: 'task-001',
    type: 'code-generation',
    description: 'Implement a debounce utility function in TypeScript',
    requiredSkills: ['code-generation'],
    acceptanceCriteria: [
      { type: 'deterministic', description: 'TypeScript compiles without errors', weight: 0.3 },
      { type: 'deterministic', description: 'All unit tests pass', weight: 0.4 },
      { type: 'llm-evaluated', description: 'Code follows best practices', weight: 0.3 },
    ],
    dependencies: [],
    estimatedComplexity: 'simple',
    contextRequirements: [
      { type: 'documentation', query: 'debounce function specification', required: true },
    ],
    toolRequirements: ['typescript-compiler', 'test-runner'],
    timeout: 120,
  },
  {
    id: 'task-002',
    type: 'code-generation',
    description: 'Add error handling to an existing API endpoint',
    requiredSkills: ['code-generation', 'debugging'],
    acceptanceCriteria: [
      { type: 'deterministic', description: 'No regression in existing tests', weight: 0.3 },
      { type: 'deterministic', description: 'New error cases handled', weight: 0.4 },
      { type: 'llm-evaluated', description: 'Error messages are user-friendly', weight: 0.3 },
    ],
    dependencies: [],
    estimatedComplexity: 'moderate',
    contextRequirements: [
      { type: 'file', path: 'src/api/endpoint.ts', required: true },
      { type: 'file', path: 'src/types/errors.ts', required: true },
      { type: 'directory', path: 'src/api/', required: false },
    ],
    toolRequirements: ['typescript-compiler', 'test-runner', 'file-editor'],
    timeout: 300,
  },
  {
    id: 'task-003',
    type: 'code-generation',
    description: 'Refactor authentication module to use dependency injection',
    requiredSkills: ['code-refactoring', 'architecture-design'],
    acceptanceCriteria: [
      { type: 'deterministic', description: 'All tests pass', weight: 0.25 },
      { type: 'llm-evaluated', description: 'DI pattern correctly implemented', weight: 0.35 },
      { type: 'llm-evaluated', description: 'No breaking changes to public API', weight: 0.4 },
    ],
    dependencies: [],
    estimatedComplexity: 'complex',
    contextRequirements: [
      { type: 'directory', path: 'src/auth/', required: true },
      { type: 'file', path: 'src/types/index.ts', required: true },
      { type: 'documentation', query: 'dependency injection patterns', required: false },
    ],
    toolRequirements: ['typescript-compiler', 'test-runner', 'file-editor', 'ast-analyzer'],
    timeout: 600,
  },
];

// =============================================================================
// BASELINE CONFIGURATION
// =============================================================================

const baseWorkerProfile: WorkerProfile = {
  id: 'worker-sonnet',
  name: 'Claude Sonnet Worker',
  model: {
    provider: 'anthropic',
    name: 'claude-sonnet-4-20250514',
    temperature: 0.3,
    maxOutputTokens: 4096,
    contextWindow: 200000,
  },
  capabilities: {
    skills: ['code-generation', 'code-refactoring', 'debugging'],
    domainExpertise: ['web-development', 'saas'],
    toolAccess: ['typescript-compiler', 'test-runner', 'file-editor'],
  },
  operational: {
    maxRuntime: 600,
    contextWindow: 32000, // Will be varied
    episodicReset: true,
    retryPolicy: {
      maxRetries: 2,
      backoffStrategy: 'exponential',
      initialDelay: 1000,
      maxDelay: 10000,
      retryableErrors: ['rate_limit', 'timeout', 'overloaded'],
    },
  },
  instrumentation: {
    traceLevel: 'detailed',
    captureIntermediates: true,
    qualityCheckpoints: [25, 50, 75, 100],
  },
};

const baselineConfig: WorkflowConfig = {
  id: 'baseline-config',
  name: 'Baseline Configuration',
  version: '1.0.0',

  orchestration: {
    planner: {
      implementation: 'single-shot',
      model: {
        provider: 'anthropic',
        name: 'claude-sonnet-4-20250514',
        temperature: 0.2,
        maxOutputTokens: 2048,
        contextWindow: 32000,
      },
      maxDecompositionDepth: 1,
      taskGranularity: 'medium',
      parallelismHint: 'parallel',
      contextBudget: 4000,
    },
    scheduler: {
      implementation: 'priority',
      maxQueueSize: 100,
      priorityWeights: {
        urgency: 0.3,
        complexity: 0.4,
        dependencies: 0.3,
      },
    },
    router: {
      implementation: 'capability',
      capabilityThreshold: 0.7,
    },
    judge: {
      implementation: 'hybrid',
      model: {
        provider: 'anthropic',
        name: 'claude-sonnet-4-20250514',
        temperature: 0.1,
        maxOutputTokens: 1024,
        contextWindow: 16000,
      },
      rubric: {
        dimensions: [
          { name: 'correctness', weight: 0.4, criteria: 'Code produces expected output' },
          { name: 'maintainability', weight: 0.3, criteria: 'Code is readable and well-structured' },
          { name: 'completeness', weight: 0.3, criteria: 'All requirements addressed' },
        ],
        passingThreshold: 0.7,
      },
      retryOnFailure: true,
      maxRetries: 1,
    },
  },

  configuration: {
    contextBuilder: {
      implementation: 'scoped', // Will be varied
      maxTokens: 8000,
      includeProjectContext: true,
      includeExamples: true,
      includeConstraints: true,
      includeHistory: false,
      relevanceThreshold: 0.6,
    },
    toolSandbox: {
      implementation: 'minimal',
      allowedTools: ['typescript-compiler', 'test-runner', 'file-editor'],
      blockedPatterns: ['rm -rf', 'sudo', 'curl | sh'],
      rateLimits: { 'file-editor': 30, 'typescript-compiler': 20 },
      timeoutPerCall: 30,
      isolationLevel: 'process',
    },
    memoryManager: {
      implementation: 'file-based',
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
    workerProfiles: [baseWorkerProfile],
    maxConcurrentWorkers: 1, // Single worker for baseline
    workerSelectionStrategy: 'capability-match',
  },

  measurement: {
    metrics: {
      enabled: true,
      collectInterval: 1000,
      exportFormat: 'json',
      exportPath: './.swarm/metrics',
      customMetrics: [
        {
          name: 'context_utilisation',
          unit: 'ratio',
          description: 'Ratio of context tokens used vs available',
          aggregation: 'mean',
          labels: ['task_type', 'complexity'],
        },
      ],
    },
    tracer: {
      enabled: true,
      traceLevel: 'detailed',
      exportFormat: 'json',
      sampleRate: 1.0, // Full tracing for experiments
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
        { name: 'maintainability', weight: 0.3, evaluator: 'llm', config: {} },
        { name: 'completeness', weight: 0.3, evaluator: 'hybrid', config: {} },
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

// =============================================================================
// EXPERIMENT DEFINITION
// =============================================================================

const contextBudgetExperiment: Experiment = {
  id: 'exp-context-budget-001',
  name: 'Optimal Context Budget for Code Generation',
  hypothesis:
    'Minimal context will outperform rich context for well-specified tasks, ' +
    'while complex refactoring tasks will benefit from broader context.',
  description:
    'Systematically vary context builder implementation and token budget ' +
    'across task complexity levels to identify optimal configurations.',

  independentVariables: [
    {
      path: 'configuration.contextBuilder.implementation',
      values: ['minimal', 'scoped', 'rich', 'full'],
      name: 'Context Strategy',
    },
    {
      path: 'configuration.contextBuilder.maxTokens',
      values: [2000, 8000, 16000, 32000],
      name: 'Context Token Budget',
    },
  ],

  dependentVariables: [
    'task_completion_rate',
    'task_completion_time',
    'total_tokens_used',
    'total_cost',
    'quality_score',
    'retry_rate',
    'context_utilisation',
  ],

  controlConfig: baselineConfig,
  taskSet: codeGenerationTasks,

  parameters: {
    runsPerConfiguration: 5, // Statistical significance
    randomSeed: 42,
    timeoutPerRun: 900,
    warmupRuns: 1,
  },
};

// =============================================================================
// CONFIGURATION MATRIX GENERATOR
// =============================================================================

/**
 * Generates all configuration permutations for an experiment
 */
function generateConfigurationMatrix(experiment: Experiment): WorkflowConfig[] {
  const configs: WorkflowConfig[] = [];
  const variables = experiment.independentVariables;

  // Generate cartesian product of all variable values
  function* cartesianProduct(arrays: unknown[][]): Generator<unknown[]> {
    if (arrays.length === 0) {
      yield [];
      return;
    }
    const [first, ...rest] = arrays;
    for (const value of first) {
      for (const combo of cartesianProduct(rest)) {
        yield [value, ...combo];
      }
    }
  }

  const valueArrays = variables.map((v) => v.values);
  let configIndex = 0;

  for (const combination of cartesianProduct(valueArrays)) {
    // Deep clone the control config
    const config = JSON.parse(JSON.stringify(experiment.controlConfig)) as WorkflowConfig;

    // Apply each variable value
    variables.forEach((variable, i) => {
      setNestedValue(config, variable.path, combination[i]);
    });

    // Update config ID
    config.id = `${experiment.id}-config-${configIndex++}`;
    config.name = combination
      .map((v, i) => `${variables[i].name}=${v}`)
      .join(', ');

    configs.push(config);
  }

  return configs;
}

/**
 * Sets a nested value in an object using dot notation path
 */
function setNestedValue(obj: Record<string, unknown>, path: string, value: unknown): void {
  const keys = path.split('.');
  let current = obj;

  for (let i = 0; i < keys.length - 1; i++) {
    current = current[keys[i]] as Record<string, unknown>;
  }

  current[keys[keys.length - 1]] = value;
}

// =============================================================================
// EXPECTED OUTPUT ANALYSIS SCHEMA
// =============================================================================

interface AnalysisOutput {
  experiment: string;
  totalConfigurations: number;
  totalRuns: number;

  // Primary findings
  findings: {
    optimalConfiguration: {
      byCompletionRate: string;
      byQuality: string;
      byCost: string;
      bySpeed: string;
    };

    contextBudgetEffect: {
      simpleTasksOptimal: number;
      moderateTasksOptimal: number;
      complexTasksOptimal: number;
    };

    diminishingReturns: {
      tokenThreshold: number;
      qualityPlateau: number;
    };
  };

  // Statistical comparisons
  statistics: {
    anovaResults: {
      fStatistic: number;
      pValue: number;
      significant: boolean;
    };
    
    pairwiseComparisons: Array<{
      configA: string;
      configB: string;
      metric: string;
      difference: number;
      pValue: number;
      effectSize: number;
    }>;
  };

  // Actionable recommendations
  recommendations: string[];
}

// Example of expected analysis output structure
const expectedAnalysis: AnalysisOutput = {
  experiment: 'exp-context-budget-001',
  totalConfigurations: 16, // 4 implementations × 4 token budgets
  totalRuns: 80, // 16 configs × 5 runs each

  findings: {
    optimalConfiguration: {
      byCompletionRate: 'scoped-8000',
      byQuality: 'rich-16000',
      byCost: 'minimal-2000',
      bySpeed: 'minimal-2000',
    },
    contextBudgetEffect: {
      simpleTasksOptimal: 2000,
      moderateTasksOptimal: 8000,
      complexTasksOptimal: 16000,
    },
    diminishingReturns: {
      tokenThreshold: 16000,
      qualityPlateau: 0.85,
    },
  },

  statistics: {
    anovaResults: {
      fStatistic: 12.4,
      pValue: 0.001,
      significant: true,
    },
    pairwiseComparisons: [
      {
        configA: 'minimal-2000',
        configB: 'full-32000',
        metric: 'quality_score',
        difference: -0.12,
        pValue: 0.03,
        effectSize: 0.65,
      },
    ],
  },

  recommendations: [
    'Use "scoped" context with 8K token budget as default configuration',
    'Scale context budget with task complexity: 2K for simple, 8K for moderate, 16K for complex',
    'Context beyond 16K shows diminishing returns for code generation tasks',
    'Consider task-specific context profiles rather than one-size-fits-all',
  ],
};

// =============================================================================
// USAGE EXAMPLE
// =============================================================================

async function runExperiment(): Promise<void> {
  // 1. Generate all configurations to test
  const configurations = generateConfigurationMatrix(contextBudgetExperiment);
  console.log(`Generated ${configurations.length} configurations to test`);

  // 2. For each configuration, run the task set multiple times
  for (const config of configurations) {
    console.log(`\nTesting configuration: ${config.name}`);

    for (let run = 0; run < contextBudgetExperiment.parameters.runsPerConfiguration; run++) {
      console.log(`  Run ${run + 1}/${contextBudgetExperiment.parameters.runsPerConfiguration}`);

      // Here you would:
      // - Create workflow with this config
      // - Execute against task set
      // - Collect metrics
      // - Store results
    }
  }

  // 3. Aggregate results and perform statistical analysis
  // 4. Generate recommendations
  // 5. Output report
}

// Export for use
export {
  contextBudgetExperiment,
  baselineConfig,
  codeGenerationTasks,
  generateConfigurationMatrix,
  runExperiment,
};
