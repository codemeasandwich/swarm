# E001 Stories

> User stories for Epic E001: Calculator Core.

## Overview

This directory contains user stories for building the core calculator functionality.

## Stories

| Story | Title | Role(s) | Dependencies |
|-------|-------|---------|--------------|
| [S001](./S001-calculator-api.md) | Calculator API Design | architect | - |
| [S002](./S002-calculator-impl.md) | Calculator Implementation | implementer, tester | S001 |

## Task Flow

```
┌─────────────────────────────────────────────────┐
│                 Epic E001                        │
│              Calculator Core                     │
└─────────────────────────────────────────────────┘
                      │
         ┌────────────┴────────────┐
         ▼                         ▼
┌─────────────────┐      ┌─────────────────┐
│  S001: API      │      │  S002: Impl     │
│  Design         │      │                 │
└────────┬────────┘      └────────┬────────┘
         │                        │
         ▼                        │
  ┌────────────┐                  │
  │ T001       │                  │
  │ (architect)│                  │
  └─────┬──────┘                  │
        │                         │
        │    ┌────────────────────┘
        │    │
        ▼    ▼
  ┌────────────┐
  │ T002       │
  │(implementer│
  └─────┬──────┘
        │
        ▼
  ┌────────────┐
  │ T003       │
  │ (tester)   │
  └────────────┘
```

## Summary

- **T001** (architect): Design the calculator API
- **T002** (implementer): Implement calculator module (depends on T001)
- **T003** (tester): Write E2E tests (depends on T002)
