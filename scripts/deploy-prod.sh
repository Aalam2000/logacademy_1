#!/usr/bin/env bash
set -euo pipefail

# Всё тело — в функции, вызываемой последней строкой: bash читает функцию
# целиком до запуска, поэтому git reset, который подменяет этот же файл
# посреди выполнения, не сбивает работу скрипта.
main() {
BRANCH="${1:-master}"
PROJECT_DIR="${PROJECT_DIR:-$(pwd)}"

cd "$PROJECT_DIR"

echo "[deploy] branch: $BRANCH"
echo "[deploy] project dir: $PROJECT_DIR"

git fetch origin
git reset --hard "origin/$BRANCH"

# Backend-контейнер работает под uid/gid того, кто деплоит (quizadm):
# файлы из git и файлы, которые пишет контейнер (translations, переводы
# инструкций в backend/templates/help), принадлежат одному пользователю —
# chmod/chown после git reset не нужны.
export APP_UID="$(id -u)"
export APP_GID="$(id -g)"
echo "[deploy] backend runs as uid=$APP_UID gid=$APP_GID ($(id -un))"

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

# Кэш сборки ограничиваем по РАЗМЕРУ, а не по возрасту: при частых выкатках
# фильтр "старше недели" ничего не удалял, и кэш дорос до 4+ ГБ.
# Лимит 6 ГБ: одна полная сборка занимает ~2,1 ГБ, и при лимите 2 ГБ очистка
# срабатывала на каждой выкатке и ломала кэш backend — следующая сборка шла
# с нуля (~275 с вместо секунд; проверено 2026-10-02). С запасом очистка
# срабатывает редко, обычная выкатка собирается из кэша.
# --reserved-space — новое имя опции (Docker 28+), --keep-storage — старое.
echo "[deploy] cleanup: dangling-образы, осиротевшие volume, build cache сверх 6 ГБ"
docker image prune -f
docker volume prune -f
docker builder prune -af --reserved-space 6gb 2>/dev/null \
  || docker builder prune -af --keep-storage 6gb

echo "[deploy] disk usage"
df -h /

echo "[deploy] done"
}

main "$@"; exit $?
