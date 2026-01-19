#!/usr/bin/env bash
#
# Documentation validation check
#
# Ensures:
#   1. Every new directory has README.md and files.md
#   2. Every committed file has entries in parent's files.md
#
# Exit codes:
#   0 = pass
#   1 = fail
#   2 = skip (no staged files)

# === Setup ===
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
HOOKS_DIR="$(dirname "$SCRIPT_DIR")"
source "$SCRIPT_DIR/utils.sh"
load_config "$HOOKS_DIR"

# === Skip if disabled ===
if [ "$REQUIRE_README" = "false" ] && [ "$REQUIRE_FILES_MD" = "false" ]; then
    exit 2
fi

# === State ===
ERROR=0
MISSING_README=()
MISSING_FILES_MD=()
MISSING_DOCS=()

# === Get staged files ===
STAGED_FILES=$(get_staged_files)
if [ -z "$STAGED_FILES" ]; then
    exit 2
fi

# === Find new directories ===
NEW_DIRS=()
for file in $STAGED_FILES; do
    is_excluded "$file" && continue

    dir=$(get_parent_dir "$file")
    while [ "$dir" != "." ] && [ "$dir" != "/" ]; do
        # Check if directory is new (not in HEAD)
        if ! git ls-tree -d HEAD "$dir" >/dev/null 2>&1; then
            array_contains "$dir" "${NEW_DIRS[@]}" || NEW_DIRS+=("$dir")
        fi
        dir=$(get_parent_dir "$dir")
    done
done

# === Check new directories for README.md and files.md ===
for dir in "${NEW_DIRS[@]}"; do
    is_excluded "$dir" && continue

    if [ "$REQUIRE_README" = "true" ]; then
        if ! file_exists_staged_or_disk "$dir/README.md" "$STAGED_FILES"; then
            MISSING_README+=("$dir")
            ERROR=1
        fi
    fi

    if [ "$REQUIRE_FILES_MD" = "true" ]; then
        if ! file_exists_staged_or_disk "$dir/files.md" "$STAGED_FILES"; then
            MISSING_FILES_MD+=("$dir")
            ERROR=1
        fi
    fi
done

# === Check file documentation in files.md ===
check_file_documented() {
    local file="$1"
    local files_md="$2"
    local filename=$(get_filename "$file")

    [ ! -f "$files_md" ] && return 1

    # Check for entry in Directory Structure section (tree diagram)
    local in_structure=false
    if grep -qE "(├──|└──|│)?\s*${filename}(\s|$|\`)" "$files_md" 2>/dev/null; then
        in_structure=true
    fi

    # Check for entry in Files section as ### `filename` or ### filename
    local in_files=false
    if grep -qE "^###\s+\`?${filename}\`?" "$files_md" 2>/dev/null; then
        in_files=true
    fi

    # For directories, also accept directory patterns
    if [ -d "$file" ]; then
        if grep -qE "^###\s+\`?${filename}/?\`?" "$files_md" 2>/dev/null; then
            in_files=true
        fi
    fi

    $in_structure && $in_files && return 0
    return 1
}

for file in $STAGED_FILES; do
    is_excluded "$file" && continue

    filename=$(get_filename "$file")

    # Skip documentation files themselves
    [[ "$filename" == "README.md" || "$filename" == "files.md" ]] && continue

    # Skip test files
    [[ "$filename" == *.test.* || "$filename" == *_test.* || "$filename" == *_spec.* ]] && continue

    # Skip root-level files
    parent_dir=$(get_parent_dir "$file")
    [ "$parent_dir" = "." ] && continue

    # Check documentation
    files_md="$parent_dir/files.md"

    if [ "$REQUIRE_FILES_MD" = "true" ]; then
        if file_exists_staged_or_disk "$files_md" "$STAGED_FILES"; then
            if ! check_file_documented "$file" "$files_md"; then
                MISSING_DOCS+=("$file")
                ERROR=1
            fi
        fi
    fi
done

# === Output ===
if [ $ERROR -eq 1 ]; then
    echo ""

    if [ ${#MISSING_README[@]} -gt 0 ]; then
        print_error "New directories missing README.md:"
        for dir in "${MISSING_README[@]}"; do
            echo "     $dir/README.md"
        done
        echo ""
    fi

    if [ ${#MISSING_FILES_MD[@]} -gt 0 ]; then
        print_error "New directories missing files.md:"
        for dir in "${MISSING_FILES_MD[@]}"; do
            echo "     $dir/files.md"
        done
        echo ""
    fi

    if [ ${#MISSING_DOCS[@]} -gt 0 ]; then
        print_error "Files not documented in files.md:"
        for doc in "${MISSING_DOCS[@]}"; do
            echo "     $doc"
        done
        echo ""
        echo "  Each file needs:"
        echo "    1. Entry in '## Directory Structure' (tree diagram)"
        echo "    2. Entry in '## Files' as '### \`filename\`'"
        echo ""
    fi

    exit 1
fi

exit 0
