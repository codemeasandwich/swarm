# Examples

> Demo applications showcasing the multi-agent orchestration framework.

## Overview

This directory contains example applications and proof-of-concept demos that illustrate how to use the framework.

## Contents

| File | Description |
|------|-------------|
| [duo-demo.js](./duo-demo.js) | Two agents working together |
| [blocking-demo.js](./blocking-demo.js) | Dependency-based blocking |

## Quick Start

### Run the Duo Demo

The duo demo shows two agents (researcher and coder) working together:

```bash
node examples/duo-demo.js
```

This demonstrates:
- Agent mission and status updates
- Request/response workflow
- Delivery acknowledgment

### Run the Blocking Demo

The blocking demo shows how agents coordinate through dependencies:

```bash
node examples/blocking-demo.js
```

This demonstrates:
1. Agent A requests work from Agent B and blocks
2. Agent B completes partial work - A still blocked
3. Agent B completes all work - A unblocks and continues

## Demo Overview

### Blocking Demo (`blocking-demo.js`)

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

### Duo Demo (`duo-demo.js`)

Two-agent proof of concept:
- Researcher and Coder agents
- Request/response workflow
- Delivery acknowledgment

## Creating Your Own Demo

```javascript
import { Coordinator, TaskAgent } from '../src/communication/index.js';

// Create coordinator
const coordinator = new Coordinator('communications.json');
await coordinator.start();

// Create agents
const researcher = coordinator.createAgent(TaskAgent, 'researcher');
const coder = coordinator.createAgent(TaskAgent, 'coder');

// Agent interactions
await researcher.setMission('Gather requirements');
await researcher.request('coder', 'Implement feature X');

// Cleanup
await coordinator.stop();
```

## Related

- [/src/cli](../src/cli/) - Interactive CLI for manual testing
- [/src/communication](../src/communication/) - Communication system details
- [/src/orchestrator](../src/orchestrator/) - Full orchestration
