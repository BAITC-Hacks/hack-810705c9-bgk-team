# ADR-002: Границы модулей и синхронная оркестрация через BFF

Дата: 2026-09-23
Статус: Proposed
Владелец: не назначен

## Контекст

Сквозной сценарий ТЗ (раздел 4, T-1) проходит от черновика до подтверждённого
этапа. Исходные документы описывают одно приложение Next.js со встроенной Mastra,
SQLite/LibSQL и pnpm (ТЗ NFR-1, NFR-2, NFR-8; платформа, разделы 8.2 и 9).
Принятый стек другой (AGENTS.md, `docs/ARCHITECTURE.md`):

- `apps/presentation-layer` — Next.js 16 UI/BFF, владелец `nextjs_db` (Drizzle);
- `apps/ai-logic-layer` — Mastra, `mastra_db`; UI вызывает его только через
  `@mastra/client-js` и `MASTRA_API_URL`;
- `apps/workers` — consumers pg-boss, `mastra_db`;
- межбазовых joins нет, consumers очередей работают только в `apps/workers`.

Текущий код — заготовка. В `ai-logic-layer/src/mastra/index.ts` есть только
`new Mastra({ storage })`, агентов и workflow нет. Схема
`presentation-layer/src/shared/db/schema.ts` содержит лишь таблицу `users`.
`workers/src/index.ts` слушает `example-queue`. Ни одна сущность из ТЗ (раздел 9.1)
пока не реализована.

Требования к латентности: ход прожарки ≤ 5 с (NFR-6). Первый вопрос возвращается
в ответе на `POST /api/tasks` (платформа, раздел 9.1). Без AI сценарий работает на
шаблонах (NFR-5, T-15).

## Решение

1. **Бизнес-логика и состояние находятся в BFF** (`presentation-layer`). Дерево
   прожарки, `score()`, `fit()`, стартовый пакет, переходы состояний и все
   записи в `nextjs_db` реализуются там как код. Это «код» из ТЗ AI-3, FR-3.1 и FR-7.9.
2. **`ai-logic-layer` выполняет только inference.** Его workflow принимают
   снимок входа (текст, целевой узел, справочник), возвращают валидированный
   структурированный результат и служебные данные для журнала. Состояние задач и
   прожарки в `mastra_db` не хранится. Детали контракта описаны в [ADR-003](003-ai-layer-contract.md).
3. **Весь сквозной сценарий выполняется синхронно** в пределах HTTP-запроса к
   BFF. Анализ черновика и ход прожарки не ставятся в pg-boss: пользователь ждёт
   следующий вопрос, а очередь добавила бы polling или push без выигрыша для демо.
   В `apps/workers` для MVP изменений нет. Если позже понадобится фоновая задача,
   например пакетный пересчёт или предзаполнение seed через LLM, producer ставит
   её через `DATABASE_URL_MASTRA`, а consumer пишется в `apps/workers`.
4. **Маппинг исходных требований на стек:**

   | Исходное требование | В проекте |
   |---|---|
   | NFR-1 SQLite (Drizzle), LibSQL для Mastra | PostgreSQL: `nextjs_db` (Drizzle), `mastra_db` (`PostgresStore`) |
   | NFR-2 `pnpm i && pnpm db:seed && pnpm dev` | `./start.sh` (миграции + `bun run dev`); seed — отдельный скрипт `db:seed` в `presentation-layer` (пока не существует) |
   | NFR-8 `src/mastra`, `src/lib`, `src/app` | `apps/ai-logic-layer/src/mastra/**`; доменные функции — FSD-слои `apps/presentation-layer/src/{entities,features}`; маршруты — `app/` |
   | NFR-3 env | Ключи моделей и `LLM_MODEL`/`CLASSIFIER_MODEL` — только в env `ai-logic-layer`; `AI_ENABLED` читает BFF (см. ADR-003) |

5. **Размещение по FSD** (предложение, не утверждено). Чистые функции (узлы,
   `score`, `fit`, дерево прожарки, стартовый пакет, нормализация цитат) лежат
   в `src/entities/*/model`. Сценарные use-case с транзакциями — в
   `src/features/*/api`. Клиент Mastra и конфигурация — в `src/shared/api`.
   Route handlers в `app/api/**` остаются тонкими обёртками (см. [ADR-009](009-bff-api-contract.md)).

## Альтернативы

- **Mastra владеет прожаркой** (состояние в `mastra_db`, workflow с `suspend/resume`).
  Отклонено. Поля, рейтинг и журнал показываются в UI и должны лежать в
  `nextjs_db`. Иначе понадобится чтение через два сервиса без joins и
  синхронизация. Платформа (8.2) прямо предписывает «один запуск workflow без suspend».
- **Асинхронные ходы через pg-boss + workers.** Отклонено: добавляет очередь,
  polling и обработку гонок, а по времени выигрыша нет. Консьюмер в workers должен
  был бы писать в `nextjs_db`, которым workers не владеет.
- **Прямые вызовы OpenAI/Anthropic из BFF** (пакет `openai` уже в зависимостях UI).
  Запрещено AGENTS.md: наличие пакета не разрешает inference из UI.
- **Общий workspace-пакет `packages/task-match-domain`**, чтобы `decide` работал
  внутри Mastra-workflow, как в AI-3. Отложено: новый пакет меняет `bun.lock` и
  конфигурацию двух приложений. Вернуться к нему, если дублирование проверок
  (ADR-003) станет заметным.

## Последствия

- Плюс: одна точка истины для бизнес-правил. Требования FR-3.1, AI-12 и FR-7.7
  проверяются в одном модуле. Mastra можно отключить без потери сценария.
- Плюс: не нужны изменения в workers, новые очереди и инфраструктура.
- Минус: ход прожарки = BFF + 1–2 вызова Mastra. Латентность ограничивается
  таймаутами (ADR-003). Долгий LLM-вызов держит HTTP-запрос.
- Минус: workflow `grill-turn` из AI-3 разделяется между BFF (decide) и Mastra
  (inference). Это отступление от формы AI-3, но не от его смысла, и оно
  вынесено в открытые вопросы индекса.
- Риск: команда может по привычке положить логику в Mastra-агента. На ревью
  проверяем, что рейтинг, fit и переходы не вычисляются в `ai-logic-layer`.

## Затронутые модули и проверка

- `apps/presentation-layer` (`app/api/**`, `src/entities`, `src/features`, `src/shared/db`).
- `apps/ai-logic-layer/src/mastra/**`.
- `apps/workers` не меняется.
- Проверка: T-1 проходит при `AI_ENABLED=false` и остановленном `ai-logic-layer`
  (T-15). `rg "openai|anthropic" apps/presentation-layer/src` не находит вызовов
  моделей. В `ai-logic-layer` нет обращений к `DATABASE_URL_NEXTJS`.

## Допущения и открытые вопросы

- Допущение: демо запускается локально через `./start.sh`, все три приложения в одной сети.
- Вопрос: нужен ли вообще `apps/workers` в демо или его оставляют как есть.
