#!/usr/bin/env bash
#
# Node.js checks
#
# Runs: Node.js built-in test runner, ESLint
#
# Exit codes:
#   0 = pass
#   1 = fail
#   2 = skip (no JS files)

# === Setup ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/utils.sh"
load_config "$HOOKS_DIR"

ERROR=0

# === Get JS files ===
JS_FILES=$(get_staged_files_by_ext "\.js$")
if [ -z "$JS_FILES" ]; then
    exit 2
fi

echo ""

# === Detect package manager ===
get_runner() {
    if [ -f "bun.lockb" ] && command -v bun &>/dev/null; then
        echo "bun"
    elif [ -f "pnpm-lock.yaml" ] && command -v pnpm &>/dev/null; then
        echo "pnpm"
    elif [ -f "yarn.lock" ] && command -v yarn &>/dev/null; then
        echo "yarn"
    elif command -v npm &>/dev/null; then
        echo "npm"
    else
        echo ""
    fi
}

RUNNER=$(get_runner)
if [ -z "$RUNNER" ]; then
    print_warning "No package manager found (npm/yarn/pnpm/bun)"
    exit 2
fi

# === Check: Node.js built-in test runner ===
if [ -f "package.json" ] && grep -q '"test"' package.json 2>/dev/null; then
    echo "  Running tests..."
    if $RUNNER test 2>/dev/null; then
        print_success "Tests passed"
    else
        print_error "Tests failed"
        ERROR=1
    fi
fi

# === Check: ESLint ===
HAS_ESLINT=false
if [ -f ".eslintrc.js" ] || [ -f ".eslintrc.json" ] || [ -f ".eslintrc.yml" ] || [ -f "eslint.config.js" ] || [ -f "eslint.config.mjs" ]; then
    HAS_ESLINT=true
elif [ -f "package.json" ] && grep -q '"eslint"' package.json 2>/dev/null; then
    HAS_ESLINT=true
fi

if $HAS_ESLINT; then
    echo "  Running ESLint..."
    if $RUNNER run lint 2>/dev/null; then
        print_success "ESLint passed"
    else
        print_error "ESLint failed"
        ERROR=1
    fi
fi

echo ""

exit $ERROR
