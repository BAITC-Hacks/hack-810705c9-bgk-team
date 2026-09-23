# ADR-001 implementation prompt

**Модуль:** Security/dependencies.

Inspect root dependency configuration, patches/, Dockerfiles and security scripts against ADR-001. The ADR is Accepted, so preserve its decisions. If the implementation is already complete, do not duplicate it; report exact verification. If anything is missing, implement only the missing ADR-001 items: root overrides for linkify-it 5.0.2 and esbuild 0.25.12, compatible provider-utils 2.2.8 Bun patch limiting JSON/error response bodies to 16 MiB in ESM and CJS, and Dockerfile patch-copy ordering. Preserve Mastra and AI SDK majors and existing lockfile constraints. Run the focused security check if available and report scanner limitations honestly.

## Общие правила выполнения

Работай только в отдельном Git worktree. До изменений проверь `git status`, текущую ветку и незакоммиченные файлы; ничего чужого не сбрасывай, не чисти и не коммить из исходной рабочей копии. Создай worktree и свою feature-ветку от актуальной ветки интеграции, используя `git worktree add ../hack-810705c9-adr-001 -b feature/adr-001-<короткое-имя> <base-branch>`. Сначала проверь `git worktree list` и `git branch --show-current`; не используй уже занятый путь/ветку.

В worktree перечитай корневой `AGENTS.md`, соответствующий `docs/adr/001-*.md`, связанные ADR и только нужные разделы спецификации/архитектуры. ADR Proposed — план реализации, а не утверждение новых требований: следуй ему, фиксируй неразрешённые вопросы как допущения и не меняй ADR статус/содержание. Сверь рабочее дерево после создания: worktree может не содержать незакоммиченные изменения исходной папки. Если необходимая зависимая реализация ещё не попала в base branch, не копируй её вручную и не переписывай: подготовь совместимый узкий интерфейс, явно укажи блокирующую зависимость и продолжай независимую часть.

Делай компактную реализацию только в согласованном модуле, следуй существующим версиям и паттернам. Не читай секреты и не выводи значения `.env`. Не добавляй инфраструктуру/зависимости без необходимости. По завершении проверь diff, выполни только целевые проверки изменённого потока и нужные type/lint команды; не запускай тесты по умолчанию, если они не требуются для реализации или не запрошены. Не публикуй, не пушь, не деплой и не мержи. Оставь изменения в своей ветке и сообщи: что сделано, изменённые файлы, проверки и результат, известные блокеры/допущения, имя ветки и путь worktree. Не удаляй worktree.

## Задача ADR-001

