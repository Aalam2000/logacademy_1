# Deployment Guide

## 1) Server-side Postgres and MinIO (outside app compose)

### 1.1 Postgres service
- Install Postgres on prod host using OS packages.
- Data directory: `/var/lib/postgresql/<version>/main` (default package path).
- Autostart and restart policy:
  - Enable default service: `sudo systemctl enable --now postgresql`
  - Apply restart policy from `deploy/systemd/postgresql.override.conf`:
    - `sudo systemctl edit postgresql`
    - paste content from file and save
    - `sudo systemctl daemon-reload`
    - `sudo systemctl restart postgresql`

#### Network settings (required)
- In `postgresql.conf` set:
  - `listen_addresses = '127.0.0.1,<PROD_PRIVATE_IP>'`
  - `port = 5432`
- In `pg_hba.conf` allow app access from host/private docker network only, for example:
  - `host all all 127.0.0.1/32 scram-sha-256`
  - `host all all <DOCKER_BRIDGE_CIDR> scram-sha-256`
- Reload config: `sudo systemctl reload postgresql`

### 1.2 MinIO service
- Create service user and directories:
  - `sudo useradd --system --home /var/lib/minio --shell /sbin/nologin minio`
  - `sudo mkdir -p /var/lib/minio/data /etc/minio`
  - `sudo chown -R minio:minio /var/lib/minio /etc/minio`
- Install binary to `/usr/local/bin/minio` and make it executable.
- Copy env template:
  - `sudo cp deploy/systemd/minio.env.example /etc/minio/minio.env`
  - set real values for `MINIO_ROOT_USER` and `MINIO_ROOT_PASSWORD`
- Install unit file:
  - `sudo cp deploy/systemd/minio.service /etc/systemd/system/minio.service`
  - `sudo systemctl daemon-reload`
  - `sudo systemctl enable --now minio`

#### Network settings (required)
- In `/etc/minio/minio.env`:
  - `MINIO_ADDRESS="0.0.0.0:9000"`
  - `MINIO_CONSOLE_ADDRESS="127.0.0.1:9001"`
- Open only port `9000` for app host/private network, keep `9001` local/admin-only.

### 1.3 Pre-deploy health checks
- Postgres service is active:
  - `systemctl is-active postgresql`
- Postgres accepts auth:
  - `PGPASSWORD='<password>' psql -h 127.0.0.1 -U <user> -d <db> -c 'select 1;'`
- MinIO service is active:
  - `systemctl is-active minio`
- MinIO API health:
  - `curl -fsS http://127.0.0.1:9000/minio/health/live`

> If any check fails, do not deploy app containers until fixed.

## 2) Environment files

- Prod:
  - `cp .env.prod.example .env.prod`
  - set real values for `DATABASE_URL`, `MINIO_*`, `REACT_APP_API_URL`
- Demo:
  - `cp .env.demo.example .env.demo`

## 3) Compose profiles

- Prod (external Postgres/MinIO on server):
  - `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build`
- Demo (local Postgres/MinIO in containers):
  - `docker compose --env-file .env.demo -f docker-compose.demo.yml up -d --build`

## 4) Production deploy from Git

- Script: `scripts/deploy-prod.sh`
- Usage:
  - `chmod +x scripts/deploy-prod.sh`
  - `./scripts/deploy-prod.sh main`
- The script does:
  - `git fetch origin`
  - `git reset --hard origin/<branch>`
  - `docker compose --env-file .env.prod -f docker-compose.prod.yml up -d --build --remove-orphans`
  - `docker image prune -af`
  - `docker builder prune -af`

## 5) Important warnings

- `git reset --hard` deletes all local uncommitted changes on server.
- Image cleanup keeps only images required by currently running containers.
