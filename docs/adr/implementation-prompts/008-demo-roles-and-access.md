# ADR-008 implementation prompt

**Модуль:** Demo roles and authorization.

Implement ADR-008 for local demo role switching and server-side access enforcement in presentation-layer. Add tm_role/tm_actor/tm_view cookie handling with stated cookie attributes, getDemoActor(), explicit actor/ownership checks in use-cases and role-aware data filtering including AiLog ownership. Add clear demo-mode labeling. This is demo role simulation, not real authentication. Integrate with existing UI shell and API/use-case structure. Coordinate with ADR-006 deck/grid and ADR-009 handlers; do not silently leave routes unguarded. Do not create a parallel auth framework or alter schema unless needed and coordinated.

## Общие правила выполнения

Работай только в отдельном Git worktree. До изменений проверь `git status`, текущую ветку и незакоммиченные файлы; ничего чужого не сбрасывай, не чисти и не коммить из исходной рабочей копии. Создай worktree и свою feature-ветку от актуальной ветки интеграции, используя `git worktree add ../hack-810705c9-adr-008 -b feature/adr-008-<короткое-имя> <base-branch>`. Сначала проверь `git worktree list` и `git branch --show-current`; не используй уже занятый путь/ветку.

В worktree перечитай корневой `AGENTS.md`, соответствующий `docs/adr/008-*.md`, связанные ADR и только нужные разделы спецификации/архитектуры. ADR Proposed — план реализации, а не утверждение новых требований: следуй ему, фиксируй неразрешённые вопросы как допущения и не меняй ADR статус/содержание. Сверь рабочее дерево после создания: worktree может не содержать незакоммиченные изменения исходной папки. Если необходимая зависимая реализация ещё не попала в base branch, не копируй её вручную и не переписывай: подготовь совместимый узкий интерфейс, явно укажи блокирующую зависимость и продолжай независимую часть.

Делай компактную реализацию только в согласованном модуле, следуй существующим версиям и паттернам. Не читай секреты и не выводи значения `.env`. Не добавляй инфраструктуру/зависимости без необходимости. По завершении проверь diff, выполни только целевые проверки изменённого потока и нужные type/lint команды; не запускай тесты по умолчанию, если они не требуются для реализации или не запрошены. Не публикуй, не пушь, не деплой и не мержи. Оставь изменения в своей ветке и сообщи: что сделано, изменённые файлы, проверки и результат, известные блокеры/допущения, имя ветки и путь worktree. Не удаляй worktree.

## Задача ADR-008

