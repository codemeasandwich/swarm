/**
 * @file Mock utilities for testing.
 * @module tests/helpers/mocks
 */

/**
 * Create a mock CI provider.
 * @returns {Object}
 */
export function createMockCIProvider() {
  const builds = new Map();
  const prs = new Map();
  let nextRunId = 1;
  let nextPRNumber = 1;

  return {
    async triggerBuild(branch) {
      const runId = `mock-${nextRunId++}`;
      const status = {
        runId,
        status: 'success',
        startedAt: new Date(),
        completedAt: new Date(),
        url: null,
        errorMessage: null,
        isComplete: () => true,
        isSuccess: () => true,
      };
      builds.set(runId, status);
      return status;
    },

    async getBuildStatus(runId) {
      return builds.get(runId);
    },

    async waitForBuild(runId) {
      return builds.get(runId);
    },

    async createPR({ title, body, sourceBranch, targetBranch }) {
      const number = nextPRNumber++;
      const prInfo = {
        number,
        title,
        status: 'open',
        url: `mock://pr/${number}`,
        sourceBranch,
        targetBranch,
        mergedAt: null,
        isMerged: () => false,
        isOpen: () => true,
      };
      prs.set(number, prInfo);
      return prInfo;
    },

    async getPRStatus(prNumber) {
      return prs.get(prNumber);
    },

    async mergePR(prNumber) {
      const pr = prs.get(prNumber);
      if (pr) {
        pr.status = 'merged';
        pr.mergedAt = new Date();
        pr.isMerged = () => true;
        pr.isOpen = () => false;
      }
      return pr;
    },

    async waitForPRMerge(prNumber) {
      const pr = prs.get(prNumber);
      if (pr) {
        pr.status = 'merged';
        pr.mergedAt = new Date();
        pr.isMerged = () => true;
      }
      return pr;
    },

    async subscribe() {},
    async unsubscribe() {},
  };
}

/**
 * Create a mock terminal manager.
 * @returns {Object}
 */
export function createMockTerminalManager() {
  const processes = new Map();

  return {
    async spawnClaudeAgent({ agentId, prompt, workingDir }) {
      const process = {
        agentId,
        prompt,
        workingDir,
        isRunning: true,
        outputLines: [],
        errorLines: [],
        pid: Math.floor(Math.random() * 10000),
        on: () => {},
        sendInput: () => true,
        terminate: async () => {
          process.isRunning = false;
        },
      };
      processes.set(agentId, process);
      return process;
    },

    getProcess(agentId) {
      return processes.get(agentId);
    },

    isRunning(agentId) {
      const p = processes.get(agentId);
      return p?.isRunning ?? false;
    },

    async terminate(agentId) {
      const p = processes.get(agentId);
      if (p) {
        p.isRunning = false;
        processes.delete(agentId);
      }
    },

    async terminateAll() {
      for (const p of processes.values()) {
        p.isRunning = false;
      }
      processes.clear();
    },
  };
}

/**
 * Create a mock workspace manager.
 * @returns {Object}
 */
export function createMockWorkspaceManager() {
  const sandboxes = new Map();

  return {
    async createSandbox(agentId) {
      const path = `/mock/sandbox/${agentId}`;
      sandboxes.set(agentId, path);
      return path;
    },

    getSandbox(agentId) {
      return sandboxes.get(agentId);
    },

    async sandboxExists(agentId) {
      return sandboxes.has(agentId);
    },

    async injectClaudeMd(agentId, content) {
      return `/mock/sandbox/${agentId}/.claude.md`;
    },

    async cleanupSandbox(agentId) {
      sandboxes.delete(agentId);
    },

    async cleanupAll() {
      sandboxes.clear();
    },
  };
}

/**
 * Create a mock branch manager.
 * @returns {Object}
 */
export function createMockBranchManager() {
  const branches = new Map();

  return {
    async createAgentBranch(agentId, taskId) {
      const branchInfo = {
        name: `agent/${agentId}/${taskId}`,
        agentId,
        taskId,
        createdAt: new Date(),
        baseBranch: 'integration',
      };
      branches.set(agentId, branchInfo);
      return branchInfo;
    },

    getBranch(agentId) {
      return branches.get(agentId);
    },

    getBranchName(agentId) {
      return branches.get(agentId)?.name;
    },

    async mergeBranch(agentId) {},
    async deleteBranch(agentId) {
      branches.delete(agentId);
    },
  };
}
