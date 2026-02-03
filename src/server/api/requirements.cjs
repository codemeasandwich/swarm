/**
 * @fileoverview Requirements API Endpoint
 *
 * Generates clarifying questions and processes answers
 * to build structured requirements.
 *
 * @module server/api/requirements
 */

const scribbles = require('scribbles');

/**
 * Question templates by category
 * @type {Object}
 */
const QUESTION_TEMPLATES = {
  scope: [
    {
      question: 'What is the expected scope of this feature?',
      type: 'select',
      options: ['Small (1-2 files)', 'Medium (3-5 files)', 'Large (6+ files)', 'Not sure'],
      triggers: ['feature', 'add', 'implement', 'create', 'build'],
    },
    {
      question: 'Should this feature include tests?',
      type: 'select',
      options: ['Yes, with full coverage', 'Yes, basic tests only', 'No tests needed'],
      triggers: ['feature', 'add', 'implement'],
    },
  ],
  target: [
    {
      question: 'Who is the primary user of this feature?',
      type: 'select',
      options: ['End users', 'Developers', 'Admins', 'All users'],
      triggers: ['user', 'feature', 'interface', 'ui'],
    },
  ],
  behavior: [
    {
      question: 'What should happen when an error occurs?',
      type: 'select',
      options: [
        'Show user-friendly message',
        'Log and continue',
        'Fail immediately',
        'Retry automatically',
      ],
      triggers: ['error', 'handle', 'catch', 'fail'],
    },
    {
      question: 'Should there be any rate limiting or throttling?',
      type: 'select',
      options: ['Yes', 'No', 'Not applicable'],
      triggers: ['api', 'endpoint', 'request', 'call'],
    },
  ],
  integration: [
    {
      question: 'Does this need to integrate with external services?',
      type: 'select',
      options: ['Yes', 'No', 'Maybe, need to investigate'],
      triggers: ['api', 'service', 'external', 'integrate', 'connect'],
    },
  ],
  data: [
    {
      question: 'What type of data storage is needed?',
      type: 'select',
      options: ['Database', 'File system', 'In-memory only', 'None'],
      triggers: ['store', 'save', 'persist', 'data', 'database'],
    },
    {
      question: 'Is this data sensitive or require encryption?',
      type: 'select',
      options: ['Yes, encrypt at rest', 'Yes, encrypt in transit', 'Both', 'No'],
      triggers: ['password', 'secret', 'sensitive', 'private', 'secure'],
    },
  ],
  ui: [
    {
      question: 'What UI components are needed?',
      type: 'select',
      options: ['Form/inputs', 'List/table', 'Modal/dialog', 'Dashboard/charts', 'None'],
      triggers: ['ui', 'interface', 'page', 'component', 'display', 'show'],
    },
    {
      question: 'Should this be responsive/mobile-friendly?',
      type: 'select',
      options: ['Yes', 'Desktop only', 'Mobile only'],
      triggers: ['ui', 'interface', 'page', 'responsive', 'mobile'],
    },
  ],
  performance: [
    {
      question: 'Are there specific performance requirements?',
      type: 'select',
      options: [
        'Yes, must be fast (<100ms)',
        'Standard performance is fine',
        'Can be slow, correctness matters more',
      ],
      triggers: ['performance', 'fast', 'quick', 'speed', 'optimize'],
    },
  ],
};

/**
 * Requirements endpoint handler
 *
 * @param {Object} data - Request data
 * @param {string} data.action - Action to perform
 * @returns {Object} Response data
 */
module.exports = function requirements(data) {
  const { action } = data;

  switch (action) {
    case 'generateQuestions':
      return generateQuestions(data.description, data.projectPath);

    case 'submitAnswers':
      return processAnswers(data.description, data.answers);

    case 'getRequirements':
      return getStructuredRequirements(data.description, data.answers);

    default:
      return { error: `Unknown action: ${action}` };
  }
};

/**
 * Generate clarifying questions based on description
 *
 * @param {string} description - Feature description
 * @param {string} projectPath - Project path for context
 * @returns {Object} Generated questions
 */
function generateQuestions(description, _projectPath) {
  const lowerDesc = description.toLowerCase();
  const questions = [];
  const usedCategories = new Set();

  // Analyze description and select relevant questions
  for (const [category, templates] of Object.entries(QUESTION_TEMPLATES)) {
    if (usedCategories.has(category)) continue;

    for (const template of templates) {
      const hasMatch = template.triggers.some((trigger) => lowerDesc.includes(trigger));

      if (hasMatch && !usedCategories.has(category)) {
        questions.push({
          id: `q-${category}-${questions.length}`,
          category,
          question: template.question,
          type: template.type,
          options: template.options,
        });
        usedCategories.add(category);
        break; // Only one question per category
      }
    }
  }

  // Always include scope question if not already added
  if (!usedCategories.has('scope')) {
    questions.unshift({
      id: 'q-scope-0',
      category: 'scope',
      question: 'What is the expected scope of this change?',
      type: 'select',
      options: ['Small (1-2 files)', 'Medium (3-5 files)', 'Large (6+ files)', 'Not sure'],
    });
  }

  // Add a freeform question for anything we missed
  questions.push({
    id: 'q-additional',
    category: 'additional',
    question: 'Is there anything else we should know?',
    type: 'text',
    placeholder: 'Any constraints, preferences, or context...',
  });

  scribbles.log(`Generated ${questions.length} questions for description`);

  return { questions };
}

/**
 * Process user answers
 *
 * @param {string} description - Original description
 * @param {Object} answers - User answers keyed by question index
 * @returns {Object} Processed result
 */
function processAnswers(description, answers) {
  // Validate answers
  const processed = {
    scope: 'medium',
    includeTests: true,
    targetUser: 'developers',
    additionalNotes: '',
  };

  // Map answers to structured data
  for (const [_key, value] of Object.entries(answers)) {
    if (value.includes('Small')) processed.scope = 'small';
    else if (value.includes('Large')) processed.scope = 'large';

    if (value.includes('No tests')) processed.includeTests = false;
    if (value.includes('End users')) processed.targetUser = 'end-users';
    if (value.includes('Admins')) processed.targetUser = 'admins';

    // Capture freeform text
    if (!value.match(/^\[.*\]$/) && value.length > 10) {
      processed.additionalNotes += value + ' ';
    }
  }

  return {
    success: true,
    processed,
  };
}

/**
 * Build structured requirements from description and answers
 *
 * @param {string} description - Feature description
 * @param {Object} answers - User answers
 * @returns {Object} Structured requirements
 */
function getStructuredRequirements(description, answers) {
  const processed = processAnswers(description, answers).processed;

  return {
    requirements: {
      summary: description,
      scope: processed.scope,
      includeTests: processed.includeTests,
      targetUser: processed.targetUser,
      additionalNotes: processed.additionalNotes.trim(),
      constraints: extractConstraints(description),
      acceptanceCriteria: generateAcceptanceCriteria(description),
    },
  };
}

/**
 * Extract constraints from description
 *
 * @param {string} description - Feature description
 * @returns {Array} Identified constraints
 */
function extractConstraints(description) {
  const constraints = [];
  const lower = description.toLowerCase();

  if (lower.includes('must') || lower.includes('required')) {
    const mustMatches = description.match(/must\s+[^.!?\n]+/gi) || [];
    constraints.push(...mustMatches.map((m) => m.trim()));
  }

  if (lower.includes("shouldn't") || lower.includes('should not') || lower.includes('must not')) {
    constraints.push('Has negative constraints - review carefully');
  }

  return constraints;
}

/**
 * Generate acceptance criteria from description
 *
 * @param {string} description - Feature description
 * @returns {Array} Acceptance criteria
 */
function generateAcceptanceCriteria(description) {
  const criteria = [];

  // Basic criteria that apply to most features
  criteria.push('Feature works as described');
  criteria.push('No regressions in existing functionality');

  // Add based on keywords
  if (description.toLowerCase().includes('error')) {
    criteria.push('Error cases are handled gracefully');
  }

  if (description.toLowerCase().includes('user') || description.toLowerCase().includes('ui')) {
    criteria.push('UI is intuitive and accessible');
  }

  if (description.toLowerCase().includes('performance')) {
    criteria.push('Performance meets requirements');
  }

  return criteria;
}
