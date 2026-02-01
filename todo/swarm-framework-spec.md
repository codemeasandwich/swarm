# SWARM: Systematic Workflow Agent Runtime Manager

## A Modular Framework for Constructing and Measuring AI Agent Workflows

---

## Executive Summary

This framework provides a systematic approach to constructing AI agent workflows where every component can be swapped, measured, and optimised. The core insight driving the architecture: **complexity in agents creates serial dependencies that break at scale; complexity in orchestration enables parallelism by keeping workers isolated.**

The framework treats agent workflows as compositions of discrete, measurable modules rather than monolithic systems. Each module has defined interfaces, swappable implementations, and instrumentation hooks for comparative analysis.

---

## 1. Framework Architecture

### 1.1 Core Design Principles

The framework implements five principles derived from successful scaled deployments:

| Principle | Implementation | Measurement Target |
|-----------|---------------|-------------------|
| Two tiers, not teams | Strict Planner → Worker → Judge hierarchy | Coordination overhead ratio |
| Workers stay ignorant | Minimum viable context injection | Context token efficiency |
| No shared state | Isolated tool sandboxes per worker | Contention/conflict rate |
| Plan for endings | Episodic operation with external state | Quality degradation over time |
| Prompts over infrastructure | Simple agents, sophisticated orchestration | Specification failure rate |

### 1.2 Layered Architecture

```
┌─────────────────────────────────────────────────────────────────────┐
│                     ORCHESTRATION LAYER                              │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Planner   │  │  Scheduler  │  │   Router    │  │   Judge    │ │
│  │   Module    │  │   Module    │  │   Module    │  │   Module   │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                      CONFIGURATION LAYER                             │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Context   │  │    Tool     │  │   Memory    │  │  Security  │ │
│  │   Builder   │  │   Sandbox   │  │   Manager   │  │  Guardrail │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                       EXECUTION LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Worker    │  │   Worker    │  │   Worker    │  │   Worker   │ │
│  │  Instance   │  │  Instance   │  │  Instance   │  │  Instance  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
                              │
                              ▼
┌─────────────────────────────────────────────────────────────────────┐
│                     MEASUREMENT LAYER                                │
│  ┌─────────────┐  ┌─────────────┐  ┌─────────────┐  ┌────────────┐ │
│  │   Metrics   │  │   Tracer    │  │    Cost     │  │   Quality  │ │
│  │  Collector  │  │   Module    │  │   Tracker   │  │  Assessor  │ │
│  └─────────────┘  └─────────────┘  └─────────────┘  └────────────┘ │
└─────────────────────────────────────────────────────────────────────┘
```

---

## 2. Modular Component Taxonomy

### 2.1 Orchestration Modules

#### Planner Module
Decomposes high-level goals into discrete, parallelisable tasks.

**Swappable Implementations:**

| Implementation | Characteristics | Best For |
|---------------|-----------------|----------|
| `single-shot` | One LLM call, complete plan upfront | Well-defined tasks, cost-sensitive |
| `iterative` | Plans in waves, refines based on results | Exploratory work, unknown scope |
| `hierarchical` | Multi-level decomposition (epic → story → task) | Large projects, team coordination |
| `reactive` | Minimal upfront planning, adapts continuously | Volatile requirements |

**Configuration Schema:**
```typescript
interface PlannerConfig {
  implementation: 'single-shot' | 'iterative' | 'hierarchical' | 'reactive';
  model: ModelSpec;
  maxDecompositionDepth: number;
  taskGranularity: 'coarse' | 'medium' | 'fine';
  parallelismHint: 'sequential' | 'parallel' | 'mixed';
  contextBudget: number; // tokens allocated to planning
}
```

#### Scheduler Module
Assigns tasks to workers and manages execution order.

**Swappable Implementations:**

| Implementation | Characteristics | Best For |
|---------------|-----------------|----------|
| `fifo` | First-in-first-out, simple queue | Baseline comparison |
| `priority` | Weighted by task importance/dependencies | Critical path optimisation |
| `adaptive` | Adjusts based on worker performance | Long-running workflows |
| `cost-aware` | Optimises for token/compute budget | Budget-constrained projects |

#### Router Module
Matches tasks to appropriate worker configurations.

**Swappable Implementations:**

| Implementation | Characteristics | Best For |
|---------------|-----------------|----------|
| `static` | Fixed task-type → worker-config mapping | Predictable workloads |
| `capability` | Matches required skills to worker capabilities | Heterogeneous task mix |
| `load-balanced` | Distributes across available workers | High throughput |
| `specialist` | Routes to domain-specific worker pools | Deep expertise requirements |

#### Judge Module
Evaluates worker outputs against acceptance criteria.

**Swappable Implementations:**

| Implementation | Characteristics | Best For |
|---------------|-----------------|----------|
| `deterministic` | Rule-based checks (tests pass, linting, etc.) | Objective criteria |
| `llm-eval` | LLM assesses quality against rubric | Subjective quality |
| `hybrid` | Deterministic gates + LLM evaluation | Production deployments |
| `consensus` | Multiple evaluators, majority vote | High-stakes decisions |

---

### 2.2 Configuration Modules

#### Context Builder Module
Constructs the minimum viable context for each worker.

**Swappable Implementations:**

| Implementation | Token Budget | Characteristics |
|---------------|-------------|-----------------|
| `minimal` | <2K tokens | Task description + immediate dependencies only |
| `scoped` | 2-8K tokens | Task + relevant file snippets + constraints |
| `rich` | 8-32K tokens | Task + broader codebase context + examples |
| `full` | 32K+ tokens | Maximum available context |

**Configuration Schema:**
```typescript
interface ContextBuilderConfig {
  implementation: 'minimal' | 'scoped' | 'rich' | 'full';
  includeProjectContext: boolean;
  includeExamples: boolean;
  includeConstraints: boolean;
  maxTokens: number;
  relevanceThreshold: number; // 0-1, for semantic filtering
}
```

#### Tool Sandbox Module
Provides isolated tool access per worker.

**Swappable Implementations:**

| Implementation | Tool Count | Isolation Level |
|---------------|-----------|-----------------|
| `minimal` | 3-5 tools | Full isolation, no shared state |
| `standard` | 5-15 tools | Process isolation, shared filesystem |
| `extended` | 15-30 tools | Container isolation |
| `full` | 30+ tools | Full MCP ecosystem (not recommended for scale) |

**Research Finding:** Tool selection accuracy degrades past 30-50 tools regardless of context window. Multi-agent efficiency drops 2-6x in 10+ tool environments.

#### Memory Manager Module
Handles state persistence across episodic agent runs.

**Swappable Implementations:**

| Implementation | Persistence | Query Capability |
|---------------|------------|------------------|
| `ephemeral` | None | None |
| `file-based` | Markdown files | Text search |
| `structured` | SQLite/JSON | Structured queries |
| `vector` | Embeddings + SQLite | Semantic search |
| `hybrid` | All of the above | Multi-modal retrieval |

#### Security Guardrail Module
Enforces safety constraints on agent actions.

**Swappable Implementations:**

| Implementation | Latency | Protection Level |
|---------------|---------|------------------|
| `permissive` | ~0ms | Blocklist only (rm -rf, etc.) |
| `standard` | ~10ms | Blocklist + allowlist for sensitive ops |
| `strict` | ~50ms | LLM pre-evaluation of commands |
| `paranoid` | ~200ms | Human-in-loop for any external action |

---

### 2.3 Execution Modules

#### Worker Instance Configuration

Workers are the deliberately simple execution units. Their configuration determines capability without adding coordination complexity.

**Worker Profile Schema:**
```typescript
interface WorkerProfile {
  id: string;
  
  // Model configuration
  model: {
    provider: 'anthropic' | 'openai' | 'google' | 'local';
    name: string;
    temperature: number;
    maxTokens: number;
  };
  
  // Capability configuration
  capabilities: {
    skills: Skill[];           // Enumerated skill set
    domainExpertise: Domain[]; // Domain knowledge areas
    toolAccess: Tool[];        // Sandboxed tool set
  };
  
  // Operational configuration
  operational: {
    maxRuntime: number;        // Seconds before forced termination
    contextWindow: number;     // Tokens available
    episodicReset: boolean;    // Whether to terminate after task
    retryPolicy: RetryPolicy;
  };
  
  // Measurement hooks
  instrumentation: {
    traceLevel: 'none' | 'summary' | 'detailed' | 'verbose';
    captureIntermediates: boolean;
    qualityCheckpoints: number[];
  };
}
```

**Skill Enumeration (extensible):**
```typescript
type Skill = 
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

type Domain =
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
```

---

### 2.4 Measurement Modules

#### Metrics Collector
Captures quantitative performance data.

**Core Metrics:**

| Metric | Unit | Description |
|--------|------|-------------|
| `task_completion_rate` | % | Tasks completed / Tasks assigned |
| `task_completion_time` | seconds | Time from assignment to completion |
| `coordination_overhead` | % | Time spent in non-execution activities |
| `context_efficiency` | tasks/token | Tasks completed per context token used |
| `tool_utilisation` | % | Tools used / Tools available |
| `retry_rate` | % | Tasks requiring retry / Total tasks |
| `conflict_rate` | % | Tasks with merge/state conflicts |
| `quality_score` | 0-1 | Judge module assessment |

#### Tracer Module
Captures execution traces for debugging and analysis.

**Trace Event Schema:**
```typescript
interface TraceEvent {
  timestamp: number;
  eventType: 'plan' | 'assign' | 'execute' | 'evaluate' | 'complete' | 'fail';
  moduleId: string;
  workerId?: string;
  taskId: string;
  payload: Record<string, unknown>;
  tokenUsage: { input: number; output: number };
  latency: number;
}
```

#### Cost Tracker
Monitors resource consumption.

**Cost Dimensions:**
- Token usage (input/output by model)
- Compute time (agent runtime)
- Tool invocations (API calls, external services)
- Coordination overhead (orchestration compute)

#### Quality Assessor
Evaluates output quality beyond binary pass/fail.

**Quality Dimensions:**

| Dimension | Measurement Method |
|-----------|-------------------|
| Correctness | Deterministic tests, type checking |
| Completeness | Requirement coverage analysis |
| Maintainability | Complexity metrics, documentation coverage |
| Performance | Benchmark execution, profiling |
| Security | Static analysis, vulnerability scanning |
| Style | Linting, formatting consistency |

---

## 3. Configuration Composition

### 3.1 Workflow Definition Schema

A complete workflow configuration composes modules across all layers:

```typescript
interface WorkflowConfig {
  id: string;
  name: string;
  version: string;
  
  // Orchestration layer
  orchestration: {
    planner: PlannerConfig;
    scheduler: SchedulerConfig;
    router: RouterConfig;
    judge: JudgeConfig;
  };
  
  // Configuration layer
  configuration: {
    contextBuilder: ContextBuilderConfig;
    toolSandbox: ToolSandboxConfig;
    memoryManager: MemoryManagerConfig;
    securityGuardrail: SecurityGuardrailConfig;
  };
  
  // Execution layer
  execution: {
    workerProfiles: WorkerProfile[];
    maxConcurrentWorkers: number;
    workerSelectionStrategy: 'round-robin' | 'capability-match' | 'load-balanced';
  };
  
  // Measurement layer
  measurement: {
    metricsCollector: MetricsConfig;
    tracer: TracerConfig;
    costTracker: CostTrackerConfig;
    qualityAssessor: QualityAssessorConfig;
  };
  
  // Global constraints
  constraints: {
    maxTotalTokens: number;
    maxTotalCost: number;
    maxTotalRuntime: number;
    qualityThreshold: number;
  };
}
```

### 3.2 Experiment Definition Schema

For systematic comparison of configurations:

```typescript
interface Experiment {
  id: string;
  name: string;
  hypothesis: string;
  
  // What we're varying
  independentVariables: {
    variable: string;        // e.g., "orchestration.planner.implementation"
    values: unknown[];       // e.g., ["single-shot", "iterative", "hierarchical"]
  }[];
  
  // What we're measuring
  dependentVariables: string[]; // e.g., ["task_completion_rate", "total_cost"]
  
  // What we're holding constant
  controlConfig: WorkflowConfig;
  
  // Task set to run against
  taskSet: TaskDefinition[];
  
  // Experiment parameters
  parameters: {
    runsPerConfiguration: number;
    randomSeed: number;
    timeoutPerRun: number;
  };
}
```

---

## 4. Reference Configurations

### 4.1 Baseline: Single Agent

Establishes baseline for comparison:

```typescript
const singleAgentBaseline: WorkflowConfig = {
  orchestration: {
    planner: { implementation: 'single-shot', taskGranularity: 'coarse' },
    scheduler: { implementation: 'fifo' },
    router: { implementation: 'static' },
    judge: { implementation: 'deterministic' }
  },
  configuration: {
    contextBuilder: { implementation: 'full' },
    toolSandbox: { implementation: 'extended' },
    memoryManager: { implementation: 'ephemeral' },
    securityGuardrail: { implementation: 'standard' }
  },
  execution: {
    workerProfiles: [/* single generalist worker */],
    maxConcurrentWorkers: 1
  }
};
```

### 4.2 Scaled: Gas Town Pattern

Optimised for parallel execution:

```typescript
const gasTownPattern: WorkflowConfig = {
  orchestration: {
    planner: { implementation: 'hierarchical', taskGranularity: 'fine' },
    scheduler: { implementation: 'adaptive' },
    router: { implementation: 'specialist' },
    judge: { implementation: 'hybrid' }
  },
  configuration: {
    contextBuilder: { implementation: 'minimal' },
    toolSandbox: { implementation: 'minimal' },
    memoryManager: { implementation: 'file-based' },
    securityGuardrail: { implementation: 'standard' }
  },
  execution: {
    workerProfiles: [/* many specialist workers */],
    maxConcurrentWorkers: 20
  }
};
```

### 4.3 Cost-Optimised

Minimises token usage while maintaining quality:

```typescript
const costOptimised: WorkflowConfig = {
  orchestration: {
    planner: { implementation: 'single-shot', model: { name: 'haiku' } },
    scheduler: { implementation: 'cost-aware' },
    router: { implementation: 'capability' },
    judge: { implementation: 'deterministic' }
  },
  configuration: {
    contextBuilder: { implementation: 'minimal' },
    toolSandbox: { implementation: 'minimal' },
    memoryManager: { implementation: 'structured' },
    securityGuardrail: { implementation: 'permissive' }
  },
  execution: {
    workerProfiles: [/* smaller models, tight context */],
    maxConcurrentWorkers: 10
  }
};
```

---

## 5. Implementation Roadmap

### Phase 1: Foundation (Weeks 1-2)

**Deliverables:**
- Core type definitions and interfaces
- Configuration validation and loading
- Basic metrics collection infrastructure
- File-based workflow state persistence

**Key Files:**
```
/src
  /types
    workflow.ts       # Core interfaces
    modules.ts        # Module type definitions
    metrics.ts        # Measurement types
  /config
    loader.ts         # Configuration parsing
    validator.ts      # Schema validation
  /state
    persistence.ts    # Workflow state management
```

### Phase 2: Orchestration Layer (Weeks 3-4)

**Deliverables:**
- Planner module implementations (single-shot, iterative)
- Scheduler module implementations (fifo, priority)
- Router module implementation (static, capability)
- Judge module implementations (deterministic, llm-eval)

**Integration Points:**
- Claude Code CLI invocation for LLM calls
- Task queue management
- Worker lifecycle management

### Phase 3: Execution Layer (Weeks 5-6)

**Deliverables:**
- Worker spawning and management
- Context injection pipeline
- Tool sandbox implementation
- Episodic operation with state capture

**Key Challenges:**
- Git worktree management for isolation
- Process supervision and timeout handling
- Result capture and aggregation

### Phase 4: Measurement Layer (Weeks 7-8)

**Deliverables:**
- Comprehensive metrics collection
- Execution tracing with visualisation
- Cost tracking and budgeting
- Quality assessment pipeline

**Output Formats:**
- JSON traces for programmatic analysis
- HTML reports for human review
- CSV exports for statistical analysis

### Phase 5: Experiment Framework (Weeks 9-10)

**Deliverables:**
- Experiment definition and execution
- Configuration matrix generation
- Statistical analysis of results
- Comparison reporting

---

## 6. Measurement Methodology

### 6.1 Experimental Design

For valid comparisons, each experiment should:

1. **Control for task variance**: Run the same task set across all configurations
2. **Control for model variance**: Pin model versions and temperatures
3. **Control for temporal variance**: Run multiple iterations, report distributions
4. **Isolate variables**: Change one dimension at a time

### 6.2 Statistical Analysis

**Recommended Approach:**

| Comparison Type | Statistical Method |
|-----------------|-------------------|
| Two configurations | Paired t-test or Wilcoxon signed-rank |
| Multiple configurations | ANOVA with post-hoc Tukey HSD |
| Configuration × Task Type | Two-way ANOVA |
| Cost-quality trade-off | Pareto frontier analysis |

### 6.3 Reporting Template

Each experiment should produce:

```markdown
## Experiment: [Name]

### Hypothesis
[What we expected to find]

### Configuration Matrix
[Table of configurations tested]

### Results Summary
| Configuration | Completion Rate | Mean Time | Mean Cost | Quality Score |
|--------------|-----------------|-----------|-----------|---------------|
| ...          | ...             | ...       | ...       | ...           |

### Statistical Significance
[P-values, confidence intervals]

### Key Findings
[Numbered list of insights]

### Recommendations
[Actionable next steps]
```

---

## 7. Trade-off Analysis Framework

### 7.1 Primary Trade-offs

| Dimension A | Dimension B | Relationship |
|-------------|-------------|--------------|
| Agent complexity | Scalability | Inverse |
| Context richness | Coordination overhead | Positive |
| Tool count | Selection accuracy | Inverse (past ~30) |
| Worker specialisation | Routing complexity | Positive |
| Quality assurance | Throughput | Inverse |
| Security strictness | Latency | Positive |

### 7.2 Configuration Decision Tree

```
START: What is your primary constraint?
│
├─► COST → Use minimal context, smaller models, deterministic judges
│
├─► SPEED → Maximise parallelism, minimal context, episodic workers
│
├─► QUALITY → Rich context, hybrid judges, lower parallelism
│
└─► SCALE → Minimal agent complexity, sophisticated orchestration,
            strict two-tier hierarchy
```

### 7.3 Anti-patterns to Measure Against

The framework should explicitly measure configurations that violate scaling principles:

| Anti-pattern | Configuration | Expected Failure Mode |
|--------------|---------------|----------------------|
| Flat collaboration | No hierarchy, peer agents | Risk aversion, coordination overhead |
| Rich worker context | Full context builder | Scope creep, conflicts |
| Tool proliferation | 30+ tools per worker | Selection degradation |
| Long-lived agents | No episodic reset | Quality degradation over time |
| Shared state | Common tool sandbox | Contention, conflicts |

---

## 8. Extension Points

### 8.1 Custom Module Implementation

All modules implement a standard interface:

```typescript
interface Module<TConfig, TInput, TOutput> {
  readonly id: string;
  readonly version: string;
  
  configure(config: TConfig): Promise<void>;
  execute(input: TInput): Promise<TOutput>;
  getMetrics(): ModuleMetrics;
  reset(): Promise<void>;
}
```

### 8.2 Plugin Architecture

Third-party modules can be registered:

```typescript
interface ModuleRegistry {
  register<T extends Module>(
    type: ModuleType,
    implementation: string,
    factory: () => T
  ): void;
  
  get<T extends Module>(
    type: ModuleType,
    implementation: string
  ): T;
}
```

### 8.3 Custom Metrics

Additional metrics can be registered:

```typescript
interface MetricDefinition {
  name: string;
  unit: string;
  aggregation: 'sum' | 'mean' | 'median' | 'max' | 'min' | 'distribution';
  collector: (context: ExecutionContext) => number;
}
```

---

## 9. Security Considerations

### 9.1 Threat Model

The framework must protect against:

| Threat | Mitigation |
|--------|-----------|
| Prompt injection via task content | Input sanitisation, context isolation |
| Tool abuse by workers | Sandboxing, allowlists, rate limiting |
| State corruption | Immutable task definitions, versioned state |
| Credential exposure | Secret injection at runtime, never in config |
| Runaway costs | Hard budget limits, automatic termination |

### 9.2 Guardrail Configuration

Default blocklist for all configurations:

```typescript
const defaultBlocklist = [
  'rm -rf',
  'sudo',
  'chmod 777',
  'curl | sh',
  'wget | sh',
  'mkfs',
  '> /dev/',
  'dd if=',
  'git push --force',
  'DROP TABLE',
  'DELETE FROM'
];
```

---

## 10. Next Steps

### Immediate Actions

1. **Validate type definitions**: Review interfaces against actual Claude Code / Gas Town implementations
2. **Build configuration loader**: Enable YAML/JSON workflow definitions
3. **Implement baseline metrics**: Task completion, time, cost tracking
4. **Create task corpus**: Standardised task set for benchmarking

### Research Questions to Answer

1. What is the optimal context budget for different task types?
2. At what worker count does coordination overhead exceed parallelism benefits?
3. Which planner implementation performs best for which task characteristics?
4. What is the cost-quality Pareto frontier for different model combinations?

### Integration Priorities

1. Claude Code CLI for worker execution
2. Git worktrees for isolation
3. SQLite for state persistence
4. OpenTelemetry for tracing
