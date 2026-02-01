/**
 * @file Test fixtures for the orchestration framework.
 * @module tests/helpers/fixtures
 */

import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir } from 'node:os';

/**
 * Create a temporary directory for testing.
 * @returns {Promise<string>} Path to temp directory
 */
export async function createTempDir() {
  return mkdtemp(join(tmpdir(), 'orchestration-test-'));
}

/**
 * Remove a temporary directory.
 * @param {string} dir - Directory path
 * @returns {Promise<void>}
 */
export async function removeTempDir(dir) {
  await rm(dir, { recursive: true, force: true });
}

/**
 * Create a mock communications.json file.
 * @param {string} dir - Directory path
 * @param {Object} [data] - Initial data
 * @returns {Promise<string>} Path to communications.json
 */
export async function createMockCommFile(dir, data = {}) {
  const filepath = join(dir, 'communications.json');
  const defaultData = {
    _meta: {
      version: '1.0',
      lastUpdated: null,
      lastUpdatedBy: null,
    },
    ...data,
  };
  await writeFile(filepath, JSON.stringify(defaultData, null, 2));
  return filepath;
}

/**
 * Create a mock plan directory.
 * @param {string} dir - Base directory
 * @returns {Promise<string>} Path to plan directory
 */
export async function createMockPlanDir(dir) {
  const planDir = join(dir, 'plan');
  await mkdir(planDir, { recursive: true });
  await mkdir(join(planDir, 'personas'), { recursive: true });
  await mkdir(join(planDir, 'epics'), { recursive: true });

  // Create project.md
  await writeFile(
    join(planDir, 'project.md'),
    `# Test Project

A test project for the orchestration framework.

## Overview

This is a mock project for testing purposes.
`
  );

  // Create a persona
  await writeFile(
    join(planDir, 'personas', 'developer.md'),
    `# Developer

## Role
developer

## Capabilities
- Write code
- Fix bugs
- Write tests

## Constraints
- Must follow coding standards
- Must write tests for new code
`
  );

  // Create an epic
  await writeFile(
    join(planDir, 'epics', 'E001.md'),
    `# Epic: User Authentication

## Description
Implement user authentication for the application.

## Story: User Login

As a user, I want to log in, so that I can access my account.

### Task: [developer] Implement login form
### Task: [developer] Implement authentication API
`
  );

  // Create milestones.md
  await writeFile(
    join(planDir, 'milestones.md'),
    `# Milestones

## [M1] MVP Release

First release with basic functionality.

- Epic: E001
`
  );

  return planDir;
}

/**
 * Create a mock agent status.
 * @returns {Object}
 */
export function createMockAgentStatus() {
  return {
    mission: 'Test mission',
    workingOn: 'Test task',
    done: 'Previous work',
    next: 'Next task',
    requests: [],
    added: [],
    lastUpdated: new Date().toISOString(),
  };
}

/**
 * Create a mock task.
 * @param {Object} [overrides] - Property overrides
 * @returns {Object}
 */
export function createMockTask(overrides = {}) {
  return {
    id: 'T001',
    description: 'Test task',
    role: 'developer',
    status: 'available',
    dependencies: [],
    assignedAgent: null,
    branch: null,
    prUrl: null,
    createdAt: null,
    claimedAt: null,
    completedAt: null,
    ...overrides,
  };
}

/**
 * Create a mock project plan.
 * @returns {Object}
 */
export function createMockProjectPlan() {
  return {
    name: 'Test Project',
    description: 'A test project',
    epics: [
      {
        id: 'E001',
        title: 'Test Epic',
        description: 'Test epic description',
        status: 'not_started',
        milestoneId: 'M1',
        priority: 'high',
        dependencies: [],
        stories: [
          {
            id: 'S001',
            title: 'Test Story',
            epicId: 'E001',
            status: 'not_started',
            asA: 'user',
            iWant: 'test functionality',
            soThat: 'I can verify it works',
            acceptanceCriteria: [],
            testScenarios: [],
            tasks: [createMockTask()],
            dependencies: [],
            blocks: [],
            technicalNotes: '',
          },
        ],
      },
    ],
    milestones: [
      {
        id: 'M1',
        name: 'Milestone 1',
        description: 'First milestone',
        epicIds: ['E001'],
        targetDate: null,
        completed: false,
        prUrl: null,
      },
    ],
    personas: [
      {
        id: 'developer',
        name: 'Developer',
        role: 'developer',
        capabilities: ['Write code', 'Fix bugs'],
        constraints: ['Follow standards'],
        claudeMdTemplate: '',
      },
    ],
  };
}
