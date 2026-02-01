/**
 * SWARM Framework - Sandbox Module
 * Provides isolated tool access per worker
 * @module swarm/execution/sandbox
 */

import { createModule, globalRegistry } from '../../registry/index.js';
import { ModuleType } from '../../types/module.js';

/**
 * @typedef {import('../../types/module.js').ToolSandboxConfig} ToolSandboxConfig
 * @typedef {import('../../types/task.js').TaskDefinition} TaskDefinition
 * @typedef {import('../../types/workflow.js').ExecutionContext} ExecutionContext
 */

/**
 * @typedef {Object} SandboxInput
 * @property {string} workerId - Worker ID
 * @property {TaskDefinition} task - Task being executed
 * @property {string[]} [requestedTools] - Tools requested by task
 * @property {string} [workingDir] - Base working directory
 */

/**
 * @typedef {Object} SandboxOutput
 * @property {string} sandboxPath - Path to sandbox directory
 * @property {string[]} allowedTools - Tools allowed in this sandbox
 * @property {string} [branchName] - Git branch name if isolation enabled
 * @property {() => Promise<void>} cleanup - Cleanup function
 * @property {string} isolationLevel - Level of isolation applied
 */

// =============================================================================
// TOOL DEFINITIONS
// =============================================================================

/**
 * Minimal tool set (3-5 tools)
 * @type {string[]}
 */
export const MINIMAL_TOOLS = [
  'Read',
  'Write',
  'Bash',
];

/**
 * Standard tool set (5-15 tools)
 * @type {string[]}
 */
export const STANDARD_TOOLS = [
  'Read',
  'Write',
  'Edit',
  'Bash',
  'Glob',
  'Grep',
  'WebFetch',
  'WebSearch',
];

/**
 * Extended tool set (15-30 tools)
 * @type {string[]}
 */
export const EXTENDED_TOOLS = [
  ...STANDARD_TOOLS,
  'Task',
  'NotebookEdit',
  'AskUserQuestion',
  'TodoWrite',
  'Skill',
];

/**
 * Full tool set (30+ tools) - not recommended for scale
 * @type {string[]}
 */
export const FULL_TOOLS = [
  ...EXTENDED_TOOLS,
  // Add all MCP tools here
];

// =============================================================================
// BLOCKED PATTERNS
// =============================================================================

/**
 * Default blocklist for all sandboxes
 * @type {string[]}
 */
export const DEFAULT_BLOCKLIST = [
  'rm -rf',
  'sudo',
  'chmod 777',
  'curl | sh',
  'wget | sh',
  'mkfs',
  '> /dev/',
  'dd if=',
  'git push --force',
  'DROP TABLE',
  'DELETE FROM',
];

// =============================================================================
// SANDBOX FACTORY
// =============================================================================

/**
 * Create a sandbox module
 * @param {string} id
 * @param {string} implementation
 * @param {(input: SandboxInput, config: ToolSandboxConfig, context: ExecutionContext) => Promise<SandboxOutput>} setupFn
 * @returns {import('../../types/module.js').Module<ToolSandboxConfig, SandboxInput, SandboxOutput>}
 */
export function createSandbox(id, implementation, setupFn) {
  /** @type {ToolSandboxConfig | null} */
  let config = null;

  return createModule({
    id,
    version: '1.0.0',
    type: ModuleType.TOOL_SANDBOX,

    async configure(cfg) {
      config = cfg;
    },

    async execute(input, context) {
      if (!config) {
        throw new Error('Sandbox not configured');
      }
      return setupFn(input, config, context);
    },
  });
}

// =============================================================================
// MINIMAL SANDBOX (3-5 tools)
// =============================================================================

/**
 * Filter tools to only allowed set
 * @param {string[]} requested
 * @param {string[]} allowed
 * @returns {string[]}
 */
function filterTools(requested, allowed) {
  if (!requested || requested.length === 0) {
    return allowed;
  }
  return requested.filter(tool => allowed.includes(tool));
}

/**
 * Check if command matches blocked pattern
 * @param {string} command
 * @param {string[]} patterns
 * @returns {boolean}
 */
export function isBlocked(command, patterns) {
  const normalizedCmd = command.toLowerCase();
  return patterns.some(pattern => normalizedCmd.includes(pattern.toLowerCase()));
}

/**
 * Minimal sandbox - maximum isolation, minimum tools
 * Best for isolated, well-defined tasks
 */
export function createMinimalSandbox() {
  return createSandbox(
    'sandbox-minimal',
    'minimal',
    async (input, config, context) => {
      const allowedTools = filterTools(
        input.requestedTools || [],
        config.allowedTools || MINIMAL_TOOLS
      );

      // Ensure we have at least the minimal set
      const finalTools = allowedTools.length > 0 ? allowedTools : MINIMAL_TOOLS.slice(0, 3);

      // Generate sandbox path
      const sandboxPath = input.workingDir
        ? `${input.workingDir}/sandbox/${input.workerId}`
        : `/tmp/swarm-sandbox/${input.workerId}`;

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'sandbox.created',
        moduleId: 'sandbox-minimal',
        payload: {
          workerId: input.workerId,
          taskId: input.task.id,
          toolCount: finalTools.length,
          isolationLevel: 'full',
        },
        level: 'info',
      });

      return {
        sandboxPath,
        allowedTools: finalTools,
        isolationLevel: 'full',
        cleanup: async () => {
          context.emit({
            timestamp: Date.now(),
            runId: context.runId,
            eventType: 'sandbox.cleaned',
            moduleId: 'sandbox-minimal',
            payload: { workerId: input.workerId },
            level: 'info',
          });
        },
      };
    }
  );
}

// =============================================================================
// STANDARD SANDBOX (5-15 tools)
// =============================================================================

/**
 * Standard sandbox - balanced isolation and capability
 * Best for typical development tasks
 */
export function createStandardSandbox() {
  return createSandbox(
    'sandbox-standard',
    'standard',
    async (input, config, context) => {
      const allowedTools = filterTools(
        input.requestedTools || [],
        config.allowedTools || STANDARD_TOOLS
      );

      // Ensure we have at least the standard set
      const finalTools = allowedTools.length > 0 ? allowedTools : STANDARD_TOOLS;

      // Generate sandbox path
      const sandboxPath = input.workingDir
        ? `${input.workingDir}/sandbox/${input.workerId}`
        : `/tmp/swarm-sandbox/${input.workerId}`;

      // Generate branch name for git isolation
      const branchName = `swarm/${input.workerId}/${input.task.id}`;

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'sandbox.created',
        moduleId: 'sandbox-standard',
        payload: {
          workerId: input.workerId,
          taskId: input.task.id,
          toolCount: finalTools.length,
          isolationLevel: 'process',
          branchName,
        },
        level: 'info',
      });

      return {
        sandboxPath,
        allowedTools: finalTools,
        branchName,
        isolationLevel: 'process',
        cleanup: async () => {
          context.emit({
            timestamp: Date.now(),
            runId: context.runId,
            eventType: 'sandbox.cleaned',
            moduleId: 'sandbox-standard',
            payload: { workerId: input.workerId, branchName },
            level: 'info',
          });
        },
      };
    }
  );
}

// =============================================================================
// EXTENDED SANDBOX (15-30 tools)
// =============================================================================

/**
 * Extended sandbox - more tools, container isolation
 * Best for complex tasks requiring more capabilities
 */
export function createExtendedSandbox() {
  return createSandbox(
    'sandbox-extended',
    'extended',
    async (input, config, context) => {
      const allowedTools = filterTools(
        input.requestedTools || [],
        config.allowedTools || EXTENDED_TOOLS
      );

      const finalTools = allowedTools.length > 0 ? allowedTools : EXTENDED_TOOLS;

      const sandboxPath = input.workingDir
        ? `${input.workingDir}/sandbox/${input.workerId}`
        : `/tmp/swarm-sandbox/${input.workerId}`;

      const branchName = `swarm/${input.workerId}/${input.task.id}`;

      context.emit({
        timestamp: Date.now(),
        runId: context.runId,
        eventType: 'sandbox.created',
        moduleId: 'sandbox-extended',
        payload: {
          workerId: input.workerId,
          taskId: input.task.id,
          toolCount: finalTools.length,
          isolationLevel: 'container',
          branchName,
        },
        level: 'info',
      });

      return {
        sandboxPath,
        allowedTools: finalTools,
        branchName,
        isolationLevel: 'container',
        cleanup: async () => {
          context.emit({
            timestamp: Date.now(),
            runId: context.runId,
            eventType: 'sandbox.cleaned',
            moduleId: 'sandbox-extended',
            payload: { workerId: input.workerId, branchName },
            level: 'info',
          });
        },
      };
    }
  );
}

// =============================================================================
// REGISTRATION
// =============================================================================

/**
 * Register default sandbox implementations
 */
export function registerSandboxes() {
  if (!globalRegistry.has(ModuleType.TOOL_SANDBOX, 'minimal')) {
    globalRegistry.register(ModuleType.TOOL_SANDBOX, 'minimal', createMinimalSandbox);
  }
  if (!globalRegistry.has(ModuleType.TOOL_SANDBOX, 'standard')) {
    globalRegistry.register(ModuleType.TOOL_SANDBOX, 'standard', createStandardSandbox);
  }
  if (!globalRegistry.has(ModuleType.TOOL_SANDBOX, 'extended')) {
    globalRegistry.register(ModuleType.TOOL_SANDBOX, 'extended', createExtendedSandbox);
  }
}

// Auto-register on import
registerSandboxes();
