# Personas

> Agent role configurations for the orchestration system.

## Overview

Personas define the roles, capabilities, and constraints for agents in the system. Each agent is assigned a persona that guides its behavior.

## Available Personas

| Persona | Role | Description |
|---------|------|-------------|
| [architect.md](./architect.md) | architect | System design and API specifications |
| [implementer.md](./implementer.md) | implementer | Python code implementation |
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

```python
plan = parser.parse_plan(Path(".state/plans"))

architect = plan.get_persona_by_role("architect")
print(f"Capabilities: {architect.capabilities}")
print(f"Constraints: {architect.constraints}")
```

## Related

- [/personas](../../../personas/) - Persona matching and configuration
- [../stories/](../stories/) - Tasks reference roles
