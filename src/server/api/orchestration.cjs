/**
 * @fileoverview Orchestration API Endpoint
 *
 * Handles SWARM orchestration control: start, stop, status, plan generation.
 *
 * @module server/api/orchestration
 */

const scribbles = require('scribbles');
const { ape } = require('api-ape');

/**
 * Active orchestration sessions
 * @type {Map<string, Object>}
 */
const sessions = new Map();

/**
 * Orchestration endpoint handler
 *
 * @param {Object} data - Request data
 * @param {string} data.action - Action to perform
 * @param {Object} embed - Embedded data from api-ape
 * @returns {Promise<Object>} Response data
 */
module.exports = async function orchestration(data, embed) {
  const clientId = embed?.clientId || 'default';
  const { action } = data;

  switch (action) {
    case 'generatePlan':
      return generatePlan(data);

    case 'start':
      return startExecution(clientId, data);

    case 'pause':
      return pauseExecution(clientId);

    case 'resume':
      return resumeExecution(clientId);

    case 'cancel':
      return cancelExecution(clientId);

    case 'status':
      return getStatus(clientId);

    default:
      return { error: `Unknown action: ${action}` };
  }
};

/**
 * Generate an execution plan from requirements
 *
 * @param {Object} data - Plan generation data
 * @param {string} data.projectPath - Path to the project
 * @param {string} data.description - Feature description
 * @param {Object} data.answers - Answers to clarifying questions
 * @returns {Object} Generated plan
 */
function generatePlan(data) {
  const { projectPath, description, answers } = data;

  scribbles.log('Generating plan for:', projectPath);

  // TODO: Integrate with actual plan parser/generator
  // For now, return a mock plan structure
  const plan = {
    id: `plan-${Date.now()}`,
    title: extractTitle(description),
    projectPath,
    createdAt: new Date().toISOString(),
    tasks: generateTasksFromDescription(description, answers),
    estimatedAgents: 3,
    estimatedDuration: '15-30 minutes',
  };

  return { plan };
}

/**
 * Start execution of a plan
 *
 * @param {string} clientId - Client identifier
 * @param {Object} data - Execution data
 * @returns {Object} Execution start result
 */
function startExecution(clientId, data) {
  const { projectPath, plan } = data;

  if (sessions.has(clientId)) {
    const existing = sessions.get(clientId);
    if (existing.status === 'running') {
      return { error: 'Execution already in progress' };
    }
  }

  const session = {
    id: `exec-${Date.now()}`,
    clientId,
    projectPath,
    plan,
    status: 'running',
    startedAt: new Date().toISOString(),
    progress: 0,
    agents: [],
    completedTasks: 0,
    totalTasks: plan.tasks.length,
    cost: 0,
  };

  sessions.set(clientId, session);

  scribbles.log('Starting execution:', session.id);

  // Start simulated execution (TODO: integrate with real orchestrator)
  simulateExecution(clientId, session);

  // Publish initial activity
  ape.publish.activity({
    type: 'info',
    message: `Starting execution: ${plan.title}`,
  });

  return {
    executionId: session.id,
    status: 'running',
  };
}

/**
 * Pause execution
 *
 * @param {string} clientId - Client identifier
 * @returns {Object} Result
 */
function pauseExecution(clientId) {
  const session = sessions.get(clientId);
  if (!session) {
    return { error: 'No active execution' };
  }

  if (session.status !== 'running') {
    return { error: `Cannot pause: status is ${session.status}` };
  }

  session.status = 'paused';
  scribbles.log('Paused execution:', session.id);

  ape.publish.activity({
    type: 'warning',
    message: 'Execution paused',
  });

  return { status: 'paused' };
}

/**
 * Resume execution
 *
 * @param {string} clientId - Client identifier
 * @returns {Object} Result
 */
function resumeExecution(clientId) {
  const session = sessions.get(clientId);
  if (!session) {
    return { error: 'No active execution' };
  }

  if (session.status !== 'paused') {
    return { error: `Cannot resume: status is ${session.status}` };
  }

  session.status = 'running';
  scribbles.log('Resumed execution:', session.id);

  // Continue simulation
  simulateExecution(clientId, session);

  ape.publish.activity({
    type: 'info',
    message: 'Execution resumed',
  });

  return { status: 'running' };
}

/**
 * Cancel execution
 *
 * @param {string} clientId - Client identifier
 * @returns {Object} Result
 */
function cancelExecution(clientId) {
  const session = sessions.get(clientId);
  if (!session) {
    return { error: 'No active execution' };
  }

  session.status = 'cancelled';
  scribbles.log('Cancelled execution:', session.id);

  ape.publish.activity({
    type: 'error',
    message: 'Execution cancelled',
  });

  return { status: 'cancelled' };
}

/**
 * Get execution status
 *
 * @param {string} clientId - Client identifier
 * @returns {Object} Status
 */
function getStatus(clientId) {
  const session = sessions.get(clientId);
  if (!session) {
    return { status: 'idle', hasSession: false };
  }

  return {
    status: session.status,
    executionId: session.id,
    progress: session.progress,
    completedTasks: session.completedTasks,
    totalTasks: session.totalTasks,
    agents: session.agents.length,
    cost: session.cost,
    startedAt: session.startedAt,
  };
}

/**
 * Extract a title from the description
 *
 * @param {string} description - Feature description
 * @returns {string} Extracted title
 */
function extractTitle(description) {
  // Take first sentence or first 50 chars
  const firstSentence = description.split(/[.!?\n]/)[0].trim();
  if (firstSentence.length <= 50) {
    return firstSentence;
  }
  return firstSentence.substring(0, 47) + '...';
}

/**
 * Generate tasks from description (placeholder)
 *
 * @param {string} description - Feature description
 * @param {Object} answers - User answers
 * @returns {Array} Generated tasks
 */
function generateTasksFromDescription(_description, _answers) {
  // TODO: Use actual plan generation with AI
  // For now, return template tasks
  return [
    {
      id: 'task-1',
      name: 'Analyze requirements',
      description: 'Review the feature description and create detailed specifications',
      status: 'pending',
      agent: 'Planner',
    },
    {
      id: 'task-2',
      name: 'Design implementation',
      description: 'Create technical design and identify files to modify',
      status: 'pending',
      agent: 'Architect',
    },
    {
      id: 'task-3',
      name: 'Implement changes',
      description: 'Write code changes according to the design',
      status: 'pending',
      agent: 'Developer',
    },
    {
      id: 'task-4',
      name: 'Write tests',
      description: 'Create tests for the new functionality',
      status: 'pending',
      agent: 'Tester',
    },
    {
      id: 'task-5',
      name: 'Review and finalize',
      description: 'Code review and final adjustments',
      status: 'pending',
      agent: 'Reviewer',
    },
  ];
}

/**
 * Simulate execution progress (for demo/testing)
 *
 * @param {string} clientId - Client identifier
 * @param {Object} session - Execution session
 */
function simulateExecution(clientId, session) {
  const interval = setInterval(() => {
    // Check if still running
    const current = sessions.get(clientId);
    if (!current || current.status !== 'running') {
      clearInterval(interval);
      return;
    }

    // Simulate progress
    session.progress = Math.min(100, session.progress + Math.random() * 10);
    session.cost += Math.random() * 0.01;

    // Complete a task occasionally
    if (Math.random() > 0.7 && session.completedTasks < session.totalTasks) {
      session.completedTasks++;
      const task = session.plan.tasks[session.completedTasks - 1];

      ape.publish.activity({
        type: 'success',
        message: `Completed: ${task.name}`,
      });
    }

    // Publish metrics update
    ape.publish.metrics({
      agents: 3,
      tasks: session.completedTasks,
      cost: session.cost,
    });

    // Publish progress
    ape.publish.progress({
      percent: Math.round(session.progress),
    });

    // Check completion
    if (session.progress >= 100) {
      session.status = 'completed';
      clearInterval(interval);

      ape.publish.activity({
        type: 'success',
        message: 'Execution completed successfully!',
      });
    }
  }, 2000);
}
