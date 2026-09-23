# Монорепозиторий: Presentation Layer + AI Logic Layer

**После клонирования: `./start.sh`.** Инструкция команды: [QUICKSTART.md](QUICKSTART.md).
Скиллы и правила агентов уже в Git; повторно устанавливать их не нужно.
Основной стек и границы модулей: [docs/ARCHITECTURE.md](docs/ARCHITECTURE.md).

Монорепозиторий на базе **Turborepo** и **Bun**, содержащий три приложения:

- `apps/presentation-layer` — **Next.js** приложение (UI, SSR, BFF) с **Drizzle ORM**, **shadcn/ui** и **PostgreSQL**.
- `apps/ai-logic-layer` — **Mastra AI server** (агенты, воркфлоу, RAG) с **PostgresStore**.
- `apps/workers` — воркеры **pg-boss** для фоновых задач с **Mastra Client SDK** и **AWS S3 Client**.

Инфраструктура: **PostgreSQL + pgvector** (две независимые БД: `nextjs_db` и `mastra_db`), **RustFS** (S3-совместимое хранилище).

---

## 📋 Требования

- **Bun** 1.4.2 и **Node.js** >=24
- **Docker** и **Docker Compose**
- **Bun** той версии, что записана в `.bun-version`; Turborepo уже входит в зависимости проекта.

---

## 🚀 Запуск в режиме разработки

Одна команда — поднимает инфраструктуру, создаёт БД и pgvector, ставит зависимости, применяет миграции и запускает все приложения:

    ./start.sh

Что делает скрипт:

1. Проверяет Docker и Bun  
2. `docker compose -f docker-compose.dev.yml up -d` — **PostgreSQL** (`5432`, `pgvector/pgvector:0.8.2-pg17`) и **RustFS** (`9000`/`9001`, `rustfs/rustfs:1.0.0`)  
3. Ждёт готовности Postgres  
4. Идемпотентно создаёт `nextjs_db` / `mastra_db` и включает `vector`  
5. `bun install --frozen-lockfile`  
6. Подставляет `.env` из `.env.example`, если их нет  
7. Применяет закоммиченные SQL-миграции Drizzle (`db:migrate`); генерацию выполняет автор изменения схемы  
8. Запускает `bun run dev`

Turborepo параллельно запустит:

- Next.js на `http://localhost:3000`
- Mastra на `http://localhost:4111`
- Воркер pg-boss

`Ctrl+C` останавливает dev-серверы, после чего EXIT trap гасит инфраструктуру (Postgres + RustFS). Оставить контейнеры запущенными после выхода: `KEEP_INFRA=1 ./scripts/dev.sh`. Остановить инфраструктуру вручную: `docker compose -f docker-compose.dev.yml stop`.

### Полезные команды

| Команда | Описание |
| :--- | :--- |
| `cd apps/presentation-layer && bun run db:generate` | Сгенерировать SQL-миграцию из `schema.ts` (коммитим SQL и `meta/`) |
| `cd apps/presentation-layer && bun run db:migrate` | Применить неприменённые миграции (dev) |
| `cd apps/presentation-layer && bun run db:deploy` | `drizzle-kit check` + `migrate` — безопасный деплой миграций (так делает `prod.sh`) |
| `cd apps/presentation-layer && bun run db:studio` | Drizzle Studio |
| `cd apps/ai-logic-layer && bun run dev` | Mastra отдельно |
| `cd apps/workers && bun run dev` | Воркер отдельно |
| `bun run lint` | ESLint по всем приложениям (turbo) |
| `bun run check-types` | Проверка типов по всем приложениям (turbo) |

---

## 🏭 Сборка и запуск в продакшене

### 1. Создать `.env` в корне (если ещё нет)

    cp .env.example .env
    # затем заполните OPENAI_API_KEY и при необходимости пароли/ключи

### 2. Одна команда

    ./scripts/prod.sh

Скрипт проверяет `.env` (и предупреждает, если остались дефолтные креды), поднимает инфраструктуру и ждёт healthcheck'и (`up -d --wait postgres rustfs`), создаёт БД и `vector`, применяет миграции Drizzle **внутри compose-сети** (одноразовый сервис `migrate`, профиль `tools`), затем собирает и стартует приложения (`up -d --build --remove-orphans --wait`) и проверяет, что все контейнеры действительно `running`.

Полезно знать:

- Схема применяется **до** старта приложений, поэтому приложение никогда не стартует на «пустой» базе.
- Прод применяет **только закоммиченные SQL-миграции** (`db:deploy` = `drizzle-kit check` + `drizzle-kit migrate`). Если в `apps/presentation-layer/src/shared/db/migrations` нет `.sql`-файлов, скрипт останавливается с подсказкой (`cd apps/presentation-layer && bun run db:generate`). Никакого `db:push` в проде нет.
- Автор изменения схемы отдельно выполняет `bun run db:generate` в `apps/presentation-layer`, затем коммитит SQL и meta/. При обычном запуске команды и в проде выполняется только применение миграций.
- Коммитим не только `*.sql`, но и `apps/presentation-layer/src/shared/db/migrations/meta/` (`_journal.json` + snapshot): без них `drizzle-kit check`/`migrate` не соберут историю миграций из чистого клона.
- Сборка образов идёт в Docker (`apps/*/Dockerfile`: `turbo prune` → `bun install --frozen-lockfile` → `turbo run build --filter=<app>`), в хостовый репозиторий ничего не пишется.
- Миграции можно применить отдельно: `docker compose -f docker-compose.prod.yml --profile tools run --rm migrate`.
- Остановить стек: `docker compose -f docker-compose.prod.yml down` (данные остаются в named volume'ах).

---

## 🗄️ Архитектура баз данных

| Приложение | База данных | ORM / клиент |
| :--- | :--- | :--- |
| `presentation-layer` | `nextjs_db` | Drizzle ORM |
| `ai-logic-layer` | `mastra_db` | Mastra PostgresStore |
| `workers` | `mastra_db` | pg-boss (схема `pgboss`) |

**Джоины между таблицами `nextjs_db` и `mastra_db` запрещены.** PostgreSQL физически не позволяет выполнять кросс-базовые запросы, что гарантирует изоляцию на уровне СУБД.

---

## 🎨 UI: shadcn/ui

Проект настроен с пресетом **`SHADCN_PRESET`**. Все компоненты shadcn/ui установлены и доступны в `apps/presentation-layer/src/shared/components/ui/` (FSD-слой `shared`).

Добавить новый компонент:

    cd apps/presentation-layer
    bunx shadcn@latest add <component-name>

Компонент автоматически окажется в `src/shared/components/ui/` — настройки shadcn (`components.json`) уже указывают на shared-слой.

---

## 🧩 FSD структура (feature-sliced-design)

`apps/presentation-layer` использует методологию [Feature-Sliced Design](https://fsd-frontend.com/). Папка маршрутизации Next.js `app/` находится на корне проекта, `src/` содержит только FSD-слои:

    apps/presentation-layer/
    ├── app/                    # Только ре-экспорты из _pages/ (маршруты Next.js)
    └── src/
        ├── _app/               # Глобальная инфраструктура (providers, styles)
        ├── _pages/             # Страницы-композиции (имеет доступ к features)
        ├── features/           # Бизнес-логика (пусто, создавать по мере надобности)
        ├── entities/           # Бизнес-сущности (пусто, создавать по мере надобности)
        └── shared/             # Небизнес-логика:
            ├── components/     # UI-компоненты, включая shadcn/ui (ui/)
            ├── lib/            # Утилиты
            ├── hooks/          # Хуки
            └── db/             # Drizzle ORM (schema, migrations, client)

Правила: слои могут импортировать только из нижестоящих слоёв (от верхних к нижним: `_app` / `_pages` → `features` → `entities` → `shared`; папка `app/` связывает маршруты). Внешний интерфейс слоя — только через его `index.ts`.

> Детали методологии упакованы в опциональный скилл `feature-sliced-design`: `./setup-skills.sh . --extras` (см. раздел «Agent Skills»). Базовые правила FSD выше действуют и без него.

---

## 🧠 Agent Skills

В проекте автоматически подключён один короткий скилл **hackathon-guide** для Codex
и Claude Code. Полная библиотека cc-polymath (26 входных скиллов и материалы) находится
в `skills/cc-polymath/` и читается только по задаче. Никакой установки после clone.

Пример: «Используй hackathon-guide: оформи решение по API в docs/adr/».
В [роутере](.agents/skills/hackathon-guide/SKILL.md) указано, какой материал читать
для каждой задачи и в каком модуле его применять. [Каталог всех 26 скиллов](skills/cc-polymath/ROUTING.md)
объясняет назначение каждого; [адаптация](skills/cc-polymath/PROJECT.md) связывает
upstream-примеры со стеком проекта. `AGENTS.md` и `CLAUDE.md` направляют агентов к этим файлам.
Коммитим `skills/`, `.agents/skills/`, `.claude/skills/`, `AGENTS.md` и `CLAUDE.md`.
Подробнее: [QUICKSTART.md](QUICKSTART.md).

`./setup-skills.sh .` восстанавливает локальное подключение без сети.
`./setup-skills.sh . --extras` дополнительно скачивает 10 технологических скиллов.
Это опционально: увеличивает список скиллов агента, для обычной работы не нужно.
