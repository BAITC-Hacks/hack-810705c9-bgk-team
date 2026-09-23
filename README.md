# AI-Sana — Мэтч задач

Платформа, где бизнес формулирует задачи, а студенческие команды находят проекты.
Помощник уточняет описание, система рассчитывает готовность задачи и подбирает
команды. После отклика участники согласуют работу и принимают результаты по этапам.

Команда: **BGK-TEAM**.

## Быстрый запуск

Нужны **Node.js ≥24**, **Bun 1.4.2** и запущенный **Docker с Compose**.

```bash
git clone https://github.com/BAITC-Hacks/hack-810705c9-bgk-team.git
cd hack-810705c9-bgk-team
./start.sh
```

Скрипт установит зависимости, поднимет PostgreSQL и RustFS, применит миграции
и запустит приложения.

- Приложение: http://localhost:3000
- Mastra: http://localhost:4111
- Хранилище RustFS: http://localhost:9001

Для AI добавьте `OPENAI_API_KEY` в корневой `.env` и перезапустите проект.
`Ctrl+C` остановит сервисы; данные БД сохранятся. Если запуск не удался — `./doctor.sh`.
Подробнее: [QUICKSTART.md](QUICKSTART.md).

> Демо использует переключатель ролей без настоящей аутентификации.
> Перед публичным развёртыванием его необходимо заменить.

## Структура

| Каталог | Назначение |
| --- | --- |
| `apps/presentation-layer` | Next.js: интерфейс, BFF и бизнес-данные через Drizzle |
| `apps/ai-logic-layer` | Mastra: AI-агенты и workflows |
| `apps/workers` | Фоновые задачи через pg-boss |

Стек: Bun, Turborepo, Next.js, React, Tailwind, shadcn/ui, Mastra и PostgreSQL.
Бизнес-данные хранятся в `nextjs_db`, данные Mastra и очередей — в `mastra_db`.

## Документация

- [Запуск и настройка](QUICKSTART.md)
- [Архитектура и границы модулей](docs/ARCHITECTURE.md)
- [Требования MVP](docs/TASK_MATCH_MVP_SPEC.md)
- [Сценарии и AI-контракты](docs/TASK_MATCH_PLATFORM.md)
- [Архитектурные решения](docs/adr/README.md)
- [Правила работы в репозитории](AGENTS.md)
