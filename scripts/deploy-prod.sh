#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-master}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

cd "$PROJECT_DIR"

echo "[deploy] branch: $BRANCH"
echo "[deploy] project dir: $PROJECT_DIR"

git fetch origin
git reset --hard "origin/$BRANCH"

# frontend/src читает backend-контейнер (autoi18n-сканер, appuser uid=1000) через
# ro bind-mount. git reset пересоздаёт файлы с правами по umask (обычно 640,
# без чтения для "остальных") — appuser не входит в группу владельца (quizadm),
# поэтому не может прочитать исходники и сканер молча ничего не находит.
# frontend/src не секрет — это исходники клиентского JS-бандла, и так уходят
# в браузер, поэтому даём "остальным" чтение без риска.
echo "[deploy] fixing read permissions on frontend/src (needed by autoi18n scanner in backend container)"
chmod -R o+rX frontend/src

# backend/templates/help подключена в backend томом: autoi18n читает
# инструкции (.md) и кладёт рядом их переводы (teacher.en.md и т.п.) —
# appuser нужно чтение исходников и запись в саму папку.
echo "[deploy] fixing permissions on backend/templates/help (autoi18n writes translated copies there)"
chmod -R o+rX backend/templates/help
chmod o+w backend/templates/help

docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

# nginx запоминает IP frontend/backend при старте. После пересоздания
# контейнеров у них новые IP → 502 (connection refused на старый адрес).
# Перезапуск nginx заново резолвит имена сервисов.
echo "[deploy] restarting nginx (re-resolve frontend/backend)"
docker compose -f docker-compose.prod.yml restart nginx

echo "[deploy] running containers"
docker compose -f docker-compose.prod.yml ps

echo "[deploy] current revision"
git rev-parse --short HEAD

echo "[deploy] cleanup: dangling-образы, осиротевшие volume, build cache старше недели"
docker image prune -f
docker volume prune -f
docker builder prune -f --filter "until=168h"

echo "[deploy] done"
