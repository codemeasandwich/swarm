# src/swarm/experiment

SWARM experiment framework - systematic workflow comparison.

## Purpose

Design and run controlled experiments to compare workflow configurations. Includes matrix generation, statistical analysis, and task corpora management.

## Submodules

| Submodule | Description |
|-----------|-------------|
| `tasks/` | Task corpus management and built-in test tasks |

## Files

| File | Description |
|------|-------------|
| `index.js` | Module exports |
| `matrix.js` | Cartesian product matrix generation for experiment variables |
| `analysis.js` | Statistical analysis (t-test, ANOVA, effect sizes) |
| `runner.js` | Experiment execution and validation |

## Exports

```javascript
import {
  // Matrix generation
  generateMatrix,
  generateMatrixWithControl,
  filterMatrix,
  cartesianProduct,
  // Statistics
  mean,
  variance,
  stdDev,
  descriptiveStats,
  cohensD,
  tTest,
  oneWayAnova,
  analyzeExperiment,
  // Runner
  validateExperiment,
  dryRun,
  createExperimentRunner,
  // Task corpus
  createCorpus,
  registerCorpus,
  getCorpus,
  filterBySkills,
  sampleTasks,
  createCodeGenCorpus,
  createCodeReviewCorpus,
} from './experiment/index.js';
```

## Experiment Structure

```javascript
{
  name: 'Model Comparison',
  variables: [
    { path: 'worker.model.id', values: ['claude-sonnet', 'claude-haiku'] }
  ],
  baseConfig: { ... },
  repetitions: 5,
  taskCorpus: 'code-generation'
}
```

## Statistical Analysis

| Function | Description |
|----------|-------------|
| `tTest()` | Two-sample t-test with Welch's correction |
| `oneWayAnova()` | One-way ANOVA for multiple groups |
| `cohensD()` | Effect size measurement |
| `analyzeExperiment()` | Full analysis with pairwise comparisons |

## Dependencies

- `../types/` - Experiment type definitions
- `../registry/` - Module registration
