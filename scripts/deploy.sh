#!/usr/bin/env bash
# Deploy на VPS (CLAUDE.md §11): backup → pull → build → migrate → up → health.
# Употреба (НА VPS, од коренот на repo-то):  ./scripts/deploy.sh staging
set -euo pipefail

ENVN="${1:-staging}"
COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.${ENVN}"
cd "$(dirname "$0")/.."

if [ ! -f ".env.${ENVN}" ]; then
  echo "❌ Недостасува .env.${ENVN} (тајните не се committed)."; exit 1
fi
# shellcheck disable=SC1090
set -a; . "./.env.${ENVN}"; set +a

echo "→ (1/6) Git pull"
git pull --ff-only

echo "→ (2/6) Backup на база (ако постои)"
mkdir -p backups
if $COMPOSE ps postgres 2>/dev/null | grep -q Up; then
  $COMPOSE exec -T postgres pg_dump -U "${POSTGRES_USER}" "${POSTGRES_DB}" \
    > "backups/${ENVN}-$(date +%F-%H%M).sql" && echo "  backup зачуван"
else
  echo "  (базата не работи сè уште — прескокнато)"
fi

echo "→ (3/6) Build слики"
$COMPOSE build

echo "→ (4/6) Инфра (postgres/redis/minio)"
$COMPOSE up -d postgres redis minio minio-init

echo "→ (5/6) Prisma migrate deploy"
$COMPOSE run --rm api pnpm --filter @gd/db exec prisma migrate deploy

echo "→ (6/6) Подигни сè"
$COMPOSE up -d

echo "→ Health check (чекам api да стане healthy)…"
for i in $(seq 1 20); do
  if $COMPOSE ps api | grep -q "healthy"; then echo "✅ api healthy"; break; fi
  sleep 5
  if [ "$i" = "20" ]; then echo "⚠️  api не стана healthy навреме — провери логови."; fi
done

echo "✅ Deploy (${ENVN}) готов → https://${STAGING_DOMAIN}"
echo "   Логови: ${COMPOSE} logs -f api"
