/**
 * SWARM Performance Monitoring Station
 * Real-time dashboard for monitoring agent orchestration performance.
 */
import blessed from '/Users/bri/www/CliUI/lib/blessed.js';
import contrib from '/Users/bri/www/CliUI/index.js';

const screen = blessed.screen();

// Create 12x12 grid layout
const grid = new contrib.grid({ rows: 12, cols: 12, screen });

// Agent Status Donut (top-right)
const agentDonut = grid.set(0, 8, 4, 4, contrib.donut, {
  label: 'Agent Utilization',
  radius: 16,
  arcWidth: 4,
  yPadding: 2,
  data: [
    { label: 'Active', percent: 0, color: 'green' },
  ],
});

// Task Throughput Line Chart (top-left, large)
const throughputLine = grid.set(0, 0, 6, 8, contrib.line, {
  showNthLabel: 5,
  maxY: 100,
  label: 'Task Throughput (tasks/min)',
  showLegend: true,
  legend: { width: 12 },
});

// Agent Bar Chart (middle-left)
const agentBar = grid.set(6, 0, 3, 4, contrib.bar, {
  label: 'Tasks per Agent',
  barWidth: 6,
  barSpacing: 2,
  xOffset: 0,
  maxHeight: 9,
});

// Memory/Token Usage Gauge (middle)
const tokenGauge = grid.set(6, 4, 2, 4, contrib.gauge, {
  label: 'Context Token Usage',
  percent: 0,
});

// Cost Tracker LCD (middle-right)
const costLcd = grid.set(4, 8, 2, 4, contrib.lcd, {
  label: 'Cost ($)',
  segmentWidth: 0.06,
  segmentInterval: 0.11,
  strokeWidth: 0.1,
  elements: 6,
  display: '000.00',
  elementSpacing: 4,
  elementPadding: 2,
  color: 'green',
});

// Task Queue Sparkline (bottom-middle)
const queueSparkline = grid.set(8, 4, 2, 4, contrib.sparkline, {
  label: 'Queue Depth',
  tags: true,
  style: { fg: 'cyan', titleFg: 'white' },
});

// Active Tasks Table (bottom-left)
const taskTable = grid.set(9, 0, 3, 6, contrib.table, {
  keys: true,
  fg: 'green',
  label: 'Active Tasks',
  columnSpacing: 1,
  columnWidth: [12, 20, 10, 8],
});

// Event Log (right side)
const eventLog = grid.set(6, 8, 6, 4, contrib.log, {
  fg: 'green',
  selectedFg: 'green',
  label: 'Agent Events',
});

// Error Rate Line (bottom)
const errorLine = grid.set(9, 6, 3, 2, contrib.line, {
  style: { line: 'red', text: 'white', baseline: 'black' },
  label: 'Errors',
  maxY: 10,
});

// Simulated data
const agents = ['Planner', 'Worker-1', 'Worker-2', 'Worker-3', 'Judge'];
const taskTypes = ['implement', 'review', 'test', 'refactor', 'document'];
const events = [
  'Agent spawned',
  'Task claimed',
  'Task completed',
  'Context refreshed',
  'Checkpoint saved',
  'Merge succeeded',
  'Conflict detected',
  'Retry scheduled',
];

// Metrics state
let totalCost = 0;
let queueHistory = new Array(30).fill(0);
let throughputHistory = {
  completed: new Array(30).fill(0),
  started: new Array(30).fill(0),
};
let errorHistory = new Array(10).fill(0);
let activeAgents = 0;

// Update agent donut
function updateAgentDonut() {
  activeAgents = Math.floor(Math.random() * agents.length) + 1;
  const percent = Math.round((activeAgents / agents.length) * 100);

  let color = 'green';
  if (percent >= 80) color = 'red';
  else if (percent >= 60) color = 'yellow';

  agentDonut.setData([
    { label: 'Active', percent, color },
  ]);
}

// Update throughput chart
function updateThroughput() {
  const timeLabels = [];
  const now = new Date();
  for (let i = 29; i >= 0; i--) {
    const t = new Date(now - i * 60000);
    timeLabels.push(t.toTimeString().slice(0, 5));
  }

  // Shift and add new data
  throughputHistory.completed.shift();
  throughputHistory.completed.push(Math.floor(Math.random() * 30) + 20);

  throughputHistory.started.shift();
  throughputHistory.started.push(Math.floor(Math.random() * 25) + 25);

  throughputLine.setData([
    {
      title: 'Completed',
      style: { line: 'green' },
      x: timeLabels,
      y: throughputHistory.completed,
    },
    {
      title: 'Started',
      style: { line: 'yellow' },
      x: timeLabels,
      y: throughputHistory.started,
    },
  ]);
}

// Update agent bar chart
function updateAgentBar() {
  const data = agents.map(() => Math.floor(Math.random() * 8) + 1);
  agentBar.setData({ titles: agents.map(a => a.slice(0, 6)), data });
}

// Update token gauge
function updateTokenGauge() {
  const usage = Math.floor(Math.random() * 40) + 30;
  tokenGauge.setData(usage);
}

// Update cost LCD
function updateCostLcd() {
  totalCost += Math.random() * 0.05;
  const display = totalCost.toFixed(2).padStart(6, '0');

  let color = 'green';
  if (totalCost >= 10) color = 'red';
  else if (totalCost >= 5) color = 'yellow';

  costLcd.setDisplay(display);
  costLcd.setOptions({ color });
}

// Update queue sparkline
function updateQueueSparkline() {
  queueHistory.shift();
  queueHistory.push(Math.floor(Math.random() * 15) + 5);
  queueSparkline.setData(['Pending', 'Blocked'], [
    queueHistory,
    queueHistory.map(v => Math.floor(v * 0.2)),
  ]);
}

// Update task table
function updateTaskTable() {
  const data = [];
  const numTasks = Math.floor(Math.random() * 5) + 3;

  for (let i = 0; i < numTasks; i++) {
    const agent = agents[Math.floor(Math.random() * agents.length)];
    const task = taskTypes[Math.floor(Math.random() * taskTypes.length)];
    const progress = Math.floor(Math.random() * 100);
    const status = progress === 100 ? 'done' : progress > 50 ? 'running' : 'pending';

    data.push([agent, task, `${progress}%`, status]);
  }

  taskTable.setData({
    headers: ['Agent', 'Task', 'Progress', 'Status'],
    data,
  });
}

// Update event log
function updateEventLog() {
  const event = events[Math.floor(Math.random() * events.length)];
  const agent = agents[Math.floor(Math.random() * agents.length)];
  const timestamp = new Date().toTimeString().slice(0, 8);
  eventLog.log(`[${timestamp}] ${agent}: ${event}`);
}

// Update error line
function updateErrorLine() {
  errorHistory.shift();
  errorHistory.push(Math.random() > 0.8 ? Math.floor(Math.random() * 3) + 1 : 0);

  errorLine.setData([{
    title: 'errors',
    x: errorHistory.map((_, i) => `t-${9-i}`),
    y: errorHistory,
  }]);
}

// Initial render
updateAgentDonut();
updateThroughput();
updateAgentBar();
updateTokenGauge();
updateCostLcd();
updateQueueSparkline();
updateTaskTable();
updateErrorLine();

taskTable.focus();

// Update intervals
setInterval(() => { updateAgentDonut(); screen.render(); }, 2000);
setInterval(() => { updateThroughput(); screen.render(); }, 1000);
setInterval(() => { updateAgentBar(); screen.render(); }, 3000);
setInterval(() => { updateTokenGauge(); screen.render(); }, 1500);
setInterval(() => { updateCostLcd(); screen.render(); }, 500);
setInterval(() => { updateQueueSparkline(); screen.render(); }, 1000);
setInterval(() => { updateTaskTable(); screen.render(); }, 2500);
setInterval(() => { updateEventLog(); screen.render(); }, 800);
setInterval(() => { updateErrorLine(); screen.render(); }, 2000);

// Handle resize
screen.on('resize', () => {
  agentDonut.emit('attach');
  throughputLine.emit('attach');
  agentBar.emit('attach');
  tokenGauge.emit('attach');
  costLcd.emit('attach');
  queueSparkline.emit('attach');
  taskTable.emit('attach');
  eventLog.emit('attach');
  errorLine.emit('attach');
});

// Exit handling
screen.key(['escape', 'q', 'C-c'], () => process.exit(0));

screen.render();

console.log('SWARM Performance Monitor started. Press q to quit.');
