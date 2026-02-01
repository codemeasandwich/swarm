/**
 * SWARM Framework - Tracer Module
 * Re-exports tracer functionality
 * @module swarm/measurement/tracer
 */

export {
  TraceStore,
  createJSONTracer,
  createTracerModule,
  registerTracers,
} from './json-tracer.js';
