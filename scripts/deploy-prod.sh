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

docker compose -f docker-compose.prod.yml up -d --build --remove-orphans

echo "[deploy] running containers"
docker compose -f docker-compose.prod.yml ps

echo "[deploy] current revision"
git rev-parse --short HEAD

echo "[deploy] cleanup: dangling-образы, осиротевшие volume, build cache старше недели"
docker image prune -f
docker volume prune -f
docker builder prune -f --filter "until=168h"

echo "[deploy] done"
