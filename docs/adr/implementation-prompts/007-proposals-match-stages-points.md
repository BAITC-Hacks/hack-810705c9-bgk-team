# ADR-007 implementation prompt

**Модуль:** Proposals, accepted matches and stages.

Implement ADR-007 in presentation-layer: proposal submission and business decisions, accepted proposal as match, kickoff snapshot, criterion-version/stage snapshots, stage claim/return/confirm lifecycle, team point aggregation and portfolio. Enforce conditional state transitions and one-time +10 per confirmed stage. Implement close-without-selection behavior. Respect actor/ownership checks if ADR-008 is present; otherwise make actor an explicit required use-case input. Integrate fit from ADR-006 and kickoff from confirmed fields without duplicating those modules. Coordinate all schema and migration work with the designated owner; no competing migrations. Keep unresolved product questions documented as assumptions rather than expanding scope.

## Общие правила выполнения

Работай только в отдельном Git worktree. До изменений проверь `git status`, текущую ветку и незакоммиченные файлы; ничего чужого не сбрасывай, не чисти и не коммить из исходной рабочей копии. Создай worktree и свою feature-ветку от актуальной ветки интеграции, используя `git worktree add ../hack-810705c9-adr-007 -b feature/adr-007-<короткое-имя> <base-branch>`. Сначала проверь `git worktree list` и `git branch --show-current`; не используй уже занятый путь/ветку.

В worktree перечитай корневой `AGENTS.md`, соответствующий `docs/adr/007-*.md`, связанные ADR и только нужные разделы спецификации/архитектуры. ADR Proposed — план реализации, а не утверждение новых требований: следуй ему, фиксируй неразрешённые вопросы как допущения и не меняй ADR статус/содержание. Сверь рабочее дерево после создания: worktree может не содержать незакоммиченные изменения исходной папки. Если необходимая зависимая реализация ещё не попала в base branch, не копируй её вручную и не переписывай: подготовь совместимый узкий интерфейс, явно укажи блокирующую зависимость и продолжай независимую часть.

Делай компактную реализацию только в согласованном модуле, следуй существующим версиям и паттернам. Не читай секреты и не выводи значения `.env`. Не добавляй инфраструктуру/зависимости без необходимости. По завершении проверь diff, выполни только целевые проверки изменённого потока и нужные type/lint команды; не запускай тесты по умолчанию, если они не требуются для реализации или не запрошены. Не публикуй, не пушь, не деплой и не мержи. Оставь изменения в своей ветке и сообщи: что сделано, изменённые файлы, проверки и результат, известные блокеры/допущения, имя ветки и путь worktree. Не удаляй worktree.

## Задача ADR-007

