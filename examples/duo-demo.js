#!/usr/bin/env node
/**
 * @file Duo demo - demonstrates two agents working together.
 *
 * This demo shows basic agent coordination:
 * - Researcher gathers information
 * - Coder implements based on research
 */

import { Coordinator, TaskAgent } from '../src/communication/index.js';

/**
 * Sleep utility.
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run the duo demo.
 * @returns {Promise<void>}
 */
async function main() {
  console.log('='.repeat(60));
  console.log('  DUO AGENT DEMO');
  console.log('='.repeat(60));

  const coordinator = new Coordinator('communications.json');
  await coordinator.start();

  // Create agents
  const researcher = coordinator.createAgent(TaskAgent, 'researcher');
  const coder = coordinator.createAgent(TaskAgent, 'coder');

  // Researcher starts work
  console.log('\n--- Researcher begins work ---');
  await researcher.setMission('Research authentication best practices');
  await researcher.setWorkingOn('Reviewing OAuth 2.0 specifications');

  await sleep(500);

  // Coder sends request
  console.log('\n--- Coder requests research ---');
  await coder.setMission('Implement authentication system');
  await coder.request('researcher', 'Need auth implementation guidelines');

  await sleep(500);

  // Researcher completes research
  console.log('\n--- Researcher completes research ---');
  await researcher.setDone('Documented auth best practices');
  await researcher.completeRequest(
    'coder',
    'Need auth implementation guidelines',
    'Use JWT with refresh tokens. See docs/auth-spec.md'
  );

  await sleep(500);

  // Coder receives and implements
  console.log('\n--- Coder implements based on research ---');
  const deliveries = await coder.getMyDeliveries();
  console.log(`Coder received ${deliveries.length} deliveries`);
  await coder.acknowledgeDeliveries();
  await coder.setWorkingOn('Implementing JWT authentication');

  await sleep(500);

  // Show final status
  console.log('\n--- Final Status ---');
  const status = await coordinator.getAllStatus();
  for (const [name, agentStatus] of status) {
    console.log(`${name}:`);
    console.log(`  Mission: ${agentStatus.mission}`);
    console.log(`  Working on: ${agentStatus.workingOn}`);
    console.log(`  Done: ${agentStatus.done}`);
  }

  await coordinator.stop();
}

main().catch(console.error);
