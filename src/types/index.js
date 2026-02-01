/**
 * @file Type definitions and enums for the orchestration framework.
 * Contains JSDoc @typedef definitions and frozen enum objects.
 * @module types
 */

// ============== ENUMS ==============

/**
 * Status of a task in the plan.
 * @readonly
 * @enum {string}
 */
export const TaskStatus = Object.freeze({
  AVAILABLE: 'available',
  CLAIMED: 'claimed',
  IN_PROGRESS: 'in_progress',
  BLOCKED: 'blocked',
  PR_PENDING: 'pr_pending',
  COMPLETE: 'complete',
});

/**
 * Status of a user story.
 * @readonly
 * @enum {string}
 */
export const StoryStatus = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

/**
 * Status of an epic.
 * @readonly
 * @enum {string}
 */
export const EpicStatus = Object.freeze({
  NOT_STARTED: 'not_started',
  IN_PROGRESS: 'in_progress',
  COMPLETE: 'complete',
});

/**
 * Agent lifecycle states.
 * @readonly
 * @enum {string}
 */
export const LifecycleState = Object.freeze({
  IDLE: 'idle',
  WORKING: 'working',
  BLOCKED: 'blocked',
  PR_PENDING: 'pr_pending',
  COMPLETE: 'complete',
  FAILED: 'failed',
});

/**
 * Result type from an agent lifecycle loop iteration.
 * @readonly
 * @enum {string}
 */
export const LoopResultType = Object.freeze({
  TASK_COMPLETE: 'task_complete',
  BLOCKED: 'blocked',
  PR_CREATED: 'pr_created',
  MAX_RETRIES: 'max_retries',
  ERROR: 'error',
  SHUTDOWN: 'shutdown',
});

/**
 * Build status types.
 * @readonly
 * @enum {string}
 */
export const BuildStatusType = Object.freeze({
  PENDING: 'pending',
  RUNNING: 'running',
  SUCCESS: 'success',
  FAILURE: 'failure',
  CANCELLED: 'cancelled',
});

/**
 * Pull request status types.
 * @readonly
 * @enum {string}
 */
export const PRStatusType = Object.freeze({
  OPEN: 'open',
  CLOSED: 'closed',
  MERGED: 'merged',
  DRAFT: 'draft',
});

/**
 * CI event types.
 * @readonly
 * @enum {string}
 */
export const CIEventType = Object.freeze({
  BUILD_STARTED: 'build_started',
  BUILD_SUCCESS: 'build_success',
  BUILD_FAILURE: 'build_failure',
  BUILD_CANCELLED: 'build_cancelled',
  PR_OPENED: 'pr_opened',
  PR_CLOSED: 'pr_closed',
  PR_MERGED: 'pr_merged',
  PR_REVIEW_REQUESTED: 'pr_review_requested',
  PR_APPROVED: 'pr_approved',
  PR_CHANGES_REQUESTED: 'pr_changes_requested',
});

/**
 * Breakpoint types for agent lifecycle management.
 * @readonly
 * @enum {string}
 */
export const BreakpointType = Object.freeze({
  TASK_COMPLETE: 'task_complete',
  BLOCKED: 'blocked',
  PR_CREATED: 'pr_created',
});

// ============== TYPE DEFINITIONS ==============

/**
 * @typedef {Object} AcceptanceCriterionData
 * @property {string} id - Criterion ID
 * @property {string} description - Full description
 * @property {string} [given] - Given clause
 * @property {string} [when] - When clause
 * @property {string} [then] - Then clause
 */

/**
 * @typedef {Object} TestScenarioData
 * @property {string} id - Test scenario ID
 * @property {string} name - Scenario name
 * @property {string} description - Scenario description
 * @property {string} acceptanceCriterionId - Related acceptance criterion ID
 * @property {string} testFunctionName - Name of the test function
 */

/**
 * @typedef {Object} TaskData
 * @property {string} id - Task ID
 * @property {string} description - Task description
 * @property {string} role - Role responsible for this task
 * @property {string} status - Current status (TaskStatus value)
 * @property {string[]} dependencies - IDs of dependent tasks
 * @property {string|null} assignedAgent - Agent ID if assigned
 * @property {string|null} branch - Git branch if assigned
 * @property {string|null} prUrl - PR URL if created
 * @property {string|null} createdAt - ISO timestamp
 * @property {string|null} claimedAt - ISO timestamp
 * @property {string|null} completedAt - ISO timestamp
 */

/**
 * @typedef {Object} StoryData
 * @property {string} id - Story ID
 * @property {string} title - Story title
 * @property {string} epicId - Parent epic ID
 * @property {string} status - Story status
 * @property {string} asA - User role
 * @property {string} iWant - Feature description
 * @property {string} soThat - Benefit description
 * @property {AcceptanceCriterionData[]} acceptanceCriteria - Acceptance criteria
 * @property {TestScenarioData[]} testScenarios - Test scenarios
 * @property {TaskData[]} tasks - Tasks in this story
 * @property {string[]} dependencies - Dependent story IDs
 * @property {string[]} blocks - Story IDs this story blocks
 * @property {string} technicalNotes - Technical notes
 */

/**
 * @typedef {Object} EpicData
 * @property {string} id - Epic ID
 * @property {string} title - Epic title
 * @property {string} description - Epic description
 * @property {string} status - Epic status
 * @property {string|null} milestoneId - Parent milestone ID
 * @property {string} priority - Priority level
 * @property {string[]} dependencies - Dependent epic IDs
 * @property {StoryData[]} stories - Stories in this epic
 */

/**
 * @typedef {Object} MilestoneData
 * @property {string} id - Milestone ID
 * @property {string} name - Milestone name
 * @property {string} description - Milestone description
 * @property {string[]} epicIds - Epic IDs in this milestone
 * @property {string|null} targetDate - ISO timestamp
 * @property {boolean} completed - Whether milestone is complete
 * @property {string|null} prUrl - PR URL for milestone merge
 */

/**
 * @typedef {Object} PersonaData
 * @property {string} id - Persona ID
 * @property {string} name - Persona name
 * @property {string} role - Role identifier
 * @property {string[]} capabilities - List of capabilities
 * @property {string[]} constraints - List of constraints
 * @property {string} claudeMdTemplate - Template for .claude.md file
 */

/**
 * @typedef {Object} ProjectPlanData
 * @property {string} name - Project name
 * @property {string} description - Project description
 * @property {EpicData[]} epics - All epics
 * @property {MilestoneData[]} milestones - All milestones
 * @property {PersonaData[]} personas - All personas
 */

/**
 * @typedef {Object} BreakpointData
 * @property {string} type - Breakpoint type (BreakpointType value)
 * @property {string|null} taskId - Task ID if applicable
 * @property {string} summary - Summary of work done
 * @property {string[]} blockedOn - Task IDs blocking this agent
 * @property {string} reason - Reason for breakpoint
 * @property {string|null} prUrl - PR URL if PR was created
 * @property {string} timestamp - ISO timestamp
 */

/**
 * @typedef {Object} AgentStatusData
 * @property {string} mission - Agent's overall goal
 * @property {string} workingOn - Current task description
 * @property {string} done - What has been completed
 * @property {string} next - What is planned next
 * @property {Array<[string, string]>} requests - Array of [targetAgent, request] pairs
 * @property {Array<[string, string, string]>} added - Array of [fromAgent, description, originalRequest] tuples
 * @property {string} lastUpdated - ISO timestamp
 */

/**
 * @typedef {Object} EnhancedAgentStatusData
 * @property {string} mission - Agent's overall goal
 * @property {string} workingOn - Current task description
 * @property {string} done - What has been completed
 * @property {string} next - What is planned next
 * @property {Array<[string, string]>} requests - Array of [targetAgent, request] pairs
 * @property {Array<[string, string, string]>} added - Array of [fromAgent, description, originalRequest] tuples
 * @property {string} lastUpdated - ISO timestamp
 * @property {string} agentId - Agent identifier
 * @property {string} role - Agent role
 * @property {string} branch - Git branch
 * @property {string} lifecycleState - Current lifecycle state
 * @property {string} currentTaskId - Current task ID
 * @property {string[]} blockedOn - Task IDs blocking this agent
 * @property {number} retryCount - Number of retries
 * @property {number} spawnCount - Number of spawns
 * @property {string} prUrl - PR URL if any
 * @property {BreakpointData|null} breakpoint - Current breakpoint info
 */

/**
 * @typedef {Object} AgentInstanceData
 * @property {string} agentId - Unique agent identifier
 * @property {string} role - Agent role
 * @property {string} branch - Git branch for this agent
 * @property {string} lifecycleState - Current state (LifecycleState value)
 * @property {string|null} currentTaskId - Current task ID
 * @property {string[]} blockedOn - Task IDs blocking this agent
 * @property {number} retryCount - Number of retries
 * @property {number} spawnCount - Number of process spawns
 * @property {string|null} prUrl - PR URL if pending
 * @property {BreakpointData|null} breakpoint - Current breakpoint
 * @property {PersonaData|null} personaConfig - Persona configuration
 */

/**
 * @typedef {Object} BranchInfoData
 * @property {string} name - Branch name
 * @property {string} agentId - Agent ID that owns this branch
 * @property {string} taskId - Task ID for this branch
 * @property {string} createdAt - ISO timestamp
 * @property {string} baseBranch - Base branch name
 */

/**
 * @typedef {Object} BuildStatusData
 * @property {string} runId - Build run identifier
 * @property {string} status - Build status (BuildStatusType value)
 * @property {string|null} startedAt - ISO timestamp
 * @property {string|null} completedAt - ISO timestamp
 * @property {string|null} url - Build URL
 * @property {string|null} errorMessage - Error message if failed
 */

/**
 * @typedef {Object} PRInfoData
 * @property {number} number - PR number
 * @property {string} title - PR title
 * @property {string} status - PR status (PRStatusType value)
 * @property {string} url - PR URL
 * @property {string} sourceBranch - Source branch
 * @property {string} targetBranch - Target branch
 * @property {string|null} mergedAt - ISO timestamp if merged
 */

/**
 * @typedef {Object} CIEventData
 * @property {string} eventType - Event type (CIEventType value)
 * @property {string} timestamp - ISO timestamp
 * @property {string|null} branch - Related branch
 * @property {string|null} runId - Build run ID if applicable
 * @property {number|null} prNumber - PR number if applicable
 * @property {Object} [metadata] - Additional metadata
 */

/**
 * @typedef {Object} ContextSnapshotData
 * @property {string} agentId - Agent identifier
 * @property {string} taskId - Task identifier
 * @property {string} timestamp - ISO timestamp
 * @property {string} summary - Work summary
 * @property {string[]} filesModified - List of modified files
 * @property {string[]} commits - List of commit hashes
 * @property {string} communicationsState - JSON string of communications state
 */

/**
 * @typedef {Object} LoopResultData
 * @property {string} resultType - Result type (LoopResultType value)
 * @property {string|null} taskId - Task ID if applicable
 * @property {string} summary - Result summary
 * @property {string[]} blockedOn - Task IDs if blocked
 * @property {string|null} prUrl - PR URL if created
 * @property {string|null} error - Error message if any
 * @property {number} spawnCount - Number of spawns
 * @property {number} retryCount - Number of retries
 */

/**
 * @typedef {Object} CommunicationsFileData
 * @property {Object} _meta - Metadata
 * @property {string} _meta.version - File version
 * @property {string|null} _meta.lastUpdated - ISO timestamp
 * @property {string|null} _meta.lastUpdatedBy - Agent that last updated
 * @property {Object.<string, AgentStatusData>} [agents] - Agent statuses by name
 */

/**
 * @typedef {Object} OrchestratorConfigData
 * @property {string} repoDir - Repository directory path
 * @property {string} planDir - Plan directory path
 * @property {boolean} autoSpawn - Whether to auto-spawn agents
 * @property {number} maxConcurrentAgents - Maximum concurrent agents
 * @property {string} integrationBranch - Integration branch name
 */

/**
 * @typedef {Object} ValidationResultData
 * @property {boolean} isValid - Whether validation passed
 * @property {string[]} errors - List of error messages
 * @property {string[]} warnings - List of warning messages
 */
