# ADR-009: заметки по реализации

Не заменяет ADR-009; фиксирует, что построено, локальные допущения и точки
интеграции для владельцев ADR-004/005/006/007/008/003.

> Обновлено после ревью (гонка версий, AI внутри транзакции, слепое
> приведение ответа Mastra, 422 vs 409, `z.locales.ru()`, утечка
> `suggested`-полей/`draftText` в каталог) — см. «Что исправлено после
> ревью» в конце файла.

## Что построено

- **Ошибки** — `src/shared/api/errors.ts`: `ApiError`, хелперы
  `invalidJson/validationError/businessError/forbidden/notFound/conflict`,
  `toErrorResponse()` (ZodError → 422 с `z.flattenError`, неизвестная ошибка
  → 500 без утечки деталей). Формат ответа — `{ error: { code, message,
  details? } }`, `message` — по-русски: `errors.ts` вызывает
  `z.config(z.locales.ru())` один раз при импорте (раньше любого
  `schema.parse`, т.к. `errors.ts` импортируется `handler.ts`, а его — каждый
  `route.ts`), поэтому и дефолтные сообщения zod (не только те, что заданы
  явно в контрактах) теперь на русском.
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
- **Транзакции** — `src/shared/db/transaction.ts`: `inMemoryTransaction`
  (`TransactionRunner`), API совпадает с `db.transaction` Drizzle **по
  сигнатуре**, но НЕ по гарантиям — комментарий в файле теперь прямо
  говорит, что при переносе на Drizzle любая проверка версии/статуса должна
  стать условным `UPDATE ... WHERE ... RETURNING` внутри `fn`, а не
  отдельным `SELECT` до `db.transaction`. Все use-case, где нужна защита от
  гонки (`submit-turn`, `decide-proposal`, `claim/confirm/return-stage`,
  `publish/close-task`, `submit-proposal`), теперь проверяют состояние
  ПЕРВОЙ строкой ВНУТРИ колбэка транзакции, а сам колбэк синхронный (без
  `await`), так что на in-memory сторе однопоточность event loop даёт ту же
  атомарность, что условный `UPDATE` даст на реальной БД.
- **AI-порт** — `src/shared/api/ports/`: `AiPort` (интерфейс
  `analyzeText`/`phraseQuestion`), `mastraAiPort` (реальный клиент через
  `@mastra/client-js`, с валидацией формы ответа `analyzeTextOutputSchema`/
  `phraseQuestionOutputSchema` и разбором `WorkflowRunResult.status`,
  таймауты 5 с/15 с по AI-9), `getAiPort()` (учитывает `AI_ENABLED=false`),
  `ruleBasedFallbackQuestion`/`rule-based-analyzer.ts` (заглушка на правилах,
  ADR-003 §5). Никакого прямого импорта `openai`. `submitGrillTurn` вызывает
  ВСЕ AI-обращения (включая формулировку следующего вопроса) ДО открытия
  транзакции — раньше `phraseQuestion` ошибочно звалась внутри неё; порт и
  транзакция теперь принимают опциональные параметры (`aiPortOverride`,
  `txRunner`) для тестов.
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
- **`toPublicTask()`** (`shared/api/store/index.ts`) — форма задачи для
  каталога/рекомендаций: без `draftText`/`businessId`, поля отфильтрованы до
  `confirmed`. Отдельная zod-схема `publicTaskSchema`
  (`contracts/common.ts`, `taskSchema.omit({businessId, draftText})`)
  используется в `catalogItemSchema`/`recommendationItemSchema` вместо
  полной `taskSchema`.
- **Тесты** — `tests/api.test.ts` (14 кейсов, включая гонку версий и
  инъекцию фейкового AI-порта/транзакции) + существующий
  `src/entities/workspace/model.test.ts` (8 кейсов), итого 22 через `bun test`.

## Список эндпоинтов и коды

Все переходы состояния (задача/отклик/этап уже не в ожидаемом статусе) —
`409 conflict`, не `422`: `422` теперь означает только нарушение
zod-схемы/бизнес-валидации ввода (черновик, URL, обязательные поля).

| Метод | Путь | 2xx | Другие коды |
|---|---|---|---|
| POST | `/api/tasks` | 201 | 422 (черновик, оплата), 403 (не business) |
| PATCH | `/api/tasks/:id` | 200 | 403, 422 (формат без условий оплаты) |
| POST | `/api/tasks/:id/grill/turn` | 200 | 403, 404, 409 (версия/сессия) |
| POST | `/api/tasks/:id/grill/checkpoint` | 200 | 403, 404 |
| PATCH | `/api/tasks/:id/fields/:node` | 200 | 403, 404, 422 (неизвестный узел, подтверждение пустого поля) |
| GET | `/api/tasks/:id/score` | 200 | 403, 404 |
| POST | `/api/tasks/:id/publish` | 200 | 403, 404, 409 (не черновик) |
| POST | `/api/tasks/:id/close` | 200 | 403, 404, 409 (не published / есть accepted) |
| GET | `/api/catalog` | 200 | — (публично, без getDemoActor; `toPublicTask`) |
| GET | `/api/teams/:id/recommendations` | 200 | 404 (`toPublicTask`) |
| POST | `/api/swipes` | 201 | 403, 404 |
| POST | `/api/tasks/:id/proposals` | 201 | 403, 404, 409 (не тот статус задачи, дубль отклика) |
| GET | `/api/tasks/:id/proposals` | 200 | 403, 404 |
| POST | `/api/proposals/:id/decision` | 200 | 403, 404, 409 (статус), 422 (reject без причины — zod) |
| GET | `/api/proposals/:id/kickoff` | 200 | 403, 404, 409 (kickoff ещё не собран) |
| POST | `/api/stages/:id/claim` | 200 | 403, 404, 409 |
| POST | `/api/stages/:id/confirm` | 200 | 403, 404, 409 |
| POST | `/api/stages/:id/return` | 200 | 403, 404, 409 |
| GET | `/api/ai-log` | 200 | 403, 404 |

Общее для всех: невалидный JSON → 400; нарушение zod-схемы тела/query/params
→ 422 через `toErrorResponse(ZodError)` (сообщения — по-русски,
`z.config(z.locales.ru())` в `errors.ts`); падение валидации СХЕМЫ ОТВЕТА
внутри `jsonOk()` → 500 (баг use-case, не ввод клиента — не должно течь как
422 клиенту).

## INTEGRATION-точки (для владельцев ADR)

- **ADR-003** (`ports/mastra-ai-port.ts`, `ports/ai-port.ts`): id workflow
  (`analyze-text`, `phrase-question`) и метод клиента (`createRun()` +
  `startAsync()`, оба — в общей гонке с таймером и `clearTimeout`) — лучшее
  приближение к `@mastra/client-js@1.47` API по установленному пакету;
  ADR-003 отмечает, что `ai-logic-layer` ещё не регистрирует эти workflow —
  проверить и поправить при подключении. Порт разбирает
  `WorkflowRunResult.status` (`success|failed|tripwire|suspended|paused`,
  `@mastra/core/dist/workflows/types.d.ts`) — берёт `result` только при
  `status==='success'`, иначе бросает, — и валидирует форму `result` через
  `analyzeTextOutputSchema`/`phraseQuestionOutputSchema`, так что
  неожиданный ответ уходит в тот же `catch`/fallback use-case, что и сетевая
  ошибка, а не приводится вслепую и не роняет запрос 500-й ошибкой.
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
  ИЛИ заголовки `x-demo-role`/`x-demo-actor` (для curl/тестов); нет `tm_view`
  и server action переключателя. Видимость `confirmed`-only полей для роли
  `team` (пункт 3 ADR-008) ТЕПЕРЬ реализована для каталога/рекомендаций
  (`toPublicTask()`), но не для «своих» ответов бизнеса (`GET
  /api/tasks/:id/score` и т.п. по-прежнему отдают полный `ApiTask` —
  корректно, это не то, что видит команда) и не для «Вид исполнителя»
  (FR-2.8) внутри самой страницы задачи бизнеса — этот фильтр UI-owner
  должен применить отдельно, используя ту же функцию.

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
2. **`submitGrillTurn` принимает необязательные `aiPortOverride`/`txRunner`.**
   Добавлено по ревью, чтобы тест «AI вне транзакции» мог доказывать это по
   факту (фейковый порт бросает, если его вызвали при открытой фейковой
   транзакции), а не по косвенным признакам. В проде оба параметра не
   передаются, действуют дефолты (`getAiPort()`, `inMemoryTransaction`).
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

## Что исправлено после ревью

1. **Гонка `sessionVersion`.** Проверка версии в `submit-turn.ts` теперь
   выполняется дважды: быстрый отказ до AI-вызовов и авторитетная проверка
   ПЕРВОЙ строкой внутри синхронной (без `await`) транзакции записи. Тот же
   check-внутри-транзакции паттерн применён в `decide-proposal.ts`,
   `claim/confirm/return-stage.ts`, `publish-task.ts`, `close-task.ts`,
   `submit-proposal.ts`. Комментарий в `shared/db/transaction.ts` явно
   говорит, что перенос на Drizzle — это условные `UPDATE ... RETURNING`, а
   не смена импорта. Тест: `гонка: два хода с одной sessionVersion -> ровно
   один 200 и один 409` (`Promise.allSettled`).
2. **`phraseQuestion` вызывалась внутри транзакции.** Теперь весь AI-путь
   (`analyzeText` + `phraseQuestion`) выполняется до `inMemoryTransaction`,
   используя проекцию состояния (`NextStepTaskView`) для расчёта следующего
   шага без мутации реальной задачи. Тест: `AI-вызовы выполняются ДО
   открытия транзакции записи` — фейковый `AiPort` бросает assertion, если
   его вызвали при `txOpen === true` (фейковый `TransactionRunner`).
3. **Слепое приведение `WorkflowRunResult`.** См. INTEGRATION(ADR-003) выше —
   разбор `status`, zod-валидация `result`, раздельные таймауты 5 с/15 с
   (AI-9), `clearTimeout`. `create-task.ts`/`submit-turn.ts` уже ловят любую
   ошибку порта (включая ZodError от валидации) как сигнал `fallbackUsed`,
   поэтому дополнительных правок в них не потребовалось.
4. **`jsonOk` больше не превращает баг схемы ответа в 422.** `handler.ts`
   использует `safeParse` и при неудаче бросает обычный `Error` → ветка
   «неизвестная ошибка» → 500, `console.error`, без утечки деталей клиенту.
5. **422 → 409 для переходов состояния.** `publish-task.ts`, `close-task.ts`
   (оба условия), `get-kickoff.ts`, `submit-proposal.ts` (оба условия) теперь
   бросают `conflict()`. Таблица эндпоинтов выше обновлена.
6. **Русские сообщения по умолчанию.** `errors.ts` вызывает
   `z.config(z.locales.ru())`. Тест: ход без `sessionVersion` → 422 с
   кириллицей в `message`.
7. **Утечка `suggested`-полей/`draftText`/`businessId`.** Добавлены
   `toPublicTask()` и zod-схема `publicTaskSchema`; каталог и рекомендации
   используют их вместо `toApiTask()`/`taskSchema`.
8. **Low-severity:** `decide-proposal.ts` — action `resume` возвращает
   `on_hold → submitted` (ADR-007 §3); `close-task.ts` пишет
   `rejectReason: 'task_closed'` (новый вариант `storedRejectReasonSchema`,
   не входящий в `rejectReasonSchema` формы ручного отклонения); проверки
   цитаты в `create-task.ts`/`submit-turn.ts` явно отбрасывают пустую
   `sourceQuote` (`''.includes('')` иначе всегда `true`); `update-task.ts`
   требует `paymentTerms` при итоговом формате, отличном от `practice`, той
   же логикой, что и создание задачи.
