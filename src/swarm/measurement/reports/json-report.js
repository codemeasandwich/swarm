/**
 * SWARM Framework - JSON Report Generator
 * Generates JSON reports from measurement data
 * @module swarm/measurement/reports/json-report
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ModuleType, createModuleMetrics } from '../../types/module.js';
import { globalRegistry } from '../../registry/module-registry.js';
import { LogLevel } from '../../types/trace.js';

// =============================================================================
// REPORT CONFIG
// =============================================================================

/**
 * @typedef {Object} ReportConfig
 * @property {string} implementation - Which reporter to use
 * @property {string} [outputPath] - Path to write reports
 * @property {boolean} [includeRawData] - Include raw data points
 * @property {boolean} [includeTraces] - Include trace events
 * @property {boolean} [prettyPrint] - Pretty print JSON
 */

/**
 * @typedef {Object} ReportInput
 * @property {string} operation - 'generate' | 'export'
 * @property {string} runId - Workflow run ID
 * @property {import('../metrics/collector.js').MetricsSnapshot} [metricsSnapshot] - Metrics data
 * @property {{events: import('../../types/trace.js').TraceEvent[], spans: import('../../types/trace.js').TraceSpan[]}} [traceData] - Trace data
 * @property {import('../cost/tracker.js').CostStatus} [costStatus] - Cost data
 * @property {import('../quality/assessor.js').QualityReport} [qualityReport] - Quality data
 * @property {Record<string, unknown>} [customData] - Custom data to include
 */

/**
 * @typedef {Object} WorkflowReport
 * @property {string} runId - Workflow run ID
 * @property {number} generatedAt - Report generation timestamp
 * @property {string} version - Report format version
 * @property {object} summary - Executive summary
 * @property {object} [metrics] - Metrics data
 * @property {object} [traces] - Trace data
 * @property {object} [costs] - Cost data
 * @property {object} [quality] - Quality data
 * @property {Record<string, unknown>} [custom] - Custom data
 */

/**
 * @typedef {Object} ReportOutput
 * @property {boolean} success - Whether operation succeeded
 * @property {WorkflowReport} [report] - Generated report
 * @property {string} [filePath] - Export file path
 */

// =============================================================================
// REPORT GENERATION
// =============================================================================

/**
 * Generate executive summary from report data
 * @param {ReportInput} input
 * @returns {object}
 */
function generateSummary(input) {
  const summary = {
    runId: input.runId,
    status: 'completed',
    duration: 0,
    taskCount: 0,
    successRate: 0,
    totalCost: 0,
    qualityScore: 0,
  };

  if (input.metricsSnapshot?.metrics) {
    const m = input.metricsSnapshot.metrics;
    summary.successRate = m.task_completion_rate || 0;
    summary.taskCount = input.metricsSnapshot.rawData?.task_completion_rate?.length || 0;
  }

  if (input.costStatus) {
    summary.totalCost = input.costStatus.totalCost;
  }

  if (input.qualityReport) {
    summary.qualityScore = input.qualityReport.overallScore;
    summary.taskCount = summary.taskCount || input.qualityReport.taskCount;
    summary.successRate = summary.successRate || input.qualityReport.passRate;
  }

  if (input.traceData?.events?.length > 0) {
    const events = input.traceData.events;
    const startEvent = events.find((e) => e.eventType === 'workflow.started');
    const endEvent = events.find(
      (e) => e.eventType === 'workflow.completed' || e.eventType === 'workflow.failed'
    );
    if (startEvent && endEvent) {
      summary.duration = endEvent.timestamp - startEvent.timestamp;
    }
    if (endEvent?.eventType === 'workflow.failed') {
      summary.status = 'failed';
    }
  }

  return summary;
}

/**
 * Creates a JSON report module
 * @returns {import('../../types/module.js').Module<ReportConfig, ReportInput, ReportOutput>}
 */
export function createJSONReportGenerator() {
  /** @type {ReportConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();

  return {
    id: 'report-json',
    version: '1.0.0',
    type: ModuleType.METRICS_COLLECTOR, // Reports are part of metrics layer

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('ReportGenerator not configured');
      }

      const startTime = Date.now();

      try {
        switch (input.operation) {
          case 'generate': {
            /** @type {WorkflowReport} */
            const report = {
              runId: input.runId,
              generatedAt: Date.now(),
              version: '1.0.0',
              summary: generateSummary(input),
            };

            // Add metrics
            if (input.metricsSnapshot) {
              report.metrics = {
                computed: input.metricsSnapshot.metrics,
                timestamp: input.metricsSnapshot.timestamp,
              };
              if (config.includeRawData) {
                report.metrics.rawData = input.metricsSnapshot.rawData;
              }
            }

            // Add traces
            if (input.traceData && config.includeTraces) {
              report.traces = {
                eventCount: input.traceData.events.length,
                spanCount: input.traceData.spans.length,
                events: input.traceData.events,
                spans: input.traceData.spans,
              };
            }

            // Add costs
            if (input.costStatus) {
              report.costs = {
                total: input.costStatus.totalCost,
                inputTokens: input.costStatus.totalInputTokens,
                outputTokens: input.costStatus.totalOutputTokens,
                budgetLimit: input.costStatus.budgetLimit,
                budgetRemaining: input.costStatus.budgetRemaining,
                byModel: input.costStatus.byModel,
                byWorker: input.costStatus.byWorker,
              };
            }

            // Add quality
            if (input.qualityReport) {
              report.quality = {
                overallScore: input.qualityReport.overallScore,
                passed: input.qualityReport.passed,
                taskCount: input.qualityReport.taskCount,
                passedCount: input.qualityReport.passedCount,
                passRate: input.qualityReport.passRate,
                dimensionAverages: input.qualityReport.dimensionAverages,
                byWorker: input.qualityReport.byWorker,
                commonFailures: input.qualityReport.commonFailures,
              };
            }

            // Add custom data
            if (input.customData) {
              report.custom = input.customData;
            }

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'report.generated',
              moduleId: 'report-json',
              payload: { runId: input.runId },
              level: LogLevel.INFO,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;

            return { success: true, report };
          }

          case 'export': {
            // First generate the report
            const generateResult = await this.execute(
              { ...input, operation: 'generate' },
              context
            );

            if (!generateResult.success || !generateResult.report) {
              return { success: false };
            }

            const report = generateResult.report;

            // Export to file
            if (config.outputPath) {
              const filePath = join(config.outputPath, `report-${input.runId}.json`);
              await mkdir(dirname(filePath), { recursive: true });

              const jsonContent = config.prettyPrint
                ? JSON.stringify(report, null, 2)
                : JSON.stringify(report);

              await writeFile(filePath, jsonContent);

              context.emit({
                timestamp: Date.now(),
                runId: input.runId,
                eventType: 'report.exported',
                moduleId: 'report-json',
                payload: { filePath },
                level: LogLevel.INFO,
              });

              return { success: true, report, filePath };
            }

            return { success: true, report };
          }

          default:
            return { success: false };
        }
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

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register JSON report generator
 */
export function registerJSONReportGenerator() {
  // Note: Using a custom registry key since reports aren't a standard module type
  if (!globalRegistry.has(ModuleType.METRICS_COLLECTOR, 'json-report')) {
    globalRegistry.register(ModuleType.METRICS_COLLECTOR, 'json-report', createJSONReportGenerator);
  }
}

// Auto-register on import
registerJSONReportGenerator();
