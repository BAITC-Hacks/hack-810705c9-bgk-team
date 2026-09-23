#!/usr/bin/env bash
# install-skills.sh — устанавливает все Agent Skills в указанную папку.
# Каждый скилл ставится с ретраями, пока не установится успешно.
#
# Использование:
#   ./install-skills.sh [target-dir] [max-retries] [retry-delay-sec]
#
# Примеры:
#   ./install-skills.sh
#   ./install-skills.sh ./my-monorepo
#   ./install-skills.sh ./my-monorepo 5 3
#
# Переменные окружения:
#   SKILLS_EXTRA_ARGS — дополнительные аргументы CLI skills, например:
#                       SKILLS_EXTRA_ARGS="--agent claude-code" ./install-skills.sh .

set -uo pipefail

# ─── Параметры ────────────────────────────────────────────────────────────────
TARGET_DIR="${1:-.}"
MAX_RETRIES="${2:-10}"
RETRY_DELAY="${3:-2}"
SKILLS_DIR_NAME=".agents/skills"
LOCK_FILE="skills-lock.json"

# ─── Цвета ────────────────────────────────────────────────────────────────────
GREEN='\033[0;32m'
YELLOW='\033[1;33m'
RED='\033[0;31m'
BLUE='\033[0;34m'
NC='\033[0m'

# ─── Список скиллов ───────────────────────────────────────────────────────────
# Формат: "<репозиторий или пакет>|<имя скилла (--skill)>|<человекочитаемое имя>"
# Имя скилла указывается всегда: иначе CLI для репозитория с несколькими
# скиллами ставит лишние/спрашивает выбор, а проверка установки невозможна.
SKILLS=(
  "https://github.com/mastra-ai/skills|mastra|Mastra"
  "firecrawl/anydoc|convert-documents-to-markdown|Firecrawl anydoc"
  "https://github.com/vercel/next.js|next-dev-loop|Next.js dev-loop"
  "https://github.com/vercel/ai|ai-sdk|Vercel AI SDK"
  "https://github.com/vercel/ai-elements|ai-elements|Vercel AI Elements"
  "https://github.com/melonask/rustfs-skills|rustfs|RustFS"
  "https://github.com/shadcn-ui/ui|shadcn|shadcn/ui"
  "vercel/turborepo|turborepo|Turborepo"
  "https://github.com/huggingface/skills|transformers-js|Transformers.js"
  "https://github.com/feature-sliced/skills|feature-sliced-design|Feature-Sliced Design"
)

# ─── Проверки ─────────────────────────────────────────────────────────────────
if ! command -v bun >/dev/null 2>&1; then
  echo -e "${RED}❌ bun не найден в PATH. Установите Bun: https://bun.sh${NC}"
  exit 1
fi

if [ ! -d "$TARGET_DIR" ]; then
  echo -e "${RED}❌ Папка не найдена: ${TARGET_DIR}${NC}"
  exit 1
fi

TARGET_DIR="$(cd "$TARGET_DIR" && pwd)"
echo -e "${BLUE}📁 Целевая папка: ${TARGET_DIR}${NC}"
echo -e "${BLUE}🔁 Максимум попыток на скилл: ${MAX_RETRIES}, задержка: ${RETRY_DELAY}s${NC}"
echo ""

cd "$TARGET_DIR"

# ─── Проверка установки ───────────────────────────────────────────────────────
# Скилл считается установленным, если на месте его собственная папка с SKILL.md
# и в lock-файле есть запись. Проверка «есть хоть какая-то папка со скиллами»
# не годится: после первого успеха она маскирует провал всех последующих.
skill_in_lock() {
  local skill="$1"
  [ -f "$TARGET_DIR/$LOCK_FILE" ] || return 1
  grep -q "\"$skill\"[[:space:]]*:" "$TARGET_DIR/$LOCK_FILE"
}

skill_installed() {
  local skill="$1"
  [ -f "$TARGET_DIR/$SKILLS_DIR_NAME/$skill/SKILL.md" ] && skill_in_lock "$skill"
}

# ─── Установка одного скилла с ретраями ───────────────────────────────────────
install_skill() {
  local repo="$1"
  local skill="$2"
  local label="$3"

  local attempt=1
  local cmd_args=("skills" "add" "$repo" "--skill" "$skill" "-y")

  if [ -n "${SKILLS_EXTRA_ARGS:-}" ]; then
    # shellcheck disable=SC2206
    cmd_args+=(${SKILLS_EXTRA_ARGS})
  fi

  while [ "$attempt" -le "$MAX_RETRIES" ]; do
    echo -e "${YELLOW}▶ [${label}] попытка ${attempt}/${MAX_RETRIES}: bunx ${cmd_args[*]}${NC}"

    # bunx может вернуть 0 даже при частичной ошибке — поэтому проверяем
    # и exit code, и наличие артефакта конкретного скилла.
    if bunx "${cmd_args[@]}" 2>&1; then
      if skill_installed "$skill"; then
        echo -e "${GREEN}✅ [${label}] установлен → ${SKILLS_DIR_NAME}/${skill}${NC}"
        return 0
      fi
      if [ -f "$TARGET_DIR/$SKILLS_DIR_NAME/$skill/SKILL.md" ]; then
        echo -e "${YELLOW}⚠️  [${label}] файлы на месте, но нет записи в ${LOCK_FILE} — повторяем${NC}"
      else
        echo -e "${YELLOW}⚠️  [${label}] команда успешна, но ${SKILLS_DIR_NAME}/${skill} не найден — повторяем${NC}"
      fi
    else
      echo -e "${RED}❌ [${label}] ошибка на попытке ${attempt}${NC}"
    fi

    attempt=$((attempt + 1))
    if [ "$attempt" -le "$MAX_RETRIES" ]; then
      sleep "$RETRY_DELAY"
    fi
  done

  echo -e "${RED}💥 [${label}] не удалось установить после ${MAX_RETRIES} попыток${NC}"
  return 1
}

# ─── Основной цикл ────────────────────────────────────────────────────────────
FAILED=()
SUCCEEDED=()

for entry in "${SKILLS[@]}"; do
  IFS='|' read -r repo skill label <<< "$entry"

  if install_skill "$repo" "$skill" "$label"; then
    SUCCEEDED+=("$label")
  else
    FAILED+=("$label")
  fi

  # Всегда возвращаемся в целевую папку (некоторые скиллы меняют cwd)
  cd "$TARGET_DIR" || exit 1
  echo ""
done

# ─── Итог ─────────────────────────────────────────────────────────────────────
echo -e "${BLUE}════════════════════════════════════════════${NC}"
echo -e "${GREEN}✅ Установлено: ${#SUCCEEDED[@]}${NC}"
for s in "${SUCCEEDED[@]}"; do
  echo -e "   ${GREEN}•${NC} $s"
done

if [ "${#FAILED[@]}" -gt 0 ]; then
  echo ""
  echo -e "${RED}❌ Не установлено: ${#FAILED[@]}${NC}"
  for f in "${FAILED[@]}"; do
    echo -e "   ${RED}•${NC} $f"
  done
  exit 1
fi

echo -e "${GREEN}🎉 Все ${#SUCCEEDED[@]} скиллов установлены в ${TARGET_DIR}/${SKILLS_DIR_NAME}${NC}"
echo -e "${BLUE}   Lock-файл: ${TARGET_DIR}/${LOCK_FILE} (коммитим вместе со скиллами)${NC}"
echo -e "${BLUE}   Агентские папки (симлинки) — по обнаруженным агентам, см. .claude/skills и т.п.${NC}"
exit 0