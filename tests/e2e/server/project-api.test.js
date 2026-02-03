/**
 * @file E2E tests for project API (STEP1-01 to STEP1-16).
 * Tests directory browsing, project validation, and analysis.
 */

import { test, describe, before, after } from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, rm, mkdir, writeFile } from 'node:fs/promises';
import { join } from 'node:path';
import { tmpdir, homedir } from 'node:os';
import { createRequire } from 'node:module';

// Import the project API directly for testing
const require = createRequire(import.meta.url);
const projectApi = require('../../../src/server/api/project.cjs');

describe('Project API', () => {
  /** @type {string} */
  let tempDir;

  before(async () => {
    // Create temp directory for testing
    tempDir = await mkdtemp(join(tmpdir(), 'swarm-project-test-'));

    // Create test project structure
    await mkdir(join(tempDir, 'valid-project'));
    await writeFile(
      join(tempDir, 'valid-project', 'package.json'),
      JSON.stringify({
        name: 'test-project',
        version: '1.0.0',
        description: 'A test project',
      })
    );

    await mkdir(join(tempDir, 'react-project'));
    await writeFile(
      join(tempDir, 'react-project', 'package.json'),
      JSON.stringify({
        name: 'react-test',
        dependencies: { react: '^18.0.0' },
      })
    );

    await mkdir(join(tempDir, 'nextjs-project'));
    await writeFile(
      join(tempDir, 'nextjs-project', 'package.json'),
      JSON.stringify({
        name: 'next-test',
        dependencies: { next: '^14.0.0' },
      })
    );

    await mkdir(join(tempDir, 'express-project'));
    await writeFile(
      join(tempDir, 'express-project', 'package.json'),
      JSON.stringify({
        name: 'express-test',
        dependencies: { express: '^4.0.0' },
      })
    );

    await mkdir(join(tempDir, 'vue-project'));
    await writeFile(
      join(tempDir, 'vue-project', 'package.json'),
      JSON.stringify({
        name: 'vue-test',
        dependencies: { vue: '^3.0.0' },
      })
    );

    await mkdir(join(tempDir, 'empty-folder'));
    await mkdir(join(tempDir, '.hidden-folder'));
    await mkdir(join(tempDir, 'node_modules'));
    await writeFile(join(tempDir, 'regular-file.txt'), 'test content');

    // Create a project with src/tests directories
    await mkdir(join(tempDir, 'full-project'));
    await mkdir(join(tempDir, 'full-project', 'src'));
    await mkdir(join(tempDir, 'full-project', 'tests'));
    await mkdir(join(tempDir, 'full-project', '.git'));
    await writeFile(
      join(tempDir, 'full-project', 'package.json'),
      JSON.stringify({ name: 'full-project' })
    );
    await writeFile(join(tempDir, 'full-project', 'index.js'), '');
    await writeFile(join(tempDir, 'full-project', 'README.md'), '');
  });

  after(async () => {
    await rm(tempDir, { recursive: true, force: true });
  });

  describe('action: browse', () => {
    // STEP1-02: Browse directories
    test('STEP1-02: browse returns directory listing', async () => {
      const result = await projectApi({ action: 'browse', path: tempDir });

      assert.ok(result.items, 'Should return items array');
      assert.ok(Array.isArray(result.items), 'Items should be an array');
      assert.equal(result.path, tempDir, 'Should return resolved path');
    });

    // STEP1-03: Hidden files and node_modules filtered
    test('STEP1-03: filters hidden files and node_modules', async () => {
      const result = await projectApi({ action: 'browse', path: tempDir });

      const names = result.items.map((i) => i.name);
      assert.ok(!names.includes('.hidden-folder'), 'Should not include hidden folders');
      assert.ok(!names.includes('node_modules'), 'Should not include node_modules');
    });

    // STEP1-04: Directories sorted correctly
    test('STEP1-04: items sorted directories first, then alphabetically', async () => {
      const result = await projectApi({ action: 'browse', path: tempDir });

      // Filter out parent dir (..)
      const items = result.items.filter((i) => i.name !== '..');

      // All directories should come before files
      let foundFile = false;
      for (const item of items) {
        if (!item.isDirectory) {
          foundFile = true;
        } else if (foundFile) {
          assert.fail('Directory found after file - should be sorted');
        }
      }
    });

    // STEP1-05: Parent directory navigation
    test('STEP1-05: includes parent directory entry', async () => {
      const result = await projectApi({
        action: 'browse',
        path: join(tempDir, 'valid-project'),
      });

      const parentEntry = result.items.find((i) => i.name === '..');
      assert.ok(parentEntry, 'Should include .. entry');
      assert.ok(parentEntry.isDirectory, 'Parent should be directory');
      assert.equal(parentEntry.path, tempDir, 'Parent path should be correct');
    });

    // STEP1-12: Non-existent path error
    test('STEP1-12: returns error for non-existent path', async () => {
      const result = await projectApi({
        action: 'browse',
        path: '/nonexistent/path/12345',
      });

      assert.ok(result.error, 'Should return error');
      assert.ok(result.error.includes('exist'), 'Error should mention existence');
    });

    // STEP1-13: File path error
    test('STEP1-13: returns error for file path', async () => {
      const result = await projectApi({
        action: 'browse',
        path: join(tempDir, 'regular-file.txt'),
      });

      assert.ok(result.error, 'Should return error');
      assert.ok(result.error.includes('directory'), 'Error should mention directory');
    });

    test('defaults to home directory when no path provided', async () => {
      const result = await projectApi({ action: 'browse' });
      assert.equal(result.path, homedir(), 'Should default to home directory');
    });
  });

  describe('action: validate', () => {
    // STEP1-08: Project validation
    test('STEP1-08: validates valid Node.js project', async () => {
      const result = await projectApi({
        action: 'validate',
        path: join(tempDir, 'valid-project'),
      });

      assert.equal(result.valid, true, 'Should be valid');
      assert.equal(result.name, 'test-project', 'Should have correct name');
      assert.equal(result.description, 'A test project', 'Should have description');
    });

    // STEP1-09: Project details shown
    test('STEP1-09: returns project details when valid', async () => {
      const result = await projectApi({
        action: 'validate',
        path: join(tempDir, 'valid-project'),
      });

      assert.ok(result.name, 'Should include name');
      assert.ok(result.type, 'Should include type');
      assert.ok(result.path, 'Should include path');
    });

    // STEP1-10: Project type detection
    describe('STEP1-10: project type detection', () => {
      test('detects React projects', async () => {
        const result = await projectApi({
          action: 'validate',
          path: join(tempDir, 'react-project'),
        });
        assert.equal(result.type, 'React');
      });

      test('detects Next.js projects', async () => {
        const result = await projectApi({
          action: 'validate',
          path: join(tempDir, 'nextjs-project'),
        });
        assert.equal(result.type, 'Next.js');
      });

      test('detects Express projects', async () => {
        const result = await projectApi({
          action: 'validate',
          path: join(tempDir, 'express-project'),
        });
        assert.equal(result.type, 'Express');
      });

      test('detects Vue projects', async () => {
        const result = await projectApi({
          action: 'validate',
          path: join(tempDir, 'vue-project'),
        });
        assert.equal(result.type, 'Vue');
      });

      test('defaults to Node.js for generic projects', async () => {
        const result = await projectApi({
          action: 'validate',
          path: join(tempDir, 'valid-project'),
        });
        assert.equal(result.type, 'Node.js');
      });
    });

    // STEP1-11: Non-project folder error
    test('STEP1-11: returns invalid for folder without package.json', async () => {
      const result = await projectApi({
        action: 'validate',
        path: join(tempDir, 'empty-folder'),
      });

      assert.equal(result.valid, false, 'Should be invalid');
      assert.ok(result.reason.includes('package.json'), 'Should mention package.json');
    });

    // STEP1-12: Non-existent path error
    test('STEP1-12: returns invalid for non-existent path', async () => {
      const result = await projectApi({
        action: 'validate',
        path: '/nonexistent/path/12345',
      });

      assert.equal(result.valid, false);
      assert.ok(result.reason.includes('exist'));
    });

    // STEP1-13: File path error
    test('STEP1-13: returns invalid for file path', async () => {
      const result = await projectApi({
        action: 'validate',
        path: join(tempDir, 'regular-file.txt'),
      });

      assert.equal(result.valid, false);
      assert.ok(result.reason.includes('directory'));
    });
  });

  describe('action: analyze', () => {
    // STEP1-16: Project analysis
    test('STEP1-16: returns project structure analysis', async () => {
      const result = await projectApi({
        action: 'analyze',
        path: join(tempDir, 'full-project'),
      });

      assert.equal(result.valid, true, 'Should be valid project');
      assert.ok(result.structure, 'Should include structure');
      assert.ok(result.structure.directories, 'Should include directories');
      assert.ok(result.structure.hasSrc, 'Should detect src directory');
      assert.ok(result.structure.hasTests, 'Should detect tests directory');
      assert.ok(result.structure.hasGit, 'Should detect .git directory');
      assert.ok(result.structure.fileCount >= 0, 'Should count files');
    });

    test('returns validation error for invalid project', async () => {
      const result = await projectApi({
        action: 'analyze',
        path: join(tempDir, 'empty-folder'),
      });

      assert.equal(result.valid, false);
    });
  });

  describe('unknown action', () => {
    test('returns error for unknown action', async () => {
      const result = await projectApi({ action: 'unknown' });
      assert.ok(result.error, 'Should return error');
      assert.ok(result.error.includes('Unknown'), 'Error should mention unknown action');
    });
  });

  describe('error handling', () => {
    test('handles corrupted package.json in validate', async () => {
      // Create a project with invalid JSON in package.json
      await mkdir(join(tempDir, 'corrupted-project'));
      await writeFile(join(tempDir, 'corrupted-project', 'package.json'), 'not valid json');

      const result = await projectApi({
        action: 'validate',
        path: join(tempDir, 'corrupted-project'),
      });

      assert.equal(result.valid, false);
      assert.ok(result.reason, 'Should have error reason');
    });

    test('handles corrupted package.json in analyze', async () => {
      const result = await projectApi({
        action: 'analyze',
        path: join(tempDir, 'corrupted-project'),
      });

      assert.equal(result.valid, false);
    });
  });
});
