# Plan

> Data models and parsing for project plans (Epics, Stories, Tasks, Milestones).

## Overview

The plan module defines the hierarchical structure for project planning and provides parsing and validation utilities. Plans are organized in a hierarchy:

```
ProjectPlan
├── Milestones (collections of epics)
├── Epics (large features)
│   └── Stories (user stories)
│       └── Tasks (atomic work units)
└── Personas (agent role definitions)
```

## Key Components

| Component | Purpose |
|-----------|---------|
| `ProjectPlan` | Complete project with all components |
| `Milestone` | Collection of epics with a target date |
| `Epic` | Large feature containing stories |
| `Story` | User story with acceptance criteria |
| `Task` | Atomic unit of work assigned to a role |
| `Persona` | Agent role definition |
| `AcceptanceCriterion` | Test-driven requirement |
| `TestScenario` | E2E test derived from criteria |
| `PlanParser` | Parses markdown plan files |
| `PlanValidator` | Validates plan structure |

## Status Enums

### TaskStatus
- `AVAILABLE` - Not yet claimed
- `CLAIMED` - Assigned to an agent
- `IN_PROGRESS` - Being worked on
- `BLOCKED` - Waiting for dependencies
- `PR_PENDING` - Waiting for PR review
- `COMPLETE` - Finished

### StoryStatus / EpicStatus
- `NOT_STARTED`
- `IN_PROGRESS`
- `COMPLETE`

## Usage

### Parsing a Plan

```python
from plan.parser import PlanParser
from plan.validator import PlanValidator
from pathlib import Path

parser = PlanParser()
plan = parser.parse_plan(Path(".state/plans"))

validator = PlanValidator()
result = validator.validate(plan)

if not result.is_valid:
    print("Errors:", result.errors)
```

### Working with Tasks

```python
# Get all tasks for a role
tasks = plan.get_tasks_by_role("implementer")

# Get available tasks (not blocked)
available = plan.get_available_tasks_for_role("architect")

# Find a specific task
task = plan.get_task_by_id("T001")

# Check task dependencies
completed = {"T001", "T002"}
blocked_by = task.is_blocked_by(completed)
```

### Working with Stories

```python
# Get all stories
stories = plan.get_all_stories()

# Find a story
story = plan.get_story_by_id("S001")

# Get user story text
print(story.user_story_text)
# "As a developer, I want an API so that I can build features"
```

## Plan Directory Structure

```
.state/plans/
├── project.md          # Main project overview
├── epics/
│   └── E001-*.md       # Epic definitions
├── stories/
│   └── E001/
│       ├── S001-*.md   # Story definitions
│       └── S002-*.md
└── personas/
    ├── architect.md    # Persona definitions
    ├── implementer.md
    └── tester.md
```

## Data Model Diagram

```
ProjectPlan
├── name: str
├── description: str
├── milestones[]
│   ├── id, name, description
│   ├── epic_ids[]
│   ├── target_date
│   └── completed, pr_url
├── epics[]
│   ├── id, title, description
│   ├── status, priority
│   ├── milestone_id
│   └── stories[]
│       ├── id, title
│       ├── as_a, i_want, so_that
│       ├── acceptance_criteria[]
│       └── tasks[]
│           ├── id, description
│           ├── role, status
│           ├── dependencies[]
│           └── assigned_agent, branch, pr_url
└── personas[]
    ├── id, name, role
    ├── capabilities[]
    └── constraints[]
```

## Related Modules

- [/orchestrator](../orchestrator/) - Uses plans to coordinate agents
- [/personas](../personas/) - Task-to-role matching
- [/lifecycle](../lifecycle/) - Uses task status for lifecycle management

## Files

- [`models.py`](./models.py) - Data model definitions
- [`parser.py`](./parser.py) - Plan file parser
- [`validator.py`](./validator.py) - Plan validation
