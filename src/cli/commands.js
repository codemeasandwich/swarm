/**
 * @file CLI command handlers.
 * @module cli/commands
 */

import { createInterface } from 'node:readline';
import { CommunicationsFile } from '../communication/communications-file.js';
import { FileWatcher } from '../communication/file-watcher.js';
import { Coordinator } from '../communication/coordinator.js';
import { TaskAgent } from '../communication/agent.js';
import { getConfig } from '../config/index.js';

/**
 * Run the file watcher command.
 * Watches communications.json and logs changes.
 *
 * @param {Object} [options] - Options
 * @param {string} [options.file] - Path to communications.json
 * @returns {Promise<void>}
 */
export async function runWatcher(options = {}) {
  const config = getConfig();
  const filepath = options.file ?? config.commFile;

  console.log(`[CLI] Starting watcher for ${filepath}`);

  const commFile = new CommunicationsFile(filepath);
  const watcher = new FileWatcher(commFile, config.pollInterval);

  // Register a listener that logs changes
  watcher.register('_watcher_cli', (updatedBy, data) => {
    const timestamp = new Date().toISOString();
    console.log(`\n[${timestamp}] Update from: ${updatedBy ?? 'unknown'}`);

    for (const [name, agentData] of Object.entries(data)) {
      if (name === '_meta') continue;
      if (typeof agentData !== 'object') continue;

      console.log(`  ${name}:`);
      if (agentData.workingOn || agentData.working_on) {
        console.log(`    Working on: ${agentData.workingOn || agentData.working_on}`);
      }
      if (agentData.lifecycleState || agentData.lifecycle_state) {
        console.log(`    State: ${agentData.lifecycleState || agentData.lifecycle_state}`);
      }
    }
  });

  await watcher.start();

  console.log('[CLI] Watcher started. Press Ctrl+C to stop.');

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[CLI] Stopping watcher...');
    await watcher.stop();
    process.exit(0);
  });

  // Keep the process running
  await new Promise(() => {});
}

/**
 * Run an interactive agent.
 *
 * @param {string} name - Agent name
 * @param {Object} [options] - Options
 * @param {string} [options.file] - Path to communications.json
 * @returns {Promise<void>}
 */
export async function runAgent(name, options = {}) {
  const config = getConfig();
  const filepath = options.file ?? config.commFile;

  console.log(`[CLI] Starting agent "${name}"`);

  const coordinator = new Coordinator(filepath);
  await coordinator.start();

  const agent = coordinator.createAgent(TaskAgent, name);

  // Setup readline for interactive input
  const rl = createInterface({
    input: process.stdin,
    output: process.stdout,
  });

  console.log(`
Agent "${name}" started. Commands:
  mission <text>     - Set your mission
  working <text>     - Set what you're working on
  done <text>        - Set what you've done
  next <text>        - Set what's next
  request <agent> <request> - Send a request to another agent
  requests           - Show your pending requests
  complete <agent> <original> <description> - Complete a request
  deliveries         - Show your deliveries
  ack                - Acknowledge deliveries
  agents             - Show all agents
  view               - View communications.json
  help               - Show this help
  quit               - Exit
`);

  const prompt = () => {
    rl.question(`[${name}] > `, async (input) => {
      const trimmed = input.trim();
      if (!trimmed) {
        prompt();
        return;
      }

      const [command, ...args] = trimmed.split(' ');
      const argText = args.join(' ');

      try {
        switch (command.toLowerCase()) {
          case 'mission':
            await agent.setMission(argText);
            console.log('Mission set.');
            break;

          case 'working':
            await agent.setWorkingOn(argText);
            console.log('Working on set.');
            break;

          case 'done':
            await agent.setDone(argText);
            console.log('Done set.');
            break;

          case 'next':
            await agent.setNext(argText);
            console.log('Next set.');
            break;

          case 'request': {
            const [targetAgent, ...requestParts] = args;
            const requestText = requestParts.join(' ');
            if (!targetAgent || !requestText) {
              console.log('Usage: request <agent> <request>');
            } else {
              await agent.request(targetAgent, requestText);
            }
            break;
          }

          case 'requests': {
            const requests = await agent.getPendingRequests();
            if (requests.length === 0) {
              console.log('No pending requests.');
            } else {
              console.log('Pending requests:');
              for (const { fromAgent, request } of requests) {
                console.log(`  From ${fromAgent}: ${request}`);
              }
            }
            break;
          }

          case 'complete': {
            const [targetAgent, ...parts] = args;
            // Format: complete <agent> <original_request> | <description>
            const fullText = parts.join(' ');
            const pipeIndex = fullText.indexOf('|');
            if (pipeIndex === -1) {
              console.log('Usage: complete <agent> <original_request> | <description>');
            } else {
              const original = fullText.slice(0, pipeIndex).trim();
              const description = fullText.slice(pipeIndex + 1).trim();
              await agent.completeRequest(targetAgent, original, description);
            }
            break;
          }

          case 'deliveries': {
            const deliveries = await agent.getMyDeliveries();
            if (deliveries.length === 0) {
              console.log('No deliveries.');
            } else {
              console.log('Deliveries:');
              for (const { fromAgent, description, originalRequest } of deliveries) {
                console.log(`  From ${fromAgent}: ${description}`);
                console.log(`    (for: ${originalRequest})`);
              }
            }
            break;
          }

          case 'ack':
            await agent.acknowledgeDeliveries();
            console.log('Deliveries acknowledged.');
            break;

          case 'agents': {
            const others = await agent.getOtherAgents();
            if (others.size === 0) {
              console.log('No other agents.');
            } else {
              console.log('Other agents:');
              for (const [agentName, status] of others) {
                console.log(`  ${agentName}:`);
                console.log(`    Mission: ${status.mission || 'N/A'}`);
                console.log(`    Working on: ${status.workingOn || status.working_on || 'N/A'}`);
              }
            }
            break;
          }

          case 'view': {
            const data = await coordinator.commFile.readRaw();
            console.log(JSON.stringify(data, null, 2));
            break;
          }

          case 'help':
            console.log(`
Commands:
  mission <text>     - Set your mission
  working <text>     - Set what you're working on
  done <text>        - Set what you've done
  next <text>        - Set what's next
  request <agent> <request> - Send a request to another agent
  requests           - Show your pending requests
  complete <agent> <original> | <description> - Complete a request
  deliveries         - Show your deliveries
  ack                - Acknowledge deliveries
  agents             - Show all agents
  view               - View communications.json
  help               - Show this help
  quit               - Exit
`);
            break;

          case 'quit':
          case 'exit':
            agent.shutdown();
            await coordinator.stop();
            rl.close();
            process.exit(0);
            break;

          default:
            console.log(`Unknown command: ${command}. Type 'help' for available commands.`);
        }
      } catch (error) {
        console.error(`Error: ${error.message}`);
      }

      prompt();
    });
  };

  prompt();

  // Handle graceful shutdown
  process.on('SIGINT', async () => {
    console.log('\n[CLI] Shutting down agent...');
    agent.shutdown();
    await coordinator.stop();
    rl.close();
    process.exit(0);
  });
}

/**
 * Show status of all agents.
 *
 * @param {Object} [options] - Options
 * @param {string} [options.file] - Path to communications.json
 * @returns {Promise<void>}
 */
export async function showStatus(options = {}) {
  const config = getConfig();
  const filepath = options.file ?? config.commFile;

  const commFile = new CommunicationsFile(filepath);
  const data = await commFile.readRaw();

  console.log('='.repeat(60));
  console.log('AGENT STATUS');
  console.log('='.repeat(60));

  let agentCount = 0;
  for (const [name, agentData] of Object.entries(data)) {
    if (name === '_meta') continue;
    if (typeof agentData !== 'object') continue;

    agentCount++;
    console.log(`\n${name}:`);
    console.log(`  Mission: ${agentData.mission || 'N/A'}`);
    console.log(`  Working on: ${agentData.workingOn || agentData.working_on || 'N/A'}`);
    console.log(`  Done: ${agentData.done || 'N/A'}`);
    console.log(`  Next: ${agentData.next || 'N/A'}`);

    const state = agentData.lifecycleState || agentData.lifecycle_state;
    if (state) {
      console.log(`  State: ${state}`);
    }

    const requests = agentData.requests ?? [];
    if (requests.length > 0) {
      console.log(`  Requests: ${requests.length}`);
    }

    const added = agentData.added ?? [];
    if (added.length > 0) {
      console.log(`  Deliveries: ${added.length}`);
    }
  }

  if (agentCount === 0) {
    console.log('\nNo agents found.');
  }

  console.log('\n' + '='.repeat(60));

  if (data._meta) {
    console.log(`Last updated: ${data._meta.lastUpdated || data._meta.last_updated || 'N/A'}`);
    console.log(`By: ${data._meta.lastUpdatedBy || data._meta.last_updated_by || 'N/A'}`);
  }
}
