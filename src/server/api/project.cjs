/**
 * @fileoverview Project API Endpoint
 *
 * Handles project folder browsing and validation.
 *
 * @module server/api/project
 */

const fs = require('node:fs');
const path = require('node:path');
const os = require('node:os');

/**
 * Project endpoint handler
 *
 * @param {Object} data - Request data
 * @param {string} data.action - Action to perform: 'browse' | 'validate' | 'analyze'
 * @param {string} [data.path] - Path for browse/validate
 * @returns {Promise<Object>} Response data
 */
module.exports = async function project(data) {
  const { action, path: requestPath } = data;

  switch (action) {
    case 'browse':
      return browseDirectory(requestPath || os.homedir());

    case 'validate':
      return validateProject(requestPath);

    case 'analyze':
      return analyzeProject(requestPath);

    default:
      return { error: `Unknown action: ${action}` };
  }
};

/**
 * Browse a directory and return its contents
 *
 * @param {string} dirPath - Directory path to browse
 * @returns {Object} Directory contents
 */
function browseDirectory(dirPath) {
  try {
    const resolvedPath = path.resolve(dirPath);

    if (!fs.existsSync(resolvedPath)) {
      return { error: 'Path does not exist', path: resolvedPath };
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return { error: 'Path is not a directory', path: resolvedPath };
    }

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

    const items = entries
      .filter((entry) => {
        // Filter out hidden files and common non-project directories
        if (entry.name.startsWith('.')) return false;
        if (entry.name === 'node_modules') return false;
        return true;
      })
      .map((entry) => ({
        name: entry.name,
        path: path.join(resolvedPath, entry.name),
        isDirectory: entry.isDirectory(),
      }))
      .sort((a, b) => {
        // Directories first, then alphabetically
        if (a.isDirectory && !b.isDirectory) return -1;
        if (!a.isDirectory && b.isDirectory) return 1;
        return a.name.localeCompare(b.name);
      });

    // Add parent directory option
    const parentPath = path.dirname(resolvedPath);
    if (parentPath !== resolvedPath) {
      items.unshift({
        name: '..',
        path: parentPath,
        isDirectory: true,
      });
    }

    return {
      path: resolvedPath,
      items,
    };
  } catch (err) {
    return { error: err.message, path: dirPath };
  }
}

/**
 * Validate if a path is a valid Node.js project
 *
 * @param {string} projectPath - Path to validate
 * @returns {Object} Validation result
 */
function validateProject(projectPath) {
  try {
    const resolvedPath = path.resolve(projectPath);

    if (!fs.existsSync(resolvedPath)) {
      return { valid: false, reason: 'Path does not exist' };
    }

    const stat = fs.statSync(resolvedPath);
    if (!stat.isDirectory()) {
      return { valid: false, reason: 'Path is not a directory' };
    }

    // Check for package.json
    const packageJsonPath = path.join(resolvedPath, 'package.json');
    if (!fs.existsSync(packageJsonPath)) {
      return { valid: false, reason: 'No package.json found' };
    }

    // Read package.json
    const packageJson = JSON.parse(fs.readFileSync(packageJsonPath, 'utf-8'));

    // Determine project type
    let type = 'Node.js';
    if (packageJson.dependencies?.react || packageJson.devDependencies?.react) {
      type = 'React';
    } else if (packageJson.dependencies?.next || packageJson.devDependencies?.next) {
      type = 'Next.js';
    } else if (packageJson.dependencies?.express || packageJson.devDependencies?.express) {
      type = 'Express';
    } else if (packageJson.dependencies?.vue || packageJson.devDependencies?.vue) {
      type = 'Vue';
    }

    return {
      valid: true,
      path: resolvedPath,
      name: packageJson.name || path.basename(resolvedPath),
      type,
      description: packageJson.description || null,
      version: packageJson.version || null,
    };
  } catch (err) {
    return { valid: false, reason: err.message };
  }
}

/**
 * Analyze project structure
 *
 * @param {string} projectPath - Path to analyze
 * @returns {Object} Project analysis
 */
function analyzeProject(projectPath) {
  try {
    const resolvedPath = path.resolve(projectPath);

    // Get basic validation first
    const validation = validateProject(projectPath);
    if (!validation.valid) {
      return validation;
    }

    // Count files and directories
    const structure = {
      directories: [],
      fileCount: 0,
      hasTests: false,
      hasSrc: false,
      hasGit: false,
    };

    const entries = fs.readdirSync(resolvedPath, { withFileTypes: true });

    for (const entry of entries) {
      if (entry.name.startsWith('.')) {
        if (entry.name === '.git') structure.hasGit = true;
        continue;
      }
      if (entry.name === 'node_modules') continue;

      if (entry.isDirectory()) {
        structure.directories.push(entry.name);
        if (entry.name === 'test' || entry.name === 'tests' || entry.name === '__tests__') {
          structure.hasTests = true;
        }
        if (entry.name === 'src') {
          structure.hasSrc = true;
        }
      } else {
        structure.fileCount++;
      }
    }

    return {
      ...validation,
      structure,
    };
  } catch (err) {
    return { error: err.message };
  }
}
