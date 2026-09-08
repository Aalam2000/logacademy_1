#!/usr/bin/env bash
set -euo pipefail

BRANCH="${1:-main}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

cd "$PROJECT_DIR"

echo "[deploy] branch: $BRANCH"
echo "[deploy] project dir: $PROJECT_DIR"

git fetch origin
git reset --hard "origin/$BRANCH"

docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --remove-orphans

echo "[deploy] running containers"
docker compose --env-file .env.prod -f docker-compose.prod.yml ps

echo "[deploy] current revision"
git rev-parse --short HEAD

echo "[deploy] cleanup unused docker images/build cache"
docker image prune -af
docker builder prune -af

echo "[deploy] done"
