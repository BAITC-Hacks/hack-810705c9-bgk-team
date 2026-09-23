# ADR 001: исправления зависимостей без миграции Mastra

Дата: 2026-09-23. Статус: принято.

`cve-lite-cli@1.36.1` обнаружил уязвимости в трёх транзитивных пакетах.
Сохраняем текущие major-версии Mastra и AI SDK, чтобы не менять API проекта.

## Решение

- Через root `overrides` обновляем `ansi-to-react > linkify-it` до `5.0.2`:
  [CVE-2026-48801](https://github.com/advisories/GHSA-22p9-wv53-3rq4) и
  [CVE-2026-59887](https://github.com/advisories/GHSA-v245-v573-v5vm).
- Обновляем `@esbuild-kit/core-utils > esbuild` до `0.25.12`:
  [GHSA-67mh-4wv8-2f99](https://github.com/advisories/GHSA-67mh-4wv8-2f99).
- Для `@ai-sdk/provider-utils@2.2.8` сохраняем Bun-патч в `patches/`:
  [CVE-2026-8769](https://github.com/advisories/GHSA-866g-f22w-33x8).
  Все три затронутых JSON/error response handler в ESM и CommonJS ограничивают
  тело ответа 16 MiB. Проверяется Content-Length и фактически прочитанное число
  байтов, включая ответы без длины и с неверной длиной. При превышении чтение
  отменяется, reader освобождается, ошибка не допускает автоматического retry.

В ветке provider-utils 2.x нет опубликованного исправления. Mastra client
использует старый `@ai-sdk/ui-utils`, которому нужен синхронный `safeParseJSON`
и экспорт `validatorSymbol`. Принудительный переход на 3.x нарушает этот API.
Локальный backport сохраняет совместимость; превышающие 16 MiB нестриминговые
JSON/error-ответы теперь отклоняются. SSE и бинарные обработчики не меняются.

## Установка и проверка

Нужен Bun 1.4.2: scoped overrides используют lockfileVersion 3.
`bun install --frozen-lockfile` автоматически применяет коммитируемый патч.
Все три Dockerfile копируют `patches/` до установки зависимостей.

`bun run test:security` проверяет лимиты и отмену чтения во всех трёх обработчиках
для ESM/CommonJS, границу 16 MiB, ошибки потока, обычный UTF-8 JSON, защиту от
prototype pollution, legacy partial JSON parsing Mastra, ANSI-ссылки и esbuild.
Проверки также прошли после установки в пустой временной директории.

## Результат сканирования и сопровождение

Повторный `cve-lite-cli` 2026-09-23: 0 Critical, 0 High, 0 Medium, **1 Low** —
`@ai-sdk/provider-utils@2.2.8`. Сканер сопоставляет версии из lockfile и не
проверяет установленный код или Bun-патчи. Версия пакета намеренно не изменена,
находка не скрывается. Это не «чистый» отчёт сканера: исправление данного дефекта
подтверждается регрессионными тестами, а отметка по версии остаётся.

Удалить backport после стабильного обновления Mastra client, устраняющего старую
зависимость, либо после появления совместимого исправленного provider-utils 2.x.
После обновления повторить `bun run test:security`, сборку и CVE-сканирование.
