---
sessionId: session-260908-181501-111n
---

# Requirements

### Overview & Goals
Подготовить прод-схему, где приложение (`backend` + `frontend`) деплоится в Docker, а `Postgres` и `MinIO` поднимаются на самом прод-сервере как **отдельные сервисы вне compose приложения** (не внутри контейнеров `app`). Добавить команду/скрипт для обновления кода из Git и перезапуска контейнеров, с политикой очистки образов: на сервере остаются только актуальные.

### Scope
#### In Scope
- Разделение конфигураций `dev/demo` и `prod`.
- Прод-конфиг без контейнеров `db`/`minio`.
- Подготовка server-side сервисов `Postgres` и `MinIO` (systemd/native или уже установленные) и проверка доступности с хоста.
- Настройка переменных окружения `DATABASE_URL` и `MINIO_*` для подключения к этим серверным сервисам.
- Скрипт деплоя в режиме `git fetch + reset --hard + docker compose up -d --build`.
- Автоочистка неиспользуемых образов после деплоя.

#### Out of Scope
- Миграция данных между старыми и новыми БД.
- Глубокий hardening ОС и сетевой инфраструктуры за пределами нужного для работы приложения минимума.
- Расширение бизнес-фич с файлами сверх инфраструктурной интеграции.

### Functional Requirements
- Прод-стек поднимается без контейнеров `db`/`minio` в compose приложения.
- На прод-сервере доступны запущенные сервисы `Postgres` и `MinIO` вне compose приложения.
- Бэкенд подключается к серверному Postgres через `DATABASE_URL`.
- Бэкенд получает рабочие параметры серверного MinIO (`endpoint`, `access key`, `secret`, `bucket`, `ssl`).
- Одна команда деплоя обновляет код и пересобирает/перезапускает контейнеры.
- После деплоя выполняется очистка Docker-образов, чтобы не копились старые.

# Technical Design

### Current Implementation
- Текущий `docker-compose.yml` (корень) — dev-ориентирован: сервис `db`, bind-mount'ы, `frontend` с `npm start`, `backend` с `--reload`.
- В `backend/app/database.py` подключение к БД идет через `DATABASE_URL` (по умолчанию на `db:5432`).
- MinIO в коде пока не реализован как рабочий storage-слой (есть только пометка в `backend/app/models.py` для `photo_url`).
- Прод-файл в `tmp/files/docker-compose.yml` повторяет dev-паттерн и тоже включает контейнер `db`.

### Key Decisions
- Прод: `Postgres` и `MinIO` запускаются на сервере как отдельные сервисы вне compose приложения; в compose остаются только `backend` и `frontend`.
- Деплой: «жесткий sync» (`fetch + reset --hard`) для предсказуемого состояния сервера.
- Очистка: после каждого деплоя удаляются все неиспользуемые образы/кеши, оставляя только актуальные контейнеры.

### Proposed Changes
- Ввести отдельный `docker-compose.prod.yml`:
  - убрать `db` и dev bind-mount'ы;
  - задать restart policy и env-файлы для прода;
  - для `frontend` использовать production-сборку/serve, а не `npm start`.
- Добавить инструкции/юниты для запуска `Postgres` и `MinIO` на прод-сервере вне compose приложения (либо зафиксировать подключение к уже поднятым сервисам), включая порты, директории данных и автозапуск.
- Ввести отдельный compose для demo (например, `docker-compose.demo.yml`) с локальными `postgres` и `minio` контейнерами.
- Добавить шаблоны env для прода:
  - `DATABASE_URL` (Postgres на сервере);
  - `MINIO_ENDPOINT`, `MINIO_ACCESS_KEY`, `MINIO_SECRET_KEY`, `MINIO_BUCKET`, `MINIO_SECURE` (MinIO на сервере).
- Добавить deploy-скрипт (например, `scripts/deploy-prod.sh`):
  - `git fetch`;
  - `git reset --hard origin/<branch>`;
  - `docker compose -f docker-compose.prod.yml up -d --build --remove-orphans`;
  - `docker image prune -af` и `docker builder prune -af`.
- Документировать запуск/обновление в отдельном `README` для прода.

### File Structure
- Новый: `docker-compose.prod.yml`
- Новый: `docker-compose.demo.yml` (или dev-эквивалент для локального демо)
- Новый: `scripts/deploy-prod.sh`
- Новый/обновленный: `.env.prod.example`, `.env.demo.example`
- Обновление: `backend/Dockerfile` (production command без `--reload`)
- Обновление: `frontend/Dockerfile` (production serve/static)
- Новый: `DEPLOYMENT.md` (инструкции)

### Risks
- Неверные сетевые ACL/Firewall/Bind-address для серверных Postgres/MinIO.
- `reset --hard` удаляет локальные изменения на прод-сервере.
- Агрессивная очистка образов увеличит время следующей пересборки (компромисс ради экономии диска).

# Testing

### Validation Approach
- Поднять/проверить серверные `Postgres` и `MinIO`, затем запустить `docker-compose.prod.yml` и проверить успешный старт `backend`/`frontend`.
- Выполнить deploy-скрипт на тестовом стенде дважды подряд и убедиться в идемпотентности.
- Проверить, что после очистки остаются только образы, связанные с текущими контейнерами.

### Key Scenarios
- Прод-стек стартует без `db`/`minio` контейнеров в compose приложения.
- `backend` подключается к серверному Postgres по `DATABASE_URL`.
- Переменные MinIO корректно подхватываются процессом backend и указывают на серверный MinIO.
- Команда деплоя обновляет код до целевой ревизии и перезапускает сервисы.

### Edge Cases
- Недоступен серверный Postgres: backend падает с явной ошибкой подключения.
- Неверные MinIO credentials: backend логирует ошибку и не стартует storage-клиент (по выбранной политике fail-fast/fail-safe).
- Повторный запуск deploy-скрипта не ломает состояние контейнеров.

# Delivery Steps

### ✓ Step 1: Исправить локально 2 env и 2 compose и удалить старые файлы
Результат: локальная схема `dev/prod` подготовлена, старые `demo`/legacy файлы удалены.
- Создать/использовать `docker-compose.dev.yml` для локального запуска с `postgres` и `minio` контейнерами.
- Обновить `docker-compose.prod.yml` под запуск только приложения с внешними сервисами.
- Использовать `.env.dev.example` и `.env.prod.example` как шаблоны, без реальных секретов.
- Удалить старые файлы `docker-compose.yml`, `docker-compose.demo.yml`, `.env.demo.example`.

### ✓ Step 2: Поднять и проверить Postgres и MinIO на прод-сервере вне compose приложения
Результат: на прод-хосте работают отдельные сервисы `Postgres` и `MinIO` с автозапуском и доступом для backend.
- Добавить операционные артефакты/инструкции для server-side запуска `Postgres` и `MinIO` (systemd/native), включая каталоги данных и restart policy.
- Зафиксировать сетевые параметры (`bind`, порты, доступы), чтобы `backend` мог подключаться локально/по приватной сети.
- Описать минимальные проверки здоровья сервисов перед деплоем приложения.

### ✓ Step 3: Настроить `.env.dev` и `.env.prod` с ручным переносом и исключить их из Git
Результат: локальный и прод env разделены, реальные env не попадают в репозиторий.
- Добавить/проверить `.gitignore` для `.env.dev` и `.env.prod`.
- Оставить в репозитории только шаблоны `.env.dev.example` и `.env.prod.example`.
- Зафиксировать в документации, что перенос `.env.*` на сервер выполняется только вручную.

### ✓ Step 4: Добавить/проверить прод-команду деплоя из Git и очистку образов
Результат: одна команда обновляет прод до последнего кода, перезапускает контейнеры и оставляет только актуальные образы.
- Добавить `scripts/deploy-prod.sh` с шагами `git fetch`, `git reset --hard origin/<branch>`, `docker compose -f docker-compose.prod.yml up -d --build --remove-orphans`.
- В конец deploy-скрипта добавить очистку `docker image prune -af` и `docker builder prune -af`.
- Описать в `DEPLOYMENT.md` полный цикл: запуск серверных Postgres/MinIO, деплой приложения, предупреждения о `reset --hard`.