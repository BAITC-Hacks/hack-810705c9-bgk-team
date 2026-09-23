# AI-Sana — Мэтч задач

Платформа для бизнеса и студенческих команд. AI помогает уточнить задачу,
система оценивает её готовность и рекомендует проекты командам.
Отклики, выбор команды и приёмка результатов по этапам — в одном месте.

## Запуск

Нужны Node.js ≥24, Bun 1.4.2 и запущенный Docker с Compose.

```bash
git clone https://github.com/BAITC-Hacks/hack-810705c9-bgk-team.git
cd hack-810705c9-bgk-team
./start.sh
```

Приложение: http://localhost:3000 · Mastra: http://localhost:4111

Для AI добавьте `OPENAI_API_KEY` в корневой `.env` и перезапустите проект.
Остановка — `Ctrl+C`. Диагностика запуска — `./doctor.sh`.

Подробнее: [QUICKSTART.md](QUICKSTART.md). Демо работает без настоящей аутентификации.
