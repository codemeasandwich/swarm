/**
 * @file Main entry point for the orchestration framework.
 * Exports all public APIs.
 * @module orchestration
 */

// Types and enums
export {
  TaskStatus,
  StoryStatus,
  EpicStatus,
  LifecycleState,
  LoopResultType,
  BuildStatusType,
  PRStatusType,
  CIEventType,
  BreakpointType,
} from './types/index.js';

// Configuration
export { getConfig, resetConfig, createConfig } from './config/index.js';

// Plan models and utilities
export {
  AcceptanceCriterion,
  TestScenario,
  Task,
  Story,
  Epic,
  Milestone,
  Persona,
  ProjectPlan,
  PlanParser,
  PlanValidator,
} from './plan/index.js';

// Persona models and utilities
export {
  Breakpoint,
  PersonaConfig,
  AgentInstance,
  PersonaMatcher,
  ClaudeMdGenerator,
} from './personas/index.js';

// Communication system
export {
  AgentStatus,
  EnhancedAgentStatus,
  CommunicationsFile,
  FileWatcher,
  Agent,
  TaskAgent,
  Coordinator,
} from './communication/index.js';

// Runtime utilities
export {
  AgentProcess,
  TerminalManager,
  BranchInfo,
  BranchManager,
  WorkspaceManager,
} from './runtime/index.js';

// CI/CD
export {
  BuildStatus,
  PRInfo,
  CIEvent,
  CIProvider,
  CIEventEmitter,
  LocalCIProvider,
} from './ci/index.js';

// Lifecycle management
export {
  ContextSnapshot,
  ContextBuilder,
  LoopResult,
  AgentLifecycleLoop,
  RalphWiggumLoop,
} from './lifecycle/index.js';

// Main orchestrator
export {
  Orchestrator,
  OrchestratorError,
  PlanParseError,
  PlanValidationError,
  AgentSpawnError,
  CommunicationError,
  BranchError,
  WorkspaceError,
  CIError,
  LifecycleError,
  TimeoutError,
} from './orchestrator/index.js';
