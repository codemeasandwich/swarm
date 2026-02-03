/**
 * @fileoverview SWARM Web Server
 *
 * api-ape WebSocket server for the SWARM project management UI.
 * Serves static files and handles real-time communication with clients.
 *
 * @module server/index
 */

import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { createRequire } from 'node:module';
import scribbles from 'scribbles';

// Import api-ape as CommonJS to get the ape server function
const require = createRequire(import.meta.url);
const { ape } = require('api-ape');

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const PUBLIC_DIR = path.join(__dirname, 'public');

/**
 * MIME types for static file serving
 * @type {Object<string, string>}
 */
const MIME_TYPES = {
  '.html': 'text/html',
  '.css': 'text/css',
  '.js': 'application/javascript',
  '.json': 'application/json',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.svg': 'image/svg+xml',
  '.ico': 'image/x-icon',
};

/**
 * Serve static files from the public directory
 *
 * @param {http.IncomingMessage} req - HTTP request
 * @param {http.ServerResponse} res - HTTP response
 * @returns {boolean} True if file was served, false if not found
 */
function serveStatic(req, res) {
  const filePath = req.url === '/' ? '/index.html' : req.url;

  // Security: prevent directory traversal
  if (filePath.includes('..')) {
    res.writeHead(403);
    res.end('Forbidden');
    return true;
  }

  const fullPath = path.join(PUBLIC_DIR, filePath);
  const ext = path.extname(fullPath);

  if (!fs.existsSync(fullPath) || fs.statSync(fullPath).isDirectory()) {
    return false;
  }

  const mimeType = MIME_TYPES[ext] || 'application/octet-stream';
  res.writeHead(200, { 'Content-Type': mimeType });
  fs.createReadStream(fullPath).pipe(res);
  return true;
}

/**
 * Create and start the SWARM web server
 *
 * @param {Object} options - Server options
 * @param {number} [options.port=1337] - Port to listen on
 * @param {Function} [options.onMetricsUpdate] - Callback when metrics should be published
 * @returns {Promise<{server: http.Server, ape: Object}>} Server and api-ape instance
 */
export async function createServer(options = {}) {
  const { port = 1337, onMetricsUpdate: _onMetricsUpdate } = options;

  const server = http.createServer((req, res) => {
    // Try to serve static file
    if (!serveStatic(req, res)) {
      // 404 for unknown paths (api-ape handles /api/* via WebSocket)
      res.writeHead(404);
      res.end('Not Found');
    }
  });

  // Initialize api-ape with the API directory
  ape(server, {
    where: 'src/server/api',
    onConnect: (socket, req, send) => {
      scribbles.log('Client connected to SWARM dashboard');

      // Send initial state
      send('init', {
        version: '1.0.0',
        status: 'ready',
      });

      return {
        onDisconnect: () => {
          scribbles.log('Client disconnected from SWARM dashboard');
        },
      };
    },
  });

  // Start listening
  return new Promise((resolve) => {
    server.listen(port, () => {
      scribbles.log(`SWARM dashboard running at http://localhost:${port}`);
      resolve({ server, ape });
    });
  });
}

export { ape };
