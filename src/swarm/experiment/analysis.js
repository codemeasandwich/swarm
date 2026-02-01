/**
 * SWARM Framework - Statistical Analysis
 * Provides statistical analysis for experiment results
 * @module swarm/experiment/analysis
 */

// =============================================================================
// DESCRIPTIVE STATISTICS
// =============================================================================

/**
 * Calculate mean of values
 * @param {number[]} values
 * @returns {number}
 */
export function mean(values) {
  if (values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
}

/**
 * Calculate variance of values
 * @param {number[]} values
 * @param {boolean} [population=false] - Use population variance (N) vs sample (N-1)
 * @returns {number}
 */
export function variance(values, population = false) {
  if (values.length === 0) return 0;
  if (values.length === 1) return 0;

  const m = mean(values);
  const sumSquaredDiffs = values.reduce((sum, v) => sum + Math.pow(v - m, 2), 0);
  const divisor = population ? values.length : values.length - 1;
  return sumSquaredDiffs / divisor;
}

/**
 * Calculate standard deviation
 * @param {number[]} values
 * @param {boolean} [population=false]
 * @returns {number}
 */
export function stdDev(values, population = false) {
  return Math.sqrt(variance(values, population));
}

/**
 * Calculate median of values
 * @param {number[]} values
 * @returns {number}
 */
export function median(values) {
  if (values.length === 0) return 0;

  const sorted = [...values].sort((a, b) => a - b);
  const mid = Math.floor(sorted.length / 2);

  if (sorted.length % 2 === 0) {
    return (sorted[mid - 1] + sorted[mid]) / 2;
  }
  return sorted[mid];
}

/**
 * Calculate minimum value
 * @param {number[]} values
 * @returns {number}
 */
export function min(values) {
  if (values.length === 0) return 0;
  return Math.min(...values);
}

/**
 * Calculate maximum value
 * @param {number[]} values
 * @returns {number}
 */
export function max(values) {
  if (values.length === 0) return 0;
  return Math.max(...values);
}

/**
 * Calculate standard error of the mean
 * @param {number[]} values
 * @returns {number}
 */
export function standardError(values) {
  if (values.length <= 1) return 0;
  return stdDev(values) / Math.sqrt(values.length);
}

/**
 * Calculate descriptive statistics for a dataset
 * @param {number[]} values
 * @returns {import('../types/experiment.js').DescriptiveStats}
 */
export function descriptiveStats(values) {
  return {
    mean: mean(values),
    stdDev: stdDev(values),
    median: median(values),
    min: min(values),
    max: max(values),
    n: values.length,
  };
}

// =============================================================================
// EFFECT SIZE
// =============================================================================

/**
 * Calculate Cohen's d effect size
 * @param {number[]} group1
 * @param {number[]} group2
 * @returns {number}
 */
export function cohensD(group1, group2) {
  if (group1.length === 0 || group2.length === 0) return 0;

  const mean1 = mean(group1);
  const mean2 = mean(group2);

  // Pooled standard deviation
  const n1 = group1.length;
  const n2 = group2.length;
  const var1 = variance(group1);
  const var2 = variance(group2);

  const pooledVar = ((n1 - 1) * var1 + (n2 - 1) * var2) / (n1 + n2 - 2);
  const pooledStd = Math.sqrt(pooledVar);

  if (pooledStd === 0) return 0;
  return (mean1 - mean2) / pooledStd;
}

/**
 * Interpret Cohen's d effect size
 * @param {number} d
 * @returns {'negligible' | 'small' | 'medium' | 'large'}
 */
export function interpretCohensD(d) {
  const absD = Math.abs(d);
  if (absD < 0.2) return 'negligible';
  if (absD < 0.5) return 'small';
  if (absD < 0.8) return 'medium';
  return 'large';
}

// =============================================================================
// T-TEST
// =============================================================================

/**
 * Calculate t-statistic for independent samples t-test
 * @param {number[]} group1
 * @param {number[]} group2
 * @returns {number}
 */
export function tStatistic(group1, group2) {
  if (group1.length === 0 || group2.length === 0) return 0;

  const mean1 = mean(group1);
  const mean2 = mean(group2);
  const var1 = variance(group1);
  const var2 = variance(group2);
  const n1 = group1.length;
  const n2 = group2.length;

  const se = Math.sqrt(var1 / n1 + var2 / n2);
  if (se === 0) return 0;

  return (mean1 - mean2) / se;
}

/**
 * Calculate degrees of freedom for Welch's t-test
 * @param {number[]} group1
 * @param {number[]} group2
 * @returns {number}
 */
export function welchDF(group1, group2) {
  const var1 = variance(group1);
  const var2 = variance(group2);
  const n1 = group1.length;
  const n2 = group2.length;

  const num = Math.pow(var1 / n1 + var2 / n2, 2);
  const denom = Math.pow(var1 / n1, 2) / (n1 - 1) + Math.pow(var2 / n2, 2) / (n2 - 1);

  if (denom === 0) return Math.min(n1, n2) - 1;
  return num / denom;
}

/**
 * Approximate p-value from t-statistic using normal approximation
 * (For large df, t-distribution approaches normal)
 * @param {number} t - t-statistic
 * @param {number} df - degrees of freedom
 * @param {boolean} [twoTailed=true]
 * @returns {number}
 */
export function tToPValue(t, df, twoTailed = true) {
  // Use normal approximation for simplicity
  // For more accurate results, would need a proper t-distribution CDF
  const absT = Math.abs(t);

  // Approximation using error function
  // P(Z > z) ≈ 0.5 * erfc(z / sqrt(2))
  const z = absT;
  const p = 0.5 * erfc(z / Math.sqrt(2));

  return twoTailed ? 2 * p : p;
}

/**
 * Complementary error function approximation
 * @param {number} x
 * @returns {number}
 */
function erfc(x) {
  // Horner form approximation (Abramowitz and Stegun)
  const a1 = 0.254829592;
  const a2 = -0.284496736;
  const a3 = 1.421413741;
  const a4 = -1.453152027;
  const a5 = 1.061405429;
  const p = 0.3275911;

  const sign = x < 0 ? -1 : 1;
  const absX = Math.abs(x);

  const t = 1.0 / (1.0 + p * absX);
  const y = 1.0 - ((((a5 * t + a4) * t + a3) * t + a2) * t + a1) * t * Math.exp(-absX * absX);

  return sign === 1 ? 1 - y : 1 + y;
}

/**
 * Perform independent samples t-test
 * @param {number[]} group1
 * @param {number[]} group2
 * @param {number} [alpha=0.05]
 * @returns {{t: number, df: number, pValue: number, significant: boolean, effectSize: number}}
 */
export function tTest(group1, group2, alpha = 0.05) {
  const t = tStatistic(group1, group2);
  const df = welchDF(group1, group2);
  const pValue = tToPValue(t, df);
  const effectSize = cohensD(group1, group2);

  return {
    t,
    df,
    pValue,
    significant: pValue < alpha,
    effectSize,
  };
}

// =============================================================================
// ANOVA
// =============================================================================

/**
 * Calculate F-statistic for one-way ANOVA
 * @param {number[][]} groups - Array of groups, each group is array of values
 * @returns {number}
 */
export function fStatistic(groups) {
  if (groups.length < 2) return 0;

  // Calculate grand mean
  const allValues = groups.flat();
  const grandMean = mean(allValues);
  const n = allValues.length;
  const k = groups.length;

  // Between-group sum of squares
  let ssBetween = 0;
  for (const group of groups) {
    const groupMean = mean(group);
    ssBetween += group.length * Math.pow(groupMean - grandMean, 2);
  }

  // Within-group sum of squares
  let ssWithin = 0;
  for (const group of groups) {
    const groupMean = mean(group);
    for (const value of group) {
      ssWithin += Math.pow(value - groupMean, 2);
    }
  }

  // Degrees of freedom
  const dfBetween = k - 1;
  const dfWithin = n - k;

  if (dfWithin <= 0 || ssWithin === 0) return 0;

  // Mean squares
  const msBetween = ssBetween / dfBetween;
  const msWithin = ssWithin / dfWithin;

  return msBetween / msWithin;
}

/**
 * Approximate p-value from F-statistic
 * (Simplified approximation)
 * @param {number} f - F-statistic
 * @param {number} df1 - numerator degrees of freedom
 * @param {number} df2 - denominator degrees of freedom
 * @returns {number}
 */
export function fToPValue(f, df1, df2) {
  // Use rough approximation: for large df, F approaches chi-squared
  // This is a simplification - for accurate values use proper F-distribution CDF
  if (f <= 0) return 1;
  if (df1 <= 0 || df2 <= 0) return 1;

  // Wilson-Hilferty approximation for F-distribution
  const k = df2 / (df2 + df1 * f);
  const z = ((1 - 2 / (9 * df2)) * Math.pow(k, 1 / 3) - (1 - 2 / (9 * df1))) / Math.sqrt(
    (2 / (9 * df2)) * Math.pow(k, 2 / 3) + 2 / (9 * df1)
  );

  return 0.5 * erfc(-z / Math.sqrt(2));
}

/**
 * Perform one-way ANOVA
 * @param {number[][]} groups
 * @param {number} [alpha=0.05]
 * @returns {{f: number, dfBetween: number, dfWithin: number, pValue: number, significant: boolean}}
 */
export function oneWayAnova(groups, alpha = 0.05) {
  const allValues = groups.flat();
  const n = allValues.length;
  const k = groups.length;

  const f = fStatistic(groups);
  const dfBetween = k - 1;
  const dfWithin = n - k;
  const pValue = fToPValue(f, dfBetween, dfWithin);

  return {
    f,
    dfBetween,
    dfWithin,
    pValue,
    significant: pValue < alpha,
  };
}

/**
 * Calculate eta-squared effect size for ANOVA
 * @param {number[][]} groups
 * @returns {number}
 */
export function etaSquared(groups) {
  if (groups.length < 2) return 0;

  const allValues = groups.flat();
  const grandMean = mean(allValues);

  // Total sum of squares
  let ssTotal = 0;
  for (const value of allValues) {
    ssTotal += Math.pow(value - grandMean, 2);
  }

  // Between-group sum of squares
  let ssBetween = 0;
  for (const group of groups) {
    const groupMean = mean(group);
    ssBetween += group.length * Math.pow(groupMean - grandMean, 2);
  }

  if (ssTotal === 0) return 0;
  return ssBetween / ssTotal;
}

// =============================================================================
// PAIRWISE COMPARISONS
// =============================================================================

/**
 * @typedef {Object} PairwiseResult
 * @property {string} groupA - First group name
 * @property {string} groupB - Second group name
 * @property {number} meanDiff - Difference in means (A - B)
 * @property {number} pValue - Statistical significance
 * @property {boolean} significant - Whether difference is significant
 * @property {number} effectSize - Cohen's d
 */

/**
 * Perform all pairwise t-tests with Bonferroni correction
 * @param {Map<string, number[]>} groups - Named groups
 * @param {number} [alpha=0.05]
 * @returns {PairwiseResult[]}
 */
export function pairwiseComparisons(groups, alpha = 0.05) {
  const groupNames = [...groups.keys()];
  const numComparisons = (groupNames.length * (groupNames.length - 1)) / 2;
  const adjustedAlpha = alpha / numComparisons; // Bonferroni correction

  const results = [];

  for (let i = 0; i < groupNames.length; i++) {
    for (let j = i + 1; j < groupNames.length; j++) {
      const nameA = groupNames[i];
      const nameB = groupNames[j];
      const groupA = groups.get(nameA);
      const groupB = groups.get(nameB);

      const test = tTest(groupA, groupB, adjustedAlpha);

      results.push({
        groupA: nameA,
        groupB: nameB,
        meanDiff: mean(groupA) - mean(groupB),
        pValue: test.pValue,
        significant: test.significant,
        effectSize: test.effectSize,
      });
    }
  }

  return results;
}

// =============================================================================
// EXPERIMENT ANALYSIS
// =============================================================================

/**
 * Analyze experiment results
 * @param {import('../types/experiment.js').ExperimentResult} result
 * @returns {import('../types/experiment.js').ExperimentAnalysis}
 */
export function analyzeExperiment(result) {
  const { configurations } = result;

  // Get all metrics measured
  const allMetrics = new Set();
  for (const config of configurations) {
    for (const run of config.runs) {
      Object.keys(run.metrics).forEach((m) => allMetrics.add(m));
    }
  }

  // Calculate summary statistics by metric
  const summary = {};
  for (const metric of allMetrics) {
    const allValues = configurations.flatMap((c) => c.runs.map((r) => r.metrics[metric] || 0));
    summary[metric] = descriptiveStats(allValues);
  }

  // Pairwise comparisons for each metric
  const comparisons = [];
  for (const metric of allMetrics) {
    const groups = new Map();
    for (const config of configurations) {
      const values = config.runs.map((r) => r.metrics[metric] || 0);
      groups.set(config.configId, values);
    }

    if (groups.size >= 2) {
      const pairwise = pairwiseComparisons(groups);
      for (const pw of pairwise) {
        comparisons.push({
          configA: pw.groupA,
          configB: pw.groupB,
          metric,
          difference: pw.meanDiff,
          pValue: pw.pValue,
          significant: pw.significant,
          effectSize: pw.effectSize,
        });
      }
    }
  }

  // Generate recommendations
  const recommendations = generateRecommendations(configurations, comparisons);

  return {
    summary,
    comparisons,
    recommendations,
  };
}

/**
 * Generate actionable recommendations from analysis
 * @param {import('../types/experiment.js').ConfigurationResult[]} configurations
 * @param {import('../types/experiment.js').PairwiseComparison[]} comparisons
 * @returns {string[]}
 */
function generateRecommendations(configurations, comparisons) {
  const recommendations = [];

  // Find best configuration per metric
  const metricBests = new Map();
  const significantDiffs = comparisons.filter((c) => c.significant);

  for (const comp of significantDiffs) {
    const metric = comp.metric;
    if (!metricBests.has(metric)) {
      metricBests.set(metric, { best: null, worst: null });
    }

    // For completion rate, quality score: higher is better
    // For cost, time: lower is better
    const higherIsBetter = metric.includes('rate') || metric.includes('score');
    const winner = comp.difference > 0 ? comp.configA : comp.configB;

    if (higherIsBetter) {
      metricBests.get(metric).best = winner;
    } else {
      metricBests.get(metric).best = comp.difference > 0 ? comp.configB : comp.configA;
    }
  }

  for (const [metric, { best }] of metricBests.entries()) {
    if (best) {
      recommendations.push(`Use configuration "${best}" for optimal ${metric.replace(/_/g, ' ')}`);
    }
  }

  if (significantDiffs.length === 0) {
    recommendations.push('No statistically significant differences found between configurations');
    recommendations.push('Consider increasing sample size or testing more varied configurations');
  }

  return recommendations;
}

/**
 * Aggregate metrics across runs for a configuration
 * @param {import('../types/experiment.js').RunResult[]} runs
 * @returns {import('../types/experiment.js').AggregatedMetrics}
 */
export function aggregateRunMetrics(runs) {
  if (runs.length === 0) {
    return { mean: {}, stdDev: {}, median: {}, min: {}, max: {} };
  }

  // Get all metric names
  const metricNames = new Set();
  for (const run of runs) {
    Object.keys(run.metrics).forEach((m) => metricNames.add(m));
  }

  const result = { mean: {}, stdDev: {}, median: {}, min: {}, max: {} };

  for (const metricName of metricNames) {
    const values = runs.map((r) => r.metrics[metricName] || 0);
    result.mean[metricName] = mean(values);
    result.stdDev[metricName] = stdDev(values);
    result.median[metricName] = median(values);
    result.min[metricName] = min(values);
    result.max[metricName] = max(values);
  }

  return result;
}
