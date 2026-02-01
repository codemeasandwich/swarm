/**
 * @file Local CI provider implementation.
 * Provides git-based CI operations for local development.
 * @module ci/local
 */

import { spawn } from 'node:child_process';
import { writeFile, readFile, mkdir } from 'node:fs/promises';
import { join } from 'node:path';
import { CIProvider, BuildStatus, PRInfo } from './interface.js';
import { CIEventEmitter } from './events.js';
import { BuildStatusType, PRStatusType } from '../types/index.js';
import { CIError, TimeoutError } from '../orchestrator/errors.js';

/**
 * Utility to sleep for a given time.
 * @param {number} ms - Milliseconds to sleep
 * @returns {Promise<void>}
 */
const sleep = (ms) => new Promise((resolve) => setTimeout(resolve, ms));

/**
 * Local CI provider using git operations.
 * Suitable for local development and testing.
 * @extends CIProvider
 */
export class LocalCIProvider extends CIProvider {
  /**
   * Create a LocalCIProvider.
   * @param {Object} props - Properties
   * @param {string} props.repoDir - Repository directory
   * @param {string} [props.stateDir] - State directory for tracking builds/PRs
   * @param {string} [props.integrationBranch='integration'] - Integration branch name
   */
  constructor({ repoDir, stateDir, integrationBranch = 'integration' }) {
    super();
    /** @type {string} */
    this.repoDir = repoDir;
    /** @type {string} */
    this.stateDir = stateDir ?? join(repoDir, '.state', 'ci');
    /** @type {string} */
    this.integrationBranch = integrationBranch;
    /** @type {CIEventEmitter} */
    this.eventEmitter = new CIEventEmitter();
    /** @private @type {Map<string, BuildStatus>} */
    this._builds = new Map();
    /** @private @type {Map<number, PRInfo>} */
    this._prs = new Map();
    /** @private @type {number} */
    this._nextPRNumber = 1;
    /** @private @type {number} */
    this._nextRunId = 1;
  }

  /**
   * Run a git command.
   * @private
   * @param {string[]} args - Git command arguments
   * @returns {Promise<{stdout: string, stderr: string, code: number}>}
   */
  async _runGit(args) {
    return new Promise((resolve, reject) => {
      const process = spawn('git', args, { cwd: this.repoDir });

      let stdout = '';
      let stderr = '';

      process.stdout?.on('data', (data) => {
        stdout += data.toString();
      });

      process.stderr?.on('data', (data) => {
        stderr += data.toString();
      });

      process.on('error', (error) => {
        reject(new CIError(`Git command failed: ${error.message}`, {
          cause: error,
          provider: 'local',
          operation: args.join(' '),
        }));
      });

      process.on('close', (code) => {
        resolve({ stdout: stdout.trim(), stderr: stderr.trim(), code: code ?? 0 });
      });
    });
  }

  /**
   * Ensure state directory exists.
   * @private
   * @returns {Promise<void>}
   */
  async _ensureStateDir() {
    await mkdir(this.stateDir, { recursive: true });
  }

  /**
   * Trigger a build on a branch.
   * For local provider, this just validates the branch exists and marks build as running.
   *
   * @param {string} branch - Branch name
   * @returns {Promise<BuildStatus>}
   */
  async triggerBuild(branch) {
    await this._ensureStateDir();

    const runId = `local-${this._nextRunId++}`;

    // Verify branch exists
    const result = await this._runGit(['rev-parse', '--verify', branch]);
    if (result.code !== 0) {
      const status = new BuildStatus({
        runId,
        status: BuildStatusType.FAILURE,
        startedAt: new Date(),
        completedAt: new Date(),
        errorMessage: `Branch ${branch} not found`,
      });
      this._builds.set(runId, status);
      await this.eventEmitter.emitBuildFailure(runId, branch, status.errorMessage);
      return status;
    }

    const status = new BuildStatus({
      runId,
      status: BuildStatusType.RUNNING,
      startedAt: new Date(),
    });

    this._builds.set(runId, status);
    await this.eventEmitter.emitBuildStarted(runId, branch);

    // Simulate build completion after a short delay
    setTimeout(async () => {
      status.status = BuildStatusType.SUCCESS;
      status.completedAt = new Date();
      await this.eventEmitter.emitBuildSuccess(runId, branch);
    }, 100);

    return status;
  }

  /**
   * Get the status of a build.
   * @param {string} runId - Build run ID
   * @returns {Promise<BuildStatus>}
   */
  async getBuildStatus(runId) {
    const status = this._builds.get(runId);
    if (!status) {
      throw new CIError(`Build ${runId} not found`, {
        provider: 'local',
        operation: 'getBuildStatus',
      });
    }
    return status;
  }

  /**
   * Wait for a build to complete.
   * @param {string} runId - Build run ID
   * @param {number} [timeout=300000] - Timeout in milliseconds
   * @returns {Promise<BuildStatus>}
   */
  async waitForBuild(runId, timeout = 300000) {
    const startTime = Date.now();
    const pollInterval = 500;

    while (Date.now() - startTime < timeout) {
      const status = await this.getBuildStatus(runId);
      if (status.isComplete()) {
        return status;
      }
      await sleep(pollInterval);
    }

    throw new TimeoutError(`Build ${runId} timed out`, {
      operation: 'waitForBuild',
      timeoutMs: timeout,
    });
  }

  /**
   * Create a pull request.
   * For local provider, this creates a merge commit simulation.
   *
   * @param {Object} props - Properties
   * @param {string} props.title - PR title
   * @param {string} props.body - PR body
   * @param {string} props.sourceBranch - Source branch
   * @param {string} props.targetBranch - Target branch
   * @returns {Promise<PRInfo>}
   */
  async createPR({ title, body, sourceBranch, targetBranch }) {
    await this._ensureStateDir();

    const prNumber = this._nextPRNumber++;

    // Verify source branch exists
    const sourceResult = await this._runGit(['rev-parse', '--verify', sourceBranch]);
    if (sourceResult.code !== 0) {
      throw new CIError(`Source branch ${sourceBranch} not found`, {
        provider: 'local',
        operation: 'createPR',
      });
    }

    const prInfo = new PRInfo({
      number: prNumber,
      title,
      status: PRStatusType.OPEN,
      url: `local://pr/${prNumber}`,
      sourceBranch,
      targetBranch,
    });

    this._prs.set(prNumber, prInfo);

    // Save PR info to state file
    const prPath = join(this.stateDir, `pr-${prNumber}.json`);
    await writeFile(prPath, JSON.stringify({
      ...prInfo.toDict(),
      body,
    }, null, 2));

    await this.eventEmitter.emitPROpened(prNumber, sourceBranch);
    console.log(`[LocalCI] Created PR #${prNumber}: ${title}`);

    return prInfo;
  }

  /**
   * Get the status of a pull request.
   * @param {number} prNumber - PR number
   * @returns {Promise<PRInfo>}
   */
  async getPRStatus(prNumber) {
    let prInfo = this._prs.get(prNumber);

    if (!prInfo) {
      // Try to load from state file
      const prPath = join(this.stateDir, `pr-${prNumber}.json`);
      try {
        const content = await readFile(prPath, 'utf-8');
        const data = JSON.parse(content);
        prInfo = PRInfo.fromDict(data);
        this._prs.set(prNumber, prInfo);
      } catch {
        throw new CIError(`PR #${prNumber} not found`, {
          provider: 'local',
          operation: 'getPRStatus',
        });
      }
    }

    return prInfo;
  }

  /**
   * Merge a pull request.
   * For local provider, this performs an actual git merge.
   *
   * @param {number} prNumber - PR number
   * @returns {Promise<PRInfo>}
   */
  async mergePR(prNumber) {
    const prInfo = await this.getPRStatus(prNumber);

    if (prInfo.isMerged()) {
      return prInfo;
    }

    if (!prInfo.isOpen()) {
      throw new CIError(`PR #${prNumber} is not open`, {
        provider: 'local',
        operation: 'mergePR',
      });
    }

    // Checkout target branch
    await this._runGit(['checkout', prInfo.targetBranch]);

    // Merge source branch
    const mergeResult = await this._runGit([
      'merge',
      prInfo.sourceBranch,
      '--no-edit',
      '-m',
      `Merge PR #${prNumber}: ${prInfo.title}`,
    ]);

    if (mergeResult.code !== 0) {
      throw new CIError(`Failed to merge PR #${prNumber}: ${mergeResult.stderr}`, {
        provider: 'local',
        operation: 'mergePR',
      });
    }

    // Update PR status
    prInfo.status = PRStatusType.MERGED;
    prInfo.mergedAt = new Date();

    // Save updated PR info
    const prPath = join(this.stateDir, `pr-${prNumber}.json`);
    await writeFile(prPath, JSON.stringify(prInfo.toDict(), null, 2));

    await this.eventEmitter.emitPRMerged(prNumber, prInfo.sourceBranch);
    console.log(`[LocalCI] Merged PR #${prNumber}`);

    return prInfo;
  }

  /**
   * Wait for a PR to be merged.
   * @param {number} prNumber - PR number
   * @param {number} [timeout=600000] - Timeout in milliseconds
   * @returns {Promise<PRInfo>}
   */
  async waitForPRMerge(prNumber, timeout = 600000) {
    const startTime = Date.now();
    const pollInterval = 1000;

    while (Date.now() - startTime < timeout) {
      const prInfo = await this.getPRStatus(prNumber);
      if (prInfo.isMerged()) {
        return prInfo;
      }
      if (prInfo.isClosed()) {
        throw new CIError(`PR #${prNumber} was closed without merge`, {
          provider: 'local',
          operation: 'waitForPRMerge',
        });
      }
      await sleep(pollInterval);
    }

    throw new TimeoutError(`PR #${prNumber} merge timed out`, {
      operation: 'waitForPRMerge',
      timeoutMs: timeout,
    });
  }

  /**
   * Subscribe to CI events.
   * @param {import('./interface.js').CIEventHandler} handler - Event handler
   * @returns {Promise<void>}
   */
  async subscribe(handler) {
    this.eventEmitter.subscribe(handler);
  }

  /**
   * Unsubscribe from CI events.
   * @param {import('./interface.js').CIEventHandler} handler - Event handler
   * @returns {Promise<void>}
   */
  async unsubscribe(handler) {
    this.eventEmitter.unsubscribe(handler);
  }

  /**
   * Get all tracked PRs.
   * @returns {PRInfo[]}
   */
  getAllPRs() {
    return Array.from(this._prs.values());
  }

  /**
   * Get all tracked builds.
   * @returns {BuildStatus[]}
   */
  getAllBuilds() {
    return Array.from(this._builds.values());
  }
}
