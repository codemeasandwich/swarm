/**
 * @file Terminal process management for agent subprocesses.
 * @module runtime/process
 */

import { spawn } from 'node:child_process';
import { mkdir } from 'node:fs/promises';
import { resolve } from 'node:path';
import { EventEmitter } from 'node:events';

/**
 * Represents a running agent subprocess.
 * @extends EventEmitter
 */
export class AgentProcess extends EventEmitter {
  /**
   * Create an AgentProcess.
   * @param {Object} props - Properties
   * @param {string} props.agentId - Agent identifier
   * @param {import('node:child_process').ChildProcess} props.process - Child process
   * @param {string} props.workingDir - Working directory
   */
  constructor({ agentId, process, workingDir }) {
    super();
    /** @type {string} */
    this.agentId = agentId;
    /** @type {import('node:child_process').ChildProcess} */
    this.process = process;
    /** @type {string} */
    this.workingDir = workingDir;
    /** @type {Date} */
    this.startedAt = new Date();
    /** @type {string[]} */
    this.outputLines = [];
    /** @type {string[]} */
    this.errorLines = [];
    /** @private @type {boolean} */
    this._terminated = false;

    this._setupOutputHandlers();
  }

  /**
   * Get the process ID.
   * @returns {number|null}
   */
  get pid() {
    return this.process?.pid ?? null;
  }

  /**
   * Check if the process is running.
   * @returns {boolean}
   */
  get isRunning() {
    return (
      this.process !== null &&
      !this.process.killed &&
      this.process.exitCode === null &&
      !this._terminated
    );
  }

  /**
   * Get the exit code.
   * @returns {number|null}
   */
  get returnCode() {
    return this.process?.exitCode ?? null;
  }

  /**
   * Setup stdout/stderr handlers.
   * @private
   */
  _setupOutputHandlers() {
    this.process.stdout?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      this.outputLines.push(...lines);
      for (const line of lines) {
        this.emit('stdout', line);
      }
    });

    this.process.stderr?.on('data', (data) => {
      const lines = data.toString().split('\n').filter(Boolean);
      this.errorLines.push(...lines);
      for (const line of lines) {
        this.emit('stderr', line);
      }
    });

    this.process.on('exit', (code, signal) => {
      this._terminated = true;
      this.emit('exit', code, signal);
    });

    this.process.on('error', (error) => {
      this.emit('error', error);
    });
  }

  /**
   * Send input to the process stdin.
   * @param {string} text - Text to send
   * @returns {boolean} True if sent successfully
   */
  sendInput(text) {
    if (this.process?.stdin && !this.process.stdin.destroyed) {
      this.process.stdin.write(text + '\n');
      return true;
    }
    return false;
  }

  /**
   * Get all stdout output as a single string.
   * @returns {string}
   */
  getOutput() {
    return this.outputLines.join('\n');
  }

  /**
   * Get all stderr output as a single string.
   * @returns {string}
   */
  getErrors() {
    return this.errorLines.join('\n');
  }

  /**
   * Get the last N lines of output.
   * @param {number} [n=10] - Number of lines
   * @returns {string[]}
   */
  getLastLines(n = 10) {
    return this.outputLines.slice(-n);
  }

  /**
   * Gracefully terminate the process.
   * @param {number} [timeoutMs=5000] - Timeout before force kill
   * @returns {Promise<void>}
   */
  async terminate(timeoutMs = 5000) {
    if (!this.process || this._terminated) return;

    return new Promise((resolvePromise) => {
      const timeout = setTimeout(() => {
        console.warn(`[Process] ${this.agentId} didn't terminate, killing`);
        this.process.kill('SIGKILL');
        this._terminated = true;
        resolvePromise();
      }, timeoutMs);

      this.process.once('exit', () => {
        clearTimeout(timeout);
        this._terminated = true;
        resolvePromise();
      });

      // Try graceful termination first
      this.process.kill('SIGTERM');
    });
  }

  /**
   * Force kill the process.
   * @returns {void}
   */
  kill() {
    if (this.process && !this._terminated) {
      this.process.kill('SIGKILL');
      this._terminated = true;
    }
  }
}

/**
 * Manages terminal processes for agents.
 */
export class TerminalManager {
  /**
   * Create a TerminalManager.
   * @param {string} baseDir - Base directory for sandboxes
   */
  constructor(baseDir) {
    /** @type {string} */
    this.baseDir = resolve(baseDir);
    /** @private @type {Map<string, AgentProcess>} */
    this._processes = new Map();
  }

  /**
   * Spawn a Claude Code CLI agent.
   *
   * @param {Object} props - Properties
   * @param {string} props.agentId - Agent identifier
   * @param {string} props.prompt - Initial prompt for the agent
   * @param {string} [props.workingDir] - Working directory (defaults to sandbox)
   * @param {boolean} [props.dangerouslySkipPermissions=true] - Skip permission prompts
   * @param {Object} [props.env] - Additional environment variables
   * @returns {Promise<AgentProcess>}
   */
  async spawnClaudeAgent({
    agentId,
    prompt,
    workingDir,
    dangerouslySkipPermissions = true,
    env = {},
  }) {
    const cwd = workingDir ?? resolve(this.baseDir, 'sandbox', agentId);
    await mkdir(cwd, { recursive: true });

    const args = ['--print'];
    if (dangerouslySkipPermissions) {
      args.push('--dangerously-skip-permissions');
    }
    args.push('-p', prompt);

    console.log(`[TerminalManager] Spawning agent ${agentId} in ${cwd}`);

    const childProcess = spawn('claude', args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    const agentProcess = new AgentProcess({
      agentId,
      process: childProcess,
      workingDir: cwd,
    });

    // Setup logging
    agentProcess.on('stdout', (line) => {
      console.log(`[${agentId}] ${line}`);
    });

    agentProcess.on('stderr', (line) => {
      console.error(`[${agentId}] ERROR: ${line}`);
    });

    agentProcess.on('exit', (code) => {
      console.log(`[${agentId}] Exited with code ${code}`);
    });

    this._processes.set(agentId, agentProcess);
    return agentProcess;
  }

  /**
   * Spawn a generic command.
   *
   * @param {Object} props - Properties
   * @param {string} props.agentId - Identifier for this process
   * @param {string} props.command - Command to run
   * @param {string[]} [props.args=[]] - Command arguments
   * @param {string} [props.workingDir] - Working directory
   * @param {Object} [props.env] - Additional environment variables
   * @returns {Promise<AgentProcess>}
   */
  async spawnCommand({ agentId, command, args = [], workingDir, env = {} }) {
    const cwd = workingDir ?? this.baseDir;
    await mkdir(cwd, { recursive: true });

    console.log(`[TerminalManager] Spawning command ${command} as ${agentId}`);

    const childProcess = spawn(command, args, {
      cwd,
      stdio: ['pipe', 'pipe', 'pipe'],
      env: { ...process.env, ...env },
    });

    const agentProcess = new AgentProcess({
      agentId,
      process: childProcess,
      workingDir: cwd,
    });

    this._processes.set(agentId, agentProcess);
    return agentProcess;
  }

  /**
   * Get a process by agent ID.
   * @param {string} agentId - Agent identifier
   * @returns {AgentProcess|undefined}
   */
  getProcess(agentId) {
    return this._processes.get(agentId);
  }

  /**
   * Check if an agent process is running.
   * @param {string} agentId - Agent identifier
   * @returns {boolean}
   */
  isRunning(agentId) {
    const process = this._processes.get(agentId);
    return process?.isRunning ?? false;
  }

  /**
   * Terminate a specific agent process.
   * @param {string} agentId - Agent identifier
   * @param {number} [timeoutMs=5000] - Timeout before force kill
   * @returns {Promise<void>}
   */
  async terminate(agentId, timeoutMs = 5000) {
    const agentProcess = this._processes.get(agentId);
    if (agentProcess) {
      await agentProcess.terminate(timeoutMs);
      this._processes.delete(agentId);
    }
  }

  /**
   * Terminate all processes.
   * @param {number} [timeoutMs=5000] - Timeout before force kill
   * @returns {Promise<void>}
   */
  async terminateAll(timeoutMs = 5000) {
    const promises = [];
    for (const agentProcess of this._processes.values()) {
      promises.push(agentProcess.terminate(timeoutMs));
    }
    await Promise.all(promises);
    this._processes.clear();
  }

  /**
   * Get all agent IDs.
   * @returns {string[]}
   */
  getAgentIds() {
    return Array.from(this._processes.keys());
  }

  /**
   * Get count of running processes.
   * @returns {number}
   */
  getRunningCount() {
    let count = 0;
    for (const process of this._processes.values()) {
      if (process.isRunning) count++;
    }
    return count;
  }

  /**
   * Send input to a specific agent.
   * @param {string} agentId - Agent identifier
   * @param {string} text - Text to send
   * @returns {boolean} True if sent
   */
  sendInput(agentId, text) {
    const process = this._processes.get(agentId);
    return process?.sendInput(text) ?? false;
  }
}
