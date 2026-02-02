# Phase 3: Resource Tracking Implementation Plan

## Objective
Wire the already-scaffolded Phase 3 trackers into the worker execution flow to capture:
- Tool usage per task
- Context utilization per task
- Peak parallelism snapshots

## Current State
- ✅ `ProfilingStore` has all methods implemented (100% complete)
- ✅ `recordToolUsage()`, `recordContextUtilization()`, `recordParallelismSnapshot()` ready
- ✅ `context.profiler` available in ExecutionContext
- ❌ Worker module doesn't call these methods

## Files to Modify

| File | Change |
|------|--------|
| [worker/index.js](src/swarm/execution/worker/index.js) | Add tool usage + context utilization calls |
| [scheduler/index.js](src/swarm/orchestration/scheduler/index.js) | Add parallelism snapshot call |

---

## Implementation Tasks

### Task 1: Tool Usage Tracking [P-worker]
**File:** `src/swarm/execution/worker/index.js`

**Location:** After task execution, before `worker.completeTask()` (lines ~438-440 and ~502-504)

**Code to add:**
```javascript
// Record tool usage profiling (simulated - real execution would parse actual tool calls)
if (context.profiler) {
  const availableTools = input.profile.tools || ['read', 'write', 'grep', 'glob', 'bash'];
  // In production, callCounts would come from parsing worker output
  const callCounts = {};  // Empty for simulated execution
  context.profiler.recordToolUsage(
    input.task.id,
    worker.id,
    availableTools,
    callCounts
  );
}
```

**Notes:**
- Simulated workers won't have real tool call data
- Infrastructure wiring enables future real execution support
- Add to both episodic (line ~438) and persistent (line ~502) workers

---

### Task 2: Context Utilization Tracking [P-worker]
**File:** `src/swarm/execution/worker/index.js`

**Location:** Same as Task 1 - after task execution, before `completeTask()`

**Code to add:**
```javascript
// Record context utilization profiling
if (context.profiler) {
  const budgetTokens = context.getMetric?.('contextBudget') || 4000;
  const inputTokens = tokensUsed;  // Already calculated from prompt
  const outputTokens = Math.floor(worker.outputBuffer.join('').length / 4);  // Estimate
  context.profiler.recordContextUtilization(
    input.task.id,
    worker.id,
    budgetTokens,
    inputTokens,
    outputTokens
  );
}
```

**Notes:**
- `budgetTokens` needs to come from config (use metric or fallback)
- `inputTokens` is already calculated as `tokensUsed`
- `outputTokens` estimated from output buffer length

---

### Task 3: Parallelism Snapshot Tracking [P-scheduler]
**File:** `src/swarm/orchestration/scheduler/index.js`

**Location:** After batch is scheduled (after line ~119 in fifo, ~233 in priority)

**Code to add:**
```javascript
// Record parallelism snapshot
if (context.profiler) {
  const tasksByWorker = {};  // Will be populated by router when tasks are assigned
  context.profiler.recordParallelismSnapshot(
    scheduled.length,       // activeWorkers (tasks about to be assigned)
    tasksByWorker,          // Empty until router assigns
    limitedQueue.length,    // pendingTasks
    0                       // completedTasks (tracked elsewhere)
  );
}
```

**Alternative approach:** Use the periodic snapshot mechanism:
- Call `context.profiler.startSnapshots(callback)` at workflow start
- Callback queries WorkerPool for active worker count
- Call `stopSnapshots()` at workflow end

**Recommendation:** Use manual snapshots in scheduler (simpler, more accurate for batch-based execution)

---

## Integration Points Summary

| Tracker | Method | Call Site | Data Source |
|---------|--------|-----------|-------------|
| Tool Usage | `recordToolUsage()` | worker/index.js:438,502 | profile.tools, output parsing |
| Context Util | `recordContextUtilization()` | worker/index.js:438,502 | prompt length, output length |
| Parallelism | `recordParallelismSnapshot()` | scheduler/index.js:119,233 | scheduled.length, queued.length |

---

## Validation

After implementation, run:
```bash
npm test -- tests/e2e/swarm/measurement.test.js
```

Verify profiling data captured in `ProfilingStore.getSummary()`:
- `tasksWithToolTracking` > 0
- `tasksWithContextTracking` > 0
- `peakParallelism` > 0

---

## Estimated Scope
- **Lines of code:** ~40 lines across 2 files
- **Test changes:** None required (existing tests cover profiler)
- **Risk:** Low (additive changes, guarded by `if (context.profiler)`)

---

## Session Log

### 2026-02-02: Phase 3 Planning
**Status:** Plan complete, ready for implementation

**Findings from exploration:**
- Judge profiling already complete (contrary to session summary)
- ProfilingStore is 100% scaffolded and functional
- Worker module uses simulated execution (no real Claude spawn)
- Scheduler emits events but doesn't trigger parallelism snapshots

**Dependencies:**
- Phase 2 complete (all orchestration modules have profiling)
- No blocking issues identified

**Next:** Implement Task 1-3 in parallel (both worker and scheduler changes are independent)
