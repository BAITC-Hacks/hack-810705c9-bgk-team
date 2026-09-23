# Деплой на сервер

Нужны Git, Bash и работающий Docker с Compose v2. Сборка выполняется в контейнерах.

## 1. Подготовьте проект

```bash
git clone https://github.com/BAITC-Hacks/hack-810705c9-bgk-team.git
cd hack-810705c9-bgk-team
cp .env.example .env
chmod 600 .env
```

В корневом `.env` задайте реальные значения вместо заглушек:

```dotenv
POSTGRES_USER=postgres
POSTGRES_PASSWORD=replace_with_secure_password
DB_NAME_NEXTJS=nextjs_db
DB_NAME_MASTRA=mastra_db
RUSTFS_ACCESS_KEY=replace_with_access_key
RUSTFS_SECRET_KEY=replace_with_secret_key
OPENAI_API_KEY=replace_with_openai_key
MASTRA_CHAT_AGENT_ID=grillAgent
```

Не добавляйте `.env` в Git. Для пароля PostgreSQL удобно использовать длинную
случайную строку из букв и цифр: Compose вставляет её в URL подключения без кодирования.

## 2. Запустите

```bash
./scripts/prod.sh
```

Скрипт поднимает PostgreSQL и RustFS, создаёт базы, применяет закоммиченные
миграции, собирает и запускает UI, Mastra и workers. Демо-данные этот скрипт
не добавляет автоматически.

Приложение: `http://IP_СЕРВЕРА:3000`.

```bash
# Состояние контейнеров
docker compose -f docker-compose.prod.yml ps

# Логи
docker compose -f docker-compose.prod.yml logs -f
```

Текущая версия использует демо-доступ без настоящей аутентификации.
До её внедрения ограничьте доступ к стенду. Compose публикует порты 3000 и 4111;
ограничьте их доступность сетевыми правилами сервера, Mastra (4111) не открывайте публично.
Домен и HTTPS настраиваются отдельно через reverse proxy.

## 3. Обновление и остановка

Перед обновлением сохраните резервную копию БД, если в ней есть нужные данные.

```bash
git pull --ff-only origin main
./scripts/prod.sh
```

Остановить стек с сохранением данных в Docker volumes:

```bash
docker compose -f docker-compose.prod.yml down
```

Не добавляйте `-v`, если нужно сохранить данные. Изменение пароля в `.env`
само по себе не меняет пароль уже созданной БД.
