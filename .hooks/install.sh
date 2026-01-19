#!/usr/bin/env bash
#
# Install git hooks
#
# Usage: ./.hooks/install.sh
#
# Creates symlinks from .git/hooks/ to .hooks/ so that:
#   - Hooks are version controlled with the repo
#   - Updates to hooks propagate automatically
#   - Works identically for all team members

set -e

# === Resolve paths ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
REPO_ROOT=$(git rev-parse --show-toplevel 2>/dev/null)

if [ -z "$REPO_ROOT" ]; then
    echo "Error: Not in a git repository"
    exit 1
fi

GIT_HOOKS_DIR="$REPO_ROOT/.git/hooks"

echo ""
echo "Installing git hooks..."
echo ""

# === Install hooks ===
for hook in pre-commit commit-msg; do
    source="$SCRIPT_DIR/$hook"
    target="$GIT_HOOKS_DIR/$hook"

    if [ -f "$source" ]; then
        # Remove existing hook (file or symlink)
        [ -e "$target" ] || [ -L "$target" ] && rm -f "$target"

        # Create symlink (preferred) or copy if symlinks don't work
        if ln -s "$source" "$target" 2>/dev/null; then
            echo "  Linked: $hook -> .hooks/$hook"
        else
            cp "$source" "$target"
            chmod +x "$target"
            echo "  Copied: $hook"
        fi
    else
        echo "  Warning: $hook not found in .hooks/"
    fi
done

echo ""
echo "Git hooks installed!"
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "  Enabled checks:"
for check in "$SCRIPT_DIR"/pre-commit.d/check-*.sh; do
    [ -f "$check" ] || continue
    [[ "$check" == *.disabled ]] && continue
    name=$(basename "$check" .sh | sed 's/^check-//')
    echo "    - $name"
done
echo ""
echo "  Disabled checks (rename to enable):"
for check in "$SCRIPT_DIR"/pre-commit.d/check-*.sh.disabled; do
    [ -f "$check" ] || continue
    name=$(basename "$check" .sh.disabled | sed 's/^check-//')
    echo "    - $name"
done
echo ""
echo "━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━"
echo ""
echo "To enable a check:"
echo "  mv .hooks/pre-commit.d/check-<name>.sh.disabled \\"
echo "     .hooks/pre-commit.d/check-<name>.sh"
echo ""
echo "To test hooks manually:"
echo "  ./.hooks/pre-commit"
echo ""
