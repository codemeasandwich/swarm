# src/plan

Project plan parsing and validation.

## Purpose

Parses project plans from YAML/JSON files into structured models (Epics, Stories, Tasks) and validates them for consistency and completeness.

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `models.js` | Data classes: `AcceptanceCriterion`, `TestScenario`, `Task`, `Story`, `Epic`, `Milestone`, `Persona`, `ProjectPlan` |
| `parser.js` | `PlanParser` for loading and parsing plan files |
| `validator.js` | `PlanValidator` for validating plan structure and dependencies |

## Exports

```javascript
import {
  // Models
  AcceptanceCriterion,
  TestScenario,
  Task,
  Story,
  Epic,
  Milestone,
  Persona,
  ProjectPlan,
  // Utilities
  PlanParser,
  PlanValidator,
} from './plan/index.js';
```

## Plan Hierarchy

```
ProjectPlan
├── Milestones
│   └── Epic references
├── Epics
│   └── Stories
│       ├── Acceptance Criteria
│       ├── Test Scenarios
│       └── Tasks
└── Personas
```

## Validation Rules

- All task dependencies must exist
- No circular dependencies
- All stories must belong to an epic
- Acceptance criteria must have Given/When/Then format
- Task IDs must be unique

## Usage

```javascript
const parser = new PlanParser();
const plan = await parser.parse('.state/plans/');

const validator = new PlanValidator();
const result = validator.validate(plan);
if (!result.isValid) {
  console.error(result.errors);
}
```

## Dependencies

- `../types/` - Status enums (`TaskStatus`, `StoryStatus`, `EpicStatus`)
