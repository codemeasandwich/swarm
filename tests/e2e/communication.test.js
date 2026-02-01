/**
 * @file E2E tests for agent communication flows.
 */

import { test, describe, before, after, beforeEach, afterEach } from 'node:test';
import assert from 'node:assert/strict';
import { join } from 'node:path';

import { CommunicationsFile } from '../../src/communication/communications-file.js';
import { Coordinator } from '../../src/communication/coordinator.js';
import { TaskAgent } from '../../src/communication/agent.js';
import { createTempDir, removeTempDir } from '../helpers/fixtures.js';

describe('Agent Communication', () => {
  /** @type {string} */
  let tempDir;
  /** @type {string} */
  let commFilePath;

  before(async () => {
    tempDir = await createTempDir();
    commFilePath = join(tempDir, 'communications.json');
  });

  after(async () => {
    await removeTempDir(tempDir);
  });

  describe('CommunicationsFile', () => {
    test('creates file if it does not exist', async () => {
      const commFile = new CommunicationsFile(commFilePath);
      const data = await commFile.readRaw();

      assert.ok(data._meta);
      assert.equal(data._meta.version, '1.0');
    });

    test('updates agent status', async () => {
      const commFile = new CommunicationsFile(commFilePath);
      const { AgentStatus } = await import('../../src/communication/agent-status.js');

      const status = new AgentStatus({
        mission: 'Test mission',
        workingOn: 'Testing',
      });

      await commFile.updateAgent('test_agent', status);

      const retrieved = await commFile.getAgent('test_agent');
      assert.equal(retrieved.mission, 'Test mission');
      assert.equal(retrieved.workingOn, 'Testing');
    });

    test('adds and retrieves requests', async () => {
      const commFile = new CommunicationsFile(commFilePath);

      await commFile.addRequest('agent_a', 'agent_b', 'Please do X');

      const requests = await commFile.getRequestsForAgent('agent_b');
      assert.equal(requests.length, 1);
      assert.equal(requests[0].fromAgent, 'agent_a');
      assert.equal(requests[0].request, 'Please do X');
    });

    test('completes requests', async () => {
      const commFile = new CommunicationsFile(commFilePath);

      await commFile.addRequest('requester', 'completer', 'Do task');
      await commFile.completeRequest('completer', 'requester', 'Do task', 'Task done');

      const data = await commFile.readRaw();
      assert.ok(data.requester.added);
      assert.equal(data.requester.added.length, 1);
      assert.equal(data.requester.added[0][0], 'completer');
      assert.equal(data.requester.added[0][1], 'Task done');
    });
  });

  describe('Coordinator', () => {
    /** @type {Coordinator} */
    let coordinator;

    beforeEach(async () => {
      // Reset the communications file
      const commFile = new CommunicationsFile(commFilePath);
      await commFile.reset();

      coordinator = new Coordinator(commFilePath);
      await coordinator.start();
    });

    afterEach(async () => {
      await coordinator.stop();
    });

    test('creates and manages agents', async () => {
      const agent = coordinator.createAgent(TaskAgent, 'test_agent');

      assert.ok(agent);
      assert.equal(agent.name, 'test_agent');
      assert.ok(coordinator.getAgent('test_agent'));
    });

    test('agents can communicate', async () => {
      const sender = coordinator.createAgent(TaskAgent, 'sender');
      const receiver = coordinator.createAgent(TaskAgent, 'receiver');

      await sender.request('receiver', 'Hello from sender');

      const requests = await receiver.getPendingRequests();
      assert.equal(requests.length, 1);
      assert.equal(requests[0].fromAgent, 'sender');
    });

    test('agents can complete requests', async () => {
      const requester = coordinator.createAgent(TaskAgent, 'requester');
      const worker = coordinator.createAgent(TaskAgent, 'worker');

      await requester.request('worker', 'Do something');

      // Worker completes the request
      await worker.completeRequest('requester', 'Do something', 'Done!');

      const deliveries = await requester.getMyDeliveries();
      assert.equal(deliveries.length, 1);
      assert.equal(deliveries[0].fromAgent, 'worker');
      assert.equal(deliveries[0].description, 'Done!');
    });
  });
});
