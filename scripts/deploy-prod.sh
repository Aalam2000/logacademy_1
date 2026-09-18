#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-master}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

cd "$PROJECT_DIR"

echo "[deploy] branch: $BRANCH"
echo "[deploy] project dir: $PROJECT_DIR"

git fetch origin
git reset --hard "origin/$BRANCH"

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
