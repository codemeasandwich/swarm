/**
 * @file E2E tests for plan models.
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';

import {
  Task,
  Story,
  Epic,
  Milestone,
  Persona,
  ProjectPlan,
} from '../../src/plan/models.js';
import { TaskStatus, StoryStatus, EpicStatus } from '../../src/types/index.js';
import { PlanValidator } from '../../src/plan/validator.js';
import { createMockProjectPlan } from '../helpers/fixtures.js';

describe('Plan Models', () => {
  describe('Task', () => {
    test('creates task with defaults', () => {
      const task = new Task({
        id: 'T001',
        description: 'Test task',
        role: 'developer',
      });

      assert.equal(task.id, 'T001');
      assert.equal(task.description, 'Test task');
      assert.equal(task.role, 'developer');
      assert.equal(task.status, TaskStatus.AVAILABLE);
      assert.deepEqual(task.dependencies, []);
    });

    test('serializes and deserializes', () => {
      const task = new Task({
        id: 'T001',
        description: 'Test task',
        role: 'developer',
        status: TaskStatus.IN_PROGRESS,
        dependencies: ['T000'],
      });

      const dict = task.toDict();
      const restored = Task.fromDict(dict);

      assert.equal(restored.id, task.id);
      assert.equal(restored.status, task.status);
      assert.deepEqual(restored.dependencies, task.dependencies);
    });

    test('checks blocked dependencies', () => {
      const task = new Task({
        id: 'T002',
        description: 'Dependent task',
        role: 'developer',
        dependencies: ['T001', 'T003'],
      });

      const completedIds = new Set(['T001']);
      const blocked = task.isBlockedBy(completedIds);

      assert.deepEqual(blocked, ['T003']);
    });
  });

  describe('ProjectPlan', () => {
    test('creates from mock data', () => {
      const data = createMockProjectPlan();
      const plan = ProjectPlan.fromDict(data);

      assert.equal(plan.name, 'Test Project');
      assert.equal(plan.epics.length, 1);
      assert.equal(plan.milestones.length, 1);
      assert.equal(plan.personas.length, 1);
    });

    test('gets all tasks', () => {
      const data = createMockProjectPlan();
      const plan = ProjectPlan.fromDict(data);

      const tasks = plan.getAllTasks();
      assert.equal(tasks.length, 1);
      assert.equal(tasks[0].id, 'T001');
    });

    test('gets tasks by role', () => {
      const data = createMockProjectPlan();
      const plan = ProjectPlan.fromDict(data);

      const tasks = plan.getTasksByRole('developer');
      assert.equal(tasks.length, 1);

      const noTasks = plan.getTasksByRole('designer');
      assert.equal(noTasks.length, 0);
    });

    test('finds task by ID', () => {
      const data = createMockProjectPlan();
      const plan = ProjectPlan.fromDict(data);

      const task = plan.getTaskById('T001');
      assert.ok(task);
      assert.equal(task.id, 'T001');

      const notFound = plan.getTaskById('T999');
      assert.equal(notFound, null);
    });

    test('checks milestone completion', () => {
      const data = createMockProjectPlan();
      const plan = ProjectPlan.fromDict(data);

      // Initially not complete
      assert.equal(plan.isMilestoneComplete('M1'), false);

      // Mark task as complete
      const task = plan.getTaskById('T001');
      task.status = TaskStatus.COMPLETE;

      assert.equal(plan.isMilestoneComplete('M1'), true);
    });
  });

  describe('PlanValidator', () => {
    test('validates valid plan', () => {
      const data = createMockProjectPlan();
      const plan = ProjectPlan.fromDict(data);
      const validator = new PlanValidator();

      const result = validator.validate(plan);
      assert.equal(result.isValid, true);
    });

    test('detects missing task role', () => {
      const data = createMockProjectPlan();
      data.epics[0].stories[0].tasks[0].role = '';
      const plan = ProjectPlan.fromDict(data);
      const validator = new PlanValidator();

      const result = validator.validate(plan);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('role')));
    });

    test('detects circular dependencies', () => {
      const data = createMockProjectPlan();
      data.epics[0].stories[0].tasks.push({
        id: 'T002',
        description: 'Second task',
        role: 'developer',
        status: 'available',
        dependencies: ['T001'],
      });
      data.epics[0].stories[0].tasks[0].dependencies = ['T002'];

      const plan = ProjectPlan.fromDict(data);
      const validator = new PlanValidator();

      const result = validator.validate(plan);
      assert.equal(result.isValid, false);
      assert.ok(result.errors.some((e) => e.includes('Circular')));
    });
  });
});
