# SWARM Logging Gap Analysis for White Paper Benchmarks

## Purpose
Define exactly what logging enhancements are needed to generate the benchmark data required for the SWARM white paper (Page 5: Performance Results & Benchmarks).

---

## White Paper Data Requirements

### Required Benchmark Metrics (from plan.md)

| Metric | Description | Current State |
|--------|-------------|---------------|
| Time to Converge | Time to arrive at correct task decomposition strategy | ❌ Not tracked - planner iterations not logged |
| Tokens Used | Total tokens consumed across all agents | ✅ Complete |
| Parallel Sub-Agents | Number of concurrent workers at peak | ⚠️ Partial - scheduled count exists, peak not tracked |
| Time to Completion | Wall-clock time from start to 100% coverage | ✅ Complete |
| Context Efficiency | Tasks completed per context token | ⚠️ Formula exists, per-task context not tracked |
| Quality Score | Judge assessment (0-1) | ✅ Complete |

### Required Narrative Data (from plan.md lines 287-315)

The white paper promises to showcase "comprehensive internal monitoring" that captures:

1. **Behavior Metrics** - Why decisions were made
2. **Strategy Metrics** - How decomposition evolved
3. **Execution Metrics** - Per-task resource usage
4. **Adaptation Tracking** - How system refined approach based on feedback

---

## Gap Analysis: What's Missing

### GAP 1: Decision Reasoning Not Logged
**Impact:** Cannot demonstrate "self-reasoning" (Page 3) or "self-learning" (differentiator #5)

**Current:** Events emit *what* happened (e.g., "selected iterative strategy")
**Missing:** *Why* it was selected (e.g., "goal complexity score 0.8 exceeded single-shot threshold 0.5")

**Files Affected:**
- `src/swarm/orchestration/planner/index.js` - strategy selection
- `src/swarm/orchestration/router/index.js` - worker routing
- `src/swarm/orchestration/scheduler/index.js` - batch sizing
- `src/swarm/orchestration/judge/index.js` - pass/retry decisions

**Data to Capture:**
```javascript
{
  decision: "strategy.selected",
  chosen: "iterative",
  alternatives: ["single-shot", "hierarchical"],
  reasoning: {
    goalComplexity: 0.8,
    threshold: 0.5,
    rule: "complexity > threshold → iterative"
  },
  config: {
    plannerStrategy: "auto",
    granularity: "medium"
  }
}
```

---

### GAP 2: Configuration→Outcome Correlation Missing
**Impact:** Cannot show "what configurations work" or populate "Configuration Guide" (Page 6)

**Current:** Config is set at start, outcomes logged at end, no link between them
**Missing:** Each trace event should include the active config that influenced it

**Data to Capture:**
```javascript
{
  event: "task.completed",
  taskId: "task-1",
  outcome: { success: true, tokens: 1200, time: 4.5 },
  activeConfig: {
    plannerStrategy: "iterative",
    routerStrategy: "capability",
    contextBudget: 2000,
    toolSandboxSize: 5
  }
}
```

---

### GAP 3: Tool Usage Per Task Not Tracked
**Impact:** Cannot prove "tool sandbox" efficiency claim (research finding: degradation past 30 tools)

**Current:** Worker profiles list available tools
**Missing:** Which tools were actually invoked per task, tool call counts, unused tools

**Data to Capture:**
```javascript
{
  event: "task.completed",
  taskId: "task-1",
  toolUsage: {
    available: ["read", "write", "grep", "glob", "bash"],
    invoked: ["read", "grep"],
    callCounts: { read: 3, grep: 2 },
    unusedTools: ["write", "glob", "bash"]
  }
}
```

---

### GAP 4: Context Utilization Per Task Not Tracked
**Impact:** Cannot prove "40% context cap" prevents rot (differentiator #1)

**Current:** Total tokens tracked at workflow level
**Missing:** Context window utilization per task (tokens used / context budget)

**Data to Capture:**
```javascript
{
  event: "task.completed",
  taskId: "task-1",
  contextUtilization: {
    budgetTokens: 2000,
    inputTokens: 1200,
    outputTokens: 450,
    utilizationPercent: 0.60,  // (input/budget)
    withinCap: true  // < 40% threshold
  }
}
```

---

### GAP 5: Planner Iteration History Not Tracked
**Impact:** Cannot show "Time to Converge" benchmark or iterative refinement narrative

**Current:** Final plan logged with task count
**Missing:** Each iteration's plan, what changed, why it changed

**Data to Capture:**
```javascript
{
  event: "planner.iteration",
  iteration: 2,
  previousTaskCount: 3,
  newTaskCount: 5,
  changes: [
    { type: "split", original: "task-1", into: ["task-1a", "task-1b"] },
    { type: "added", task: "task-4", reason: "discovered dependency" }
  ],
  triggerReason: "judge.feedback",
  feedback: "task-1 too broad, split by component"
}
```

---

### GAP 6: Peak Parallelism Not Tracked
**Impact:** Cannot populate "Parallel Sub-Agents" benchmark column

**Current:** Scheduled count per batch logged
**Missing:** High-water mark of concurrent workers across entire run

**Data to Capture:**
```javascript
{
  event: "parallelism.snapshot",
  timestamp: 1234567890,
  activeWorkers: 4,
  peakSoFar: 6,
  tasksByWorker: {
    "worker-1": ["task-1"],
    "worker-2": ["task-2", "task-3"],
    "worker-3": ["task-4"],
    "worker-4": ["task-5"]
  }
}
```

---

### GAP 7: Strategy Refinement History Not Tracked
**Impact:** Cannot demonstrate "self-learning" (differentiator #5) or "Adaptation Tracking" section

**Current:** No logging of config/strategy changes during execution
**Missing:** When and why strategies were adjusted mid-run

**Data to Capture:**
```javascript
{
  event: "strategy.refined",
  component: "router",
  previousStrategy: "static",
  newStrategy: "capability",
  trigger: "worker-1 failed 3 consecutive tasks",
  reasoning: "static routing ineffective for this task type"
}
```

---

## Profiling Mode Design

### Concept
Add a `profilingMode: true` configuration option that enables detailed decision logging without impacting normal operation performance.

### What Profiling Mode Enables

| Feature | Normal Mode | Profiling Mode |
|---------|-------------|----------------|
| Basic metrics | ✅ | ✅ |
| Decision reasoning | ❌ | ✅ |
| Config snapshots per event | ❌ | ✅ |
| Tool usage tracking | ❌ | ✅ |
| Context utilization | ❌ | ✅ |
| Iteration history | ❌ | ✅ |
| Peak parallelism | ❌ | ✅ |
| Strategy refinement log | ❌ | ✅ |

### Configuration

```javascript
{
  measurement: {
    profilingMode: true,  // Enable detailed logging
    profilingOptions: {
      captureDecisionReasoning: true,
      captureConfigSnapshots: true,
      captureToolUsage: true,
      captureContextUtilization: true,
      captureIterationHistory: true,
      captureParallelismSnapshots: true,
      captureStrategyRefinements: true
    }
  }
}
```

### Logging Requirement

**CRITICAL:** All profiling code MUST use `scribbles` package (https://www.npmjs.com/package/scribbles):
- `scribbles.stdOut(format, ...args)` - Formatted string output
- `scribbles.dataOut(label, data)` - Structured data with full system performance metrics
- **NEVER use `console.log`** - scribbles provides W3C trace-context, git repo/branch/commit info, source file locations, and event loop blocking detection

---

## Implementation Tasks

### Phase 1: Core Profiling Infrastructure [P]
1. [P] Add `profilingMode` config option to MeasurementLayer
2. [P] Create `ProfilingStore` to aggregate profiling-specific data
3. [P] Add profiling event types to tracer

### Phase 2: Decision Reasoning Capture [P-orchestration]
4. [P-orchestration] Enhance Planner to log strategy selection reasoning
5. [P-orchestration] Enhance Router to log worker selection reasoning
6. [P-orchestration] Enhance Scheduler to log batch sizing reasoning
7. [P-orchestration] Enhance Judge to log pass/retry reasoning

### Phase 3: Resource Tracking [P-measurement]
8. [P-measurement] Add tool usage tracking per task
9. [P-measurement] Add context utilization tracking per task
10. [P-measurement] Add peak parallelism tracking

### Phase 4: History Tracking [S]
11. [S] Add planner iteration history (depends on #4)
12. [S] Add strategy refinement history (depends on #4-7)

### Phase 5: Export & Analysis [S]
13. [S] Extend JSON report with profiling data
14. [S] Add profiling-specific analysis functions
15. [S] Create benchmark comparison utilities

### Phase 6: Testing [P-tests]
16. [P-tests] E2E tests for profiling mode
17. [P-tests] Verify profiling doesn't affect normal operation
18. [P-tests] Test profiling data export and analysis

---

## Session Log

### 2026-02-02: Gap Analysis Created
**Status:** Gap analysis complete, ready for implementation planning

**Findings:**
- 7 critical gaps identified for white paper data needs
- Profiling mode design proposed to capture detailed data
- 18 implementation tasks identified across 6 phases

**Next Steps:**
- Get user approval on profiling mode design
- Begin implementation of core infrastructure

### 2026-02-02: Phase 3 Complete
**Status:** Resource tracking implemented and tested

**Completed:**
- Tool usage tracking wired to episodic + persistent workers
- Context utilization tracking wired to episodic + persistent workers
- Parallelism snapshot tracking wired to FIFO + priority schedulers
- All 558 tests pass

**Files Modified:**
- `src/swarm/execution/worker/index.js` - Added profiling calls before task completion
- `src/swarm/orchestration/scheduler/index.js` - Added parallelism snapshots after batch sizing

**Notes:**
- Workers are simulated, so tool call data is empty (infrastructure ready for real execution)
- Phase 2 was already complete (Judge profiling existed)

**Next Steps:**
- Phase 4: Iteration history + refinement history
- Phase 5: Export & analysis utilities
- Phase 6: E2E profiling tests

### 2026-02-02: Phase 4 Complete
**Status:** History tracking infrastructure complete

**Completed:**
- Verified `recordPlannerIteration()` is wired in iterative planner (iteration 1 recorded)
- Verified `recordStrategyRefinement()` method exists and is ready
- Verified `export()` includes `history.plannerIterations` and `history.strategyRefinements`
- Verified event types `PLANNER_ITERATION` and `STRATEGY_REFINED` are defined

**Files Already Wired:**
- `src/swarm/orchestration/planner/index.js:142-154` - Records iteration 1 with changes array
- `src/swarm/measurement/profiling/store.js:264-310` - Both history tracking methods implemented

**Notes:**
- Phase 4 is INFRASTRUCTURE COMPLETE
- Subsequent planner iterations (2, 3, etc.) will be recorded when iteration loop logic is added
- Strategy refinements will be recorded when mid-run adaptation logic is added
- Current SWARM uses static strategies per run (no adaptation yet)

**Next Steps:**
- Phase 5: Export & analysis utilities
- Phase 6: E2E profiling tests
