# Examples

> Demo applications showcasing the multi-agent orchestration framework.

## Overview

This directory contains example applications and proof-of-concept demos that illustrate how to use the framework.

## Contents

| Directory | Description |
|-----------|-------------|
| [poc/](./poc/) | Proof of concept demos |
| [demos/](./demos/) | Feature demonstrations |

## Quick Start

### Run the Blocking Demo

The blocking demo shows how agents coordinate through dependencies:

```bash
python -m examples.demos.blocking_demo
```

This demonstrates:
1. Agent A requests work from Agent B and blocks
2. Agent B completes partial work - A still blocked
3. Agent B completes all work - A unblocks and continues

### Run the Duo Demo

The duo demo shows two agents working together:

```bash
python -m examples.poc.duo_demo
```

## Demo Overview

### Blocking Demo (`demos/blocking_demo.py`)

Demonstrates dependency-based blocking:

```
Builder ─────► requests 2 tasks ─────► Designer
        │                                │
        │ BLOCKED (waiting)              │
        │                                ▼
        │                          Completes task 1
        │ still BLOCKED                  │
        │                                ▼
        │                          Completes task 2
        │                                │
        ▼                                ▼
   UNBLOCKED ◄─── all deps satisfied ───┘
```

### Duo Demo (`poc/duo_demo.py`)

Two-agent proof of concept:
- Researcher and Coder agents
- Request/response workflow
- Delivery acknowledgment

## Creating Your Own Demo

```python
from communication.core import CommunicationsFile, FileWatcher, TaskAgent, Coordinator

# Create coordinator
coordinator = Coordinator("communications.json")
coordinator.start()

# Create agents
researcher = coordinator.create_agent(TaskAgent, "researcher")
coder = coordinator.create_agent(TaskAgent, "coder")

# Agent interactions
researcher.set_mission("Gather requirements")
researcher.request("coder", "Implement feature X")

# Cleanup
coordinator.stop()
```

## Related

- [/cli](../cli/) - Interactive CLI for manual testing
- [/communication](../communication/) - Communication system details
- [/orchestrator](../orchestrator/) - Full orchestration
