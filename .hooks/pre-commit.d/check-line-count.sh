#!/usr/bin/env bash
#
# File size limit check
#
# Enforces maximum lines per source file (excluding comments).
# Default: 260 lines (configurable in config.sh)
#
# Exit codes:
#   0 = pass
#   1 = fail
#   2 = skip (no matching files)

# === Setup ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/utils.sh"
load_config "$HOOKS_DIR"

# === Configuration ===
MAX="${MAX_LINES:-260}"
PATTERN="${SOURCE_FILE_PATTERN:-\\.(js|ts|jsx|tsx|py)$}"

# === State ===
ERROR=0
FAILED_FILES=()

# === Line counting ===
# Counts lines excluding block comments
count_effective_lines() {
    local file="$1"
    local ext="${file##*.}"

    case "$ext" in
        js|ts|jsx|tsx)
            # Remove /* */ and /** */ block comments
            perl -0777 -ne 's|/\*.*?\*/||gs; print' "$file" 2>/dev/null | grep -c '' || echo 0
            ;;
        py)
            # Remove triple-quote docstrings (both """ and ''')
            perl -0777 -ne 's|""".*?"""|""|gs; s|'"'"''"'"''"'"'.*?'"'"''"'"''"'"'|""|gs; print' "$file" 2>/dev/null | grep -c '' || echo 0
            ;;
        sh|bash)
            # Remove lines starting with # (comments)
            grep -v '^\s*#' "$file" 2>/dev/null | grep -c '' || echo 0
            ;;
        *)
            # Default: count all lines
            wc -l < "$file" 2>/dev/null | tr -d ' ' || echo 0
            ;;
    esac
}

# === Check staged files ===
MATCHING_FILES=$(get_staged_files | grep -E "$PATTERN" || true)

if [ -z "$MATCHING_FILES" ]; then
    exit 2
fi

while IFS= read -r file; do
    [ -f "$file" ] || continue
    is_excluded "$file" && continue

    # Skip test files
    filename=$(get_filename "$file")
    [[ "$filename" == *.test.* || "$filename" == *_test.* || "$filename" == *_spec.* || "$filename" == test_* ]] && continue

    lines=$(count_effective_lines "$file")
    if [ "$lines" -gt "$MAX" ]; then
        FAILED_FILES+=("$file ($lines lines)")
        ERROR=1
    fi
done <<< "$MATCHING_FILES"

# === Output ===
if [ $ERROR -eq 1 ]; then
    echo ""
    print_error "Files exceeding $MAX source lines:"
    for failed in "${FAILED_FILES[@]}"; do
        echo "     $failed"
    done
    echo ""
    echo "  Consider splitting large files into smaller modules."
    echo ""
    exit 1
fi

exit 0
