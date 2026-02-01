#!/usr/bin/env bash
# .hooks/config.sh - Project-specific configuration
# Customize these values for your project

# === Language Mode ===
# Options: "python", "jsts", "generic"
# This affects which file extensions are checked by default
HOOK_LANGUAGE="jsts"

# === Exclusions ===
# Directories to exclude from all checks (pipe-separated regex pattern)
EXCLUDED_DIRS="node_modules|coverage|.next|.git|.hooks|.github|__pycache__|.venv|venv|dist|build|.pytest_cache|.mypy_cache"

# === File Patterns ===
# Source file extensions to check (regex pattern)
# Python:  "\.py$"
# JS/TS:   "\.(js|ts|jsx|tsx)$"
# Generic: "\.(js|ts|jsx|tsx|py)$"
SOURCE_FILE_PATTERN="\.(js|ts|jsx|tsx)$"

# === Line Count Limits ===
# Maximum lines per source file (excluding comments)
MAX_LINES=260

# === Documentation Requirements ===
# Set to "false" to disable documentation checks
REQUIRE_README=true
REQUIRE_FILES_MD=true

# === Commit Message Settings ===
# Maximum length for the first line of commit messages
COMMIT_MSG_MAX_LENGTH=80

# Allowed commit types (pipe-separated)
# Conventional Commits types + "bug" for bug reports
COMMIT_TYPES="bug|fix|feat|docs|style|refactor|perf|test|build|ci|chore"
