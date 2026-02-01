/**
 * SWARM Framework - Context Builder Module
 * Constructs minimum viable context for workers
 * @module swarm/execution/context
 */

import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';

/**
 * @typedef {import('../../types/module.js').ContextBuilderConfig} ContextBuilderConfig
 * @typedef {import('../../types/task.js').TaskDefinition} TaskDefinition
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 */

/**
 * @typedef {Object} ContextInput
 * @property {TaskDefinition} task - Task to build context for
 * @property {string[]} [files] - Relevant file contents
 * @property {string} [codebaseContext] - Broader codebase context
 * @property {string[]} [examples] - Example outputs
 * @property {string[]} [constraints] - Constraints and requirements
 * @property {string} [history] - Execution history
 */

/**
 * @typedef {Object} ContextOutput
 * @property {string} prompt - Built context prompt
 * @property {number} tokenCount - Estimated token count
 * @property {string[]} includedFiles - Files included in context
 * @property {boolean} truncated - Whether context was truncated
 */

// =============================================================================
// TOKEN ESTIMATION
// =============================================================================

/**
 * Estimate token count from text (simple word-based estimate)
 * Roughly 1 token = 4 characters for English text
 * @param {string} text
 * @returns {number}
 */
export function estimateTokens(text) {
  if (!text) return 0;
  return Math.ceil(text.length / 4);
}

/**
 * Truncate text to fit within token budget
 * @param {string} text
 * @param {number} maxTokens
 * @returns {{text: string, truncated: boolean}}
 */
export function truncateToTokens(text, maxTokens) {
  const currentTokens = estimateTokens(text);
  if (currentTokens <= maxTokens) {
    return { text, truncated: false };
  }

  // Truncate to approximate character count
  const maxChars = maxTokens * 4;
  const truncatedText = text.slice(0, maxChars) + '\n\n[... truncated ...]';
  return { text: truncatedText, truncated: true };
}

// =============================================================================
// CONTEXT BUILDER FACTORY
// =============================================================================

/**
 * Create a context builder module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: ContextInput, config: ContextBuilderConfig, context: ExecutionContext) => Promise<ContextOutput>} buildFn
 * @returns {import('../../types/module.js').Module<ContextBuilderConfig, ContextInput, ContextOutput>}
 */
export function createContextBuilder(id, implementation, buildFn) {
  /** @type {ContextBuilderConfig | null} */
  let config = null;

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.CONTEXT_BUILDER,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Context builder not configured');
      }
      return buildFn(input, config, context);
    },
  });
}

// =============================================================================
// MINIMAL CONTEXT BUILDER (<2K tokens)
// =============================================================================

/**
 * Build minimal context section
 * @param {TaskDefinition} task
 * @returns {string}
 */
function buildTaskSection(task) {
  return `## Task

**ID:** ${task.id}
**Type:** ${task.type}

### Description
${task.description}

### Required Skills
${task.requiredSkills.join(', ')}

### Acceptance Criteria
${task.acceptanceCriteria.map((c, i) => `${i + 1}. ${c.description} (weight: ${c.weight})`).join('\n')}
`;
}

/**
 * Minimal context builder - task description only
 * Best for well-defined, isolated tasks
 */
export function createMinimalContextBuilder() {
  return createContextBuilder(
    'context-builder-minimal',
    'minimal',
    async (input, config, context) => {
      const sections = [];

      // Task section (required)
      sections.push(buildTaskSection(input.task));

      // Dependencies if any
      if (input.task.dependencies && input.task.dependencies.length > 0) {
        sections.push(`### Dependencies
This task depends on: ${input.task.dependencies.join(', ')}`);
      }

      const prompt = sections.join('\n\n');
      const { text: finalPrompt, truncated } = truncateToTokens(prompt, config.maxTokens || 2000);
      const tokenCount = estimateTokens(finalPrompt);

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'context.built',
        moduleId: 'context-builder-minimal',
        payload: { taskId: input.task.id, tokenCount, truncated },
        level: 'info',
      });

      return {
        prompt: finalPrompt,
        tokenCount,
        includedFiles: [],
        truncated,
      };
    }
  );
}

// =============================================================================
// SCOPED CONTEXT BUILDER (2-8K tokens)
// =============================================================================

/**
 * Scoped context builder - task + relevant file snippets + constraints
 * Best for tasks requiring local context
 */
export function createScopedContextBuilder() {
  return createContextBuilder(
    'context-builder-scoped',
    'scoped',
    async (input, config, context) => {
      const sections = [];
      const includedFiles = [];

      // Task section (required)
      sections.push(buildTaskSection(input.task));

      // File snippets if provided
      if (input.files && input.files.length > 0 && config.includeProjectContext) {
        const fileSection = ['## Relevant Files'];
        for (const file of input.files) {
          fileSection.push('```\n' + file + '\n```');
          includedFiles.push(file.split('\n')[0] || 'file');
        }
        sections.push(fileSection.join('\n\n'));
      }

      // Constraints if provided
      if (input.constraints && input.constraints.length > 0 && config.includeConstraints) {
        sections.push(`## Constraints

${input.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);
      }

      // Tool requirements
      if (input.task.toolRequirements && input.task.toolRequirements.length > 0) {
        sections.push(`## Available Tools

${input.task.toolRequirements.join(', ')}`);
      }

      const prompt = sections.join('\n\n');
      const { text: finalPrompt, truncated } = truncateToTokens(prompt, config.maxTokens || 8000);
      const tokenCount = estimateTokens(finalPrompt);

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'context.built',
        moduleId: 'context-builder-scoped',
        payload: { taskId: input.task.id, tokenCount, truncated, fileCount: includedFiles.length },
        level: 'info',
      });

      return {
        prompt: finalPrompt,
        tokenCount,
        includedFiles,
        truncated,
      };
    }
  );
}

// =============================================================================
// RICH CONTEXT BUILDER (8-32K tokens)
// =============================================================================

/**
 * Rich context builder - task + broader context + examples + full constraints
 * Best for complex tasks requiring extensive context
 */
export function createRichContextBuilder() {
  return createContextBuilder(
    'context-builder-rich',
    'rich',
    async (input, config, context) => {
      const sections = [];
      const includedFiles = [];

      // Project context if provided
      if (input.codebaseContext && config.includeProjectContext) {
        sections.push(`## Project Context

${input.codebaseContext}`);
      }

      // Task section (required)
      sections.push(buildTaskSection(input.task));

      // File snippets if provided
      if (input.files && input.files.length > 0 && config.includeProjectContext) {
        const fileSection = ['## Relevant Files'];
        for (const file of input.files) {
          fileSection.push('```\n' + file + '\n```');
          includedFiles.push(file.split('\n')[0] || 'file');
        }
        sections.push(fileSection.join('\n\n'));
      }

      // Examples if provided
      if (input.examples && input.examples.length > 0 && config.includeExamples) {
        sections.push(`## Examples

${input.examples.map((e, i) => `### Example ${i + 1}

${e}`).join('\n\n')}`);
      }

      // Constraints if provided
      if (input.constraints && input.constraints.length > 0 && config.includeConstraints) {
        sections.push(`## Constraints and Requirements

${input.constraints.map((c, i) => `${i + 1}. ${c}`).join('\n')}`);
      }

      // Execution history if provided
      if (input.history && config.includeHistory) {
        sections.push(`## Execution History

${input.history}`);
      }

      // Tool requirements
      if (input.task.toolRequirements && input.task.toolRequirements.length > 0) {
        sections.push(`## Available Tools

${input.task.toolRequirements.join(', ')}`);
      }

      const prompt = sections.join('\n\n');
      const { text: finalPrompt, truncated } = truncateToTokens(prompt, config.maxTokens || 32000);
      const tokenCount = estimateTokens(finalPrompt);

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'context.built',
        moduleId: 'context-builder-rich',
        payload: {
          taskId: input.task.id,
          tokenCount,
          truncated,
          fileCount: includedFiles.length,
          hasExamples: (input.examples?.length ?? 0) > 0,
          hasHistory: !!input.history,
        },
        level: 'info',
      });

      return {
        prompt: finalPrompt,
        tokenCount,
        includedFiles,
        truncated,
      };
    }
  );
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register default context builder implementations
 */
export function registerContextBuilders() {
  if (!globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'minimal')) {
    globalRegistry.register(ModuleType.CONTEXT_BUILDER, 'minimal', createMinimalContextBuilder);
  }
  if (!globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'scoped')) {
    globalRegistry.register(ModuleType.CONTEXT_BUILDER, 'scoped', createScopedContextBuilder);
  }
  if (!globalRegistry.has(ModuleType.CONTEXT_BUILDER, 'rich')) {
    globalRegistry.register(ModuleType.CONTEXT_BUILDER, 'rich', createRichContextBuilder);
  }
}

// Auto-register on import
registerContextBuilders();
