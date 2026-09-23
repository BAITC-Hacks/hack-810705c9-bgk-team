#!/usr/bin/env bash
# One-shot prod bootstrap: .env check → infra → DB → migrations → build & start → status
# Порядок важен: миграции применяются ДО старта приложений, а «поднялось ли»
# проверяется по статусам контейнеров (сборка идёт в Docker, см. apps/*/Dockerfile).
set -euo pipefail

ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
cd "$ROOT"

COMPOSE=(docker compose -f docker-compose.prod.yml)
ENV_FILE=".env"
INFRA_SERVICES=(postgres rustfs)
APP_SERVICES=(presentation-layer ai-logic-layer workers)
MIGRATIONS_DIR="apps/presentation-layer/src/shared/db/migrations"
UP_WAIT_TIMEOUT="${UP_WAIT_TIMEOUT:-180}"

log() { printf '\n==> %s\n' "$*"; }
warn() { printf 'WARNING: %s\n' "$*" >&2; }
die() { printf 'ERROR: %s\n' "$*" >&2; exit 1; }

require_cmd() {
  command -v "$1" >/dev/null 2>&1 || die "not found: $1"
}

load_env() {
  [[ -f "$ENV_FILE" ]] || die "missing ${ENV_FILE} in repo root. Create it, e.g.:
POSTGRES_USER=postgres
POSTGRES_PASSWORD=<secure-password>
DB_NAME_NEXTJS=nextjs_db
DB_NAME_MASTRA=mastra_db
RUSTFS_ACCESS_KEY=<key>
RUSTFS_SECRET_KEY=<secret>
OPENAI_API_KEY=<key>"

  set -a
  # shellcheck disable=SC1090
  source "$ENV_FILE"
  set +a

  local required=(POSTGRES_USER POSTGRES_PASSWORD DB_NAME_NEXTJS DB_NAME_MASTRA RUSTFS_ACCESS_KEY RUSTFS_SECRET_KEY OPENAI_API_KEY)
  local missing=()
  local v
  for v in "${required[@]}"; do
    if [[ -z "${!v:-}" ]]; then
      missing+=("$v")
    fi
  done
  if ((${#missing[@]})); then
    die "missing in ${ENV_FILE}: ${missing[*]}"
  fi

  if [[ "$POSTGRES_PASSWORD" == "postgres" || "$RUSTFS_ACCESS_KEY" == "rustfsadmin" || "$RUSTFS_SECRET_KEY" == "rustfsadmin" ]]; then
    warn "${ENV_FILE} still uses default credentials (postgres / rustfsadmin) — set real secrets before exposing this stack"
  fi
}

verify_running() {
  log "Verifying containers"
  local svc cid state
  for svc in "$@"; do
    cid="$("${COMPOSE[@]}" ps -aq "$svc")"
    [[ -n "$cid" ]] || die "service ${svc} was not created"
    state="$(docker inspect --format '{{.State.Status}}' "$cid")"
    [[ "$state" == "running" ]] || die "service ${svc} is ${state} — check logs: docker compose -f docker-compose.prod.yml logs ${svc}"
    echo "  ✓ ${svc} (running)"
  done
}

psql_as() {
  "${COMPOSE[@]}" exec -T -e PGPASSWORD="${POSTGRES_PASSWORD}" postgres \
    psql -U "${POSTGRES_USER}" -v ON_ERROR_STOP=1 "$@"
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

run_migrations() {
  # Codebase-first: прод НИКОГДА не генерирует и не «пушит» схему — только
  # применяет уже закоммиченные SQL-миграции. `db:deploy` = check (согласованность
  # файлов/journal) + migrate (применить непримененные). Идёт в образе `migrator`
  # внутри compose-сети; хостовый репозиторий не монтируется.
  if ! compgen -G "${MIGRATIONS_DIR}/*.sql" >/dev/null 2>&1; then
    die "no migration SQL in ${MIGRATIONS_DIR}. Generate and commit them first: cd apps/presentation-layer && bun run db:generate"
  fi
  log "Applying Drizzle migrations (db:deploy: check + migrate)"
  "${COMPOSE[@]}" --profile tools run --rm --build migrate
}

print_status() {
  log "Stack is up"
  cat <<'EOF'
  UI      http://localhost:3000
  Mastra  http://localhost:4111
  Logs    docker compose -f docker-compose.prod.yml logs -f
  Ps      docker compose -f docker-compose.prod.yml ps
  Stop    docker compose -f docker-compose.prod.yml down
  Migrate docker compose -f docker-compose.prod.yml --profile tools run --rm migrate
EOF
}

log "Checking prerequisites"
require_cmd docker
docker info >/dev/null 2>&1 || die "Docker daemon is not running"
load_env

log "Starting infrastructure (Postgres + RustFS)"
"${COMPOSE[@]}" up -d --wait --wait-timeout "${UP_WAIT_TIMEOUT}" "${INFRA_SERVICES[@]}"

log "Ensuring databases and pgvector"
ensure_db "${DB_NAME_NEXTJS}"
ensure_db "${DB_NAME_MASTRA}"
echo "Databases ready (prod)."

run_migrations

log "Building and starting application services"
"${COMPOSE[@]}" up -d --build --remove-orphans --wait --wait-timeout "${UP_WAIT_TIMEOUT}"

verify_running "${APP_SERVICES[@]}"

print_status
