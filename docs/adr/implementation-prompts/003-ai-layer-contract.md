# ADR-003 implementation prompt

**Модуль:** Mastra inference.

Implement ADR-003 in apps/ai-logic-layer plus only the narrow BFF client/fallback seam needed to call it. Add stateless analyze-text and phrase-question workflows, schemas/guards, quote validation, digit-option filtering, retry/timeout behavior, AI_ENABLED BFF bypass, and AiLog result shape as specified. Use @mastra/client-js from BFF via MASTRA_API_URL; no direct provider call in presentation-layer. First inspect installed Mastra APIs and package versions instead of assuming signatures or adding dependencies. Coordinate the exported input/output contract with existing BFF code. Do not own nextjs_db schema/migrations; expose structured results and document required persistence seam. Keep personal/team profile data out of model input.

## Общие правила выполнения

Работай только в отдельном Git worktree. До изменений проверь `git status`, текущую ветку и незакоммиченные файлы; ничего чужого не сбрасывай, не чисти и не коммить из исходной рабочей копии. Создай worktree и свою feature-ветку от актуальной ветки интеграции, используя `git worktree add ../hack-810705c9-adr-003 -b feature/adr-003-<короткое-имя> <base-branch>`. Сначала проверь `git worktree list` и `git branch --show-current`; не используй уже занятый путь/ветку.

В worktree перечитай корневой `AGENTS.md`, соответствующий `docs/adr/003-*.md`, связанные ADR и только нужные разделы спецификации/архитектуры. ADR Proposed — план реализации, а не утверждение новых требований: следуй ему, фиксируй неразрешённые вопросы как допущения и не меняй ADR статус/содержание. Сверь рабочее дерево после создания: worktree может не содержать незакоммиченные изменения исходной папки. Если необходимая зависимая реализация ещё не попала в base branch, не копируй её вручную и не переписывай: подготовь совместимый узкий интерфейс, явно укажи блокирующую зависимость и продолжай независимую часть.

Делай компактную реализацию только в согласованном модуле, следуй существующим версиям и паттернам. Не читай секреты и не выводи значения `.env`. Не добавляй инфраструктуру/зависимости без необходимости. По завершении проверь diff, выполни только целевые проверки изменённого потока и нужные type/lint команды; не запускай тесты по умолчанию, если они не требуются для реализации или не запрошены. Не публикуй, не пушь, не деплой и не мержи. Оставь изменения в своей ветке и сообщи: что сделано, изменённые файлы, проверки и результат, известные блокеры/допущения, имя ветки и путь worktree. Не удаляй worktree.

## Задача ADR-003

