/**
 * @file Context snapshot and builder for agent lifecycle management.
 * @module lifecycle/context
 */

import { readFile, writeFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { spawn } from 'node:child_process';

/**
 * A snapshot of agent progress at a breakpoint.
 */
export class ContextSnapshot {
  /**
   * Create a ContextSnapshot.
   * @param {Object} props - Properties
   * @param {string} props.agentId - Agent identifier
   * @param {string} props.taskId - Task identifier
   * @param {Date} [props.timestamp] - Snapshot timestamp
   * @param {string} [props.summary=''] - Work summary
   * @param {string[]} [props.filesModified=[]] - List of modified files
   * @param {string[]} [props.commits=[]] - List of commit hashes
   * @param {Object} [props.communicationsState={}] - Communications file state
   */
  constructor({
    agentId,
    taskId,
    timestamp,
    summary = '',
    filesModified = [],
    commits = [],
    communicationsState = {},
  }) {
    /** @type {string} */
    this.agentId = agentId;
    /** @type {string} */
    this.taskId = taskId;
    /** @type {Date} */
    this.timestamp = timestamp ?? new Date();
    /** @type {string} */
    this.summary = summary;
    /** @type {string[]} */
    this.filesModified = filesModified;
    /** @type {string[]} */
    this.commits = commits;
    /** @type {Object} */
    this.communicationsState = communicationsState;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').ContextSnapshotData}
   */
  toDict() {
    return {
      agentId: this.agentId,
      taskId: this.taskId,
      timestamp: this.timestamp.toISOString(),
      summary: this.summary,
      filesModified: this.filesModified,
      commits: this.commits,
      communicationsState: JSON.stringify(this.communicationsState),
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').ContextSnapshotData} data
   * @returns {ContextSnapshot}
   */
  static fromDict(data) {
    let communicationsState = {};
    if (data.communicationsState) {
      try {
        communicationsState = typeof data.communicationsState === 'string'
          ? JSON.parse(data.communicationsState)
          : data.communicationsState;
      } catch {
        // Ignore parse errors
      }
    }

    return new ContextSnapshot({
      agentId: data.agentId,
      taskId: data.taskId,
      timestamp: data.timestamp ? new Date(data.timestamp) : undefined,
      summary: data.summary ?? '',
      filesModified: data.filesModified ?? [],
      commits: data.commits ?? [],
      communicationsState,
    });
  }
}

/**
 * Builds context for restarted agents.
 */
export class ContextBuilder {
  /**
   * Create a ContextBuilder.
   * @param {string} repoDir - Repository directory
   */
  constructor(repoDir) {
    /** @type {string} */
    this.repoDir = repoDir;
    /** @private @type {ContextSnapshot[]} */
    this._snapshots = [];
  }

  /**
   * Run a git command.
   * @private
   * @param {string[]} args - Git command arguments
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  async _runGit(args) {
    return new Promise((resolve) => {
      const process = spawn('git', args, { cwd: this.repoDir });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 0 });
      });

      process.on('error', () => {
        resolve({ stdout: '', stderr: '', code: 1 });
      });
    });
  }

  /**
   * Capture a snapshot of the current agent progress.
   *
   * @param {import('../personas/models.js').AgentInstance} agent - Agent instance
   * @param {import('../plan/models.js').Task} task - Current task
   * @param {string} commFilePath - Path to communications.json
   * @returns {Promise<ContextSnapshot>}
   */
  async captureSnapshot(agent, task, commFilePath) {
    // Get list of modified files
    const statusResult = await this._runGit(['status', '--porcelain']);
    const filesModified = statusResult.stdout
      .split('\n')
      .filter(Boolean)
      .map((line) => line.slice(3).trim());

    // Get recent commits on this branch
    const logResult = await this._runGit([
      'log',
      '--oneline',
      '-n',
      '10',
      agent.branch || 'HEAD',
    ]);
    const commits = logResult.stdout.split('\n').filter(Boolean);

    // Read communications state
    let communicationsState = {};
    try {
      const content = await readFile(commFilePath, 'utf-8');
      communicationsState = JSON.parse(content);
    } catch {
      // Ignore errors
    }

    // Build summary from agent status
    const agentStatus = communicationsState[agent.agentId] ?? {};
    const summary = this._buildSummary(agentStatus, filesModified, commits);

    const snapshot = new ContextSnapshot({
      agentId: agent.agentId,
      taskId: task.id,
      summary,
      filesModified,
      commits,
      communicationsState,
    });

    this._snapshots.push(snapshot);
    return snapshot;
  }

  /**
   * Build a summary string from agent status.
   * @private
   * @param {Object} agentStatus
   * @param {string[]} filesModified
   * @param {string[]} commits
   * @returns {string}
   */
  _buildSummary(agentStatus, filesModified, commits) {
    const parts = [];

    if (agentStatus.done) {
      parts.push(`Completed: ${agentStatus.done}`);
    }

    if (agentStatus.workingOn || agentStatus.working_on) {
      parts.push(`Was working on: ${agentStatus.workingOn || agentStatus.working_on}`);
    }

    if (filesModified.length > 0) {
      parts.push(`Modified files: ${filesModified.slice(0, 5).join(', ')}${filesModified.length > 5 ? '...' : ''}`);
    }

    if (commits.length > 0) {
      parts.push(`Recent commits: ${commits.slice(0, 3).join('; ')}`);
    }

    return parts.join('\n');
  }

  /**
   * Build a context summary for a fresh agent from snapshots.
   *
   * @param {ContextSnapshot} snapshot - Latest snapshot
   * @returns {string}
   */
  buildContextSummary(snapshot) {
    const lines = [];

    lines.push('## Previous Progress');
    lines.push('');

    if (snapshot.summary) {
      lines.push(snapshot.summary);
      lines.push('');
    }

    if (snapshot.filesModified.length > 0) {
      lines.push('### Files Modified');
      for (const file of snapshot.filesModified.slice(0, 10)) {
        lines.push(`- ${file}`);
      }
      if (snapshot.filesModified.length > 10) {
        lines.push(`- ... and ${snapshot.filesModified.length - 10} more`);
      }
      lines.push('');
    }

    if (snapshot.commits.length > 0) {
      lines.push('### Recent Commits');
      for (const commit of snapshot.commits.slice(0, 5)) {
        lines.push(`- ${commit}`);
      }
      lines.push('');
    }

    lines.push('**Continue from where the previous iteration left off.**');
    lines.push('**Do not repeat work that has already been completed.**');

    return lines.join('\n');
  }

  /**
   * Save a snapshot to disk.
   *
   * @param {ContextSnapshot} snapshot - Snapshot to save
   * @param {string} snapshotDir - Directory to save snapshots
   * @returns {Promise<string>} Path to saved snapshot
   */
  async saveSnapshot(snapshot, snapshotDir) {
    await mkdir(snapshotDir, { recursive: true });

    const filename = `${snapshot.agentId}_${snapshot.taskId}_${snapshot.timestamp.getTime()}.json`;
    const filepath = join(snapshotDir, filename);

    await writeFile(filepath, JSON.stringify(snapshot.toDict(), null, 2));
    return filepath;
  }

  /**
   * Load a snapshot from disk.
   *
   * @param {string} filepath - Path to snapshot file
   * @returns {Promise<ContextSnapshot>}
   */
  async loadSnapshot(filepath) {
    const content = await readFile(filepath, 'utf-8');
    const data = JSON.parse(content);
    return ContextSnapshot.fromDict(data);
  }

  /**
   * Get all snapshots for an agent.
   * @param {string} agentId - Agent identifier
   * @returns {ContextSnapshot[]}
   */
  getSnapshotsForAgent(agentId) {
    return this._snapshots.filter((s) => s.agentId === agentId);
  }

  /**
   * Get the latest snapshot for an agent.
   * @param {string} agentId - Agent identifier
   * @returns {ContextSnapshot|null}
   */
  getLatestSnapshot(agentId) {
    const snapshots = this.getSnapshotsForAgent(agentId);
    if (snapshots.length === 0) return null;

    return snapshots.reduce((latest, current) =>
      current.timestamp > latest.timestamp ? current : latest
    );
  }

  /**
   * Build a combined context from multiple snapshots.
   *
   * @param {string} agentId - Agent identifier
   * @returns {string}
   */
  buildCombinedContext(agentId) {
    const snapshots = this.getSnapshotsForAgent(agentId);
    if (snapshots.length === 0) {
      return '';
    }

    // Sort by timestamp
    snapshots.sort((a, b) => a.timestamp.getTime() - b.timestamp.getTime());

    const lines = [];
    lines.push('## Iteration History');
    lines.push('');

    for (let i = 0; i < snapshots.length; i++) {
      const snapshot = snapshots[i];
      lines.push(`### Iteration ${i + 1} (${snapshot.timestamp.toISOString()})`);
      lines.push(`Task: ${snapshot.taskId}`);
      if (snapshot.summary) {
        lines.push(snapshot.summary);
      }
      lines.push('');
    }

    const latest = snapshots[snapshots.length - 1];
    lines.push(this.buildContextSummary(latest));

    return lines.join('\n');
  }
}
