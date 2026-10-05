#!/usr/bin/env bash
set -euo pipefail

# Всё тело — в функции, вызываемой последней строкой: bash читает функцию
# целиком до запуска, поэтому git reset, который подменяет этот же файл
# посреди выполнения, не сбивает работу скрипта.
COMPOSE="docker compose -f docker-compose.prod.yml"

# Ждёт, пока команда-проверка не выполнится успешно (раз в секунду, до N секунд).
# wait_ok <секунд> <команда...>
wait_ok() {
  local tries="$1"; shift
  local i
  for ((i = 1; i <= tries; i++)); do
    if "$@" >/dev/null 2>&1; then return 0; fi
    sleep 1
  done
  return 1
}

# Бэкенд отвечает сам (изнутри своего контейнера, мимо nginx)
check_backend() {
  $COMPOSE exec -T backend python -c \
    "import urllib.request; urllib.request.urlopen('http://127.0.0.1:8000/i18n/languages', timeout=3)"
}

# Вся цепочка через nginx: $1 — путь (/i18n/languages → backend, / → frontend)
check_via_nginx() {
  $COMPOSE exec -T nginx wget -q -T 3 -O /dev/null --header "Host: logacademy" "http://127.0.0.1$1"
}

deploy_failed() {
  echo "[deploy] FAILED: $1"
  echo "[deploy] последние строки лога backend:"
  $COMPOSE logs --tail 40 backend || true
  echo "[deploy] последние строки лога nginx:"
  $COMPOSE logs --tail 15 nginx || true
  exit 1
}

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

# Без «метки происхождения» (provenance) сборка без изменений даёт тот же
# образ. С ней каждая сборка создавала новую обёртку образа: имя
# quiz-backend:latest переезжало на неё, а работающий контейнер оставался на
# прежней — в списке контейнеров вместо имени образа показывался sha256:….
export BUILDX_NO_DEFAULT_ATTESTATIONS=1

$COMPOSE up -d --build --remove-orphans

# Ждём, пока бэкенд реально поднимется: миграции + старт uvicorn. «Up» в
# списке контейнеров значит только «процесс запущен», а не «сервер отвечает».
echo "[deploy] waiting for backend (до 60 с)"
wait_ok 60 check_backend || deploy_failed "backend не ответил за 60 секунд"

# nginx запоминает IP frontend/backend при старте. После пересоздания
# контейнеров у них новые IP → 502 (connection refused на старый адрес).
# reload заново резолвит имена сервисов и, в отличие от restart, не рвёт
# открытые соединения и не даёт секунды полного простоя. Если reload не
# удался (например, nginx не запущен) — по-старому перезапускаем.
echo "[deploy] reloading nginx (re-resolve frontend/backend)"
if ! $COMPOSE exec -T nginx nginx -s reload; then
  echo "[deploy] reload не удался — restart nginx"
  $COMPOSE restart nginx
fi

# Проверяем всю цепочку снаружи внутрь: nginx → backend и nginx → frontend
echo "[deploy] checking site through nginx"
wait_ok 20 check_via_nginx /i18n/languages || deploy_failed "nginx → backend не отвечает"
wait_ok 20 check_via_nginx /               || deploy_failed "nginx → frontend не отвечает"
echo "[deploy] site is up"

echo "[deploy] running containers"
$COMPOSE ps

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
