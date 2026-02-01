/**
 * SWARM Framework - Reports Module
 * Re-exports report generators
 * @module swarm/measurement/reports
 */

export {
  createJSONReportGenerator,
  registerJSONReportGenerator,
} from './json-report.js';

export {
  createHTMLReportGenerator,
  registerHTMLReportGenerator,
} from './html-report.js';
