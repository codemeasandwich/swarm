#!/usr/bin/env node
/**
 * @file Blocking demo - demonstrates agent request/response with dependency blocking.
 *
 * This demo shows two agents coordinating work:
 * - Designer creates a design
 * - Builder waits for design to be delivered before building
 */

import { Coordinator, TaskAgent } from '../src/communication/index.js';

/**
 * Sleep utility.
 * @param {number} ms - Milliseconds
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Run the blocking demo.
 * @returns {Promise<void>}
 */
async function main() {
  console.log('='.repeat(60));
  console.log('  AGENT BLOCKING DEMO');
  console.log('='.repeat(60));

  const coordinator = new Coordinator('communications.json');
  await coordinator.start();

  // Create agents
  const designer = coordinator.createAgent(TaskAgent, 'designer');
  const builder = coordinator.createAgent(TaskAgent, 'builder');

  await sleep(500);

  // Builder sends request to designer
  console.log('\n--- Builder requests design ---');
  await builder.setMission('Build the user interface');
  await builder.request('designer', 'Please create the UI design mockups');

  await sleep(1000);

  // Designer checks requests
  console.log('\n--- Designer checks requests ---');
  const requests = await designer.getPendingRequests();
  for (const { fromAgent, request } of requests) {
    console.log(`  Request from ${fromAgent}: ${request}`);
  }

  // Designer works on the request
  await designer.setMission('Create UI designs');
  await designer.setWorkingOn('Creating mockups for builder');

  await sleep(1000);

  // Designer completes the request
  console.log('\n--- Designer completes request ---');
  await designer.completeRequest(
    'builder',
    'Please create the UI design mockups',
    'Mockups completed! See designs/ui-mockups.pdf'
  );
  await designer.setDone('UI mockups created');

  await sleep(1000);

  // Builder checks deliveries
  console.log('\n--- Builder checks deliveries ---');
  const deliveries = await builder.getMyDeliveries();
  for (const { fromAgent, description, originalRequest } of deliveries) {
    console.log(`  From: ${fromAgent}`);
    console.log(`  Description: ${description}`);
    console.log(`  Original request: ${originalRequest}`);
  }

  await builder.acknowledgeDeliveries();

  // Builder can now proceed
  await builder.setWorkingOn('Building UI based on mockups');

  await sleep(500);

  // Final state
  console.log('\n--- Final State ---');
  const data = await coordinator.commFile.readRaw();
  console.log(JSON.stringify(data, null, 2));

  await coordinator.stop();
}

main().catch(console.error);
