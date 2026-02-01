/**
 * @file Workspace management for agent sandboxes.
 * @module runtime/workspace
 */

import { mkdir, rm, writeFile, readFile, access, constants, cp } from 'node:fs/promises';
import { join, resolve } from 'node:path';
import { WorkspaceError } from '../orchestrator/errors.js';

/**
 * Manages sandbox workspaces for agents.
 */
export class WorkspaceManager {
  /**
   * Create a WorkspaceManager.
   * @param {string} baseDir - Base directory for all sandboxes
   * @param {string} repoDir - Repository directory to clone from
   */
  constructor(baseDir, repoDir) {
    /** @type {string} */
    this.baseDir = resolve(baseDir);
    /** @type {string} */
    this.repoDir = resolve(repoDir);
    /** @private @type {Map<string, string>} */
    this._sandboxes = new Map();
  }

  /**
   * Create a sandbox directory for an agent.
   *
   * @param {string} agentId - Agent identifier
   * @param {Object} [options] - Options
   * @param {boolean} [options.clean=false] - Remove existing sandbox first
   * @returns {Promise<string>} Path to the sandbox
   */
  async createSandbox(agentId, options = {}) {
    const sandboxPath = join(this.baseDir, agentId);

    // Clean existing sandbox if requested
    if (options.clean) {
      await this.cleanupSandbox(agentId);
    }

    // Create the sandbox directory
    await mkdir(sandboxPath, { recursive: true });

    this._sandboxes.set(agentId, sandboxPath);
    console.log(`[WorkspaceManager] Created sandbox for ${agentId} at ${sandboxPath}`);

    return sandboxPath;
  }

  /**
   * Get the sandbox path for an agent.
   * @param {string} agentId - Agent identifier
   * @returns {string|undefined}
   */
  getSandbox(agentId) {
    return this._sandboxes.get(agentId);
  }

  /**
   * Check if a sandbox exists for an agent.
   * @param {string} agentId - Agent identifier
   * @returns {Promise<boolean>}
   */
  async sandboxExists(agentId) {
    const sandboxPath = this._sandboxes.get(agentId) ?? join(this.baseDir, agentId);
    try {
      await access(sandboxPath, constants.F_OK);
      return true;
    } catch {
      return false;
    }
  }

  /**
   * Inject a .claude.md file into an agent's sandbox.
   *
   * @param {string} agentId - Agent identifier
   * @param {string} content - Content of the .claude.md file
   * @returns {Promise<string>} Path to the .claude.md file
   * @throws {WorkspaceError} If sandbox doesn't exist
   */
  async injectClaudeMd(agentId, content) {
    const sandboxPath = this._sandboxes.get(agentId);

    if (!sandboxPath) {
      throw new WorkspaceError(`No sandbox found for agent ${agentId}`, {
        agentId,
      });
    }

    const claudeMdPath = join(sandboxPath, '.claude.md');
    await writeFile(claudeMdPath, content, 'utf-8');

    console.log(`[WorkspaceManager] Injected .claude.md for ${agentId}`);
    return claudeMdPath;
  }

  /**
   * Setup .claude.md from existing file.
   *
   * @param {string} agentId - Agent identifier
   * @param {string} sourcePath - Path to source .claude.md file
   * @returns {Promise<string>} Path to the copied .claude.md file
   * @throws {WorkspaceError} If sandbox doesn't exist or source file not found
   */
  async setupClaudeMd(agentId, sourcePath) {
    const sandboxPath = this._sandboxes.get(agentId);

    if (!sandboxPath) {
      throw new WorkspaceError(`No sandbox found for agent ${agentId}`, {
        agentId,
      });
    }

    try {
      const content = await readFile(sourcePath, 'utf-8');
      return this.injectClaudeMd(agentId, content);
    } catch (error) {
      throw new WorkspaceError(`Failed to read source .claude.md: ${error.message}`, {
        agentId,
        path: sourcePath,
        cause: error,
      });
    }
  }

  /**
   * Copy files from repo to sandbox.
   *
   * @param {string} agentId - Agent identifier
   * @param {string[]} files - Relative file paths to copy
   * @returns {Promise<void>}
   * @throws {WorkspaceError} If sandbox doesn't exist
   */
  async copyFilesToSandbox(agentId, files) {
    const sandboxPath = this._sandboxes.get(agentId);

    if (!sandboxPath) {
      throw new WorkspaceError(`No sandbox found for agent ${agentId}`, {
        agentId,
      });
    }

    for (const file of files) {
      const sourcePath = join(this.repoDir, file);
      const destPath = join(sandboxPath, file);

      try {
        // Ensure destination directory exists
        await mkdir(join(destPath, '..'), { recursive: true });
        await cp(sourcePath, destPath, { recursive: true });
      } catch (error) {
        console.warn(`[WorkspaceManager] Failed to copy ${file}: ${error.message}`);
      }
    }
  }

  /**
   * Write a file to an agent's sandbox.
   *
   * @param {string} agentId - Agent identifier
   * @param {string} relativePath - Relative path within sandbox
   * @param {string} content - File content
   * @returns {Promise<string>} Absolute path to the written file
   * @throws {WorkspaceError} If sandbox doesn't exist
   */
  async writeFile(agentId, relativePath, content) {
    const sandboxPath = this._sandboxes.get(agentId);

    if (!sandboxPath) {
      throw new WorkspaceError(`No sandbox found for agent ${agentId}`, {
        agentId,
      });
    }

    const filePath = join(sandboxPath, relativePath);

    // Ensure directory exists
    await mkdir(join(filePath, '..'), { recursive: true });
    await writeFile(filePath, content, 'utf-8');

    return filePath;
  }

  /**
   * Read a file from an agent's sandbox.
   *
   * @param {string} agentId - Agent identifier
   * @param {string} relativePath - Relative path within sandbox
   * @returns {Promise<string>} File content
   * @throws {WorkspaceError} If sandbox doesn't exist or file not found
   */
  async readFile(agentId, relativePath) {
    const sandboxPath = this._sandboxes.get(agentId);

    if (!sandboxPath) {
      throw new WorkspaceError(`No sandbox found for agent ${agentId}`, {
        agentId,
      });
    }

    const filePath = join(sandboxPath, relativePath);

    try {
      return await readFile(filePath, 'utf-8');
    } catch (error) {
      throw new WorkspaceError(`Failed to read file ${relativePath}: ${error.message}`, {
        agentId,
        path: filePath,
        cause: error,
      });
    }
  }

  /**
   * Cleanup a sandbox directory.
   *
   * @param {string} agentId - Agent identifier
   * @returns {Promise<void>}
   */
  async cleanupSandbox(agentId) {
    const sandboxPath = this._sandboxes.get(agentId) ?? join(this.baseDir, agentId);

    try {
      await rm(sandboxPath, { recursive: true, force: true });
      this._sandboxes.delete(agentId);
      console.log(`[WorkspaceManager] Cleaned up sandbox for ${agentId}`);
    } catch (error) {
      console.warn(`[WorkspaceManager] Failed to cleanup sandbox: ${error.message}`);
    }
  }

  /**
   * Cleanup all sandboxes.
   * @returns {Promise<void>}
   */
  async cleanupAll() {
    for (const agentId of this._sandboxes.keys()) {
      await this.cleanupSandbox(agentId);
    }
  }

  /**
   * Get all tracked sandboxes.
   * @returns {Map<string, string>}
   */
  getAllSandboxes() {
    return new Map(this._sandboxes);
  }

  /**
   * Get sandbox path for an agent, creating if necessary.
   *
   * @param {string} agentId - Agent identifier
   * @returns {Promise<string>}
   */
  async getOrCreateSandbox(agentId) {
    if (this._sandboxes.has(agentId)) {
      return this._sandboxes.get(agentId);
    }
    return this.createSandbox(agentId);
  }
}
