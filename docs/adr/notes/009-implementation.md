# ADR-009: заметки по реализации

Не заменяет ADR-009; фиксирует, что построено, локальные допущения и точки
интеграции для владельцев ADR-004/005/006/007/008/003.

## Что построено

- **Ошибки** — `src/shared/api/errors.ts`: `ApiError`, хелперы
  `invalidJson/validationError/businessError/forbidden/notFound/conflict`,
  `toErrorResponse()` (ZodError → 422 с `z.flattenError`, неизвестная ошибка
  → 500 без утечки деталей). Формат ответа — `{ error: { code, message,
  details? } }`, `message` — по-русски.
- **Контракты** — `src/shared/api/contracts/*.ts`: zod-схемы запроса/ответа
  каждого эндпоинта раздела 10 ТЗ и трёх уточнений ADR-009 §6
  (`POST /api/tasks` → `{task, draftSummary, fallbackUsed}`;
  `POST /grill/turn` → discriminated union `next: question|checkpoint|done`;
  `PATCH /fields/:node` union `{action:'confirm'} | правка значения`).
  17 узлов и 7 блоков рейтинга — `contracts/common.ts` (`nodeIdSchema`,
  `blockIdSchema`), веса продублированы в `store/nodes.ts` для расчёта score.
- **Handler-хелперы** — `src/shared/api/handler.ts`: `readJsonBody` (400 на
  невалидный JSON), `parseBody/parseQuery/parseParams` (Next 16: `params` —
  Promise), `withErrorHandling`, `jsonOk` (валидирует и ответ той же схемой).
  Каждый `route.ts` — три шага: `getDemoActor(request)` → `parse*` → вызов
  use-case → `jsonOk`.
- **`getDemoActor(request?)`** — `src/shared/api/demo-actor.ts`. См.
  «Допущения» ниже: принимает `NextRequest` для route handlers (не требует
  контекста рендера Next, поэтому route handlers тестируемы напрямую) и
  работает без аргумента для серверных компонентов через `next/headers`.
- **Транзакции** — `src/shared/db/transaction.ts`: `inMemoryTransaction`,
  API совпадает с `db.transaction` Drizzle. Use-case AI-хода вызывает
  `analyzeText`/`phraseQuestion` **до** `inMemoryTransaction(...)`.
- **AI-порт** — `src/shared/api/ports/`: `AiPort` (интерфейс
  `analyzeText`/`phraseQuestion`), `mastraAiPort` (реальный клиент через
  `@mastra/client-js`), `getAiPort()` (учитывает `AI_ENABLED=false`),
  `ruleBasedFallbackQuestion`/`rule-based-analyzer.ts` (заглушка на правилах,
  ADR-003 §5). Никакого прямого импорта `openai`.
- **In-memory store** — `src/shared/api/store/`: `domain.ts` (внутренние
  типы), `index.ts` (singleton на `globalThis`, переживает HMR), `nodes.ts`
  (веса/блоки узлов), `scoring.ts` (score/breakdown/missing/nextStep),
  `fit.ts` (ADR-006 §1 формула совпадения), `rule-based-analyzer.ts`.
- **Use-case** — по одному файлу на действие в
  `src/features/{tasks,grill,catalog,recommendations,swipes,proposals,stages,ai-log}/api/`.
  Бизнес-логики в `route.ts` нет — все проверки (владение, переходы статуса,
  422/403/404/409) в use-case.
- **19 маршрутов** под `app/api/**` — раздел 10 + три уточнения ADR-009 §6 +
  `claim/confirm/return` как отдельные роуты (`app/api/stages/[id]/{claim,confirm,return}/route.ts`).
- **Тесты** — `tests/api.test.ts` (10 кейсов) + существующий
  `src/entities/workspace/model.test.ts` (8 кейсов), итого 18 через `bun test`.

## Список эндпоинтов и коды

| Метод | Путь | 2xx | Другие коды |
|---|---|---|---|
| POST | `/api/tasks` | 201 | 422 (черновик, оплата), 403 (не business) |
| PATCH | `/api/tasks/:id` | 200 | 403 |
| POST | `/api/tasks/:id/grill/turn` | 200 | 403, 404, 409 (версия/сессия) |
| POST | `/api/tasks/:id/grill/checkpoint` | 200 | 403, 404 |
| PATCH | `/api/tasks/:id/fields/:node` | 200 | 403, 404, 422 (неизвестный узел, подтверждение пустого поля) |
| GET | `/api/tasks/:id/score` | 200 | 403, 404 |
| POST | `/api/tasks/:id/publish` | 200 | 403, 404, 422 (не черновик) |
| POST | `/api/tasks/:id/close` | 200 | 403, 404, 422 (не published / есть accepted) |
| GET | `/api/catalog` | 200 | — (публично, без getDemoActor) |
| GET | `/api/teams/:id/recommendations` | 200 | 404 |
| POST | `/api/swipes` | 201 | 403, 404 |
| POST | `/api/tasks/:id/proposals` | 201 | 403, 404, 422 (не тот статус задачи, дубль отклика) |
| GET | `/api/tasks/:id/proposals` | 200 | 403, 404 |
| POST | `/api/proposals/:id/decision` | 200 | 403, 404, 409 (статус), 422 (reject без причины — zod) |
| GET | `/api/proposals/:id/kickoff` | 200 | 403, 404, 422 (kickoff ещё не собран) |
| POST | `/api/stages/:id/claim` | 200 | 403, 404, 409 |
| POST | `/api/stages/:id/confirm` | 200 | 403, 404, 409 |
| POST | `/api/stages/:id/return` | 200 | 403, 404, 409 |
| GET | `/api/ai-log` | 200 | 403, 404 |

Общее для всех: невалидный JSON → 400; нарушение zod-схемы тела/query/params
→ 422 через `toErrorResponse(ZodError)`.

## INTEGRATION-точки (для владельцев ADR)

- **ADR-003** (`ports/mastra-ai-port.ts`): id workflow (`analyze-text`,
  `phrase-question`) и метод клиента (`createRun()` + `startAsync()`) —
  лучшее приближение к `@mastra/client-js@1.47` API по установленному
  пакету; ADR-003 отмечает, что `ai-logic-layer` ещё не регистрирует эти
  workflow — проверить и поправить при подключении.
- **ADR-004** (`features/grill/api/next-step.ts`,
  `submit-turn.ts`/`submit-checkpoint.ts`, `store/domain.ts` GrillSession):
  дерево прожарки здесь линейное по блокам (FR-1.3, FR-1.6, FR-1.4), БЕЗ
  веток FR-1.8 («данных нет», профиль результата) и БЕЗ pushback FR-1.7
  (одно уточнение на узел всегда `isPushback: false`). Таблицы
  `grill_session`/`grill_turn`/`task_field`/`criterion` — in-memory аналоги в
  `store/domain.ts`, заменяются на Drizzle без смены сигнатур use-case.
- **ADR-005** (`store/scoring.ts`): веса узлов продублированы из раздела 6.1
  ТЗ; нет `ScoreEvent`-истории (FR-3.8) — только текущий пересчёт.
- **ADR-006** (`features/catalog/api/get-catalog.ts`,
  `features/recommendations/api/get-recommendations.ts`, `store/fit.ts`):
  фильтрация in-memory вместо SQL; `fit()` — то же исправление примера
  (missing по `skills ∪ technologies`), что описано в самом ADR-006.
- **ADR-007** (`features/proposals/*`, `features/stages/*`): нет
  `criteria_version`-сверки при показе отклика после правки критериев
  (открытый вопрос самого ADR-007); нет частичного уникального индекса БД —
  проверка дубля отклика в коде use-case, не на уровне схемы.
- **ADR-008** (`shared/api/demo-actor.ts`): читает cookie `tm_role`/`tm_actor`
  ИЛИ заголовки `x-demo-role`/`x-demo-actor` (для curl/тестов); нет
  `tm_view`, server action переключателя и видимости `suggested`-полей для
  роли `team` (пункт 3 ADR-008) — каталог/рекомендации в этой реализации
  отдают тот же `ApiTask`, что и бизнесу; сокрытие `suggested`-полей от
  команды нужно добавить владельцу ADR-008.

## Отклонения и допущения относительно ADR

1. **`getDemoActor(request?: NextRequest)` вместо `getDemoActor()` без
   аргументов.** ADR-008 (и черновой набросок в задаче на реализацию)
   предполагали функцию без параметров, читающую `next/headers`. На практике
   `cookies()/headers()` из `next/headers` бросают
   `... was called outside a request scope` при прямом вызове route handler
   вне `next dev`/`next start` (что и требовалось тестами п. 8 — «вызывать
   route handler напрямую, конструируя `Request`»). `NextRequest.cookies`/
   `.headers` не имеют этого ограничения. Поэтому маршруты передают свой
   `request`; серверные компоненты по-прежнему могут звать без аргумента.
   Владельцу ADR-008 нужно либо принять этот сигнатурный вариант, либо
   явно решить, что route-тесты поднимают реальный Next request context
   (дороже и медленнее).
2. **Тест «AI вне транзакции» — структурный, не по меткам времени.**
   `submitGrillTurn` в реальности всегда вызывает `mastraAiPort` (нет
   отдельного мок-порта в тестах). В CI/локально Mastra не поднята, поэтому
   `fetch` к `MASTRA_API_URL` падает быстро, код уходит в `catch` и
   переходит к `inMemoryTransaction`. Тест проверяет, что несмотря на это
   ход зафиксирован (`sessionVersion` увеличился, вопрос/checkpoint
   вернулись), что подтверждает последовательность «AI (или его неудача) →
   запись», но не строгий porядок по времени между двумя параллельными
   веткам. Для honest строгой проверки нужен инжектируемый `AiPort` (DI) —
   не стал вводить, чтобы не переусложнять use-case сигнатуру перед
   интеграцией ADR-003.
3. **Справочник ролей/навыков не валидируется по enum (AI-11, FR-2.7).**
   `neededRoles`/`neededSkills` в `PATCH /api/tasks/:id` принимают
   произвольные строки. Полный справочник — вне объёма контрактного демо;
   отмечено здесь, а не в самом ADR-009.
4. **`criteria.items` начисление** реализовано по правилу раздела 6.1 (5
   баллов за критерий с числовым порогом, 2 — без), но проверка
   `thresholdHasNumber` не автоматизирована (поле выставляется вызывающей
   стороной, не парсится из текста порога).

## Не проверено вживую

- Реальный вызов `@mastra/client-js` к поднятой Mastra (`ai-logic-layer` не
  содержит агентов/workflow на момент реализации — подтверждено чтением
  ADR-003 §Контекст). Проверен только путь отказа (connection refused →
  `fallbackUsed: true`), что и требовалось T-13/T-15.
- Реальная Drizzle-транзакция на `nextjs_db` — таблицы ADR-004/005/007 ещё
  не смигрированы в `src/shared/db/schema.ts` (там только `users`).
- Полная матрица видимости ADR-008 (роль `team` видящая только
  `confirmed`-поля) — не реализована, см. INTEGRATION выше.

## Рекомендуемый порядок интеграции

1. Владелец схемы (кто бы им ни был) добавляет таблицы
   `task/task_field/criterion/grill_session/grill_turn/proposal/stage/swipe/ai_log`
   в `src/shared/db/schema.ts` + миграцию.
2. ADR-004/005 переносят `store/domain.ts` → Drizzle-репозитории,
   `features/grill/api/next-step.ts` → полное дерево с ветками FR-1.8/FR-1.7.
3. ADR-006 заменяет `get-catalog.ts`/`get-recommendations.ts` на
   SQL-версии, оставляя тот же экспортируемый контракт ответа.
4. ADR-007 добавляет `criteria_version`-сверку и переносит
   `decide-proposal.ts`/`stages/*` на реальные условные `UPDATE`.
5. ADR-008 заменяет `demo-actor.ts` на полную версию (cookie `tm_view`,
   server action, фильтр `suggested`-полей для роли `team`) — сохранить
   сигнатуру `getDemoActor(request?)`, чтобы route-тесты остались рабочими.
6. ADR-003 подключает реальные workflow в `mastra-ai-port.ts`, проверяет
   `createRun()`/`startAsync()` по факту, добавляет провайдерные пакеты, если
   model router их требует.
