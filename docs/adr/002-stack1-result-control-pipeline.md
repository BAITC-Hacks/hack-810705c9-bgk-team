# ADR-002: Пайплайн «Результат и Контроль» на Mastra (агенты + воркфлоу)

Date: 2026-09-23
Status: Accepted
Owner: team

## Context

Стек №1 требует провести пользователя через четыре методологии постановки задачи —
SMART → User Story → Job Story → Acceptance Criteria — с жёстким exit-контролем
на каждой стадии (тесты role/swap/falsification + coverage-карты из
`apps/ai-logic-layer/skills/grill-me-*.md`). Нужны: язык диалога на входе,
переход контекста между стадиями и финальный перевод собранных артефактов.
AI живёт только в `ai-logic-layer` (Mastra, `mastra_db`), UI зовёт через
`@mastra/client-js`/`MASTRA_API_URL`.

## Decision

1. **Один интервью-агент `grillAgent`** со всеми четырьмя скиллами. Единая папка
   скиллов — `apps/ai-logic-layer/skills/<name>/SKILL.md` (каноничный формат
   Agent Skills / `LocalSkillSource` Mastra); подключаются нативными путями
   в `agent.skills`, кастомного лоадера нет. В Dockerfile добавлен COPY в `./skills`.
   Промпт каждого шага воркфлоу активирует нужный скилл, передаёт язык,
   seedIdea и коммитнутые артефакты — это даёт переход контекста «от шага к шагу»
   без четырёх агентов.
2. **Отдельный `translatorAgent`**: финальный шаг спрашивает (на языке диалога),
   на какие языки переводить, через `suspend()`, затем переводит пакет одним
   вызовом (structured output).
3. **Воркфлоу `stack1-result-control`**: цепочка `.then(init).dountil(roundStep, …)`
   на стадию (susp/resume по раундам, потолок `MAX_ROUNDS=10` с честным
   `capReached`-отчётом вместо бесконечного цикла) → `compile` → `translator-ask`
   → `translate`. Снапшоты и memory живут в `PostgresStore` (`DATABASE_URL_MASTRA`).
4. **Контроль в два уровня**: структурный (zod-парсинг артефакта по схеме стадии)
   и семантический (exit-вызов агента с рубрикой `EXIT_RUBRICS[stage]`).
   Провал → возврат в цикл с `failingChecks` (follow-up раунд).
5. **Один memory-thread на run** (`threadId = runId`) — оба агента читают одну
   историю (`@mastra/memory`, `lastMessages: 60`).
6. Модель `openai/gpt-6-luna` (сверена с provider-registry mastra-скилла, подтверждена
   живым вызовом `mastra api agent run`), переопределение — `GRILL_MODEL`.

## Alternatives

- **Четыре отдельных агента по стадии** — 1:1 со скиллами, но thread-scoped
  memory-шаринг между ними требует одинаковых id на прямых вызовах и не даёт
  выигрыша при одном interrupt-потоке; выбран один агент со сменой промпта.
- **Интервью вне воркфлоу (chat-first, валидация отдельно)** — проще, но теряет
  durable suspend/resume: run не переживает рестарт и не рендерит вопросы
  из состояния воркфлоу.
- **Некликательный автопрогон (агент сам себя опрашивает)** — быстро для демо,
  но противоречит сути grilling (пушбэк и реальные ответы человека).

## Consequences

- (+) Run переживает рестарты сервера; UI можно отрендерить из suspend-payload
  и дослать ответы через `run.resume()`.
- (+) Exit-отчёты всех стадий попадают в финальный пакет — «Результат и
  Контроль» виден заказчику, расхождения US↔JS фиксируются в `disagreements`.
- (−) Нативные path-скиллы резолвятся относительно cwd приложения — запускать
  нужно из корня `apps/ai-logic-layer`; для Docker это покрыто COPY `./skills`
  и `WORKDIR /app`.
- (−) Живой прогон (LLM + suspend в PG) требует `OPENAI_API_KEY` и поднятого
  `mastra_db`; без ключа проверяется только boot/типизация.
- (−) Потолок `MAX_ROUNDS` при слишком широкой идее помечает стадию
  `capReached: committed=false`, не теряя остальных стадий.
