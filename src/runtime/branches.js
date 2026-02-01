/**
 * @file Git branch management for agent workspaces.
 * @module runtime/branches
 */

import { spawn } from 'node:child_process';
import { BranchError } from '../orchestrator/errors.js';

/**
 * Information about a git branch.
 */
export class BranchInfo {
  /**
   * Create a BranchInfo.
   * @param {Object} props - Properties
   * @param {string} props.name - Branch name
   * @param {string} props.agentId - Agent ID that owns this branch
   * @param {string} props.taskId - Task ID for this branch
   * @param {Date} [props.createdAt] - Creation timestamp
   * @param {string} [props.baseBranch='main'] - Base branch name
   */
  constructor({ name, agentId, taskId, createdAt, baseBranch = 'main' }) {
    /** @type {string} */
    this.name = name;
    /** @type {string} */
    this.agentId = agentId;
    /** @type {string} */
    this.taskId = taskId;
    /** @type {Date} */
    this.createdAt = createdAt ?? new Date();
    /** @type {string} */
    this.baseBranch = baseBranch;
  }

  /**
   * Convert to plain object for JSON serialization.
   * @returns {import('../types/index.js').BranchInfoData}
   */
  toDict() {
    return {
      name: this.name,
      agentId: this.agentId,
      taskId: this.taskId,
      createdAt: this.createdAt.toISOString(),
      baseBranch: this.baseBranch,
    };
  }

  /**
   * Create from plain object.
   * @param {import('../types/index.js').BranchInfoData} data - Plain object data
   * @returns {BranchInfo}
   */
  static fromDict(data) {
    return new BranchInfo({
      name: data.name,
      agentId: data.agentId,
      taskId: data.taskId,
      createdAt: data.createdAt ? new Date(data.createdAt) : undefined,
      baseBranch: data.baseBranch ?? 'main',
    });
  }
}

/**
 * Manages git branches for agents.
 */
export class BranchManager {
  /**
   * Create a BranchManager.
   * @param {string} repoDir - Repository directory
   * @param {string} [integrationBranch='integration'] - Integration branch name
   */
  constructor(repoDir, integrationBranch = 'integration') {
    /** @type {string} */
    this.repoDir = repoDir;
    /** @type {string} */
    this.integrationBranch = integrationBranch;
    /** @private @type {Map<string, BranchInfo>} */
    this._branches = new Map();
  }

  /**
   * Run a git command.
   * @private
   * @param {string[]} args - Git command arguments
   * @param {Object} [options] - Options
   * @param {string} [options.cwd] - Working directory
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  async _runGit(args, options = {}) {
    const cwd = options.cwd ?? this.repoDir;

    return new Promise((resolve, reject) => {
      const process = spawn('git', args, { cwd });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        reject(new BranchError(`Git command failed: ${error.message}`, {
          cause: error,
          operation: args.join(' '),
        }));
      });

      process.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 0 });
      });
    });
  }

  /**
   * Create a new branch for an agent.
   *
   * @param {string} agentId - Agent identifier
   * @param {string} taskId - Task identifier
   * @param {string} [baseBranch] - Base branch (defaults to integration branch)
   * @returns {Promise<BranchInfo>}
   * @throws {BranchError} If branch creation fails
   */
  async createAgentBranch(agentId, taskId, baseBranch) {
    const base = baseBranch ?? this.integrationBranch;
    const branchName = `agent/${agentId}/${taskId}`;

    // Fetch latest
    await this._runGit(['fetch', 'origin', base]).catch(() => {
      // Ignore fetch errors - branch might be local only
    });

    // Create and checkout the branch
    const result = await this._runGit(['checkout', '-b', branchName, `origin/${base}`]).catch(async () => {
      // Try without origin/ prefix
      return this._runGit(['checkout', '-b', branchName, base]);
    });

    if (result.code !== 0 && !result.stderr.includes('already exists')) {
      throw new BranchError(`Failed to create branch ${branchName}: ${result.stderr}`, {
        branch: branchName,
        operation: 'create',
      });
    }

    const branchInfo = new BranchInfo({
      name: branchName,
      agentId,
      taskId,
      baseBranch: base,
    });

    this._branches.set(agentId, branchInfo);
    console.log(`[BranchManager] Created branch ${branchName} for agent ${agentId}`);

    return branchInfo;
  }

  /**
   * Switch to an existing branch.
   * @param {string} branchName - Branch name
   * @returns {Promise<void>}
   * @throws {BranchError} If checkout fails
   */
  async checkoutBranch(branchName) {
    const result = await this._runGit(['checkout', branchName]);

    if (result.code !== 0) {
      throw new BranchError(`Failed to checkout branch ${branchName}: ${result.stderr}`, {
        branch: branchName,
        operation: 'checkout',
      });
    }
  }

  /**
   * Get the current branch name.
   * @returns {Promise<string>}
   */
  async getCurrentBranch() {
    const result = await this._runGit(['rev-parse', '--abbrev-ref', 'HEAD']);
    return result.stdout;
  }

  /**
   * Merge an agent branch to the integration branch.
   *
   * @param {string} agentId - Agent identifier
   * @param {string} [targetBranch] - Target branch (defaults to integration branch)
   * @returns {Promise<void>}
   * @throws {BranchError} If merge fails
   */
  async mergeBranch(agentId, targetBranch) {
    const target = targetBranch ?? this.integrationBranch;
    const branchInfo = this._branches.get(agentId);

    if (!branchInfo) {
      throw new BranchError(`No branch found for agent ${agentId}`, {
        operation: 'merge',
      });
    }

    // Checkout target branch
    await this.checkoutBranch(target);

    // Merge the agent branch
    const result = await this._runGit(['merge', branchInfo.name, '--no-edit']);

    if (result.code !== 0) {
      throw new BranchError(`Failed to merge branch ${branchInfo.name}: ${result.stderr}`, {
        branch: branchInfo.name,
        operation: 'merge',
      });
    }

    console.log(`[BranchManager] Merged ${branchInfo.name} into ${target}`);
  }

  /**
   * Delete an agent branch.
   *
   * @param {string} agentId - Agent identifier
   * @param {boolean} [force=false] - Force delete even if not merged
   * @returns {Promise<void>}
   */
  async deleteBranch(agentId, force = false) {
    const branchInfo = this._branches.get(agentId);

    if (!branchInfo) {
      return; // Branch doesn't exist
    }

    const flag = force ? '-D' : '-d';
    await this._runGit(['branch', flag, branchInfo.name]).catch(() => {
      // Ignore errors - branch might already be deleted
    });

    this._branches.delete(agentId);
    console.log(`[BranchManager] Deleted branch ${branchInfo.name}`);
  }

  /**
   * Get branch info for an agent.
   * @param {string} agentId - Agent identifier
   * @returns {BranchInfo|undefined}
   */
  getBranch(agentId) {
    return this._branches.get(agentId);
  }

  /**
   * Get branch name for an agent.
   * @param {string} agentId - Agent identifier
   * @returns {string|undefined}
   */
  getBranchName(agentId) {
    return this._branches.get(agentId)?.name;
  }

  /**
   * Check if branch has uncommitted changes.
   * @returns {Promise<boolean>}
   */
  async hasUncommittedChanges() {
    const result = await this._runGit(['status', '--porcelain']);
    return result.stdout.length > 0;
  }

  /**
   * Get list of commits on branch since base.
   * @param {string} branchName - Branch name
   * @param {string} baseBranch - Base branch
   * @returns {Promise<string[]>}
   */
  async getCommits(branchName, baseBranch) {
    const result = await this._runGit([
      'log',
      '--oneline',
      `${baseBranch}..${branchName}`,
    ]);

    if (result.code !== 0) {
      return [];
    }

    return result.stdout.split('\n').filter(Boolean);
  }

  /**
   * Get list of changed files on branch since base.
   * @param {string} branchName - Branch name
   * @param {string} baseBranch - Base branch
   * @returns {Promise<string[]>}
   */
  async getChangedFiles(branchName, baseBranch) {
    const result = await this._runGit([
      'diff',
      '--name-only',
      `${baseBranch}...${branchName}`,
    ]);

    if (result.code !== 0) {
      return [];
    }

    return result.stdout.split('\n').filter(Boolean);
  }

  /**
   * Push a branch to remote.
   * @param {string} branchName - Branch name
   * @param {boolean} [setUpstream=true] - Set upstream tracking
   * @returns {Promise<void>}
   * @throws {BranchError} If push fails
   */
  async pushBranch(branchName, setUpstream = true) {
    const args = ['push'];
    if (setUpstream) {
      args.push('-u', 'origin', branchName);
    } else {
      args.push('origin', branchName);
    }

    const result = await this._runGit(args);

    if (result.code !== 0) {
      throw new BranchError(`Failed to push branch ${branchName}: ${result.stderr}`, {
        branch: branchName,
        operation: 'push',
      });
    }

    console.log(`[BranchManager] Pushed branch ${branchName}`);
  }

  /**
   * Get all tracked branches.
   * @returns {Map<string, BranchInfo>}
   */
  getAllBranches() {
    return new Map(this._branches);
  }
}
