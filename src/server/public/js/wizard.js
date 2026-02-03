/**
 * @fileoverview SWARM Wizard Client
 *
 * Handles wizard navigation, API calls, and real-time updates
 * using api-ape WebSocket communication.
 */

// State
const state = {
  currentStep: 1,
  projectPath: '',
  description: '',
  answers: {},
  questions: [],
  plan: null,
  isExecuting: false,
};

// DOM Elements
const elements = {
  connectionStatus: document.getElementById('connection-status'),
  stepButtons: document.querySelectorAll('.wizard-steps .step'),
  stepContents: document.querySelectorAll('.step-content'),
  projectPath: document.getElementById('project-path'),
  browseBtn: document.getElementById('browse-btn'),
  directoryTree: document.getElementById('directory-tree'),
  projectInfo: document.getElementById('project-info'),
  projectDetails: document.getElementById('project-details'),
  featureDescription: document.getElementById('feature-description'),
  charCount: document.getElementById('char-count'),
  questionsContainer: document.getElementById('questions-container'),
  planContainer: document.getElementById('plan-container'),
  activityLog: document.getElementById('activity-log'),
  progressFill: document.getElementById('progress-fill'),
  progressText: document.getElementById('progress-text'),
  agentsActive: document.getElementById('agents-active'),
  tasksComplete: document.getElementById('tasks-complete'),
  costDisplay: document.getElementById('cost-display'),
};

// Initialize
function init() {
  setupConnectionMonitor();
  setupEventListeners();
  setupSubscriptions();
}

// Connection monitoring
function setupConnectionMonitor() {
  api.onConnectionChange((status) => {
    const el = elements.connectionStatus;
    if (status === 'connected') {
      el.textContent = 'Connected';
      el.className = 'status connected';
    } else {
      el.textContent = status === 'connecting' ? 'Connecting...' : 'Disconnected';
      el.className = 'status disconnected';
    }
  });
}

// Event listeners
function setupEventListeners() {
  // Step navigation buttons
  elements.stepButtons.forEach((btn) => {
    btn.addEventListener('click', () => {
      const step = parseInt(btn.dataset.step, 10);
      if (step <= state.currentStep) {
        goToStep(step);
      }
    });
  });

  // Step 1: Project selection
  elements.browseBtn.addEventListener('click', () => {
    const path = elements.projectPath.value || process.env.HOME || '/';
    browseDirectory(path);
  });

  elements.projectPath.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      validateProject(elements.projectPath.value);
    }
  });

  document.getElementById('next-step-1').addEventListener('click', () => {
    if (state.projectPath) {
      goToStep(2);
    }
  });

  // Step 2: Description
  elements.featureDescription.addEventListener('input', (e) => {
    state.description = e.target.value;
    elements.charCount.textContent = e.target.value.length;
    document.getElementById('next-step-2').disabled = e.target.value.length < 10;
  });

  document.getElementById('prev-step-2').addEventListener('click', () => goToStep(1));
  document.getElementById('next-step-2').addEventListener('click', () => {
    if (state.description.length >= 10) {
      generateQuestions();
      goToStep(3);
    }
  });

  // Step 3: Questions
  document.getElementById('prev-step-3').addEventListener('click', () => goToStep(2));
  document.getElementById('next-step-3').addEventListener('click', () => {
    generatePlan();
    goToStep(4);
  });

  // Step 4: Plan review
  document.getElementById('prev-step-4').addEventListener('click', () => goToStep(3));
  document.getElementById('approve-plan').addEventListener('click', () => {
    approvePlan();
    goToStep(5);
  });

  // Step 5: Execution
  document.getElementById('pause-execution').addEventListener('click', pauseExecution);
  document.getElementById('cancel-execution').addEventListener('click', cancelExecution);
}

// Subscribe to server events
function setupSubscriptions() {
  // Initial connection data
  api.on('init', ({ data }) => {
    console.log('SWARM initialized:', data);
  });

  // Real-time metrics updates
  api.on('metrics', ({ data }) => {
    updateMetrics(data);
  });

  // Activity log updates
  api.on('activity', ({ data }) => {
    addLogEntry(data);
  });

  // Execution progress
  api.on('progress', ({ data }) => {
    updateProgress(data);
  });
}

// Navigation
function goToStep(step) {
  // Update state
  state.currentStep = step;

  // Update step buttons
  elements.stepButtons.forEach((btn) => {
    const btnStep = parseInt(btn.dataset.step, 10);
    btn.classList.remove('active', 'completed');
    if (btnStep === step) {
      btn.classList.add('active');
    } else if (btnStep < step) {
      btn.classList.add('completed');
    }
  });

  // Update step content
  elements.stepContents.forEach((content) => {
    content.classList.remove('active');
  });
  document.getElementById(`step-${step}`).classList.add('active');
}

// Step 1: Directory browsing
async function browseDirectory(path) {
  try {
    const result = await api.project({ action: 'browse', path });
    if (result.error) {
      showError(result.error);
      return;
    }
    renderDirectoryTree(result.items, path);
  } catch (_err) {
    showError('Failed to browse directory');
  }
}

function renderDirectoryTree(items, _currentPath) {
  elements.directoryTree.innerHTML = items
    .filter((item) => item.isDirectory)
    .map(
      (item) => `
      <div class="item folder" data-path="${item.path}">
        ${item.name}
      </div>
    `
    )
    .join('');

  // Add click handlers
  elements.directoryTree.querySelectorAll('.item').forEach((el) => {
    el.addEventListener('click', () => {
      const path = el.dataset.path;
      elements.projectPath.value = path;
      validateProject(path);
    });

    el.addEventListener('dblclick', () => {
      browseDirectory(el.dataset.path);
    });
  });
}

async function validateProject(path) {
  try {
    const result = await api.project({ action: 'validate', path });
    if (result.valid) {
      state.projectPath = path;
      elements.projectInfo.classList.remove('hidden');
      elements.projectDetails.innerHTML = `
        <p><strong>Name:</strong> ${result.name}</p>
        <p><strong>Type:</strong> ${result.type}</p>
        ${result.description ? `<p><strong>Description:</strong> ${result.description}</p>` : ''}
      `;
      document.getElementById('next-step-1').disabled = false;

      // Mark as selected in tree
      elements.directoryTree.querySelectorAll('.item').forEach((el) => {
        el.classList.toggle('selected', el.dataset.path === path);
      });
    } else {
      elements.projectInfo.classList.add('hidden');
      document.getElementById('next-step-1').disabled = true;
      showError(result.reason || 'Not a valid Node.js project');
    }
  } catch (_err) {
    showError('Failed to validate project');
  }
}

// Step 3: Generate questions
async function generateQuestions() {
  elements.questionsContainer.innerHTML = '<div class="loading">Generating questions...</div>';

  try {
    const result = await api.requirements({
      action: 'generateQuestions',
      description: state.description,
      projectPath: state.projectPath,
    });

    if (result.questions && result.questions.length > 0) {
      state.questions = result.questions;
      renderQuestions(result.questions);
    } else {
      // No questions needed, enable next
      elements.questionsContainer.innerHTML =
        '<p>No additional clarification needed. Proceed to review the plan.</p>';
      document.getElementById('next-step-3').disabled = false;
    }
  } catch (_err) {
    elements.questionsContainer.innerHTML =
      '<p class="error">Failed to generate questions. Please try again.</p>';
  }
}

function renderQuestions(questions) {
  elements.questionsContainer.innerHTML = questions
    .map(
      (q, i) => `
      <div class="question-card" data-index="${i}">
        <h4>${q.question}</h4>
        ${
          q.type === 'select'
            ? `
          <div class="options">
            ${q.options
              .map(
                (opt, _j) => `
              <label class="option">
                <input type="radio" name="q${i}" value="${opt}">
                ${opt}
              </label>
            `
              )
              .join('')}
          </div>
        `
            : `
          <input type="text" placeholder="Your answer..." data-question="${i}">
        `
        }
      </div>
    `
    )
    .join('');

  // Add change handlers
  elements.questionsContainer.querySelectorAll('input').forEach((input) => {
    input.addEventListener('change', () => {
      const card = input.closest('.question-card');
      const index = parseInt(card.dataset.index, 10);
      state.answers[index] = input.value;
      checkAllQuestionsAnswered();
    });
  });
}

function checkAllQuestionsAnswered() {
  const allAnswered = state.questions.every((_, i) => state.answers[i]);
  document.getElementById('next-step-3').disabled = !allAnswered;
}

// Step 4: Generate plan
async function generatePlan() {
  elements.planContainer.innerHTML = '<div class="loading">Generating plan...</div>';

  try {
    const result = await api.orchestration({
      action: 'generatePlan',
      projectPath: state.projectPath,
      description: state.description,
      answers: state.answers,
    });

    if (result.plan) {
      state.plan = result.plan;
      renderPlan(result.plan);
    } else {
      elements.planContainer.innerHTML = '<p class="error">Failed to generate plan.</p>';
    }
  } catch (_err) {
    elements.planContainer.innerHTML = '<p class="error">Failed to generate plan.</p>';
  }
}

function renderPlan(plan) {
  elements.planContainer.innerHTML = `
    <h3>${plan.title || 'Implementation Plan'}</h3>
    <ul class="task-list">
      ${plan.tasks
        .map(
          (task) => `
        <li class="task-item">
          <span class="task-name">${task.name}</span>
          <p class="task-description">${task.description || ''}</p>
        </li>
      `
        )
        .join('')}
    </ul>
  `;
}

// Step 5: Execution
async function approvePlan() {
  state.isExecuting = true;
  addLogEntry({ type: 'info', message: 'Starting execution...' });

  try {
    await api.orchestration({
      action: 'start',
      projectPath: state.projectPath,
      plan: state.plan,
    });
  } catch (_err) {
    addLogEntry({ type: 'error', message: 'Failed to start execution' });
  }
}

async function pauseExecution() {
  try {
    await api.orchestration({ action: 'pause' });
    addLogEntry({ type: 'info', message: 'Execution paused' });
  } catch (_err) {
    addLogEntry({ type: 'error', message: 'Failed to pause' });
  }
}

async function cancelExecution() {
  if (confirm('Are you sure you want to cancel? Progress will be lost.')) {
    try {
      await api.orchestration({ action: 'cancel' });
      addLogEntry({ type: 'warning', message: 'Execution cancelled' });
      state.isExecuting = false;
    } catch (_err) {
      addLogEntry({ type: 'error', message: 'Failed to cancel' });
    }
  }
}

function updateMetrics(data) {
  if (data.agents !== undefined) {
    elements.agentsActive.textContent = data.agents;
  }
  if (data.tasks !== undefined) {
    elements.tasksComplete.textContent = data.tasks;
  }
  if (data.cost !== undefined) {
    elements.costDisplay.textContent = `$${data.cost.toFixed(2)}`;
  }
}

function updateProgress(data) {
  const percent = data.percent || 0;
  elements.progressFill.style.width = `${percent}%`;
  elements.progressText.textContent = `${percent}% complete`;
}

function addLogEntry(entry) {
  const timestamp = new Date().toLocaleTimeString();
  const div = document.createElement('div');
  div.className = `log-entry ${entry.type || 'info'}`;
  div.innerHTML = `<span class="timestamp">${timestamp}</span>${entry.message}`;
  elements.activityLog.appendChild(div);
  elements.activityLog.scrollTop = elements.activityLog.scrollHeight;
}

function showError(message) {
  console.error(message);
  // Could add a toast notification here
}

// Start
init();
