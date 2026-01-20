# Demos

> Feature demonstration scripts for the multi-agent system.

## Contents

| File | Description |
|------|-------------|
| `blocking_demo.py` | Dependency-based blocking demonstration |

## Blocking Demo

The blocking demo (`blocking_demo.py`) demonstrates how agents block on dependencies and unblock when those dependencies are satisfied.

```bash
python -m examples.demos.blocking_demo
```

### Scenario

1. **Builder** agent requests 2 tasks from **Designer** agent
2. Builder enters BLOCKED state (waiting for both tasks)
3. Designer completes task 1 - Builder still blocked (missing 1 dependency)
4. Designer completes task 2 - Builder UNBLOCKED
5. Builder continues with received work

### Flow Diagram

```
Time    Builder                     Designer
─────────────────────────────────────────────────
  │
  │     request("task 1") ─────────►
  │     request("task 2") ─────────►
  │
  │     BLOCKED (waiting for 2)
  │                                 working on task 1
  │                                        │
  │     ◄───────────────────────── complete task 1
  │
  │     still BLOCKED (1/2)
  │                                 working on task 2
  │                                        │
  │     ◄───────────────────────── complete task 2
  │
  │     UNBLOCKED! (2/2 received)
  │
  │     continues work...
  ▼
```

### Key Concepts Demonstrated

- **Blocking on multiple dependencies**: Agent waits for ALL dependencies
- **Partial completion**: Having some deps doesn't unblock
- **Automatic unblocking**: When all deps satisfied, work continues
- **File-based coordination**: All through `communications.json`

### Code Highlights

```python
# Agent blocks until it has required deliveries
while len(my_deliveries) < required_count:
    # FileWatcher notifies when file changes
    # Agent checks if dependencies satisfied
    pass

# All dependencies received - unblocked!
process_deliveries()
```

## Related

- [../poc/](../poc/) - Proof of concept demos
- [/lifecycle](../../lifecycle/) - Blocking in lifecycle loop
