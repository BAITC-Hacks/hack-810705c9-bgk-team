#!/usr/bin/env bash
# One command after clone. The generator is never run on teammates' machines.
set -euo pipefail
cd "$(dirname "${BASH_SOURCE[0]}")"
if ! command -v bun >/dev/null 2>&1 && [ -x "$HOME/.bun/bin/bun" ]; then
  export PATH="$HOME/.bun/bin:$PATH"
fi
./doctor.sh
if [ ! -f .env ]; then
  cp .env.example .env
  echo 'Created .env. Set OPENAI_API_KEY there for AI features; local UI/DB can start now.'
fi
exec bun --env-file=.env scripts/start.mjs
