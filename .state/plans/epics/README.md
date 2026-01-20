# Epics

> Epic definitions for the project.

## Overview

Epics are large features containing multiple user stories. Each epic is defined in a separate markdown file.

## Current Epics

| File | Epic | Description |
|------|------|-------------|
| `E001-calculator-core.md` | Calculator Core | Basic arithmetic operations |

## Epic File Format

```markdown
# Epic: E001 - Epic Title

## Description
What this epic accomplishes.

## Status
not_started | in_progress | complete

## Priority
high | medium | low

## Stories
- S001
- S002

## Dependencies
- E000 (if any)
```

## Parsing

Epics are parsed and linked to the project plan:

```python
plan = parser.parse_plan(Path(".state/plans"))
epic = plan.get_epic_by_id("E001")
print(f"Epic: {epic.title}")
print(f"Stories: {len(epic.stories)}")
```

## Related

- [../stories/](../stories/) - Stories belonging to epics
- [../project.md](../project.md) - Project milestones
