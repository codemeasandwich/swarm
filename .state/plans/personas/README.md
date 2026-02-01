# Personas

> Agent role configurations for the orchestration system.

## Overview

Personas define the roles, capabilities, and constraints for agents in the system. Each agent is assigned a persona that guides its behavior.

## Available Personas

| Persona | Role | Description |
|---------|------|-------------|
| [architect.md](./architect.md) | architect | System design and API specifications |
| [implementer.md](./implementer.md) | implementer | Code implementation |
| [tester.md](./tester.md) | tester | E2E test development |

## Persona File Format

```markdown
# Persona: Name

## Role
role_identifier

## Capabilities
- Capability 1
- Capability 2

## Constraints
- Constraint 1
- Constraint 2

## Claude MD Template
Instructions for the agent's .claude.md file.
```

## Example: Architect

```markdown
# Persona: System Architect

## Role
architect

## Capabilities
- API design and specification
- System architecture decisions
- Technical documentation

## Constraints
- No implementation code
- Design documents only
- Work in /sandbox directory
```

## Usage

Personas are loaded during plan parsing:

```javascript
const plan = await parser.parsePlan('.state/plans');

const architect = plan.getPersonaByRole('architect');
console.log(`Capabilities: ${architect.capabilities}`);
console.log(`Constraints: ${architect.constraints}`);
```

## Related

- [/src/personas](../../../src/personas/) - Persona matching and configuration
- [../stories/](../stories/) - Tasks reference roles
