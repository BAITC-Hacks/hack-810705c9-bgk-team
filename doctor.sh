#!/usr/bin/env bash
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if ! command -v bun >/dev/null 2>&1 && [ -x "$HOME/.bun/bin/bun" ]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi
failed=0
for tool in git node bun docker; do
  if command -v "$tool" >/dev/null 2>&1; then printf 'OK: %s\n' "$tool";
  else printf 'MISSING: %s (see QUICKSTART.md)\n' "$tool"; failed=1; fi
done
if command -v bun >/dev/null 2>&1 && [ -f .bun-version ]; then
  wanted="$(cat .bun-version)"
  actual="$(bun --version)"
  if [ "$wanted" != "$actual" ]; then
    printf 'Bun version mismatch: need %s, found %s. Install the version from .bun-version.\n' "$wanted" "$actual"
    failed=1
  fi
fi
if command -v node >/dev/null 2>&1; then
  node -e 'if (Number(process.versions.node.split(".")[0]) < 24) process.exit(1)' || { echo 'Node.js >=24 is required.'; failed=1; }
fi
if command -v docker >/dev/null 2>&1; then
  docker compose version >/dev/null 2>&1 || { echo 'MISSING: Docker Compose v2'; failed=1; }
  docker info >/dev/null 2>&1 || { echo 'Docker is stopped: start Docker Desktop / Docker Engine.'; failed=1; }
fi
for file in bun.lock .env.example scripts/dev.sh .agents/skills/hackathon-guide/SKILL.md .claude/skills/hackathon-guide/SKILL.md; do
  [ -f "$file" ] || { printf 'Missing project file: %s\n' "$file"; failed=1; }
done
exit "$failed"
