# Proof of Concept

> Initial proof of concept demos for the multi-agent system.

## Contents

| File | Description |
|------|-------------|
| `duo_demo.py` | Two-agent coordination demo |

## Duo Demo

The duo demo (`duo_demo.py`) demonstrates basic two-agent coordination:

```bash
python -m examples.poc.duo_demo
```

### What It Shows

1. **Agent Registration** - Researcher and Coder agents register
2. **Mission Setting** - Each agent sets their mission
3. **Request Flow** - Researcher requests work from Coder
4. **Work Execution** - Coder sets working status and completes
5. **Delivery** - Coder delivers completed work
6. **Acknowledgment** - Researcher acknowledges delivery

### Output Example

```
============================================================
  AGENT REQUEST/RESPONSE DEMO
============================================================

--- Researcher sends request ---
Mission: Get API implementation
[researcher] Sent request to coder: Please implement the user authentication API

--- Coder checks requests ---
  Request from researcher: Please implement the user authentication API

--- Coder completes request ---
[coder] Completed request for researcher: Auth API implemented in auth_api.py

--- Researcher checks deliveries ---
  From: coder
  Description: Auth API implemented - includes login, logout endpoints
  Original request: Please implement the user authentication API

--- Final State ---
{
  "_meta": {...},
  "researcher": {...},
  "coder": {...}
}
```

## Related

- [../demos/](../demos/) - Feature demonstrations
- [/communication](../../communication/) - Communication system
