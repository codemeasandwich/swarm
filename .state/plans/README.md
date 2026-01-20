# Plans

> Project plan definitions for the orchestration framework.

## Overview

This directory contains the project plan in markdown format, organized hierarchically:

- **project.md** - Main project overview and milestones
- **epics/** - Epic (large feature) definitions
- **stories/** - User story definitions with tasks
- **personas/** - Agent role configurations

## Structure

```
plans/
├── project.md              # Main project overview
├── epics/
│   └── E001-*.md           # Epic definitions
├── stories/
│   └── E001/
│       ├── S001-*.md       # Story definitions
│       └── S002-*.md
└── personas/
    ├── architect.md        # Architect persona
    ├── implementer.md      # Implementer persona
    └── tester.md           # Tester persona
```

## Project File Format

`project.md` defines the project overview:

```markdown
# Project Name

## Description
What this project is about.

## Milestones

### M1: Milestone Name
Description of milestone.

- [ ] E001
- [ ] E002
```

## Subdirectories

| Directory | Description |
|-----------|-------------|
| [epics/](./epics/) | Epic definitions (large features) |
| [stories/](./stories/) | User stories with acceptance criteria |
| [personas/](./personas/) | Agent role configurations |

## Parsing

Plans are parsed by the `PlanParser` class:

```python
from plan.parser import PlanParser

parser = PlanParser()
plan = parser.parse_plan(Path(".state/plans"))
```

## Related

- [/plan](../../plan/) - Plan parsing and validation
- [/personas](../../personas/) - Persona matching
