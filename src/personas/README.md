# src/personas

Agent persona definitions and task matching.

## Purpose

Defines agent archetypes (architect, implementer, tester, etc.) with their capabilities and constraints. Matches tasks to the most suitable persona and generates context for agent initialization.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `models.js` | `Breakpoint`, `PersonaConfig`, and `AgentInstance` data classes |
| `matcher.js` | `PersonaMatcher` for matching tasks to suitable personas |
| `generator.js` | `ClaudeMdGenerator` for generating agent context files |

## Exports

```javascript
import {
  Breakpoint,
  PersonaConfig,
  AgentInstance,
  PersonaMatcher,
  ClaudeMdGenerator,
} from './personas/index.js';
```

## Persona Structure

```javascript
{
  id: 'architect',
  name: 'Architect Agent',
  role: 'architect',
  capabilities: ['design', 'documentation', 'code-review'],
  constraints: ['no-implementation'],
  claudeMdTemplate: '...'
}
```

## Task Matching

`PersonaMatcher` scores tasks against personas based on:
- Required capabilities vs persona capabilities
- Role alignment
- Current workload
- Constraint compatibility

## CLAUDE.md Generation

`ClaudeMdGenerator` creates context files for spawned agents containing:
- Persona instructions
- Current task details
- Project context
- Communication protocols

## Dependencies

- `../types/` - Data type definitions
- `../plan/` - Task and story models
