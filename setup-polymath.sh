#!/usr/bin/env bash
# Install the bundled cc-polymath library into a project, without network access.
set -euo pipefail
SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
TARGET_DIR="${1:-.}"
command -v bun >/dev/null 2>&1 || { echo 'Bun is required.' >&2; exit 1; }
[ -d "$TARGET_DIR" ] || { echo "Directory not found: $TARGET_DIR" >&2; exit 1; }
bun "$SCRIPT_DIR/scripts/setup-polymath.mjs" "$SCRIPT_DIR/skills/cc-polymath" "$TARGET_DIR"
