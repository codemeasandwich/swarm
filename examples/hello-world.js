/**
 * Hello World example for the SWARM orchestration framework.
 * Demonstrates basic usage of the Orchestrator.
 */
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { Orchestrator } from '../src/index.js';

const __dirname = dirname(fileURLToPath(import.meta.url));

// Create orchestrator config
const config = {
  repoDir: resolve(__dirname, '..'),
  planDir: resolve(__dirname, '../todo'),
};

// Create orchestrator instance
const orchestrator = new Orchestrator(config);

console.log('SWARM Framework - Hello World');
console.log('Orchestrator created successfully');
console.log('Status:', orchestrator.status());
