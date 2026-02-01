/**
 * @file Data models for project plans - Epics, Stories, Tasks, Milestones, Personas.
 * @module plan/models
 */

import { TaskStatus, StoryStatus, EpicStatus } from '../types/index.js';

/**
 * An acceptance criterion that drives a test.
 */
export class AcceptanceCriterion {
  /**
   * Create an AcceptanceCriterion.
   * @param {Object} props - Properties
   * @param {string} props.id - Criterion ID
   * @param {string} props.description - Full description
   * @param {string} [props.given=''] - Given clause for BDD
   * @param {string} [props.when=''] - When clause for BDD
   * @param {string} [props.then=''] - Then clause for BDD
   */
  constructor({ id, description, given = '', when = '', then = '' }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.description = description;
    /** @type {string} */
    this.given = given;
    /** @type {string} */
    this.when = when;
    /** @type {string} */
    this.then = then;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').AcceptanceCriterionData}
   */
  toDict() {
    return {
      id: this.id,
      description: this.description,
      given: this.given,
      when: this.when,
      then: this.then,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').AcceptanceCriterionData} data - Plain object data
   * @returns {AcceptanceCriterion}
   */
  static fromDict(data) {
    return new AcceptanceCriterion({
      id: data.id ?? '',
      description: data.description ?? '',
      given: data.given ?? '',
      when: data.when ?? '',
      then: data.then ?? '',
    });
  }
}

/**
 * An E2E test scenario derived from acceptance criteria.
 */
export class TestScenario {
  /**
   * Create a TestScenario.
   * @param {Object} props - Properties
   * @param {string} props.id - Scenario ID
   * @param {string} props.name - Scenario name
   * @param {string} props.description - Scenario description
   * @param {string} props.acceptanceCriterionId - Related acceptance criterion ID
   * @param {string} props.testFunctionName - Name of the test function
   */
  constructor({ id, name, description, acceptanceCriterionId, testFunctionName }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.description = description;
    /** @type {string} */
    this.acceptanceCriterionId = acceptanceCriterionId;
    /** @type {string} */
    this.testFunctionName = testFunctionName;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').TestScenarioData}
   */
  toDict() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      acceptanceCriterionId: this.acceptanceCriterionId,
      testFunctionName: this.testFunctionName,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').TestScenarioData} data - Plain object data
   * @returns {TestScenario}
   */
  static fromDict(data) {
    return new TestScenario({
      id: data.id ?? '',
      name: data.name ?? '',
      description: data.description ?? '',
      acceptanceCriterionId: data.acceptanceCriterionId ?? '',
      testFunctionName: data.testFunctionName ?? '',
    });
  }
}

/**
 * A task within a user story, assigned to a role.
 */
export class Task {
  /**
   * Create a Task.
   * @param {Object} props - Properties
   * @param {string} props.id - Task ID
   * @param {string} props.description - Task description
   * @param {string} props.role - Role responsible for this task
   * @param {string} [props.status='available'] - Current status
   * @param {string[]} [props.dependencies=[]] - IDs of dependent tasks
   * @param {string|null} [props.assignedAgent=null] - Agent ID if assigned
   * @param {string|null} [props.branch=null] - Git branch if assigned
   * @param {string|null} [props.prUrl=null] - PR URL if created
   * @param {Date|null} [props.createdAt=null] - Creation timestamp
   * @param {Date|null} [props.claimedAt=null] - Claim timestamp
   * @param {Date|null} [props.completedAt=null] - Completion timestamp
   */
  constructor({
    id,
    description,
    role,
    status = TaskStatus.AVAILABLE,
    dependencies = [],
    assignedAgent = null,
    branch = null,
    prUrl = null,
    createdAt = null,
    claimedAt = null,
    completedAt = null,
  }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.description = description;
    /** @type {string} */
    this.role = role;
    /** @type {string} */
    this.status = status;
    /** @type {string[]} */
    this.dependencies = dependencies;
    /** @type {string|null} */
    this.assignedAgent = assignedAgent;
    /** @type {string|null} */
    this.branch = branch;
    /** @type {string|null} */
    this.prUrl = prUrl;
    /** @type {Date|null} */
    this.createdAt = createdAt;
    /** @type {Date|null} */
    this.claimedAt = claimedAt;
    /** @type {Date|null} */
    this.completedAt = completedAt;
  }

  /**
   * Return list of dependencies not yet completed.
   * @param {Set<string>} completedTaskIds - Set of completed task IDs
   * @returns {string[]} List of blocking dependency IDs
   */
  isBlockedBy(completedTaskIds) {
    return this.dependencies.filter((dep) => !completedTaskIds.has(dep));
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').TaskData}
   */
  toDict() {
    return {
      id: this.id,
      description: this.description,
      role: this.role,
      status: this.status,
      dependencies: this.dependencies,
      assignedAgent: this.assignedAgent,
      branch: this.branch,
      prUrl: this.prUrl,
      createdAt: this.createdAt?.toISOString() ?? null,
      claimedAt: this.claimedAt?.toISOString() ?? null,
      completedAt: this.completedAt?.toISOString() ?? null,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').TaskData} data - Plain object data
   * @returns {Task}
   */
  static fromDict(data) {
    return new Task({
      id: data.id ?? '',
      description: data.description ?? '',
      role: data.role ?? '',
      status: data.status ?? TaskStatus.AVAILABLE,
      dependencies: data.dependencies ?? [],
      assignedAgent: data.assignedAgent ?? null,
      branch: data.branch ?? null,
      prUrl: data.prUrl ?? null,
      createdAt: data.createdAt ? new Date(data.createdAt) : null,
      claimedAt: data.claimedAt ? new Date(data.claimedAt) : null,
      completedAt: data.completedAt ? new Date(data.completedAt) : null,
    });
  }
}

/**
 * A user story with acceptance criteria and tasks.
 */
export class Story {
  /**
   * Create a Story.
   * @param {Object} props - Properties
   * @param {string} props.id - Story ID
   * @param {string} props.title - Story title
   * @param {string} props.epicId - Parent epic ID
   * @param {string} [props.status='not_started'] - Story status
   * @param {string} [props.asA=''] - User role (As a...)
   * @param {string} [props.iWant=''] - Feature description (I want...)
   * @param {string} [props.soThat=''] - Benefit (So that...)
   * @param {AcceptanceCriterion[]} [props.acceptanceCriteria=[]] - Acceptance criteria
   * @param {TestScenario[]} [props.testScenarios=[]] - Test scenarios
   * @param {Task[]} [props.tasks=[]] - Tasks in this story
   * @param {string[]} [props.dependencies=[]] - Dependent story IDs
   * @param {string[]} [props.blocks=[]] - Story IDs this story blocks
   * @param {string} [props.technicalNotes=''] - Technical notes
   */
  constructor({
    id,
    title,
    epicId,
    status = StoryStatus.NOT_STARTED,
    asA = '',
    iWant = '',
    soThat = '',
    acceptanceCriteria = [],
    testScenarios = [],
    tasks = [],
    dependencies = [],
    blocks = [],
    technicalNotes = '',
  }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.title = title;
    /** @type {string} */
    this.epicId = epicId;
    /** @type {string} */
    this.status = status;
    /** @type {string} */
    this.asA = asA;
    /** @type {string} */
    this.iWant = iWant;
    /** @type {string} */
    this.soThat = soThat;
    /** @type {AcceptanceCriterion[]} */
    this.acceptanceCriteria = acceptanceCriteria;
    /** @type {TestScenario[]} */
    this.testScenarios = testScenarios;
    /** @type {Task[]} */
    this.tasks = tasks;
    /** @type {string[]} */
    this.dependencies = dependencies;
    /** @type {string[]} */
    this.blocks = blocks;
    /** @type {string} */
    this.technicalNotes = technicalNotes;
  }

  /**
   * Return formatted user story text.
   * @returns {string}
   */
  get userStoryText() {
    return `As a ${this.asA}, I want ${this.iWant} so that ${this.soThat}`;
  }

  /**
   * Get all tasks for a specific role.
   * @param {string} role - Role to filter by
   * @returns {Task[]}
   */
  getTasksByRole(role) {
    return this.tasks.filter((t) => t.role === role);
  }

  /**
   * Get tasks that are available (not blocked by dependencies).
   * @param {Set<string>} completedTaskIds - Set of completed task IDs
   * @returns {Task[]}
   */
  getAvailableTasks(completedTaskIds) {
    const available = [];
    for (const task of this.tasks) {
      if (task.status === TaskStatus.AVAILABLE) {
        const blockedBy = task.isBlockedBy(completedTaskIds);
        if (blockedBy.length === 0) {
          available.push(task);
        }
      }
    }
    return available;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').StoryData}
   */
  toDict() {
    return {
      id: this.id,
      title: this.title,
      epicId: this.epicId,
      status: this.status,
      asA: this.asA,
      iWant: this.iWant,
      soThat: this.soThat,
      acceptanceCriteria: this.acceptanceCriteria.map((ac) => ac.toDict()),
      testScenarios: this.testScenarios.map((ts) => ts.toDict()),
      tasks: this.tasks.map((t) => t.toDict()),
      dependencies: this.dependencies,
      blocks: this.blocks,
      technicalNotes: this.technicalNotes,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').StoryData} data - Plain object data
   * @returns {Story}
   */
  static fromDict(data) {
    return new Story({
      id: data.id ?? '',
      title: data.title ?? '',
      epicId: data.epicId ?? '',
      status: data.status ?? StoryStatus.NOT_STARTED,
      asA: data.asA ?? '',
      iWant: data.iWant ?? '',
      soThat: data.soThat ?? '',
      acceptanceCriteria: (data.acceptanceCriteria ?? []).map(AcceptanceCriterion.fromDict),
      testScenarios: (data.testScenarios ?? []).map(TestScenario.fromDict),
      tasks: (data.tasks ?? []).map(Task.fromDict),
      dependencies: data.dependencies ?? [],
      blocks: data.blocks ?? [],
      technicalNotes: data.technicalNotes ?? '',
    });
  }
}

/**
 * An epic containing multiple user stories.
 */
export class Epic {
  /**
   * Create an Epic.
   * @param {Object} props - Properties
   * @param {string} props.id - Epic ID
   * @param {string} props.title - Epic title
   * @param {string} props.description - Epic description
   * @param {string} [props.status='not_started'] - Epic status
   * @param {string|null} [props.milestoneId=null] - Parent milestone ID
   * @param {string} [props.priority='medium'] - Priority level
   * @param {string[]} [props.dependencies=[]] - Dependent epic IDs
   * @param {Story[]} [props.stories=[]] - Stories in this epic
   */
  constructor({
    id,
    title,
    description,
    status = EpicStatus.NOT_STARTED,
    milestoneId = null,
    priority = 'medium',
    dependencies = [],
    stories = [],
  }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.title = title;
    /** @type {string} */
    this.description = description;
    /** @type {string} */
    this.status = status;
    /** @type {string|null} */
    this.milestoneId = milestoneId;
    /** @type {string} */
    this.priority = priority;
    /** @type {string[]} */
    this.dependencies = dependencies;
    /** @type {Story[]} */
    this.stories = stories;
  }

  /**
   * Get all tasks across all stories.
   * @returns {Task[]}
   */
  getAllTasks() {
    const tasks = [];
    for (const story of this.stories) {
      tasks.push(...story.tasks);
    }
    return tasks;
  }

  /**
   * Get all tasks for a specific role across all stories.
   * @param {string} role - Role to filter by
   * @returns {Task[]}
   */
  getTasksByRole(role) {
    const tasks = [];
    for (const story of this.stories) {
      tasks.push(...story.getTasksByRole(role));
    }
    return tasks;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').EpicData}
   */
  toDict() {
    return {
      id: this.id,
      title: this.title,
      description: this.description,
      status: this.status,
      milestoneId: this.milestoneId,
      priority: this.priority,
      dependencies: this.dependencies,
      stories: this.stories.map((s) => s.toDict()),
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').EpicData} data - Plain object data
   * @returns {Epic}
   */
  static fromDict(data) {
    return new Epic({
      id: data.id ?? '',
      title: data.title ?? '',
      description: data.description ?? '',
      status: data.status ?? EpicStatus.NOT_STARTED,
      milestoneId: data.milestoneId ?? null,
      priority: data.priority ?? 'medium',
      dependencies: data.dependencies ?? [],
      stories: (data.stories ?? []).map(Story.fromDict),
    });
  }
}

/**
 * A milestone containing multiple epics.
 */
export class Milestone {
  /**
   * Create a Milestone.
   * @param {Object} props - Properties
   * @param {string} props.id - Milestone ID
   * @param {string} props.name - Milestone name
   * @param {string} props.description - Milestone description
   * @param {string[]} [props.epicIds=[]] - Epic IDs in this milestone
   * @param {Date|null} [props.targetDate=null] - Target completion date
   * @param {boolean} [props.completed=false] - Whether milestone is complete
   * @param {string|null} [props.prUrl=null] - PR URL for milestone merge
   */
  constructor({
    id,
    name,
    description,
    epicIds = [],
    targetDate = null,
    completed = false,
    prUrl = null,
  }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.description = description;
    /** @type {string[]} */
    this.epicIds = epicIds;
    /** @type {Date|null} */
    this.targetDate = targetDate;
    /** @type {boolean} */
    this.completed = completed;
    /** @type {string|null} */
    this.prUrl = prUrl;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').MilestoneData}
   */
  toDict() {
    return {
      id: this.id,
      name: this.name,
      description: this.description,
      epicIds: this.epicIds,
      targetDate: this.targetDate?.toISOString() ?? null,
      completed: this.completed,
      prUrl: this.prUrl,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').MilestoneData} data - Plain object data
   * @returns {Milestone}
   */
  static fromDict(data) {
    return new Milestone({
      id: data.id ?? '',
      name: data.name ?? '',
      description: data.description ?? '',
      epicIds: data.epicIds ?? [],
      targetDate: data.targetDate ? new Date(data.targetDate) : null,
      completed: data.completed ?? false,
      prUrl: data.prUrl ?? null,
    });
  }
}

/**
 * An agent persona definition.
 */
export class Persona {
  /**
   * Create a Persona.
   * @param {Object} props - Properties
   * @param {string} props.id - Persona ID
   * @param {string} props.name - Persona name
   * @param {string} props.role - Role identifier
   * @param {string[]} [props.capabilities=[]] - List of capabilities
   * @param {string[]} [props.constraints=[]] - List of constraints
   * @param {string} [props.claudeMdTemplate=''] - Template for .claude.md file
   */
  constructor({
    id,
    name,
    role,
    capabilities = [],
    constraints = [],
    claudeMdTemplate = '',
  }) {
    /** @type {string} */
    this.id = id;
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.role = role;
    /** @type {string[]} */
    this.capabilities = capabilities;
    /** @type {string[]} */
    this.constraints = constraints;
    /** @type {string} */
    this.claudeMdTemplate = claudeMdTemplate;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').PersonaData}
   */
  toDict() {
    return {
      id: this.id,
      name: this.name,
      role: this.role,
      capabilities: this.capabilities,
      constraints: this.constraints,
      claudeMdTemplate: this.claudeMdTemplate,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').PersonaData} data - Plain object data
   * @returns {Persona}
   */
  static fromDict(data) {
    return new Persona({
      id: data.id ?? '',
      name: data.name ?? '',
      role: data.role ?? '',
      capabilities: data.capabilities ?? [],
      constraints: data.constraints ?? [],
      claudeMdTemplate: data.claudeMdTemplate ?? '',
    });
  }
}

/**
 * Complete project plan with all components.
 */
export class ProjectPlan {
  /**
   * Create a ProjectPlan.
   * @param {Object} props - Properties
   * @param {string} props.name - Project name
   * @param {string} props.description - Project description
   * @param {Epic[]} [props.epics=[]] - All epics
   * @param {Milestone[]} [props.milestones=[]] - All milestones
   * @param {Persona[]} [props.personas=[]] - All personas
   */
  constructor({
    name,
    description,
    epics = [],
    milestones = [],
    personas = [],
  }) {
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.description = description;
    /** @type {Epic[]} */
    this.epics = epics;
    /** @type {Milestone[]} */
    this.milestones = milestones;
    /** @type {Persona[]} */
    this.personas = personas;
  }

  /**
   * Get all tasks across all epics and stories.
   * @returns {Task[]}
   */
  getAllTasks() {
    const tasks = [];
    for (const epic of this.epics) {
      tasks.push(...epic.getAllTasks());
    }
    return tasks;
  }

  /**
   * Get all stories across all epics.
   * @returns {Story[]}
   */
  getAllStories() {
    const stories = [];
    for (const epic of this.epics) {
      stories.push(...epic.stories);
    }
    return stories;
  }

  /**
   * Get all tasks for a specific role.
   * @param {string} role - Role to filter by
   * @returns {Task[]}
   */
  getTasksByRole(role) {
    const tasks = [];
    for (const epic of this.epics) {
      tasks.push(...epic.getTasksByRole(role));
    }
    return tasks;
  }

  /**
   * Get tasks available for a role (not blocked by dependencies).
   * @param {string} role - Role to filter by
   * @returns {Task[]}
   */
  getAvailableTasksForRole(role) {
    const completedTaskIds = new Set(
      this.getAllTasks()
        .filter((t) => t.status === TaskStatus.COMPLETE)
        .map((t) => t.id)
    );

    const available = [];
    for (const epic of this.epics) {
      for (const story of epic.stories) {
        for (const task of story.getAvailableTasks(completedTaskIds)) {
          if (task.role === role) {
            available.push(task);
          }
        }
      }
    }
    return available;
  }

  /**
   * Find a task by ID.
   * @param {string} taskId - Task ID to find
   * @returns {Task|null}
   */
  getTaskById(taskId) {
    for (const task of this.getAllTasks()) {
      if (task.id === taskId) {
        return task;
      }
    }
    return null;
  }

  /**
   * Find a story by ID.
   * @param {string} storyId - Story ID to find
   * @returns {Story|null}
   */
  getStoryById(storyId) {
    for (const story of this.getAllStories()) {
      if (story.id === storyId) {
        return story;
      }
    }
    return null;
  }

  /**
   * Find an epic by ID.
   * @param {string} epicId - Epic ID to find
   * @returns {Epic|null}
   */
  getEpicById(epicId) {
    for (const epic of this.epics) {
      if (epic.id === epicId) {
        return epic;
      }
    }
    return null;
  }

  /**
   * Find a persona by role.
   * @param {string} role - Role to find
   * @returns {Persona|null}
   */
  getPersonaByRole(role) {
    for (const persona of this.personas) {
      if (persona.role === role) {
        return persona;
      }
    }
    return null;
  }

  /**
   * Find a milestone by ID.
   * @param {string} milestoneId - Milestone ID to find
   * @returns {Milestone|null}
   */
  getMilestoneById(milestoneId) {
    for (const milestone of this.milestones) {
      if (milestone.id === milestoneId) {
        return milestone;
      }
    }
    return null;
  }

  /**
   * Get all epics for a milestone.
   * @param {string} milestoneId - Milestone ID
   * @returns {Epic[]}
   */
  getEpicsForMilestone(milestoneId) {
    const milestone = this.getMilestoneById(milestoneId);
    if (!milestone) {
      return [];
    }
    return this.epics.filter((e) => milestone.epicIds.includes(e.id));
  }

  /**
   * Check if all tasks in a milestone are complete.
   * @param {string} milestoneId - Milestone ID
   * @returns {boolean}
   */
  isMilestoneComplete(milestoneId) {
    const epics = this.getEpicsForMilestone(milestoneId);
    for (const epic of epics) {
      for (const task of epic.getAllTasks()) {
        if (task.status !== TaskStatus.COMPLETE) {
          return false;
        }
      }
    }
    return true;
  }

  /**
   * Get all unique roles from personas.
   * @returns {string[]}
   */
  getRoles() {
    return [...new Set(this.personas.map((p) => p.role))];
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').ProjectPlanData}
   */
  toDict() {
    return {
      name: this.name,
      description: this.description,
      epics: this.epics.map((e) => e.toDict()),
      milestones: this.milestones.map((m) => m.toDict()),
      personas: this.personas.map((p) => p.toDict()),
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').ProjectPlanData} data - Plain object data
   * @returns {ProjectPlan}
   */
  static fromDict(data) {
    return new ProjectPlan({
      name: data.name ?? '',
      description: data.description ?? '',
      epics: (data.epics ?? []).map(Epic.fromDict),
      milestones: (data.milestones ?? []).map(Milestone.fromDict),
      personas: (data.personas ?? []).map(Persona.fromDict),
    });
  }
}
