/**
 * @file E2E tests for server connection (WEB-01 to WEB-06).
 * Tests server startup, static file serving, and security.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';
import { createServer } from '../../../src/server/index.js';

/**
 * Make a raw HTTP request without path normalization.
 * fetch() normalizes paths which removes .. sequences before sending.
 * @param {string} host - Host name
 * @param {number} port - Port number
 * @param {string} path - Raw path (not normalized)
 * @returns {Promise<{statusCode: number, body: string}>}
 */
function rawHttpGet(host, port, path) {
  return new Promise((resolve, reject) => {
    const req = http.request({ host, port, path, method: 'GET' }, (res) => {
      let body = '';
      res.on('data', (chunk) => (body += chunk));
      res.on('end', () => resolve({ statusCode: res.statusCode, body }));
    });
    req.on('error', reject);
    req.end();
  });
}

describe('Server Connection', () => {
  /** @type {import('node:http').Server} */
  let server;
  /** @type {number} */
  let port;
  /** @type {string} */
  let baseUrl;

  before(async () => {
    // Use a random high port to avoid conflicts
    port = 30000 + Math.floor(Math.random() * 10000);
    const result = await createServer({ port });
    server = result.server;
    baseUrl = `http://localhost:${port}`;
  });

  after(() => {
    return new Promise((resolve) => {
      // Force close all connections
      server.closeAllConnections?.();
      server.close(resolve);
    });
  });

  // WEB-01: Server starts on configured port
  test('WEB-01: server starts and listens on configured port', async () => {
    const address = server.address();
    assert.ok(address, 'Server should have an address');
    assert.equal(address.port, port, 'Server should listen on configured port');
  });

  // WEB-02: Dashboard loads in browser
  test('WEB-02: navigating to root returns HTML wizard UI', async () => {
    const response = await fetch(baseUrl);
    assert.equal(response.status, 200, 'Should return 200 OK');

    const contentType = response.headers.get('content-type');
    assert.ok(contentType.includes('text/html'), 'Should return HTML');

    const html = await response.text();
    assert.ok(html.includes('SWARM'), 'HTML should contain SWARM title');
    assert.ok(html.includes('wizard'), 'HTML should contain wizard reference');
  });

  // WEB-05: Static files served correctly
  describe('WEB-05: static file serving', () => {
    test('serves CSS files with correct MIME type', async () => {
      const response = await fetch(`${baseUrl}/css/styles.css`);
      assert.equal(response.status, 200, 'Should return 200 OK');

      const contentType = response.headers.get('content-type');
      assert.ok(contentType.includes('text/css'), 'Should return CSS content type');
    });

    test('serves JavaScript files with correct MIME type', async () => {
      const response = await fetch(`${baseUrl}/js/wizard.js`);
      assert.equal(response.status, 200, 'Should return 200 OK');

      const contentType = response.headers.get('content-type');
      assert.ok(contentType.includes('javascript'), 'Should return JS content type');
    });

    test('returns 404 for non-existent files', async () => {
      const response = await fetch(`${baseUrl}/nonexistent.html`);
      assert.equal(response.status, 404, 'Should return 404 Not Found');
    });
  });

  // WEB-06: Security - directory traversal protection
  // Note: fetch() normalizes paths, so we use raw HTTP requests for these tests
  describe('WEB-06: directory traversal protection', () => {
    test('blocks path with .. sequence', async () => {
      const res = await rawHttpGet('localhost', port, '/../../../etc/passwd');
      assert.equal(res.statusCode, 403, 'Should return 403 Forbidden');
    });

    test('blocks encoded .. sequence', async () => {
      // URL-encoded .. (%2e%2e) - server should decode and block
      const res = await rawHttpGet('localhost', port, '/%2e%2e/etc/passwd');
      // May be 403 (if decoded) or 404 (if not decoded and file not found)
      assert.ok(
        res.statusCode === 403 || res.statusCode === 404,
        'Should block or not find traversal paths'
      );
    });

    test('blocks nested .. sequences', async () => {
      const res = await rawHttpGet('localhost', port, '/css/../../../package.json');
      assert.equal(res.statusCode, 403, 'Should return 403 Forbidden');
    });
  });
});
