/**
 * @file Generator for .claude.md agent context files.
 * @module personas/generator
 */

/**
 * Generator for .claude.md files that provide context to Claude agents.
 */
export class ClaudeMdGenerator {
  /**
   * Create a ClaudeMdGenerator.
   * @param {import('../plan/models.js').ProjectPlan} plan - Project plan
   */
  constructor(plan) {
    /** @type {import('../plan/models.js').ProjectPlan} */
    this.plan = plan;
  }

  /**
   * Generate the .claude.md content for an agent.
   *
   * @param {import('./models.js').PersonaConfig} personaConfig - Agent's persona configuration
   * @param {import('../plan/models.js').Task} task - Current task
   * @param {string} branch - Git branch for this agent
   * @param {string} [contextSummary=''] - Summary from previous iterations
   * @returns {string} Generated .claude.md content
   */
  generate(personaConfig, task, branch, contextSummary = '') {
    const sections = [];

    // Header
    sections.push(this._generateHeader(personaConfig, task));

    // Mission
    sections.push(this._generateMission(personaConfig, task));

    // Context summary from previous iterations
    if (contextSummary) {
      sections.push(this._generateContextSection(contextSummary));
    }

    // Task details
    sections.push(this._generateTaskSection(task));

    // Capabilities and constraints
    sections.push(this._generateCapabilitiesSection(personaConfig));

    // Communication protocol
    sections.push(this._generateCommunicationSection(personaConfig.role, branch));

    // Breakpoint signaling
    sections.push(this._generateBreakpointSection(task));

    // Custom template content
    if (personaConfig.claudeMdTemplate) {
      sections.push(this._generateCustomSection(personaConfig.claudeMdTemplate));
    }

    return sections.join('\n\n');
  }

  /**
   * Generate header section.
   * @private
   * @param {import('./models.js').PersonaConfig} personaConfig
   * @param {import('../plan/models.js').Task} task
   * @returns {string}
   */
  _generateHeader(personaConfig, task) {
    return `# Agent: ${personaConfig.name}

**Role:** ${personaConfig.role}
**Current Task:** ${task.id}
**Project:** ${this.plan.name}`;
  }

  /**
   * Generate mission section.
   * @private
   * @param {import('./models.js').PersonaConfig} personaConfig
   * @param {import('../plan/models.js').Task} task
   * @returns {string}
   */
  _generateMission(personaConfig, task) {
    return `## Mission

You are "${personaConfig.name}", a ${personaConfig.role} agent working on the "${this.plan.name}" project.

Your current mission is to complete task **${task.id}**:
> ${task.description}`;
  }

  /**
   * Generate context summary section.
   * @private
   * @param {string} contextSummary
   * @returns {string}
   */
  _generateContextSection(contextSummary) {
    return `## Previous Progress

This is a continuation of previous work. Here's what has been accomplished:

${contextSummary}

**Important:** Build on this progress. Do not repeat completed work.`;
  }

  /**
   * Generate task details section.
   * @private
   * @param {import('../plan/models.js').Task} task
   * @returns {string}
   */
  _generateTaskSection(task) {
    let content = `## Task Details

**ID:** ${task.id}
**Description:** ${task.description}
**Role:** ${task.role}
**Status:** ${task.status}`;

    if (task.dependencies.length > 0) {
      content += `\n**Dependencies:** ${task.dependencies.join(', ')}`;
    }

    if (task.branch) {
      content += `\n**Branch:** ${task.branch}`;
    }

    // Find the story this task belongs to
    const story = this._findStoryForTask(task.id);
    if (story) {
      content += `\n\n### User Story

${story.userStoryText}`;

      if (story.acceptanceCriteria.length > 0) {
        content += `\n\n### Acceptance Criteria\n`;
        for (const ac of story.acceptanceCriteria) {
          content += `\n- **${ac.id}:** ${ac.description}`;
        }
      }
    }

    return content;
  }

  /**
   * Find the story containing a task.
   * @private
   * @param {string} taskId
   * @returns {import('../plan/models.js').Story|null}
   */
  _findStoryForTask(taskId) {
    for (const epic of this.plan.epics) {
      for (const story of epic.stories) {
        for (const task of story.tasks) {
          if (task.id === taskId) {
            return story;
          }
        }
      }
    }
    return null;
  }

  /**
   * Generate capabilities section.
   * @private
   * @param {import('./models.js').PersonaConfig} personaConfig
   * @returns {string}
   */
  _generateCapabilitiesSection(personaConfig) {
    let content = `## Your Capabilities`;

    if (personaConfig.capabilities.length > 0) {
      content += `\n\nYou are capable of:\n`;
      for (const cap of personaConfig.capabilities) {
        content += `- ${cap}\n`;
      }
    }

    if (personaConfig.constraints.length > 0) {
      content += `\n### Constraints\n\nYou must adhere to these constraints:\n`;
      for (const constraint of personaConfig.constraints) {
        content += `- ${constraint}\n`;
      }
    }

    return content;
  }

  /**
   * Generate communication protocol section.
   * @private
   * @param {string} role
   * @param {string} branch
   * @returns {string}
   */
  _generateCommunicationSection(role, branch) {
    return `## Communication Protocol

You coordinate with other agents via \`communications.json\`.

### Your Agent Entry

Update your status in communications.json under your agent ID. Include:
- **mission**: Your overall goal
- **workingOn**: Current activity
- **done**: Completed items
- **next**: Planned next steps

### Requesting Help

To request work from another agent, add to your \`requests\` array:
\`\`\`json
["target_agent_role", "description of what you need"]
\`\`\`

### Receiving Deliveries

Check your \`added\` array for completed work from other agents:
\`\`\`json
["from_agent", "what was delivered", "original request"]
\`\`\`

After processing deliveries, clear the \`added\` array.

### Git Branch

Work on branch: \`${branch}\`

Commit frequently with clear messages. Create a PR when the task is complete.`;
  }

  /**
   * Generate breakpoint signaling section.
   * @private
   * @param {import('../plan/models.js').Task} task
   * @returns {string}
   */
  _generateBreakpointSection(task) {
    return `## Breakpoint Signaling

When you reach a natural stopping point, signal a breakpoint by updating your status in communications.json:

### Task Complete
\`\`\`json
{
  "lifecycleState": "complete",
  "breakpoint": {
    "type": "task_complete",
    "taskId": "${task.id}",
    "summary": "Brief summary of what was accomplished"
  }
}
\`\`\`

### Blocked
\`\`\`json
{
  "lifecycleState": "blocked",
  "breakpoint": {
    "type": "blocked",
    "blockedOn": ["T001", "T002"],
    "reason": "Why you are blocked"
  }
}
\`\`\`

### PR Created
\`\`\`json
{
  "lifecycleState": "pr_pending",
  "breakpoint": {
    "type": "pr_created",
    "taskId": "${task.id}",
    "prUrl": "https://github.com/..."
  }
}
\`\`\`

**Important:** Always signal a breakpoint before stopping work. This allows the orchestrator to manage your lifecycle correctly.`;
  }

  /**
   * Generate custom template section.
   * @private
   * @param {string} template
   * @returns {string}
   */
  _generateCustomSection(template) {
    return `## Additional Instructions

${template}`;
  }

  /**
   * Generate a minimal .claude.md for quick tasks.
   *
   * @param {string} agentId - Agent identifier
   * @param {string} role - Agent role
   * @param {string} taskDescription - Task description
   * @param {string} branch - Git branch
   * @returns {string}
   */
  generateMinimal(agentId, role, taskDescription, branch) {
    return `# Agent: ${agentId}

**Role:** ${role}
**Branch:** ${branch}

## Task

${taskDescription}

## Communication

Update your status in \`communications.json\` under \`${agentId}\`.

Signal breakpoints when:
- Task complete: \`{"lifecycleState": "complete", "breakpoint": {"type": "task_complete", "summary": "..."}}\`
- Blocked: \`{"lifecycleState": "blocked", "breakpoint": {"type": "blocked", "blockedOn": [...], "reason": "..."}}\`
- PR created: \`{"lifecycleState": "pr_pending", "breakpoint": {"type": "pr_created", "prUrl": "..."}}\`
`;
  }
}
