/**
 * SWARM Framework - HTML Report Generator
 * Generates HTML reports from measurement data
 * @module swarm/measurement/reports/html-report
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { createModuleMetrics } from '../../types/module.js';
import { LogLevel } from '../../types/trace.js';

// =============================================================================
// HTML TEMPLATES
// =============================================================================

/**
 * Generate HTML document from report data
 * @param {import('./json-report.js').WorkflowReport} report
 * @returns {string}
 */
function generateHTML(report) {
  const summaryRows = Object.entries(report.summary)
    .map(([key, value]) => {
      const formattedValue = typeof value === 'number' ? formatNumber(key, value) : value;
      return `<tr><td>${formatKey(key)}</td><td>${formattedValue}</td></tr>`;
    })
    .join('\n');

  const metricsSection = report.metrics
    ? generateMetricsSection(report.metrics)
    : '';

  const costSection = report.costs
    ? generateCostSection(report.costs)
    : '';

  const qualitySection = report.quality
    ? generateQualitySection(report.quality)
    : '';

  const tracesSection = report.traces
    ? generateTracesSection(report.traces)
    : '';

  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>SWARM Workflow Report - ${report.runId}</title>
  <style>
    :root {
      --primary-color: #2563eb;
      --success-color: #16a34a;
      --warning-color: #ca8a04;
      --error-color: #dc2626;
      --bg-color: #f8fafc;
      --card-bg: #ffffff;
      --text-color: #1e293b;
      --text-muted: #64748b;
      --border-color: #e2e8f0;
    }
    * { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif;
      background: var(--bg-color);
      color: var(--text-color);
      line-height: 1.6;
      padding: 2rem;
    }
    .container { max-width: 1200px; margin: 0 auto; }
    h1 {
      font-size: 1.875rem;
      margin-bottom: 0.5rem;
    }
    h2 {
      font-size: 1.25rem;
      margin-bottom: 1rem;
      padding-bottom: 0.5rem;
      border-bottom: 2px solid var(--primary-color);
    }
    .subtitle {
      color: var(--text-muted);
      margin-bottom: 2rem;
    }
    .card {
      background: var(--card-bg);
      border-radius: 0.5rem;
      box-shadow: 0 1px 3px rgba(0,0,0,0.1);
      padding: 1.5rem;
      margin-bottom: 1.5rem;
    }
    table {
      width: 100%;
      border-collapse: collapse;
    }
    th, td {
      padding: 0.75rem;
      text-align: left;
      border-bottom: 1px solid var(--border-color);
    }
    th { font-weight: 600; color: var(--text-muted); font-size: 0.875rem; }
    .status-badge {
      display: inline-block;
      padding: 0.25rem 0.75rem;
      border-radius: 9999px;
      font-size: 0.875rem;
      font-weight: 500;
    }
    .status-completed { background: #dcfce7; color: var(--success-color); }
    .status-failed { background: #fee2e2; color: var(--error-color); }
    .metric-grid {
      display: grid;
      grid-template-columns: repeat(auto-fit, minmax(200px, 1fr));
      gap: 1rem;
    }
    .metric-item {
      background: var(--bg-color);
      padding: 1rem;
      border-radius: 0.375rem;
    }
    .metric-label { font-size: 0.875rem; color: var(--text-muted); }
    .metric-value { font-size: 1.5rem; font-weight: 600; }
    .progress-bar {
      height: 0.5rem;
      background: var(--border-color);
      border-radius: 0.25rem;
      overflow: hidden;
      margin-top: 0.5rem;
    }
    .progress-fill {
      height: 100%;
      background: var(--primary-color);
      border-radius: 0.25rem;
    }
    .timeline {
      position: relative;
      padding-left: 1.5rem;
    }
    .timeline::before {
      content: '';
      position: absolute;
      left: 0;
      top: 0;
      bottom: 0;
      width: 2px;
      background: var(--border-color);
    }
    .timeline-item {
      position: relative;
      padding-bottom: 1rem;
    }
    .timeline-item::before {
      content: '';
      position: absolute;
      left: -1.625rem;
      top: 0.375rem;
      width: 0.5rem;
      height: 0.5rem;
      background: var(--primary-color);
      border-radius: 50%;
    }
    .timeline-time { font-size: 0.75rem; color: var(--text-muted); }
    .timeline-event { font-weight: 500; }
    @media (max-width: 768px) {
      body { padding: 1rem; }
      .metric-grid { grid-template-columns: 1fr; }
    }
  </style>
</head>
<body>
  <div class="container">
    <h1>SWARM Workflow Report</h1>
    <p class="subtitle">Run ID: ${report.runId} | Generated: ${new Date(report.generatedAt).toISOString()}</p>

    <div class="card">
      <h2>Summary</h2>
      <table>
        <tbody>
          ${summaryRows}
        </tbody>
      </table>
    </div>

    ${metricsSection}
    ${costSection}
    ${qualitySection}
    ${tracesSection}
  </div>
</body>
</html>`;
}

/**
 * Format key for display
 * @param {string} key
 * @returns {string}
 */
function formatKey(key) {
  return key
    .replace(/([A-Z])/g, ' $1')
    .replace(/_/g, ' ')
    .replace(/^./, (s) => s.toUpperCase())
    .trim();
}

/**
 * Format number for display
 * @param {string} key
 * @param {number} value
 * @returns {string}
 */
function formatNumber(key, value) {
  if (key.includes('Rate') || key.includes('Score') || key.includes('rate') || key.includes('score')) {
    return `${value.toFixed(1)}%`;
  }
  if (key.includes('Cost') || key.includes('cost')) {
    return `$${value.toFixed(4)}`;
  }
  if (key.includes('duration') || key.includes('Duration') || key.includes('time') || key.includes('Time')) {
    return `${(value / 1000).toFixed(2)}s`;
  }
  if (Number.isInteger(value)) {
    return value.toString();
  }
  return value.toFixed(2);
}

/**
 * Generate metrics section
 * @param {object} metrics
 * @returns {string}
 */
function generateMetricsSection(metrics) {
  if (!metrics.computed) return '';

  const items = Object.entries(metrics.computed)
    .filter(([key]) => !key.includes('distribution'))
    .map(([key, value]) => {
      const formattedValue = typeof value === 'number' ? formatNumber(key, value) : JSON.stringify(value);
      return `
        <div class="metric-item">
          <div class="metric-label">${formatKey(key)}</div>
          <div class="metric-value">${formattedValue}</div>
        </div>
      `;
    })
    .join('');

  return `
    <div class="card">
      <h2>Metrics</h2>
      <div class="metric-grid">
        ${items}
      </div>
    </div>
  `;
}

/**
 * Generate cost section
 * @param {object} costs
 * @returns {string}
 */
function generateCostSection(costs) {
  const budgetPercent = costs.budgetLimit > 0
    ? ((costs.total / costs.budgetLimit) * 100).toFixed(1)
    : 0;

  const modelRows = costs.byModel
    ? Object.entries(costs.byModel)
        .map(([model, data]) => `
          <tr>
            <td>${model}</td>
            <td>${data.inputTokens.toLocaleString()}</td>
            <td>${data.outputTokens.toLocaleString()}</td>
            <td>$${data.totalCost.toFixed(4)}</td>
          </tr>
        `)
        .join('')
    : '';

  return `
    <div class="card">
      <h2>Costs</h2>
      <div class="metric-grid">
        <div class="metric-item">
          <div class="metric-label">Total Cost</div>
          <div class="metric-value">$${costs.total.toFixed(4)}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Input Tokens</div>
          <div class="metric-value">${costs.inputTokens.toLocaleString()}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Output Tokens</div>
          <div class="metric-value">${costs.outputTokens.toLocaleString()}</div>
        </div>
        ${costs.budgetLimit > 0 ? `
        <div class="metric-item">
          <div class="metric-label">Budget Used</div>
          <div class="metric-value">${budgetPercent}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${Math.min(100, budgetPercent)}%"></div>
          </div>
        </div>
        ` : ''}
      </div>
      ${modelRows ? `
      <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1rem;">Cost by Model</h3>
      <table>
        <thead>
          <tr>
            <th>Model</th>
            <th>Input Tokens</th>
            <th>Output Tokens</th>
            <th>Cost</th>
          </tr>
        </thead>
        <tbody>
          ${modelRows}
        </tbody>
      </table>
      ` : ''}
    </div>
  `;
}

/**
 * Generate quality section
 * @param {object} quality
 * @returns {string}
 */
function generateQualitySection(quality) {
  const dimensionRows = quality.dimensionAverages
    ? Object.entries(quality.dimensionAverages)
        .map(([dim, score]) => `
          <tr>
            <td>${formatKey(dim)}</td>
            <td>
              <div style="display: flex; align-items: center; gap: 0.5rem;">
                <div class="progress-bar" style="flex: 1; height: 0.375rem;">
                  <div class="progress-fill" style="width: ${score * 100}%"></div>
                </div>
                <span>${(score * 100).toFixed(0)}%</span>
              </div>
            </td>
          </tr>
        `)
        .join('')
    : '';

  return `
    <div class="card">
      <h2>Quality Assessment</h2>
      <div class="metric-grid">
        <div class="metric-item">
          <div class="metric-label">Overall Score</div>
          <div class="metric-value">${(quality.overallScore * 100).toFixed(1)}%</div>
          <div class="progress-bar">
            <div class="progress-fill" style="width: ${quality.overallScore * 100}%"></div>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Status</div>
          <div class="metric-value">
            <span class="status-badge ${quality.passed ? 'status-completed' : 'status-failed'}">
              ${quality.passed ? 'Passed' : 'Failed'}
            </span>
          </div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Tasks Passed</div>
          <div class="metric-value">${quality.passedCount} / ${quality.taskCount}</div>
        </div>
        <div class="metric-item">
          <div class="metric-label">Pass Rate</div>
          <div class="metric-value">${quality.passRate.toFixed(1)}%</div>
        </div>
      </div>
      ${dimensionRows ? `
      <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1rem;">Dimension Scores</h3>
      <table>
        <tbody>
          ${dimensionRows}
        </tbody>
      </table>
      ` : ''}
      ${quality.commonFailures?.length > 0 ? `
      <h3 style="margin-top: 1.5rem; margin-bottom: 0.5rem; font-size: 1rem;">Common Failures</h3>
      <ul style="padding-left: 1.5rem;">
        ${quality.commonFailures.map((f) => `<li>${f}</li>`).join('')}
      </ul>
      ` : ''}
    </div>
  `;
}

/**
 * Generate traces section
 * @param {object} traces
 * @returns {string}
 */
function generateTracesSection(traces) {
  if (!traces.events || traces.events.length === 0) return '';

  // Show first 20 events
  const events = traces.events.slice(0, 20);
  const startTime = events[0]?.timestamp || 0;

  const timelineItems = events
    .map((event) => `
      <div class="timeline-item">
        <div class="timeline-time">${((event.timestamp - startTime) / 1000).toFixed(3)}s</div>
        <div class="timeline-event">${event.eventType}</div>
        ${event.taskId ? `<div style="font-size: 0.75rem; color: var(--text-muted);">Task: ${event.taskId}</div>` : ''}
      </div>
    `)
    .join('');

  return `
    <div class="card">
      <h2>Execution Timeline</h2>
      <p style="margin-bottom: 1rem; color: var(--text-muted);">
        ${traces.eventCount} events, ${traces.spanCount} spans
        ${traces.eventCount > 20 ? ' (showing first 20)' : ''}
      </p>
      <div class="timeline">
        ${timelineItems}
      </div>
    </div>
  `;
}

// =============================================================================
// HTML REPORT MODULE
// =============================================================================

/**
 * @typedef {Object} HTMLReportConfig
 * @property {string} implementation - Which reporter to use
 * @property {string} [outputPath] - Path to write reports
 * @property {boolean} [includeTraces] - Include trace timeline
 */

/**
 * Creates an HTML report module
 * @returns {import('../../types/module.js').Module<HTMLReportConfig, import('./json-report.js').ReportInput, import('./json-report.js').ReportOutput>}
 */
export function createHTMLReportGenerator() {
  /** @type {HTMLReportConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();

  return {
    id: 'report-html',
    version: '1.0.0',
    type: 'report',

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('HTMLReportGenerator not configured');
      }

      const startTime = Date.now();

      try {
        // Build the report data structure
        /** @type {import('./json-report.js').WorkflowReport} */
        const reportData = {
          runId: input.runId,
          generatedAt: Date.now(),
          version: '1.0.0',
          summary: {
            runId: input.runId,
            status: 'completed',
            duration: 0,
            taskCount: 0,
            successRate: 0,
            totalCost: 0,
            qualityScore: 0,
          },
        };

        // Add metrics
        if (input.metricsSnapshot) {
          reportData.metrics = {
            computed: input.metricsSnapshot.metrics,
            timestamp: input.metricsSnapshot.timestamp,
          };
          reportData.summary.successRate = input.metricsSnapshot.metrics?.task_completion_rate || 0;
        }

        // Add costs
        if (input.costStatus) {
          reportData.costs = {
            total: input.costStatus.totalCost,
            inputTokens: input.costStatus.totalInputTokens,
            outputTokens: input.costStatus.totalOutputTokens,
            budgetLimit: input.costStatus.budgetLimit,
            budgetRemaining: input.costStatus.budgetRemaining,
            byModel: input.costStatus.byModel,
            byWorker: input.costStatus.byWorker,
          };
          reportData.summary.totalCost = input.costStatus.totalCost;
        }

        // Add quality
        if (input.qualityReport) {
          reportData.quality = {
            overallScore: input.qualityReport.overallScore,
            passed: input.qualityReport.passed,
            taskCount: input.qualityReport.taskCount,
            passedCount: input.qualityReport.passedCount,
            passRate: input.qualityReport.passRate,
            dimensionAverages: input.qualityReport.dimensionAverages,
            byWorker: input.qualityReport.byWorker,
            commonFailures: input.qualityReport.commonFailures,
          };
          reportData.summary.qualityScore = input.qualityReport.overallScore;
          reportData.summary.taskCount = input.qualityReport.taskCount;
        }

        // Add traces
        if (input.traceData && config.includeTraces) {
          reportData.traces = {
            eventCount: input.traceData.events.length,
            spanCount: input.traceData.spans.length,
            events: input.traceData.events,
            spans: input.traceData.spans,
          };

          // Calculate duration from trace events
          const events = input.traceData.events;
          const startEvent = events.find((e) => e.eventType === 'workflow.started');
          const endEvent = events.find(
            (e) => e.eventType === 'workflow.completed' || e.eventType === 'workflow.failed'
          );
          if (startEvent && endEvent) {
            reportData.summary.duration = endEvent.timestamp - startEvent.timestamp;
          }
        }

        // Generate HTML
        const html = generateHTML(reportData);

        // Export to file if configured
        if (config.outputPath && input.operation === 'export') {
          const filePath = join(config.outputPath, `report-${input.runId}.html`);
          await mkdir(dirname(filePath), { recursive: true });
          await writeFile(filePath, html);

          context.emit({
            timestamp: Date.now(),
            runId: input.runId,
            eventType: 'report.html.exported',
            moduleId: 'report-html',
            payload: { filePath },
            level: LogLevel.INFO,
          });

          metrics.executionCount++;
          metrics.totalDuration += Date.now() - startTime;

          return { success: true, report: reportData, filePath };
        }

        context.emit({
          timestamp: Date.now(),
          runId: input.runId,
          eventType: 'report.html.generated',
          moduleId: 'report-html',
          payload: {},
          level: LogLevel.INFO,
        });

        metrics.executionCount++;
        metrics.totalDuration += Date.now() - startTime;

        return { success: true, report: reportData };
      } catch (error) {
        metrics.errorCount++;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      metrics = createModuleMetrics();
    },
  };
}

/**
 * Register HTML report generator
 */
export function registerHTMLReportGenerator() {
  // Using globalRegistry when available
}

// Auto-register on import
registerHTMLReportGenerator();
