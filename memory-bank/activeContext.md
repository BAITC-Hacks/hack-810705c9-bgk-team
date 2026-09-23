# Active Context

## 2026-09-23 — Агент оценки готовности задачи (apps/ai-logic-layer)

`taskEvaluatorAgent` — отдельный чат-агент ВНЕ воркфлоу (пользователь сам присылает текст задачи), отвечает строгим markdown-отчётом на языке задачи:

- Скилл-чеклист `skills/task-readiness-checklist/SKILL.md` (единая папка скиллов): рубрика 7 критериев (контекст 20 / данные 20 / результат 15 / критерии 15 / ограничения 10 / пользователи 10 / связь с бизнесом 10), правила частичных баллов (только заполненные и подтверждённые поля, сумма = оценка), quality bar из четырёх `grill-me-*` скиллов (SMART-линзы, role/swap/falsification, coverage map), уровни (0–39 черновик, 40–69 рабочая, 70–89 готовая, 90–100 приоритетная; уровень — следствие суммы, «дотянуть» запрещено), правила списка недостающих сведений (конкретные вопросы заказчику) и пересчёта с нуля. Подключены все пять скиллов (`SKILLS_DIR` теперь экспортируется из `grill-agent`).
- Ответ — строгий **raw JSON** (контракт — zod `RatingReport` в `schemas/rating.ts`): `score` 0–100 + `level` (draft/working/ready/priority) → `breakdown[]` (ровно 7 строк в порядке рубрики, сумма `awarded` = `score`) → `missing[]` (недостающие сведения) → `recalculation` (firstEvaluation/previousScore/delta/closedItems); если в сообщении нет задачи — `{"error":"no_task","message":…}`.
- `memory: sessionMemory` — пересчёт опирается на прежние отчёты того же thread (`было X → стало Y, Δ`, что закрылось/осталось); без истории — честная первичная оценка. Для UI: держать один thread на задачу.
- Из воркфлоу `stack1-result-control` оценщик убран: удалены `workflows/steps/evaluate.ts` и `processors/score-only-output.ts`; из `schemas/pipeline.ts` — `TaskRating`/`RatingOutput`/`Rated` и `FinalOutput.rating`; цепочка снова `compile → translator-ask → translate` (концепция зафиксирована в `docs/adr/003-task-readiness-evaluator.md`).
- Регистрация: `index.ts` → `agents: { grillAgent, translatorAgent, taskEvaluatorAgent }`.

Проверено: `bun run check-types` (turbo, 3/3 пакета) зелёный; `mastra build` ок в изолированной копии (работающий dev-сервер PID 56708 не останавливали); живой smoke через `POST /api/agents/task-evaluator-agent/generate` (dev-сервер подхватил новый код, все 5 скиллов видны в `/api/agents`). Формат-смоук JSON (чистый thread, python-валидация ключей/7 строк breakdown/порядка критериев/суммы/маппинга уровней/полей пересчёта — ALL PASSED): приветствие → `{"error":"no_task", …}` (одна фраза-просьба); задача-черновик → `score=22, level=draft, missing=7`, `firstEvaluation=true, previousScore=null` (сумма 8+4+7+0+0+3+0=22 ✓); та же задача с дополнениями в том же thread → `22 → 86 (Δ+64), level=ready, closed=7` (delta = score − previousScore ✓). Ранее (markdown-формат) подтверждены пересчёт `22 → 93 (Δ+71)` и вызовы без задачи. Непроверено: рендер/парсинг в UI (UI-клиент ещё не написан), поведение вне memory-thread.

Изменено: `agents/task-evaluator-agent.ts` (переписан), `schemas/rating.ts` (новый, контракт `RatingReport`), `skills/task-readiness-checklist/SKILL.md` (новый), `agents/grill-agent.ts` (export SKILLS_DIR), `memory.ts`, `schemas/pipeline.ts`, `workflows/steps/translator.ts`, `workflows/stack-1-result-control.ts`, `docs/adr/003-task-readiness-evaluator.md` (новый); удалены `workflows/steps/evaluate.ts`, `processors/score-only-output.ts`.

## 2026-09-23 — Пайплайн Стек №1 «Результат и Контроль» (apps/ai-logic-layer)

Реализован и проверен вживую пайплайн SMART → User Story → Job Story → Acceptance Criteria → перевод:

- Агенты: `grill-agent` (4 нативных filesystem-скилла из единой папки `apps/ai-logic-layer/skills/<name>/SKILL.md`, пути в `agent.skills`), `translator-agent` (вопрос о языках перевода + перевод пакета).
- Воркфлоу `stack1-result-control`: init → 4× (dountil раундов suspend/resume + exit-гейт, `MAX_ROUNDS=10`) → compile → translator-ask (suspend) → translate.
- Контроль: структурный (zod на артефакт стадии) + семантический (`EXIT_RUBRICS`: role/swap/falsification + coverage-карты).
- Модель: `openai/gpt-6-luna` (default в `GRILL_MODEL`, env-переопределение).
- Проверено: `bun run check-types` (весь монорепо) зелёный; `mastra build` ок; `/api/agents` и `/api/workflows` отдают ресурсы; run дошёл до `suspended` (русские вопросы); живой `agent run` ответил.

Изменено: `src/mastra/{index,memory,storage}.ts`, `agents/*`, `schemas/pipeline.ts`, `workflows/*`, `skills/` (единая папка, `<name>/SKILL.md`), `Dockerfile` (COPY skills), `package.json`+`bun.lock` (+`@mastra/memory`), `docs/adr/002-...`.

Следующий шаг: UI-клиент через `@mastra/client-js` (start → читать suspend-payload → resume с ответами → финальный пакет + translations).

