#!/usr/bin/env bash
# .hooks/pre-commit.d/utils.sh - Shared utilities for pre-commit hooks
# Source this file in hook scripts: source "$(dirname "$0")/utils.sh"

# === Color definitions ===
RED='\033[0;31m'
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
BLUE='\033[0;34m'
NC='\033[0m' # No Color

# === Resolve script directory ===
# Works whether called from .git/hooks/ or .hooks/
resolve_hooks_dir() {
    local script_path="$1"
    local dir=$(dirname "$script_path")

    # If we're in .git/hooks, look for .hooks in repo root
    if [[ "$dir" == *".git/hooks"* ]]; then
        local repo_root=$(git rev-parse --show-toplevel 2>/dev/null)
        echo "$repo_root/.hooks"
    else
        # Already in .hooks or pre-commit.d
        if [[ "$dir" == *"pre-commit.d"* ]]; then
            echo "$(dirname "$dir")"
        else
            echo "$dir"
        fi
    fi
}

# === Load configuration ===
load_config() {
    local hooks_dir="$1"
    local config_file="$hooks_dir/config.sh"

    # Set defaults
    EXCLUDED_DIRS="${EXCLUDED_DIRS:-node_modules|coverage|.next|.git|.hooks|.github|__pycache__|.venv|venv|dist|build}"
    SOURCE_FILE_PATTERN="${SOURCE_FILE_PATTERN:-\\.(js|ts|jsx|tsx|py)$}"
    MAX_LINES="${MAX_LINES:-260}"
    REQUIRE_README="${REQUIRE_README:-true}"
    REQUIRE_FILES_MD="${REQUIRE_FILES_MD:-true}"
    COMMIT_MSG_MAX_LENGTH="${COMMIT_MSG_MAX_LENGTH:-80}"
    COMMIT_TYPES="${COMMIT_TYPES:-bug|fix|feat|docs|style|refactor|perf|test|build|ci|chore}"

    # Load project config if exists
    if [ -f "$config_file" ]; then
        source "$config_file"
    fi
}

# === Output formatting ===
print_header() {
    local title="$1"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
    echo -e "  ${title}"
    echo -e "${BLUE}━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━${NC}"
}

print_success() {
    echo -e "${GREEN}✓${NC} $1"
}

print_error() {
    echo -e "${RED}✗${NC} $1"
}

print_warning() {
    echo -e "${YELLOW}!${NC} $1"
}

print_check_result() {
    local check_name="$1"
    local status="$2"  # 0=pass, 1=fail, 2=skip

    case $status in
        0) echo -e "  [${GREEN}PASS${NC}] $check_name" ;;
        1) echo -e "  [${RED}FAIL${NC}] $check_name" ;;
        2) echo -e "  [${YELLOW}SKIP${NC}] $check_name" ;;
    esac
}

# === Path utilities ===
is_excluded() {
    local path="$1"
    echo "$path" | grep -qE "($EXCLUDED_DIRS)" && return 0
    return 1
}

get_repo_root() {
    git rev-parse --show-toplevel 2>/dev/null
}

# === Array utilities ===
array_contains() {
    local needle="$1"
    shift
    for item in "$@"; do
        [ "$item" = "$needle" ] && return 0
    done
    return 1
}

# === Git utilities ===
get_staged_files() {
    local filter="${1:-AM}"  # Default: Added or Modified
    git diff --cached --name-only --diff-filter="$filter" 2>/dev/null || true
}

get_staged_files_by_ext() {
    local ext_pattern="$1"  # e.g., "\.py$" or "\.(js|ts)$"
    get_staged_files | grep -E "$ext_pattern" || true
}

is_merge_commit() {
    git rev-parse -q --verify MERGE_HEAD >/dev/null 2>&1
}

# === File utilities ===
get_filename() {
    basename "$1"
}

get_parent_dir() {
    dirname "$1"
}

file_exists_staged_or_disk() {
    local file="$1"
    local staged_files="$2"

    echo "$staged_files" | grep -qx "$file" && return 0
    [ -f "$file" ] && return 0
    return 1
}
