# ADR-010 implementation prompt

**Модуль:** Acceptance verification.

Implement ADR-010 verification artifacts only: focused bun tests for pure domain functions and AI guards using fixtures, plus a deterministic HTTP acceptance runner/checklist for T-1–T-20 that works with AI_ENABLED=false and the existing local startup/seed conventions. Clearly separate unit, fallback-backed HTTP and live-LLM manual verification; never claim mocks prove live services. Do not change product behavior merely to make a test pass; report conflicts with earlier ADRs. Do not add Playwright or dependencies. Inspect existing scripts and tests first and add only focused coverage for implemented flows.

## Общие правила выполнения

Работай только в отдельном Git worktree. До изменений проверь `git status`, текущую ветку и незакоммиченные файлы; ничего чужого не сбрасывай, не чисти и не коммить из исходной рабочей копии. Создай worktree и свою feature-ветку от актуальной ветки интеграции, используя `git worktree add ../hack-810705c9-adr-010 -b feature/adr-010-<короткое-имя> <base-branch>`. Сначала проверь `git worktree list` и `git branch --show-current`; не используй уже занятый путь/ветку.

В worktree перечитай корневой `AGENTS.md`, соответствующий `docs/adr/010-*.md`, связанные ADR и только нужные разделы спецификации/архитектуры. ADR Proposed — план реализации, а не утверждение новых требований: следуй ему, фиксируй неразрешённые вопросы как допущения и не меняй ADR статус/содержание. Сверь рабочее дерево после создания: worktree может не содержать незакоммиченные изменения исходной папки. Если необходимая зависимая реализация ещё не попала в base branch, не копируй её вручную и не переписывай: подготовь совместимый узкий интерфейс, явно укажи блокирующую зависимость и продолжай независимую часть.

Делай компактную реализацию только в согласованном модуле, следуй существующим версиям и паттернам. Не читай секреты и не выводи значения `.env`. Не добавляй инфраструктуру/зависимости без необходимости. По завершении проверь diff, выполни только целевые проверки изменённого потока и нужные type/lint команды; не запускай тесты по умолчанию, если они не требуются для реализации или не запрошены. Не публикуй, не пушь, не деплой и не мержи. Оставь изменения в своей ветке и сообщи: что сделано, изменённые файлы, проверки и результат, известные блокеры/допущения, имя ветки и путь worktree. Не удаляй worktree.

## Задача ADR-010

