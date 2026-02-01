/**
 * SWARM Framework - Tasks Module
 * Re-exports task corpus management
 * @module swarm/experiment/tasks
 */

export {
  // Types
  corpusStore,
  // Creation
  createCorpus,
  registerCorpus,
  getCorpus,
  getAllCorpora,
  // Utilities
  mergeCorpora,
  filterBySkills,
  filterByDomain,
  sampleTasks,
  splitCorpus,
  // Built-in
  createCodeGenCorpus,
  createCodeReviewCorpus,
  registerBuiltinCorpora,
} from './corpus.js';
