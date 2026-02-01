/**
 * @file CLI entry point.
 * @module cli
 */

import { Command } from 'commander';
import { runWatcher, runAgent, showStatus } from './commands.js';

/**
 * Create and configure the CLI program.
 * @returns {Command}
 */
export function createProgram() {
  const program = new Command();

  program
    .name('orchestrate')
    .description('Multi-agent orchestration framework CLI')
    .version('1.0.0');

  program
    .command('watcher')
    .description('Start the file watcher to monitor communications.json')
    .option('-f, --file <path>', 'Path to communications.json')
    .action((options) => {
      runWatcher(options);
    });

  program
    .command('agent <name>')
    .description('Start an interactive agent with the given name')
    .option('-f, --file <path>', 'Path to communications.json')
    .action((name, options) => {
      runAgent(name, options);
    });

  program
    .command('status')
    .description('Show status of all agents')
    .option('-f, --file <path>', 'Path to communications.json')
    .action((options) => {
      showStatus(options);
    });

  return program;
}

/**
 * Run the CLI.
 * @param {string[]} [args] - Command line arguments
 * @returns {void}
 */
export function run(args) {
  const program = createProgram();
  program.parse(args ?? process.argv);
}

// Re-export commands for programmatic use
export { runWatcher, runAgent, showStatus };
