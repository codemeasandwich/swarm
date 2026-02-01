# Stories

> User story definitions organized by epic.

## Overview

Stories are organized in subdirectories by epic ID. Each story defines:

- User story (As a... I want... So that...)
- Acceptance criteria
- Tasks with role assignments and dependencies

## Structure

```
stories/
├── E001/                     # Epic E001 stories
│   ├── S001-calculator-api.md
│   └── S002-calculator-impl.md
└── E002/                     # Epic E002 stories (future)
    └── ...
```

## Current Stories

### E001: Calculator Core

| Story | Title | Tasks |
|-------|-------|-------|
| [S001](./E001/S001-calculator-api.md) | Calculator API Design | T001 (architect) |
| [S002](./E001/S002-calculator-impl.md) | Calculator Implementation | T002 (implementer), T003 (tester) |

## Story File Format

```markdown
# Story: S001 - Story Title

## Epic
E001

## User Story
- As a: developer
- I want: an API for calculations
- So that: I can perform arithmetic operations

## Acceptance Criteria

### AC1: Addition
- Given: two numbers
- When: I call add()
- Then: I get the sum

## Tasks

### T001: Design API
- Role: architect
- Dependencies: none
- Description: Create API specification

### T002: Implement Calculator
- Role: implementer
- Dependencies: T001
- Description: Implement the calculator module
```

## Related

- [../epics/](../epics/) - Epic definitions
- [/src/plan](../../../src/plan/) - Story parsing
