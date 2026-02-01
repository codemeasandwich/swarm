/**
 * SWARM Framework - JSON Tracer
 * Captures and exports execution traces to JSON
 * @module swarm/measurement/tracer/json-tracer
 */

import { writeFile, mkdir } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { ModuleType, createModuleMetrics } from '../../types/module.js';
import { globalRegistry } from '../../registry/module-registry.js';
import { createTraceEvent, createTraceSpan, TraceEventType, LogLevel } from '../../types/trace.js';

// =============================================================================
// TRACER CONFIG
// =============================================================================

/**
 * @typedef {Object} TracerConfig
 * @property {string} implementation - Which tracer to use
 * @property {string} [outputPath] - Path to write trace files
 * @property {import('../../types/trace.js').TraceEventTypeValue[]} [filterEvents] - Only capture these events
 * @property {import('../../types/trace.js').LogLevelType} [minLevel] - Minimum log level to capture
 * @property {boolean} [includePayloads] - Include full payloads (default: true)
 * @property {boolean} [includeSpans] - Track spans (default: true)
 */

/**
 * @typedef {Object} TracerInput
 * @property {string} operation - 'record' | 'startSpan' | 'endSpan' | 'export' | 'clear'
 * @property {string} runId - Workflow run ID
 * @property {import('../../types/trace.js').TraceEvent} [event] - Event to record
 * @property {string} [spanName] - Span name for startSpan
 * @property {string} [spanId] - Span ID for endSpan
 * @property {string} [parentSpanId] - Parent span for nested spans
 * @property {Record<string, unknown>} [attributes] - Span attributes
 */

/**
 * @typedef {Object} TracerOutput
 * @property {boolean} success - Whether operation succeeded
 * @property {string} [spanId] - Created span ID (for startSpan)
 * @property {string} [filePath] - Export file path (for export)
 * @property {import('../../types/trace.js').TraceEvent[]} [events] - Events (for export)
 * @property {import('../../types/trace.js').TraceSpan[]} [spans] - Spans (for export)
 */

// =============================================================================
// TRACE STORE
// =============================================================================

/**
 * Stores trace data for a workflow run
 */
export class TraceStore {
  /**
   * @param {string} runId
   */
  constructor(runId) {
    /** @type {string} */
    this.runId = runId;
    /** @type {import('../../types/trace.js').TraceEvent[]} */
    this.events = [];
    /** @type {Map<string, import('../../types/trace.js').TraceSpan>} */
    this.spans = new Map();
    /** @type {import('../../types/trace.js').TraceSpan | null} */
    this.activeSpan = null;
    /** @type {number} */
    this.startTime = Date.now();
  }

  /**
   * Record an event
   * @param {import('../../types/trace.js').TraceEvent} event
   */
  recordEvent(event) {
    const enrichedEvent = {
      ...event,
      runId: this.runId,
    };
    this.events.push(enrichedEvent);

    // Add to active span if any
    if (this.activeSpan) {
      this.activeSpan.events.push(enrichedEvent);
    }
  }

  /**
   * Start a new span
   * @param {string} name
   * @param {string} [parentId]
   * @param {Record<string, unknown>} [attributes]
   * @returns {import('../../types/trace.js').TraceSpan}
   */
  startSpan(name, parentId, attributes = {}) {
    const span = createTraceSpan(name, {
      parentId,
      attributes: {
        runId: this.runId,
        ...attributes,
      },
    });
    this.spans.set(span.id, span);
    this.activeSpan = span;
    return span;
  }

  /**
   * End a span
   * @param {string} spanId
   * @returns {import('../../types/trace.js').TraceSpan | undefined}
   */
  endSpan(spanId) {
    const span = this.spans.get(spanId);
    if (span) {
      span.endTime = Date.now();
      if (this.activeSpan?.id === spanId) {
        // Find parent span if any
        this.activeSpan = span.parentId ? this.spans.get(span.parentId) || null : null;
      }
    }
    return span;
  }

  /**
   * Get all events
   * @returns {import('../../types/trace.js').TraceEvent[]}
   */
  getEvents() {
    return [...this.events];
  }

  /**
   * Get all spans
   * @returns {import('../../types/trace.js').TraceSpan[]}
   */
  getSpans() {
    return Array.from(this.spans.values());
  }

  /**
   * Export trace data
   * @returns {{runId: string, startTime: number, endTime: number, events: import('../../types/trace.js').TraceEvent[], spans: import('../../types/trace.js').TraceSpan[]}}
   */
  export() {
    return {
      runId: this.runId,
      startTime: this.startTime,
      endTime: Date.now(),
      events: this.getEvents(),
      spans: this.getSpans(),
    };
  }

  /**
   * Clear all data
   */
  clear() {
    this.events = [];
    this.spans.clear();
    this.activeSpan = null;
  }
}

// =============================================================================
// LOG LEVEL ORDERING
// =============================================================================

const LOG_LEVEL_ORDER = {
  [LogLevel.DEBUG]: 0,
  [LogLevel.INFO]: 1,
  [LogLevel.WARN]: 2,
  [LogLevel.ERROR]: 3,
};

/**
 * Check if event level meets minimum
 * @param {import('../../types/trace.js').LogLevelType} eventLevel
 * @param {import('../../types/trace.js').LogLevelType} minLevel
 * @returns {boolean}
 */
function meetsMinLevel(eventLevel, minLevel) {
  return LOG_LEVEL_ORDER[eventLevel] >= LOG_LEVEL_ORDER[minLevel];
}

// =============================================================================
// JSON TRACER MODULE
// =============================================================================

/**
 * Creates a JSON tracer module
 * @returns {import('../../types/module.js').Module<TracerConfig, TracerInput, TracerOutput>}
 */
export function createJSONTracer() {
  /** @type {TracerConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  /** @type {Map<string, TraceStore>} */
  const stores = new Map();

  /**
   * Get or create store for run
   * @param {string} runId
   * @returns {TraceStore}
   */
  function getStore(runId) {
    if (!stores.has(runId)) {
      stores.set(runId, new TraceStore(runId));
    }
    return stores.get(runId);
  }

  /**
   * Check if event should be recorded
   * @param {import('../../types/trace.js').TraceEvent} event
   * @returns {boolean}
   */
  function shouldRecord(event) {
    // Check event type filter
    if (config?.filterEvents && config.filterEvents.length > 0) {
      if (!config.filterEvents.includes(event.eventType)) {
        return false;
      }
    }

    // Check minimum level
    if (config?.minLevel) {
      if (!meetsMinLevel(event.level || LogLevel.INFO, config.minLevel)) {
        return false;
      }
    }

    return true;
  }

  return {
    id: 'tracer-json',
    version: '1.0.0',
    type: ModuleType.TRACER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Tracer not configured');
      }

      const startTime = Date.now();
      const store = getStore(input.runId);

      try {
        switch (input.operation) {
          case 'record': {
            if (!input.event) {
              return { success: false };
            }

            if (!shouldRecord(input.event)) {
              return { success: true }; // Filtered out, but not an error
            }

            // Strip payloads if configured
            const event = config.includePayloads === false
              ? { ...input.event, payload: {} }
              : input.event;

            store.recordEvent(event);

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'trace.recorded',
              moduleId: 'tracer-json',
              payload: { eventType: event.eventType },
              level: LogLevel.DEBUG,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return { success: true };
          }

          case 'startSpan': {
            if (!config.includeSpans) {
              return { success: false };
            }

            const span = store.startSpan(
              input.spanName || 'unnamed',
              input.parentSpanId,
              input.attributes
            );

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'trace.span.started',
              moduleId: 'tracer-json',
              payload: { spanId: span.id, spanName: span.name },
              level: LogLevel.DEBUG,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return { success: true, spanId: span.id };
          }

          case 'endSpan': {
            if (!input.spanId) {
              return { success: false };
            }

            const span = store.endSpan(input.spanId);

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'trace.span.ended',
              moduleId: 'tracer-json',
              payload: {
                spanId: input.spanId,
                duration: span ? span.endTime - span.startTime : 0,
              },
              level: LogLevel.DEBUG,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return { success: true };
          }

          case 'export': {
            const data = store.export();

            if (config.outputPath) {
              const filePath = join(config.outputPath, `trace-${input.runId}.json`);
              await mkdir(dirname(filePath), { recursive: true });
              await writeFile(filePath, JSON.stringify(data, null, 2));

              context.emit({
                timestamp: Date.now(),
                runId: input.runId,
                eventType: 'trace.exported',
                moduleId: 'tracer-json',
                payload: { filePath, eventCount: data.events.length },
                level: LogLevel.INFO,
              });

              metrics.executionCount++;
              metrics.totalDuration += Date.now() - startTime;
              return {
                success: true,
                filePath,
                events: data.events,
                spans: data.spans,
              };
            }

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return {
              success: true,
              events: data.events,
              spans: data.spans,
            };
          }

          case 'clear': {
            store.clear();
            stores.delete(input.runId);

            context.emit({
              timestamp: Date.now(),
              runId: input.runId,
              eventType: 'trace.cleared',
              moduleId: 'tracer-json',
              payload: {},
              level: LogLevel.DEBUG,
            });

            metrics.executionCount++;
            metrics.totalDuration += Date.now() - startTime;
            return { success: true };
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
      stores.clear();
      metrics = createModuleMetrics();
    },

    // Additional methods for direct access
    getStore,
    getEvents(runId) {
      const store = stores.get(runId);
      return store ? store.getEvents() : [];
    },
    getSpans(runId) {
      const store = stores.get(runId);
      return store ? store.getSpans() : [];
    },
  };
}

// =============================================================================
// MODULE FACTORY
// =============================================================================

/**
 * Create a custom tracer module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: TracerInput, config: TracerConfig, context: import('../../types/workflow.js').ExecutionContext, store: TraceStore) => Promise<TracerOutput>} traceFn
 * @returns {import('../../types/module.js').Module<TracerConfig, TracerInput, TracerOutput>}
 */
export function createTracerModule(id, implementation, traceFn) {
  /** @type {TracerConfig | null} */
  let config = null;
  let metrics = createModuleMetrics();
  const store = new TraceStore('default');

  return {
    id,
    version: '1.0.0',
    type: ModuleType.TRACER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Tracer not configured');
      }

      const startTime = Date.now();
      try {
        const result = await traceFn(input, config, context, store);
        metrics.executionCount++;
        metrics.totalDuration += Date.now() - startTime;
        return result;
      } catch (error) {
        metrics.errorCount++;
        throw error;
      }
    },

    getMetrics() {
      return { ...metrics };
    },

    async reset() {
      store.clear();
      metrics = createModuleMetrics();
    },
  };
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register all tracer implementations
 */
export function registerTracers() {
  if (!globalRegistry.has(ModuleType.TRACER, 'json')) {
    globalRegistry.register(ModuleType.TRACER, 'json', createJSONTracer);
  }
}

// Auto-register on import
registerTracers();
