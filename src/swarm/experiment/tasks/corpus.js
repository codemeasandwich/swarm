/**
 * SWARM Framework - Task Corpus
 * Manages standardized task sets for experiments
 * @module swarm/experiment/tasks/corpus
 */

import { createTaskDefinition } from '../../types/task.js';
import { Skill, Domain } from '../../types/foundation.js';

// =============================================================================
// CORPUS TYPES
// =============================================================================

/**
 * @typedef {Object} TaskCorpus
 * @property {string} id - Unique corpus ID
 * @property {string} name - Human-readable name
 * @property {string} description - Corpus description
 * @property {import('../../types/task.js').TaskDefinition[]} tasks - Tasks in corpus
 * @property {string[]} tags - Categorization tags
 * @property {CorpusMetadata} metadata - Corpus metadata
 */

/**
 * @typedef {Object} CorpusMetadata
 * @property {number} taskCount - Number of tasks
 * @property {number} estimatedDuration - Estimated total duration in seconds
 * @property {string[]} requiredSkills - Skills needed
 * @property {string[]} requiredDomains - Domains covered
 * @property {'easy' | 'medium' | 'hard' | 'mixed'} difficulty - Difficulty level
 */

// =============================================================================
// CORPUS STORE
// =============================================================================

/**
 * In-memory corpus store
 */
class CorpusStore {
  constructor() {
    /** @type {Map<string, TaskCorpus>} */
    this.corpora = new Map();
  }

  /**
   * Register a corpus
   * @param {TaskCorpus} corpus
   */
  register(corpus) {
    this.corpora.set(corpus.id, corpus);
  }

  /**
   * Get corpus by ID
   * @param {string} id
   * @returns {TaskCorpus | undefined}
   */
  get(id) {
    return this.corpora.get(id);
  }

  /**
   * Get all corpora
   * @returns {TaskCorpus[]}
   */
  getAll() {
    return [...this.corpora.values()];
  }

  /**
   * Find corpora by tags
   * @param {string[]} tags
   * @returns {TaskCorpus[]}
   */
  findByTags(tags) {
    return [...this.corpora.values()].filter((corpus) =>
      tags.some((tag) => corpus.tags.includes(tag))
    );
  }

  /**
   * Find corpora by difficulty
   * @param {'easy' | 'medium' | 'hard' | 'mixed'} difficulty
   * @returns {TaskCorpus[]}
   */
  findByDifficulty(difficulty) {
    return [...this.corpora.values()].filter((corpus) => corpus.metadata.difficulty === difficulty);
  }

  /**
   * Clear all corpora
   */
  clear() {
    this.corpora.clear();
  }
}

/** @type {CorpusStore} */
export const corpusStore = new CorpusStore();

// =============================================================================
// CORPUS CREATION
// =============================================================================

/**
 * Create a task corpus
 * @param {Partial<TaskCorpus>} overrides
 * @returns {TaskCorpus}
 */
export function createCorpus(overrides = {}) {
  const tasks = overrides.tasks || [];

  // Calculate metadata from tasks
  const requiredSkills = new Set();
  const requiredDomains = new Set();
  let estimatedDuration = 0;

  for (const task of tasks) {
    if (task.requirements?.skills) {
      task.requirements.skills.forEach((s) => requiredSkills.add(s));
    }
    if (task.requirements?.domain) {
      requiredDomains.add(task.requirements.domain);
    }
    if (task.timeout) {
      estimatedDuration += task.timeout;
    }
  }

  return {
    id: `corpus-${Date.now()}`,
    name: 'Unnamed Corpus',
    description: '',
    tasks,
    tags: [],
    metadata: {
      taskCount: tasks.length,
      estimatedDuration,
      requiredSkills: [...requiredSkills],
      requiredDomains: [...requiredDomains],
      difficulty: 'medium',
    },
    ...overrides,
  };
}

/**
 * Register a corpus in the global store
 * @param {TaskCorpus} corpus
 */
export function registerCorpus(corpus) {
  corpusStore.register(corpus);
}

/**
 * Get corpus by ID
 * @param {string} id
 * @returns {TaskCorpus | undefined}
 */
export function getCorpus(id) {
  return corpusStore.get(id);
}

/**
 * Get all registered corpora
 * @returns {TaskCorpus[]}
 */
export function getAllCorpora() {
  return corpusStore.getAll();
}

// =============================================================================
// CORPUS UTILITIES
// =============================================================================

/**
 * Merge multiple corpora into one
 * @param {TaskCorpus[]} corpora
 * @param {string} name - Name for merged corpus
 * @returns {TaskCorpus}
 */
export function mergeCorpora(corpora, name) {
  const allTasks = corpora.flatMap((c) => c.tasks);
  const allTags = [...new Set(corpora.flatMap((c) => c.tags))];

  return createCorpus({
    name,
    description: `Merged from: ${corpora.map((c) => c.name).join(', ')}`,
    tasks: allTasks,
    tags: allTags,
  });
}

/**
 * Filter corpus tasks by skill
 * @param {TaskCorpus} corpus
 * @param {string[]} skills
 * @returns {TaskCorpus}
 */
export function filterBySkills(corpus, skills) {
  const filtered = corpus.tasks.filter(
    (task) =>
      task.requirements?.skills && task.requirements.skills.some((s) => skills.includes(s))
  );

  return createCorpus({
    ...corpus,
    id: `${corpus.id}-filtered`,
    name: `${corpus.name} (filtered by skills)`,
    tasks: filtered,
  });
}

/**
 * Filter corpus tasks by domain
 * @param {TaskCorpus} corpus
 * @param {string} domain
 * @returns {TaskCorpus}
 */
export function filterByDomain(corpus, domain) {
  const filtered = corpus.tasks.filter((task) => task.requirements?.domain === domain);

  return createCorpus({
    ...corpus,
    id: `${corpus.id}-filtered`,
    name: `${corpus.name} (filtered by domain)`,
    tasks: filtered,
  });
}

/**
 * Sample tasks from corpus
 * @param {TaskCorpus} corpus
 * @param {number} count - Number of tasks to sample
 * @param {number} [seed] - Random seed for reproducibility
 * @returns {TaskCorpus}
 */
export function sampleTasks(corpus, count, seed = Date.now()) {
  if (count >= corpus.tasks.length) {
    return corpus;
  }

  // Seeded random
  const random = seedRandom(seed);
  const shuffled = [...corpus.tasks].sort(() => random() - 0.5);
  const sampled = shuffled.slice(0, count);

  return createCorpus({
    ...corpus,
    id: `${corpus.id}-sample-${count}`,
    name: `${corpus.name} (sample of ${count})`,
    tasks: sampled,
  });
}

/**
 * Seeded random number generator
 * @param {number} seed
 * @returns {() => number}
 */
function seedRandom(seed) {
  return function () {
    seed = (seed * 1103515245 + 12345) & 0x7fffffff;
    return seed / 0x7fffffff;
  };
}

/**
 * Split corpus into training and test sets
 * @param {TaskCorpus} corpus
 * @param {number} trainRatio - Ratio for training (0-1)
 * @param {number} [seed]
 * @returns {{train: TaskCorpus, test: TaskCorpus}}
 */
export function splitCorpus(corpus, trainRatio, seed = Date.now()) {
  const random = seedRandom(seed);
  const shuffled = [...corpus.tasks].sort(() => random() - 0.5);
  const splitIndex = Math.floor(shuffled.length * trainRatio);

  const trainTasks = shuffled.slice(0, splitIndex);
  const testTasks = shuffled.slice(splitIndex);

  return {
    train: createCorpus({
      ...corpus,
      id: `${corpus.id}-train`,
      name: `${corpus.name} (training)`,
      tasks: trainTasks,
    }),
    test: createCorpus({
      ...corpus,
      id: `${corpus.id}-test`,
      name: `${corpus.name} (test)`,
      tasks: testTasks,
    }),
  };
}

// =============================================================================
// BUILT-IN CORPORA
// =============================================================================

/**
 * Create the built-in code generation corpus
 * @returns {TaskCorpus}
 */
export function createCodeGenCorpus() {
  return createCorpus({
    id: 'builtin-codegen',
    name: 'Code Generation Benchmark',
    description: 'Standard tasks for evaluating code generation capabilities',
    tags: ['builtin', 'codegen', 'benchmark'],
    metadata: {
      taskCount: 5,
      estimatedDuration: 300,
      requiredSkills: [Skill.CODE_GENERATION, Skill.TEST_WRITING],
      requiredDomains: [Domain.WEB_DEVELOPMENT],
      difficulty: 'medium',
    },
    tasks: [
      createTaskDefinition({
        id: 'codegen-001',
        name: 'Implement FizzBuzz function',
        description:
          'Create a function that prints numbers 1 to n, replacing multiples of 3 with "Fizz", multiples of 5 with "Buzz", and multiples of both with "FizzBuzz"',
        requirements: {
          skills: [Skill.CODE_GENERATION],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Function exists', type: 'test', required: true },
          { id: 'ac-2', description: 'Handles edge cases', type: 'test', required: true },
        ],
        timeout: 60,
      }),
      createTaskDefinition({
        id: 'codegen-002',
        name: 'Implement binary search',
        description: 'Create a binary search function that returns the index of a target in a sorted array',
        requirements: {
          skills: [Skill.CODE_GENERATION],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Returns correct index', type: 'test', required: true },
          { id: 'ac-2', description: 'Returns -1 if not found', type: 'test', required: true },
        ],
        timeout: 60,
      }),
      createTaskDefinition({
        id: 'codegen-003',
        name: 'Implement deep clone',
        description: 'Create a function that deep clones an object, handling nested objects and arrays',
        requirements: {
          skills: [Skill.CODE_GENERATION],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Clones nested objects', type: 'test', required: true },
          { id: 'ac-2', description: 'Clones arrays', type: 'test', required: true },
        ],
        timeout: 60,
      }),
      createTaskDefinition({
        id: 'codegen-004',
        name: 'Implement debounce function',
        description: 'Create a debounce function that delays invoking a function until after a wait period',
        requirements: {
          skills: [Skill.CODE_GENERATION],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Delays execution', type: 'test', required: true },
          { id: 'ac-2', description: 'Cancels previous calls', type: 'test', required: true },
        ],
        timeout: 60,
      }),
      createTaskDefinition({
        id: 'codegen-005',
        name: 'Implement LRU cache',
        description: 'Create an LRU (Least Recently Used) cache with get and set operations',
        requirements: {
          skills: [Skill.CODE_GENERATION],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Get returns cached value', type: 'test', required: true },
          { id: 'ac-2', description: 'Evicts LRU item when full', type: 'test', required: true },
        ],
        timeout: 60,
      }),
    ],
  });
}

/**
 * Create the built-in code review corpus
 * @returns {TaskCorpus}
 */
export function createCodeReviewCorpus() {
  return createCorpus({
    id: 'builtin-codereview',
    name: 'Code Review Benchmark',
    description: 'Standard tasks for evaluating code review capabilities',
    tags: ['builtin', 'codereview', 'benchmark'],
    metadata: {
      taskCount: 3,
      estimatedDuration: 180,
      requiredSkills: [Skill.CODE_REVIEW, Skill.SECURITY_ANALYSIS],
      requiredDomains: [Domain.WEB_DEVELOPMENT],
      difficulty: 'medium',
    },
    tasks: [
      createTaskDefinition({
        id: 'review-001',
        name: 'Review SQL query handling',
        description: 'Review code for SQL injection vulnerabilities',
        requirements: {
          skills: [Skill.CODE_REVIEW, Skill.SECURITY_ANALYSIS],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Identifies vulnerabilities', type: 'llm-eval', required: true },
          { id: 'ac-2', description: 'Suggests fixes', type: 'llm-eval', required: true },
        ],
        timeout: 60,
      }),
      createTaskDefinition({
        id: 'review-002',
        name: 'Review authentication flow',
        description: 'Review authentication implementation for security issues',
        requirements: {
          skills: [Skill.CODE_REVIEW, Skill.SECURITY_ANALYSIS],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Identifies security issues', type: 'llm-eval', required: true },
        ],
        timeout: 60,
      }),
      createTaskDefinition({
        id: 'review-003',
        name: 'Review error handling',
        description: 'Review error handling patterns for completeness',
        requirements: {
          skills: [Skill.CODE_REVIEW],
          domain: Domain.WEB_DEVELOPMENT,
        },
        acceptanceCriteria: [
          { id: 'ac-1', description: 'Identifies missing handlers', type: 'llm-eval', required: true },
        ],
        timeout: 60,
      }),
    ],
  });
}

/**
 * Register all built-in corpora
 */
export function registerBuiltinCorpora() {
  registerCorpus(createCodeGenCorpus());
  registerCorpus(createCodeReviewCorpus());
}
