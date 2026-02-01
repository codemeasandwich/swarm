/**
 * @file Plan validation logic.
 * Validates project plans for consistency and completeness.
 * @module plan/validator
 */

import { TaskStatus } from '../types/index.js';

/**
 * @typedef {Object} ValidationResult
 * @property {boolean} isValid - Whether validation passed
 * @property {string[]} errors - List of error messages
 * @property {string[]} warnings - List of warning messages
 */

/**
 * Validator for project plans.
 */
export class PlanValidator {
  /**
   * Create a PlanValidator.
   */
  constructor() {
    /** @private @type {string[]} */
    this._errors = [];
    /** @private @type {string[]} */
    this._warnings = [];
  }

  /**
   * Validate a project plan.
   * @param {import('./models.js').ProjectPlan} plan - Plan to validate
   * @returns {ValidationResult}
   */
  validate(plan) {
    this._errors = [];
    this._warnings = [];

    this._validateBasicStructure(plan);
    this._validateTaskDependencies(plan);
    this._validatePersonas(plan);
    this._validateMilestones(plan);
    this._validateUniqueIds(plan);
    this._validateTaskRoles(plan);

    return {
      isValid: this._errors.length === 0,
      errors: [...this._errors],
      warnings: [...this._warnings],
    };
  }

  /**
   * Validate basic plan structure.
   * @private
   * @param {import('./models.js').ProjectPlan} plan
   */
  _validateBasicStructure(plan) {
    if (!plan.name) {
      this._errors.push('Plan must have a name');
    }

    if (plan.epics.length === 0) {
      this._warnings.push('Plan has no epics');
    }

    for (const epic of plan.epics) {
      if (!epic.id) {
        this._errors.push('Epic must have an ID');
      }
      if (!epic.title) {
        this._errors.push(`Epic ${epic.id || '(no ID)'} must have a title`);
      }

      if (epic.stories.length === 0) {
        this._warnings.push(`Epic ${epic.id} has no stories`);
      }

      for (const story of epic.stories) {
        if (!story.id) {
          this._errors.push('Story must have an ID');
        }
        if (!story.title) {
          this._errors.push(`Story ${story.id || '(no ID)'} must have a title`);
        }

        if (story.tasks.length === 0) {
          this._warnings.push(`Story ${story.id} has no tasks`);
        }

        for (const task of story.tasks) {
          if (!task.id) {
            this._errors.push('Task must have an ID');
          }
          if (!task.description) {
            this._errors.push(`Task ${task.id || '(no ID)'} must have a description`);
          }
          if (!task.role) {
            this._errors.push(`Task ${task.id} must have a role`);
          }
        }
      }
    }
  }

  /**
   * Validate task dependencies.
   * @private
   * @param {import('./models.js').ProjectPlan} plan
   */
  _validateTaskDependencies(plan) {
    const allTaskIds = new Set(plan.getAllTasks().map((t) => t.id));

    for (const task of plan.getAllTasks()) {
      for (const depId of task.dependencies) {
        if (!allTaskIds.has(depId)) {
          this._errors.push(`Task ${task.id} has unknown dependency: ${depId}`);
        }

        if (depId === task.id) {
          this._errors.push(`Task ${task.id} depends on itself`);
        }
      }
    }

    // Check for circular dependencies
    const visited = new Set();
    const recursionStack = new Set();

    const hasCycle = (taskId, path = []) => {
      if (recursionStack.has(taskId)) {
        const cycleStart = path.indexOf(taskId);
        const cycle = path.slice(cycleStart).concat(taskId);
        this._errors.push(`Circular dependency detected: ${cycle.join(' -> ')}`);
        return true;
      }

      if (visited.has(taskId)) {
        return false;
      }

      visited.add(taskId);
      recursionStack.add(taskId);

      const task = plan.getTaskById(taskId);
      if (task) {
        for (const depId of task.dependencies) {
          if (hasCycle(depId, [...path, taskId])) {
            return true;
          }
        }
      }

      recursionStack.delete(taskId);
      return false;
    };

    for (const task of plan.getAllTasks()) {
      visited.clear();
      recursionStack.clear();
      hasCycle(task.id);
    }
  }

  /**
   * Validate personas configuration.
   * @private
   * @param {import('./models.js').ProjectPlan} plan
   */
  _validatePersonas(plan) {
    if (plan.personas.length === 0) {
      this._warnings.push('Plan has no personas defined');
      return;
    }

    const roles = new Set();
    for (const persona of plan.personas) {
      if (!persona.id) {
        this._errors.push('Persona must have an ID');
      }
      if (!persona.role) {
        this._errors.push(`Persona ${persona.id || '(no ID)'} must have a role`);
      }
      if (roles.has(persona.role)) {
        this._warnings.push(`Duplicate persona role: ${persona.role}`);
      }
      roles.add(persona.role);
    }
  }

  /**
   * Validate milestones configuration.
   * @private
   * @param {import('./models.js').ProjectPlan} plan
   */
  _validateMilestones(plan) {
    const epicIds = new Set(plan.epics.map((e) => e.id));

    for (const milestone of plan.milestones) {
      if (!milestone.id) {
        this._errors.push('Milestone must have an ID');
      }
      if (!milestone.name) {
        this._errors.push(`Milestone ${milestone.id || '(no ID)'} must have a name`);
      }

      for (const epicId of milestone.epicIds) {
        if (!epicIds.has(epicId)) {
          this._errors.push(`Milestone ${milestone.id} references unknown epic: ${epicId}`);
        }
      }

      if (milestone.epicIds.length === 0) {
        this._warnings.push(`Milestone ${milestone.id} has no epics`);
      }
    }

    // Check for epics not in any milestone
    const milestonedEpics = new Set(plan.milestones.flatMap((m) => m.epicIds));
    for (const epic of plan.epics) {
      if (!milestonedEpics.has(epic.id)) {
        this._warnings.push(`Epic ${epic.id} is not in any milestone`);
      }
    }
  }

  /**
   * Validate unique IDs across all entities.
   * @private
   * @param {import('./models.js').ProjectPlan} plan
   */
  _validateUniqueIds(plan) {
    const ids = new Map();

    const checkId = (type, id) => {
      if (ids.has(id)) {
        this._errors.push(`Duplicate ID: ${id} (${type} and ${ids.get(id)})`);
      } else {
        ids.set(id, type);
      }
    };

    for (const epic of plan.epics) {
      checkId('Epic', epic.id);
      for (const story of epic.stories) {
        checkId('Story', story.id);
        for (const task of story.tasks) {
          checkId('Task', task.id);
        }
        for (const ac of story.acceptanceCriteria) {
          checkId('AcceptanceCriterion', ac.id);
        }
      }
    }

    for (const milestone of plan.milestones) {
      checkId('Milestone', milestone.id);
    }

    for (const persona of plan.personas) {
      checkId('Persona', persona.id);
    }
  }

  /**
   * Validate that task roles match defined personas.
   * @private
   * @param {import('./models.js').ProjectPlan} plan
   */
  _validateTaskRoles(plan) {
    if (plan.personas.length === 0) {
      return; // Can't validate if no personas defined
    }

    const roles = new Set(plan.personas.map((p) => p.role));

    for (const task of plan.getAllTasks()) {
      if (!roles.has(task.role)) {
        this._warnings.push(`Task ${task.id} has role "${task.role}" which is not defined in personas`);
      }
    }
  }

  /**
   * Quick validation check - returns true/false without details.
   * @param {import('./models.js').ProjectPlan} plan - Plan to validate
   * @returns {boolean}
   */
  isValid(plan) {
    return this.validate(plan).isValid;
  }
}
