#!/usr/bin/env bash
# One-shot dev bootstrap: infra → DB → deps → migrations → bun run dev
# Ctrl+C останавливает dev-серверы как обычно, после чего EXIT trap гасит инфраструктуру
# (KEEP_INFRA=1 — оставить контейнеры запущенными).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.dev.yml)
PGUSER="${POSTGRES_USER:-postgres}"
PGPASSWORD="${POSTGRES_PASSWORD:-postgres}"
DB_NAME_NEXTJS="${DB_NAME_NEXTJS:-nextjs_db}"
DB_NAME_MASTRA="${DB_NAME_MASTRA:-mastra_db}"
WAIT_SECS="${PG_WAIT_SECS:-60}"

INFRA_STARTED=0
SHUTTING_DOWN=0

log() { printf '\n==> %s\n' "$*"; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "not found: $1"
}

wait_postgres() {
  log "Waiting for Postgres (up to ${WAIT_SECS}s)..."
  local i
  for i in $(seq 1 "$WAIT_SECS"); do
    if "${COMPOSE[@]}" exec -T postgres pg_isready -U "$PGUSER" >/dev/null 2>&1; then
      echo "Postgres is ready."
      return 0
    fi
    sleep 1
  done
  die "Postgres did not become ready in ${WAIT_SECS}s"
}

psql_as() {
  "${COMPOSE[@]}" exec -T -e PGPASSWORD="$PGPASSWORD" postgres \
    psql -U "$PGUSER" -v ON_ERROR_STOP=1 "$@"
}

ensure_db() {
  local name="$1"
  local exists
  exists="$(psql_as -tAc "SELECT 1 FROM pg_database WHERE datname = '${name}'" || true)"
  if [[ "$exists" != "1" ]]; then
    echo "Creating database ${name}..."
    psql_as -c "CREATE DATABASE \"${name}\";"
  else
    echo "Database ${name} already exists."
  fi
  psql_as -d "$name" -c "CREATE EXTENSION IF NOT EXISTS vector;"
}

ensure_env_file() {
  local dir="$1"
  if [[ ! -f "$dir/.env" && -f "$dir/.env.example" ]]; then
    cp "$dir/.env.example" "$dir/.env"
    echo "Created $dir/.env from .env.example"
  fi
}

sync_schema() {
  # На старте применяем готовые миграции; генерацию выполняет автор схемы.
  # Так чистый clone не создаёт новую SQL-историю у каждого участника.
  local app_dir="$1"
  log "Database schema: apply committed migrations (Drizzle)"
  (
    cd "$app_dir"
    bun run db:migrate
  )
}

# Гасит инфраструктуру. Идемпотентно; учитывает KEEP_INFRA=1.
stop_infra() {
  if [ "$INFRA_STARTED" != "1" ]; then
    return
  fi
  if [ "${KEEP_INFRA:-0}" = "1" ]; then
    echo "KEEP_INFRA=1 — infra left running (Postgres + RustFS)."
    echo "Stop it later with: docker compose -f docker-compose.dev.yml stop"
    return
  fi
  log "Stopping dev infrastructure (Postgres + RustFS)"
  "${COMPOSE[@]}" stop || true
}

# Уборка, пока скрипт ещё жив: провал bootstrap или Ctrl+C до старта dev-серверов.
cleanup() {
  local rc=$?
  if [ "$SHUTTING_DOWN" = "1" ]; then
    return
  fi
  SHUTTING_DOWN=1
  trap - EXIT INT TERM HUP
  stop_infra
  exit "$rc"
}

trap cleanup EXIT INT TERM HUP

log "Checking prerequisites"
require_cmd docker
require_cmd bun
docker compose version >/dev/null 2>&1 || die "Docker Compose v2 is required"
docker info >/dev/null 2>&1 || die "Docker daemon is not running"

log "Starting dev infrastructure (Postgres + RustFS)"
"${COMPOSE[@]}" up -d
INFRA_STARTED=1

wait_postgres

log "Ensuring databases and pgvector"
ensure_db "$DB_NAME_NEXTJS"
ensure_db "$DB_NAME_MASTRA"
echo "Databases ready (dev)."

log "Installing workspace dependencies from the committed lockfile"
bun install --frozen-lockfile

log "Ensuring app .env files"
ensure_env_file "apps/presentation-layer"
ensure_env_file "apps/ai-logic-layer"
ensure_env_file "apps/workers"

log "Database schema"
sync_schema "apps/presentation-layer"

if [[ "${SEED_DEMO_DATA:-1}" == "1" ]]; then
  log "Seeding demo workspace (existing records are preserved)"
  (cd apps/presentation-layer && bun run db:seed)
fi

log "Starting dev servers (Next :3000, Mastra :4111, workers)"
echo "Ctrl+C stops the dev servers; the Docker infra is stopped right after."
echo "Leave infra running after exit: KEEP_INFRA=1 ./scripts/dev.sh"

# Keep the shell alive so EXIT reliably stops this project's infrastructure.
bun run dev
