/**
 * SWARM Framework - Core Type Definitions
 * Systematic Workflow Agent Runtime Manager
 */

// =============================================================================
// FOUNDATION TYPES
// =============================================================================

export type ModelProvider = 'anthropic' | 'openai' | 'google' | 'local';

export interface ModelSpec {
  provider: ModelProvider;
  name: string;
  temperature: number;
  maxOutputTokens: number;
  contextWindow: number;
}

export type Skill =
  | 'code-generation'
  | 'code-review'
  | 'code-refactoring'
  | 'test-writing'
  | 'documentation'
  | 'debugging'
  | 'api-integration'
  | 'database-design'
  | 'frontend-development'
  | 'backend-development'
  | 'devops'
  | 'security-analysis'
  | 'performance-optimisation'
  | 'architecture-design'
  | 'research'
  | 'writing'
  | 'data-analysis';

export type Domain =
  | 'web-development'
  | 'mobile-development'
  | 'cloud-infrastructure'
  | 'machine-learning'
  | 'financial-services'
  | 'healthcare'
  | 'e-commerce'
  | 'saas'
  | 'enterprise'
  | 'startup';

// =============================================================================
// TASK DEFINITIONS
// =============================================================================

export interface TaskDefinition {
  id: string;
  type: string;
  description: string;
  requiredSkills: Skill[];
  requiredDomain?: Domain;
  acceptanceCriteria: AcceptanceCriterion[];
  dependencies: string[]; // Task IDs
  estimatedComplexity: 'trivial' | 'simple' | 'moderate' | 'complex' | 'very-complex';
  contextRequirements: ContextRequirement[];
  toolRequirements: string[];
  timeout: number; // seconds
}

export interface AcceptanceCriterion {
  type: 'deterministic' | 'llm-evaluated';
  description: string;
  evaluator?: string; // Path to evaluation script or LLM prompt
  weight: number; // 0-1, for weighted scoring
}

export interface ContextRequirement {
  type: 'file' | 'directory' | 'snippet' | 'documentation' | 'example';
  path?: string;
  query?: string; // For semantic retrieval
  required: boolean;
}

// =============================================================================
// MODULE INTERFACES
// =============================================================================

export interface ModuleMetrics {
  executionCount: number;
  totalDuration: number;
  totalTokensUsed: number;
  errorCount: number;
  customMetrics: Record<string, number>;
}

export interface Module<TConfig, TInput, TOutput> {
  readonly id: string;
  readonly version: string;
  readonly type: ModuleType;

  configure(config: TConfig): Promise<void>;
  execute(input: TInput, context: ExecutionContext): Promise<TOutput>;
  getMetrics(): ModuleMetrics;
  reset(): Promise<void>;
}

export type ModuleType =
  | 'planner'
  | 'scheduler'
  | 'router'
  | 'judge'
  | 'context-builder'
  | 'tool-sandbox'
  | 'memory-manager'
  | 'security-guardrail'
  | 'metrics-collector'
  | 'tracer'
  | 'cost-tracker'
  | 'quality-assessor';

// =============================================================================
// ORCHESTRATION LAYER CONFIGS
// =============================================================================

export interface PlannerConfig {
  implementation: 'single-shot' | 'iterative' | 'hierarchical' | 'reactive';
  model: ModelSpec;
  maxDecompositionDepth: number;
  taskGranularity: 'coarse' | 'medium' | 'fine';
  parallelismHint: 'sequential' | 'parallel' | 'mixed';
  contextBudget: number;
  systemPrompt?: string;
}

export interface SchedulerConfig {
  implementation: 'fifo' | 'priority' | 'adaptive' | 'cost-aware';
  maxQueueSize: number;
  priorityWeights?: {
    urgency: number;
    complexity: number;
    dependencies: number;
  };
  adaptiveWindow?: number; // For adaptive scheduler
}

export interface RouterConfig {
  implementation: 'static' | 'capability' | 'load-balanced' | 'specialist';
  staticMapping?: Record<string, string>; // Task type -> Worker profile ID
  capabilityThreshold?: number; // Minimum skill match score
  loadBalanceStrategy?: 'round-robin' | 'least-loaded' | 'random';
}

export interface JudgeConfig {
  implementation: 'deterministic' | 'llm-eval' | 'hybrid' | 'consensus';
  model?: ModelSpec; // For LLM evaluation
  rubric?: EvaluationRubric;
  consensusThreshold?: number; // For consensus judge
  retryOnFailure: boolean;
  maxRetries: number;
}

export interface EvaluationRubric {
  dimensions: {
    name: string;
    weight: number;
    criteria: string;
  }[];
  passingThreshold: number;
}

// =============================================================================
// CONFIGURATION LAYER CONFIGS
// =============================================================================

export interface ContextBuilderConfig {
  implementation: 'minimal' | 'scoped' | 'rich' | 'full';
  maxTokens: number;
  includeProjectContext: boolean;
  includeExamples: boolean;
  includeConstraints: boolean;
  includeHistory: boolean;
  relevanceThreshold: number;
  embeddingModel?: string; // For semantic retrieval
}

export interface ToolSandboxConfig {
  implementation: 'minimal' | 'standard' | 'extended' | 'full';
  allowedTools: string[];
  blockedPatterns: string[];
  rateLimits: Record<string, number>; // Tool -> calls per minute
  timeoutPerCall: number;
  isolationLevel: 'none' | 'process' | 'container' | 'vm';
}

export interface MemoryManagerConfig {
  implementation: 'ephemeral' | 'file-based' | 'structured' | 'vector' | 'hybrid';
  storagePath: string;
  maxEntries?: number;
  embeddingModel?: string; // For vector implementation
  ttl?: number; // Time-to-live in seconds
}

export interface SecurityGuardrailConfig {
  implementation: 'permissive' | 'standard' | 'strict' | 'paranoid';
  blocklist: string[];
  allowlist?: string[];
  requireApprovalFor: string[];
  humanInLoopWebhook?: string;
  auditLog: boolean;
}

// =============================================================================
// EXECUTION LAYER
// =============================================================================

export interface WorkerProfile {
  id: string;
  name: string;

  model: ModelSpec;

  capabilities: {
    skills: Skill[];
    domainExpertise: Domain[];
    toolAccess: string[];
  };

  operational: {
    maxRuntime: number;
    contextWindow: number;
    episodicReset: boolean;
    retryPolicy: RetryPolicy;
  };

  instrumentation: {
    traceLevel: 'none' | 'summary' | 'detailed' | 'verbose';
    captureIntermediates: boolean;
    qualityCheckpoints: number[];
  };

  systemPrompt?: string;
}

export interface RetryPolicy {
  maxRetries: number;
  backoffStrategy: 'fixed' | 'exponential' | 'linear';
  initialDelay: number;
  maxDelay: number;
  retryableErrors: string[];
}

export interface WorkerInstance {
  id: string;
  profileId: string;
  status: 'idle' | 'working' | 'completed' | 'failed' | 'terminated';
  currentTaskId?: string;
  startedAt?: number;
  metrics: WorkerMetrics;
}

export interface WorkerMetrics {
  tasksCompleted: number;
  tasksFailed: number;
  totalRuntime: number;
  totalTokensUsed: number;
  averageQualityScore: number;
}

// =============================================================================
// MEASUREMENT LAYER
// =============================================================================

export interface MetricsConfig {
  enabled: boolean;
  collectInterval: number;
  exportFormat: 'json' | 'prometheus' | 'opentelemetry';
  exportPath?: string;
  customMetrics: MetricDefinition[];
}

export interface MetricDefinition {
  name: string;
  unit: string;
  description: string;
  aggregation: 'sum' | 'mean' | 'median' | 'max' | 'min' | 'distribution';
  labels: string[];
}

export interface TracerConfig {
  enabled: boolean;
  traceLevel: 'none' | 'summary' | 'detailed' | 'verbose';
  exportFormat: 'json' | 'otlp' | 'jaeger';
  exportEndpoint?: string;
  sampleRate: number; // 0-1
}

export interface CostTrackerConfig {
  enabled: boolean;
  tokenPricing: Record<string, { input: number; output: number }>; // Model -> price per 1K tokens
  budgetLimit?: number;
  alertThreshold?: number; // Percentage of budget
  alertWebhook?: string;
}

export interface QualityAssessorConfig {
  dimensions: QualityDimension[];
  aggregationMethod: 'weighted-mean' | 'min' | 'geometric-mean';
  passingThreshold: number;
}

export interface QualityDimension {
  name: string;
  weight: number;
  evaluator: 'deterministic' | 'llm' | 'hybrid';
  config: Record<string, unknown>;
}

// =============================================================================
// WORKFLOW CONFIGURATION
// =============================================================================

export interface WorkflowConfig {
  id: string;
  name: string;
  version: string;
  description?: string;

  orchestration: {
    planner: PlannerConfig;
    scheduler: SchedulerConfig;
    router: RouterConfig;
    judge: JudgeConfig;
  };

  configuration: {
    contextBuilder: ContextBuilderConfig;
    toolSandbox: ToolSandboxConfig;
    memoryManager: MemoryManagerConfig;
    securityGuardrail: SecurityGuardrailConfig;
  };

  execution: {
    workerProfiles: WorkerProfile[];
    maxConcurrentWorkers: number;
    workerSelectionStrategy: 'round-robin' | 'capability-match' | 'load-balanced';
  };

  measurement: {
    metrics: MetricsConfig;
    tracer: TracerConfig;
    costTracker: CostTrackerConfig;
    qualityAssessor: QualityAssessorConfig;
  };

  constraints: {
    maxTotalTokens: number;
    maxTotalCost: number;
    maxTotalRuntime: number;
    qualityThreshold: number;
  };
}

// =============================================================================
// EXECUTION CONTEXT & STATE
// =============================================================================

export interface ExecutionContext {
  workflowId: string;
  runId: string;
  taskId?: string;
  workerId?: string;
  parentContext?: ExecutionContext;
  
  state: WorkflowState;
  config: WorkflowConfig;
  
  emit(event: TraceEvent): void;
  getMetric(name: string): number | undefined;
  setMetric(name: string, value: number): void;
}

export interface WorkflowState {
  status: 'pending' | 'planning' | 'executing' | 'evaluating' | 'completed' | 'failed';
  tasks: Map<string, TaskState>;
  workers: Map<string, WorkerInstance>;
  
  startedAt: number;
  completedAt?: number;
  
  totalTokensUsed: number;
  totalCost: number;
  
  errors: WorkflowError[];
}

export interface TaskState {
  task: TaskDefinition;
  status: 'pending' | 'queued' | 'assigned' | 'executing' | 'evaluating' | 'completed' | 'failed';
  assignedWorkerId?: string;
  attempts: TaskAttempt[];
  result?: TaskResult;
}

export interface TaskAttempt {
  workerId: string;
  startedAt: number;
  completedAt?: number;
  tokensUsed: number;
  error?: string;
}

export interface TaskResult {
  success: boolean;
  output: unknown;
  qualityScore: number;
  qualityBreakdown: Record<string, number>;
  artifacts: string[]; // Paths to generated files
}

export interface WorkflowError {
  timestamp: number;
  taskId?: string;
  workerId?: string;
  moduleId?: string;
  error: string;
  stack?: string;
  recoverable: boolean;
}

// =============================================================================
// TRACE EVENTS
// =============================================================================

export interface TraceEvent {
  timestamp: number;
  runId: string;
  eventType: TraceEventType;
  moduleId?: string;
  workerId?: string;
  taskId?: string;
  payload: Record<string, unknown>;
  tokenUsage?: { input: number; output: number };
  latency?: number;
  level: 'debug' | 'info' | 'warn' | 'error';
}

export type TraceEventType =
  | 'workflow.started'
  | 'workflow.completed'
  | 'workflow.failed'
  | 'plan.started'
  | 'plan.completed'
  | 'task.created'
  | 'task.queued'
  | 'task.assigned'
  | 'task.started'
  | 'task.completed'
  | 'task.failed'
  | 'task.retrying'
  | 'worker.spawned'
  | 'worker.working'
  | 'worker.completed'
  | 'worker.failed'
  | 'worker.terminated'
  | 'judge.evaluating'
  | 'judge.passed'
  | 'judge.failed'
  | 'guardrail.blocked'
  | 'guardrail.approved'
  | 'budget.warning'
  | 'budget.exceeded';

// =============================================================================
// EXPERIMENT FRAMEWORK
// =============================================================================

export interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  description?: string;

  independentVariables: IndependentVariable[];
  dependentVariables: string[];

  controlConfig: WorkflowConfig;
  taskSet: TaskDefinition[];

  parameters: {
    runsPerConfiguration: number;
    randomSeed: number;
    timeoutPerRun: number;
    warmupRuns: number;
  };
}

export interface IndependentVariable {
  path: string; // Dot-notation path into WorkflowConfig
  values: unknown[];
  name?: string; // Human-readable name
}

export interface ExperimentResult {
  experimentId: string;
  startedAt: number;
  completedAt: number;

  configurations: ConfigurationResult[];
  
  analysis: {
    summary: Record<string, DescriptiveStats>;
    comparisons: PairwiseComparison[];
    recommendations: string[];
  };
}

export interface ConfigurationResult {
  configId: string;
  config: WorkflowConfig;
  runs: RunResult[];
  
  aggregated: {
    mean: Record<string, number>;
    stdDev: Record<string, number>;
    median: Record<string, number>;
    min: Record<string, number>;
    max: Record<string, number>;
  };
}

export interface RunResult {
  runId: string;
  startedAt: number;
  completedAt: number;
  success: boolean;
  
  metrics: Record<string, number>;
  traces: TraceEvent[];
  errors: WorkflowError[];
}

export interface DescriptiveStats {
  mean: number;
  stdDev: number;
  median: number;
  min: number;
  max: number;
  n: number;
}

export interface PairwiseComparison {
  configA: string;
  configB: string;
  metric: string;
  difference: number;
  pValue: number;
  significant: boolean;
  effectSize: number;
}

// =============================================================================
// MODULE REGISTRY
// =============================================================================

export type ModuleFactory<T extends Module<unknown, unknown, unknown>> = () => T;

export interface ModuleRegistry {
  register<T extends Module<unknown, unknown, unknown>>(
    type: ModuleType,
    implementation: string,
    factory: ModuleFactory<T>
  ): void;

  get<T extends Module<unknown, unknown, unknown>>(
    type: ModuleType,
    implementation: string
  ): T;

  list(type: ModuleType): string[];

  has(type: ModuleType, implementation: string): boolean;
}

// =============================================================================
// RUNTIME API
// =============================================================================

export interface SwarmRuntime {
  // Configuration
  loadConfig(path: string): Promise<WorkflowConfig>;
  validateConfig(config: WorkflowConfig): ValidationResult;

  // Execution
  createWorkflow(config: WorkflowConfig): Workflow;
  
  // Experiments
  createExperiment(config: Experiment): ExperimentRunner;
  
  // Module management
  readonly modules: ModuleRegistry;
}

export interface Workflow {
  readonly id: string;
  readonly config: WorkflowConfig;
  readonly state: WorkflowState;

  execute(tasks: TaskDefinition[]): Promise<WorkflowResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;

  on(event: string, handler: (data: unknown) => void): void;
  off(event: string, handler: (data: unknown) => void): void;
}

export interface WorkflowResult {
  success: boolean;
  taskResults: Map<string, TaskResult>;
  metrics: Record<string, number>;
  traces: TraceEvent[];
  errors: WorkflowError[];
  
  summary: {
    totalTasks: number;
    completedTasks: number;
    failedTasks: number;
    totalRuntime: number;
    totalTokens: number;
    totalCost: number;
    averageQuality: number;
  };
}

export interface ExperimentRunner {
  readonly id: string;
  readonly experiment: Experiment;

  run(): Promise<ExperimentResult>;
  pause(): Promise<void>;
  resume(): Promise<void>;
  cancel(): Promise<void>;

  getProgress(): ExperimentProgress;
}

export interface ExperimentProgress {
  totalConfigurations: number;
  completedConfigurations: number;
  currentConfiguration: string;
  totalRuns: number;
  completedRuns: number;
  estimatedTimeRemaining: number;
}

export interface ValidationResult {
  valid: boolean;
  errors: ValidationError[];
  warnings: ValidationWarning[];
}

export interface ValidationError {
  path: string;
  message: string;
  value?: unknown;
}

export interface ValidationWarning {
  path: string;
  message: string;
  suggestion?: string;
}
