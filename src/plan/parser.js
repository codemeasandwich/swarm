/**
 * @file Markdown parser for project plans.
 * Parses plan directories containing project.md and persona files.
 * @module plan/parser
 */

import { readFile, readdir, access, constants } from 'node:fs/promises';
import { join, basename } from 'node:path';
import { PlanParseError } from '../orchestrator/errors.js';
import {
  ProjectPlan,
  Epic,
  Story,
  Task,
  Milestone,
  Persona,
  AcceptanceCriterion,
} from './models.js';
import { TaskStatus, StoryStatus, EpicStatus } from '../types/index.js';

/**
 * Parser for project plan markdown files.
 */
export class PlanParser {
  /**
   * Create a PlanParser.
   * @param {string} planDir - Directory containing plan files
   */
  constructor(planDir) {
    /** @type {string} */
    this.planDir = planDir;
  }

  /**
   * Parse the complete plan from the directory.
   * @returns {Promise<ProjectPlan>}
   * @throws {PlanParseError} If parsing fails
   */
  async parsePlan() {
    try {
      // Check if plan directory exists
      await access(this.planDir, constants.R_OK);
    } catch {
      throw new PlanParseError(`Plan directory not found: ${this.planDir}`);
    }

    // Parse main project file
    const projectPath = join(this.planDir, 'project.md');
    let projectContent;
    try {
      projectContent = await readFile(projectPath, 'utf-8');
    } catch {
      throw new PlanParseError(`Project file not found: ${projectPath}`, { file: projectPath });
    }

    const { name, description } = this._parseProjectFile(projectContent);

    // Parse personas
    const personas = await this._parsePersonasDir();

    // Parse epics and stories
    const epics = await this._parseEpicsDir();

    // Parse milestones
    const milestones = await this._parseMilestonesFile();

    return new ProjectPlan({
      name,
      description,
      epics,
      milestones,
      personas,
    });
  }

  /**
   * Parse the main project.md file.
   * @private
   * @param {string} content - File content
   * @returns {{name: string, description: string}}
   */
  _parseProjectFile(content) {
    const lines = content.split('\n');
    let name = '';
    let description = '';
    let inDescription = false;

    for (const line of lines) {
      if (line.startsWith('# ')) {
        name = line.slice(2).trim();
        inDescription = true;
      } else if (inDescription && line.startsWith('## ')) {
        break;
      } else if (inDescription) {
        description += line + '\n';
      }
    }

    return {
      name,
      description: description.trim(),
    };
  }

  /**
   * Parse personas from the personas directory.
   * @private
   * @returns {Promise<Persona[]>}
   */
  async _parsePersonasDir() {
    const personasDir = join(this.planDir, 'personas');
    const personas = [];

    try {
      await access(personasDir, constants.R_OK);
      const files = await readdir(personasDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const content = await readFile(join(personasDir, file), 'utf-8');
        const persona = this._parsePersonaFile(content, file);
        if (persona) {
          personas.push(persona);
        }
      }
    } catch {
      // Personas directory is optional
    }

    return personas;
  }

  /**
   * Parse a single persona file.
   * @private
   * @param {string} content - File content
   * @param {string} filename - File name
   * @returns {Persona|null}
   */
  _parsePersonaFile(content, filename) {
    const lines = content.split('\n');
    const id = basename(filename, '.md');
    let name = '';
    let role = '';
    const capabilities = [];
    const constraints = [];
    let claudeMdTemplate = '';

    let currentSection = '';

    for (const line of lines) {
      if (line.startsWith('# ')) {
        name = line.slice(2).trim();
      } else if (line.startsWith('## Role')) {
        currentSection = 'role';
      } else if (line.startsWith('## Capabilities')) {
        currentSection = 'capabilities';
      } else if (line.startsWith('## Constraints')) {
        currentSection = 'constraints';
      } else if (line.startsWith('## Template')) {
        currentSection = 'template';
      } else if (line.startsWith('## ')) {
        currentSection = '';
      } else if (currentSection === 'role' && line.trim()) {
        role = line.trim();
        currentSection = '';
      } else if (currentSection === 'capabilities' && line.startsWith('- ')) {
        capabilities.push(line.slice(2).trim());
      } else if (currentSection === 'constraints' && line.startsWith('- ')) {
        constraints.push(line.slice(2).trim());
      } else if (currentSection === 'template') {
        claudeMdTemplate += line + '\n';
      }
    }

    if (!name) return null;

    return new Persona({
      id,
      name,
      role: role || id,
      capabilities,
      constraints,
      claudeMdTemplate: claudeMdTemplate.trim(),
    });
  }

  /**
   * Parse epics from the epics directory.
   * @private
   * @returns {Promise<Epic[]>}
   */
  async _parseEpicsDir() {
    const epicsDir = join(this.planDir, 'epics');
    const epics = [];

    try {
      await access(epicsDir, constants.R_OK);
      const files = await readdir(epicsDir);

      for (const file of files) {
        if (!file.endsWith('.md')) continue;

        const content = await readFile(join(epicsDir, file), 'utf-8');
        const epic = this._parseEpicFile(content, file);
        if (epic) {
          epics.push(epic);
        }
      }
    } catch {
      // Epics directory is optional
    }

    return epics;
  }

  /**
   * Parse a single epic file.
   * @private
   * @param {string} content - File content
   * @param {string} filename - File name
   * @returns {Epic|null}
   */
  _parseEpicFile(content, filename) {
    const lines = content.split('\n');
    const id = basename(filename, '.md');
    let title = '';
    let description = '';
    let milestoneId = null;
    let priority = 'medium';
    const dependencies = [];
    const stories = [];

    let currentSection = '';
    let currentStory = null;
    let currentTask = null;

    for (let i = 0; i < lines.length; i++) {
      const line = lines[i];

      if (line.startsWith('# ')) {
        title = line.slice(2).trim();
        currentSection = 'description';
      } else if (line.startsWith('## Description')) {
        currentSection = 'description';
      } else if (line.startsWith('## Milestone:')) {
        milestoneId = line.split(':')[1]?.trim() || null;
      } else if (line.startsWith('## Priority:')) {
        priority = line.split(':')[1]?.trim() || 'medium';
      } else if (line.startsWith('## Dependencies')) {
        currentSection = 'dependencies';
      } else if (line.startsWith('## Story:') || line.startsWith('### Story:')) {
        // Save previous story
        if (currentStory) {
          if (currentTask) {
            currentStory.tasks.push(currentTask);
            currentTask = null;
          }
          stories.push(currentStory);
        }

        const storyTitle = line.split(':').slice(1).join(':').trim();
        const storyId = `${id}-S${stories.length + 1}`;
        currentStory = new Story({
          id: storyId,
          title: storyTitle,
          epicId: id,
        });
        currentSection = 'story';
      } else if (line.startsWith('### Task:') || line.startsWith('#### Task:')) {
        // Save previous task
        if (currentTask && currentStory) {
          currentStory.tasks.push(currentTask);
        }

        const taskParts = line.split(':').slice(1).join(':').trim();
        const taskMatch = taskParts.match(/\[([^\]]+)\]\s*(.*)/);
        const role = taskMatch ? taskMatch[1] : 'developer';
        const taskDesc = taskMatch ? taskMatch[2] : taskParts;
        const taskId = currentStory ? `${currentStory.id}-T${currentStory.tasks.length + 1}` : `T${i}`;

        currentTask = new Task({
          id: taskId,
          description: taskDesc,
          role,
        });
        currentSection = 'task';
      } else if (currentSection === 'description' && !line.startsWith('##')) {
        description += line + '\n';
      } else if (currentSection === 'dependencies' && line.startsWith('- ')) {
        dependencies.push(line.slice(2).trim());
      } else if (currentSection === 'story' && line.startsWith('As a ')) {
        // Parse user story format
        const storyMatch = line.match(/As a ([^,]+), I want ([^,]+), so that (.+)/i);
        if (storyMatch && currentStory) {
          currentStory.asA = storyMatch[1].trim();
          currentStory.iWant = storyMatch[2].trim();
          currentStory.soThat = storyMatch[3].trim();
        }
      } else if (currentSection === 'story' && line.startsWith('- AC:')) {
        // Parse acceptance criterion
        if (currentStory) {
          const acText = line.slice(5).trim();
          const acId = `${currentStory.id}-AC${currentStory.acceptanceCriteria.length + 1}`;
          currentStory.acceptanceCriteria.push(
            new AcceptanceCriterion({
              id: acId,
              description: acText,
            })
          );
        }
      }
    }

    // Save last story and task
    if (currentTask && currentStory) {
      currentStory.tasks.push(currentTask);
    }
    if (currentStory) {
      stories.push(currentStory);
    }

    if (!title) return null;

    return new Epic({
      id,
      title,
      description: description.trim(),
      milestoneId,
      priority,
      dependencies,
      stories,
    });
  }

  /**
   * Parse milestones from the milestones.md file.
   * @private
   * @returns {Promise<Milestone[]>}
   */
  async _parseMilestonesFile() {
    const milestonesPath = join(this.planDir, 'milestones.md');
    const milestones = [];

    try {
      const content = await readFile(milestonesPath, 'utf-8');
      const lines = content.split('\n');

      let currentMilestone = null;

      for (const line of lines) {
        if (line.startsWith('## ')) {
          if (currentMilestone) {
            milestones.push(currentMilestone);
          }

          const title = line.slice(3).trim();
          const idMatch = title.match(/\[([^\]]+)\]/);
          const id = idMatch ? idMatch[1] : `M${milestones.length + 1}`;
          const name = title.replace(/\[[^\]]+\]/, '').trim();

          currentMilestone = new Milestone({
            id,
            name,
            description: '',
          });
        } else if (currentMilestone) {
          if (line.startsWith('- Epic:')) {
            const epicId = line.split(':')[1]?.trim();
            if (epicId) {
              currentMilestone.epicIds.push(epicId);
            }
          } else if (line.startsWith('- Target:')) {
            const dateStr = line.split(':').slice(1).join(':').trim();
            try {
              currentMilestone.targetDate = new Date(dateStr);
            } catch {
              // Invalid date, ignore
            }
          } else if (line.trim() && !line.startsWith('-')) {
            currentMilestone.description += line + '\n';
          }
        }
      }

      if (currentMilestone) {
        milestones.push(currentMilestone);
      }
    } catch {
      // Milestones file is optional
    }

    return milestones;
  }

  /**
   * Parse a plan from JSON file.
   * Alternative to markdown parsing.
   * @param {string} jsonPath - Path to JSON file
   * @returns {Promise<ProjectPlan>}
   */
  async parseFromJson(jsonPath) {
    try {
      const content = await readFile(jsonPath, 'utf-8');
      const data = JSON.parse(content);
      return ProjectPlan.fromDict(data);
    } catch (error) {
      throw new PlanParseError(`Failed to parse JSON plan: ${error.message}`, {
        file: jsonPath,
        cause: error,
      });
    }
  }
}
