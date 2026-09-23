# Архитектура проекта хакатона

Основа: предоставленный командой `ARCHITECTURE (2).md`. Версии — требования стека; фактическое разрешение фиксируется bun.lock при генерации.
Командная оптимизация: `./start.sh` проверяет окружение; обычный dev-старт применяет готовые миграции. Автор схемы отдельно запускает `db:generate`.
AI SDK зафиксирован на ^6 для совместимости с AI Elements.


Монорепа Turborepo + Bun (bun@1.4.2, Node >=24): 3 приложения, 2 shared-пакета. Инфра: PostgreSQL 17 + pgvector (2 изолированные БД: `nextjs_db`, `mastra_db`), RustFS (S3), Docker Compose.

## Правила

- **Две БД, кросс-джоины запрещены**: UI → `nextjs_db` (Drizzle); Mastra + pg-boss → `mastra_db`.
- **AI только в `ai-logic-layer`**: UI/воркеры зовут через `MASTRA_API_URL` (`@mastra/client-js`).
- **Очереди pg-boss** (схема `pgboss`): consumers только в `apps/workers`, постановка — той же строкой подключения.
- **RustFS** (S3): dev `:9000`, консоль `:9001`. **pgvector** в обеих БД (включают `scripts/dev.sh`/`prod.sh`).
- **Миграции Drizzle codebase-first**: `generate` только в dev; прод применяет только закоммиченные SQL (`db:deploy` = check + migrate) сервисом `migrate` в compose-сети.

## Структура

```
project/
├── apps/presentation-layer/    # Next.js + FSD, :3000, nextjs_db
├── apps/ai-logic-layer/        # Mastra server, :4111, mastra_db
├── apps/workers/               # pg-boss consumers, mastra_db (pgboss)
├── packages/typescript-config/ # @repo/typescript-config
├── packages/eslint-config/     # @repo/eslint-config
├── scripts/dev.sh, prod.sh     # one-shot bootstrap
├── docker-compose.{dev,prod}.yml
└── turbo.json
```

## presentation-layer — Next.js UI/BFF

UI/SSR/BFF, владелец `nextjs_db`. Стек: Next.js 16.3.6, React 19.2.8, Tailwind 4, shadcn/ui (все компоненты), Drizzle ORM. Порт `3000`, `DATABASE_URL_NEXTJS`. FSD: `app/` — ре-экспорты; слои `src/` (`_app`, `_pages`, `features`, `entities`, `shared`). Build: `output: standalone` (`turbo prune` → `bun install --frozen-lockfile` → `turbo run build`). Скрипты: dev/build/start, lint, check-types, db:generate/migrate/deploy/studio.

**dependencies:**

- Framework: `next@16.3.6` — React-фреймворк (SSR/SSG/ISR/App Router); `react@19.2.8` — UI-библиотека; `react-dom@19.2.8` — DOM-рендерер React.
- AI/LLM: `ai` — Vercel AI SDK (стриминг, чат, функции); `openai` — клиент OpenAI API; `@mastra/client-js` — клиент Mastra (AI-агенты, оркестрация); `@huggingface/transformers` — Transformers.js, ML-модели Hugging Face в браузере (ONNX); `tokenlens` — подсчёт/анализ токенов; `streamdown` — Markdown из потокового вывода AI (GFM/math/Mermaid/CJK); `@streamdown/cjk|code|math|mermaid` — его плагины; `shiki` — подсветка кода (TextMate-грамматики); `ansi-to-react` — ANSI → React (терминальный вывод); `react-jsx-parser` — парсер JSX-строк; `use-stick-to-bottom` — автоскролл чата к низу.
- UI: `radix-ui` — a11y-примитивы; `@radix-ui/react-use-controllable-state` — хук управляемого состояния; `@base-ui/react` — базовые компоненты от MUI; `@shadcn/react` — shadcn/ui (Radix + Tailwind); `shadcn` — CLI установки компонентов; `class-variance-authority` — варианты компонентов (CVA); `cmdk` — Cmd+K-диалог; `cn` — merge class names; `lucide-react` — иконки; `sonner` — toast; `vaul` — drawer (мобильные шторки); `tw-animate-css` — CSS-анимации Tailwind; `embla-carousel-react` — карусели; `react-resizable-panels` — split views; `input-otp` — OTP-инпут; `react-day-picker` — календарь/даты; `next-themes` — light/dark темы.
- Графика/медиа: `@xyflow/react` — node-based графы/flowcharts (React Flow); `recharts` — графики на D3; `@rive-app/react-webgl2` — Rive-анимации (WebGL2); `media-chrome` — UI медиаплееров; `motion` — Framer Motion (анимации).
- Данные/БД: `drizzle-orm` — TS ORM/query builder; `pg` — клиент PostgreSQL; `pg-boss` — очередь на PostgreSQL (exactly-once; здесь — постановка задач); `zod` — валидация, инференс типов.
- Утилиты: `date-fns` — даты; `nanoid` — генератор ID. Прочее: `@hallelx/youtube-transcript` — транскрипты YouTube.

**devDependencies:** `tailwindcss@^4` — utility-first CSS (v4); `@tailwindcss/postcss@^4` — PostCSS-плагин; `drizzle-kit` — CLI миграций/студия; `eslint@^9`; `eslint-config-next@16.3.6`; `typescript@^5`; `@types/node|react|react-dom|pg` — типы.

## ai-logic-layer — Mastra AI server

Агенты/воркфлоу/RAG + Mastra Studio. Порт `4111`, `mastra_db` (`PostgresStore`, `DATABASE_URL_MASTRA`). ESM, Node >=22.13. Исходники: `src/mastra/index.ts`, `src/mastra/storage.ts`. Скрипты: mastra dev/build/start, check-types.

- dependencies: `@mastra/core` — ядро Mastra (агенты, workflows, memory); `@mastra/pg` — PG-хранилище Mastra (memory, state); `ai` — Vercel AI SDK (тот же, что в presentation-layer); `pg` — клиент PostgreSQL; `zod` — валидация схем.
- devDependencies: `mastra` — CLI; `typescript@^6`; `@types/node`, `@types/pg` — типы.

## workers — фоновые воркеры (pg-boss)

Consumers очередей, вызовы Mastra по HTTP, работа с S3. `mastra_db` (схема `pgboss`). Bun, ESM; dev `bun run --watch src/index.ts`, build → `dist/`. Исходники: `src/index.ts` (PgBoss + MastraClient + S3Client, очередь `example-queue`).

- dependencies: `pg-boss@^10` — очередь на PostgreSQL; `pg` — клиент PostgreSQL; `@mastra/client-js` — клиент Mastra; `@aws-sdk/client-s3` — S3-клиент AWS SDK v3 (загрузка/скачивание/листинг; RustFS через `RUSTFS_ENDPOINT`, `forcePathStyle: true`); `zod` — валидация.
- devDependencies: `typescript@^5.7`; `@types/node`, `@types/pg` — типы; `bun-types` — типы Bun runtime.

## Самописные пакеты (`packages/*`, scope `@repo/*`, приватные)

**@repo/typescript-config** — tsconfig-пресеты (extends `@repo/typescript-config/<имя>`), зависимостей нет: `base.json` — strict-база; `nextjs.json` — Next.js (App Router); `react-library.json` — React-библиотеки.

**@repo/eslint-config** — ESLint flat-конфиги через `exports`: `./base` (base.js — база + turbo/prettier), `./next-js` (next.js — @next/eslint-plugin-next), `./react-internal` (react-internal.js — react-hooks).

devDependencies: `eslint@10` — линтер; `@eslint/js` — официальные JS-конфиги; `eslint-config-prettier` — снимает конфликты с Prettier; `eslint-plugin-only-warn` — ошибки → предупреждения; `eslint-plugin-react-hooks` — правила хуков; `eslint-plugin-turbo`; `@next/eslint-plugin-next` — правила Next.js; `@babel/core` + `@babel/eslint-parser` + `@babel/preset-typescript` — парсер TS для ESLint; `globals` — глобальные переменные.

## Инфраструктура

Compose-сервисы:
- `postgres` — `pgvector/pgvector:0.8.2-pg17`, `:5432`, БД `nextjs_db` + `mastra_db`, расширение `vector`.
- `rustfs` — `rustfs/rustfs:1.0.0`, `:9000`/`:9001` (S3 + консоль).
- prod: `presentation-layer` `:3000`, `ai-logic-layer` `:4111`, `workers` (без порта; depends_on healthy postgres/rustfs, workers ждёт ai-logic-layer); `migrate` — профиль tools, target `migrator`, одноразовые миграции **до** старта приложений.

Turbo-задачи: `build` (dependsOn `^build`, outputs `.next/**`, `dist/**`, `.mastra/**`, env: `DATABASE_URL_*`, `RUSTFS_*`, `MASTRA_API_URL`, `OPENAI_API_KEY`); `dev` (persistent, без кэша); `lint`/`check-types` (dependsOn `^lint`/`^check-types`).

Скрипты:
- `./scripts/dev.sh` — compose up → ждёт Postgres → БД+vector → `bun install --frozen-lockfile` → `.env` из `.env.example` → db:migrate (generate выполняет автор схемы отдельно) → `bun run dev`; EXIT trap гасит инфру на выходе (`KEEP_INFRA=1` — оставить).
- `./scripts/prod.sh` — валидация корневого `.env` → infra `--wait` → БД+vector → `db:deploy` (сервис migrate) → `up -d --build --wait` → проверка статусов контейнеров.

ENV (корень `.env.example`): `POSTGRES_USER/PASSWORD`, `DB_NAME_NEXTJS=nextjs_db`, `DB_NAME_MASTRA=mastra_db`, `RUSTFS_ACCESS_KEY/SECRET_KEY`, `OPENAI_API_KEY`. У каждого приложения свой `.env.example`; `.env` не коммитится.

## Корень

devDependencies: `turbo@^2.11.3` — сборка монорепы; `prettier@3.9.6` — форматтер; `typescript@7.0.2`. Workspace: `apps/*`, `packages/*`. Скрипты: build/dev/lint/check-types (turbo), format (prettier).

## Agent skills

В Git уже лежит один короткий `hackathon-guide` для Codex и Claude Code.
Полный cc-polymath находится в `skills/cc-polymath/`, материалы читаются по задаче.
`./setup-skills.sh .` восстанавливает локальное подключение без сети.
`./setup-skills.sh . --extras` опционально добавляет 10 внешних технологических скиллов;
для повседневной работы и после clone запускать установку не нужно.
