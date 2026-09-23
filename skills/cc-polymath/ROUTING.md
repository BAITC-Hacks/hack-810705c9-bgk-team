# Как выбрать скилл cc-polymath

Основная точка входа — `hackathon-guide`: [Codex](../../.agents/skills/hackathon-guide/SKILL.md),
[Claude Code](../../.claude/skills/hackathon-guide/SKILL.md). Он направляет типовые задачи
сразу к нужному материалу. Здесь перечислены все 26 входных скиллов библиотеки.
Участникам не нужно устанавливать их глобально: библиотека и роутер хранятся в Git.

Выберите строку по результату задачи, откройте её SKILL.md, затем только нужный
справочный материал. Для обычной небольшой правки справочник необязателен.
Если пользователь назвал скилл явно, откройте его по ссылке в таблице.
При переносе примеров учитывайте [стек проекта](PROJECT.md) и [AGENTS.md](../../AGENTS.md).

| Скилл | Когда использовать | Где и как применять в проекте |
| --- | --- | --- |
| [discover-api](skills/discover-api/SKILL.md) | Endpoint, контракт запроса/ответа, ошибки, версия API | Next.js BFF в `apps/presentation-layer/app/`, согласование вызовов Mastra |
| [discover-frontend](skills/discover-frontend/SKILL.md) | Страницы, React-компоненты, формы, состояние, загрузка данных | Next.js 16 / React 19, FSD в `apps/presentation-layer/src/` |
| [elegant-design](skills/elegant-design/SKILL.md) | Визуальное оформление, адаптивность, доступность интерфейса | Tailwind 4, существующие shadcn/Radix и AI Elements; сохранять FSD |
| [discover-database](skills/discover-database/SKILL.md) | Схемы, миграции, индексы, SQL, connection pooling | Drizzle и `nextjs_db` для бизнес-данных; `mastra_db` для Mastra/pg-boss; без cross-DB joins |
| [discover-agentic](skills/discover-agentic/SKILL.md) | AI-агенты, workflow, инструменты, память и контекст | Mastra в `apps/ai-logic-layer`; UI/worker обращаются через Mastra client |
| [discover-ml](skills/discover-ml/SKILL.md) | RAG, embeddings, retrieval, выбор модели, оценка ответов | AI-слой, pgvector, RustFS; AI SDK major 6; примеры DSPy/Python не меняют стек |
| [discover-data](skills/discover-data/SKILL.md) | Импорт, преобразование и валидация данных, пакетная обработка | Фоновая обработка в `apps/workers`, файлы в RustFS/S3 |
| [discover-distributed](skills/discover-distributed/SKILL.md) | Очереди, повторы, идемпотентность, согласованность, realtime | pg-boss v10; consumers только в workers; одна `DATABASE_URL_MASTRA` у producer/consumer |
| [discover-infra](skills/discover-infra/SKILL.md) | Docker, Compose, контейнеры, локальная инфраструктура | Существующие compose-файлы, PostgreSQL и RustFS; новые сервисы только по задаче |
| [discover-networking](skills/discover-networking/SKILL.md) | Порты, DNS, HTTP, связь между контейнерами и хостом | UI :3000, Mastra :4111, PostgreSQL :5432, RustFS :9000/:9001; учитывать локальные overrides |
| [discover-cicd](skills/discover-cicd/SKILL.md) | CI, сборка, проверки, доставка артефактов | Bun workspaces, Turbo, Dockerfiles, frozen lockfile; публикация требует разрешения задачи |
| [discover-testing](skills/discover-testing/SKILL.md) | Unit/integration/e2e, регрессия пользовательского сценария | Существующие package scripts; различать mocked проверки и работу живых сервисов |
| [discover-debugging](skills/discover-debugging/SKILL.md) | Падение, неправильный результат, проблема запуска или производительности | Начать с воспроизведения, `./doctor.sh` и логов конкретного модуля |
| [discover-security](skills/discover-security/SKILL.md) | Auth, права доступа, валидация, защита API и файлов | Границы BFF/Mastra, секреты, загруженные и полученные извне данные |
| [discover-cryptography](skills/discover-cryptography/SKILL.md) | Шифрование, сертификаты, TLS, криптографические протоколы | Только затронутый механизм; существующие библиотеки и модель развёртывания |
| [discover-engineering](skills/discover-engineering/SKILL.md) | Code review, технический дизайн, ADR, практика разработки | Малые изменения для демо, решения в `docs/adr/`, сохранение изменений команды |
| [typed-holes-refactor](skills/typed-holes-refactor/SKILL.md) | Запрошенный пошаговый рефакторинг через типы и проверки | TypeScript-контракты и малые проверяемые шаги в затронутом модуле |
| [anti-slop](skills/anti-slop/SKILL.md) | Редактура шаблонных текстов, UI-копирайта или сгенерированного кода | Конкретный артефакт задачи; не превращать редактуру в общий рефакторинг |
| [discover-product](skills/discover-product/SKILL.md) | Scope демо, user stories, приоритеты, критерии приёмки | Рабочий сквозной сценарий в пределах пятичасового хакатона |
| [discover-research](skills/discover-research/SKILL.md) | Исследование, сравнение решений, проверка гипотез и источников | Короткий исследовательский вопрос; факты отдельно от предположений; совместимость со стеком |
| [discover-mcp](skills/discover-mcp/SKILL.md) | Задача требует MCP tools/resources/server | Проверить интеграции Mastra; AI-оркестрация остаётся в `ai-logic-layer` |
| [discover-math](skills/discover-math/SKILL.md) | Алгоритм требует статистики, линейной алгебры или оптимизации | Выбрать метод под конкретный расчёт и проверить результат |
| [discover-systems-theory](skills/discover-systems-theory/SKILL.md) | Теория поиска, типов, компиляторов, формальная проверка | Только релевантный алгоритм или контракт; не загружать все разделы |
| [discover-mobile](skills/discover-mobile/SKILL.md) | Явная задача по native mobile или мобильной интеграции | Текущий продукт — Next.js; обычная адаптивная веб-страница относится к frontend/design |
| [discover-wasm](skills/discover-wasm/SKILL.md) | Функции действительно нужен WebAssembly | Проверить совместимость с Next.js/Bun; не добавлять WASM ради обычной логики |
| [discover-zig](skills/discover-zig/SKILL.md) | Явная задача по Zig или взаимодействию с Zig-кодом | Основной стек — TypeScript/Bun; скилл не означает переход сервисов на Zig |

Для задачи на границе модулей выбирайте материалы последовательно: например,
API-контракт → агент Mastra → очередь worker. Не читайте все три, если меняется
только страница. Версии и решения проекта имеют приоритет над upstream-примерами.

Ссылки этой таблицы разрешаются относительно `skills/cc-polymath/`. После перехода
в SKILL.md относительные ссылки разрешаются уже от его папки. Большая библиотека
исключена из широкого поиска через `.ignore`, но все ссылки доступны для чтения.
