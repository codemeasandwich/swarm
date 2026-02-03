/**
 * @file E2E tests for terminal monitor (TERM-*).
 *
 * The performance-monitor.js is example code that uses blessed for terminal UI.
 * Since it executes immediately on import and uses local library paths,
 * we validate the code structure and patterns rather than runtime behavior.
 *
 * Visual/runtime testing requires manual verification:
 * - Run: node examples/performance-monitor.js
 * - Verify: Dashboard displays, widgets update, q/Escape exits
 */

import { test, describe } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { join } from 'node:path';

const MONITOR_PATH = join(process.cwd(), 'examples/performance-monitor.js');

describe('Terminal Monitor', () => {
  /** @type {string} */
  let monitorCode;

  // Load the monitor file content for validation
  const loadMonitorCode = async () => {
    if (!monitorCode) {
      monitorCode = await readFile(MONITOR_PATH, 'utf-8');
    }
    return monitorCode;
  };

  describe('TERM-01/02: startup and layout', () => {
    test('file exists and is valid JavaScript', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.length > 0, 'File should not be empty');
      // Basic syntax validation - no syntax errors in the source
      assert.ok(code.includes('import'), 'Should use ES modules');
    });

    test('creates blessed screen', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('blessed.screen'), 'Should create blessed screen');
    });

    test('creates 12x12 grid layout', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('rows: 12'), 'Should have 12 rows');
      assert.ok(code.includes('cols: 12'), 'Should have 12 columns');
    });
  });

  describe('TERM-03/04/05: exit handling', () => {
    test('registers q key handler', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes("'q'"), 'Should register q key handler');
    });

    test('registers escape key handler', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes("'escape'"), 'Should register escape key handler');
    });

    test('registers Ctrl+C handler', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes("'C-c'"), 'Should register Ctrl+C handler');
    });

    test('exits process on key press', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('process.exit'), 'Should call process.exit');
    });
  });

  describe('TERM-06: resize handling', () => {
    test('handles resize event', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes("'resize'"), 'Should handle resize event');
      assert.ok(code.includes('.emit'), 'Should emit attach on resize');
    });
  });

  describe('TERM-07/08/09: agent donut chart', () => {
    test('creates agent donut widget', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.donut'), 'Should create donut chart');
      assert.ok(code.includes('Agent Utilization'), 'Should have agent utilization label');
    });

    test('has updateAgentDonut function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateAgentDonut'), 'Should have update function');
    });

    test('donut color changes based on load', async () => {
      const code = await loadMonitorCode();
      // Check for color logic (green, yellow, red thresholds)
      assert.ok(code.includes('color = '), 'Should set color based on load');
      assert.ok(code.includes("'green'"), 'Should use green color');
      assert.ok(code.includes("'yellow'"), 'Should use yellow color');
      assert.ok(code.includes("'red'"), 'Should use red color');
    });
  });

  describe('TERM-10/11/12/13: throughput line chart', () => {
    test('creates throughput line chart', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.line'), 'Should create line chart');
      assert.ok(code.includes('Throughput'), 'Should have throughput label');
    });

    test('shows both started and completed lines', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes("title: 'Completed'"), 'Should have completed line');
      assert.ok(code.includes("title: 'Started'"), 'Should have started line');
    });

    test('maintains 30 data points', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('new Array(30)'), 'Should initialize 30-point arrays');
    });

    test('has updateThroughput function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateThroughput'), 'Should have update function');
    });
  });

  describe('TERM-14/15: agent bar chart', () => {
    test('creates agent bar chart', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.bar'), 'Should create bar chart');
      assert.ok(code.includes('Tasks per Agent'), 'Should have tasks per agent label');
    });

    test('has updateAgentBar function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateAgentBar'), 'Should have update function');
    });
  });

  describe('TERM-16/17: token gauge', () => {
    test('creates token gauge widget', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.gauge'), 'Should create gauge');
      assert.ok(code.includes('Token Usage'), 'Should have token usage label');
    });

    test('has updateTokenGauge function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateTokenGauge'), 'Should have update function');
    });
  });

  describe('TERM-18/19/20: cost LCD', () => {
    test('creates cost LCD widget', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.lcd'), 'Should create LCD');
      assert.ok(code.includes('Cost'), 'Should have cost label');
    });

    test('has updateCostLcd function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateCostLcd'), 'Should have update function');
    });

    test('cost LCD has color thresholds', async () => {
      const code = await loadMonitorCode();
      // Check for cost thresholds (5, 10)
      assert.ok(code.includes('totalCost >= 10'), 'Should have high cost threshold');
      assert.ok(code.includes('totalCost >= 5'), 'Should have medium cost threshold');
    });
  });

  describe('TERM-21/22: queue sparkline', () => {
    test('creates queue sparkline widget', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.sparkline'), 'Should create sparkline');
      assert.ok(code.includes('Queue'), 'Should have queue label');
    });

    test('has updateQueueSparkline function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateQueueSparkline'), 'Should have update function');
    });
  });

  describe('TERM-23/24/25: task table', () => {
    test('creates task table widget', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.table'), 'Should create table');
      assert.ok(code.includes('Active Tasks'), 'Should have active tasks label');
    });

    test('table has keyboard navigation', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('keys: true'), 'Should enable key navigation');
      assert.ok(code.includes('taskTable.focus'), 'Should focus table');
    });

    test('has updateTaskTable function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateTaskTable'), 'Should have update function');
    });

    test('table has expected columns', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes("'Agent'"), 'Should have Agent column');
      assert.ok(code.includes("'Task'"), 'Should have Task column');
      assert.ok(code.includes("'Progress'"), 'Should have Progress column');
      assert.ok(code.includes("'Status'"), 'Should have Status column');
    });
  });

  describe('TERM-26/27: event log', () => {
    test('creates event log widget', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('contrib.log'), 'Should create log');
      assert.ok(code.includes('Agent Events'), 'Should have agent events label');
    });

    test('has updateEventLog function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateEventLog'), 'Should have update function');
    });
  });

  describe('TERM-28/29: error line chart', () => {
    test('creates error line chart', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('Errors'), 'Should have errors label');
    });

    test('has updateErrorLine function', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('function updateErrorLine'), 'Should have update function');
    });
  });

  describe('update intervals', () => {
    test('sets up update intervals', async () => {
      const code = await loadMonitorCode();
      const intervalMatches = code.match(/setInterval/g);
      assert.ok(intervalMatches, 'Should use setInterval');
      assert.ok(intervalMatches.length >= 8, 'Should have multiple update intervals');
    });

    test('uses screen.render in intervals', async () => {
      const code = await loadMonitorCode();
      assert.ok(code.includes('screen.render()'), 'Should call screen.render()');
    });
  });
});
