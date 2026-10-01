#!/usr/bin/env bash
# Deploy на VPS (CLAUDE.md §11): backup → pull → build → migrate → up → health.
# Употреба (НА VPS, од коренот на repo-то):  ./scripts/deploy.sh staging
set -euo pipefail

ENVN="${1:-staging}"
# env_file во compose се интерполира преку ENV_FILE → контејнерите ја добиваат вистинската околина
# (.env.staging vs .env.production), не хардкодирано staging.
export ENV_FILE=".env.${ENVN}"
COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.${ENVN}"
cd "$(dirname "$0")/.."

if [ ! -f ".env.${ENVN}" ]; then
  echo "❌ Недостасува .env.${ENVN} (тајните не се committed)."; exit 1
fi
# НЕ source-ираме (вредности како SMTP_FROM со < > би скршиле bash); земаме само што треба.
val() { grep -E "^$1=" ".env.${ENVN}" | head -1 | cut -d= -f2-; }
STAGING_DOMAIN="$(val STAGING_DOMAIN)"
POSTGRES_USER="$(val POSTGRES_USER)"
POSTGRES_DB="$(val POSTGRES_DB)"

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

echo "→ (5/6) Prisma migrate deploy (TD-5: как owner, не gd_app)"
# Миграциите мора да ги вози OWNER role-от (DDL + REVOKE), не апликацискиот gd_app.
# Ако е поставен MIGRATE_DATABASE_URL, го користиме за овој чекор; инаку DATABASE_URL (dev/single-role).
MIGRATE_URL="$(val MIGRATE_DATABASE_URL)"
if [ -n "${MIGRATE_URL}" ]; then
  $COMPOSE run --rm -e DATABASE_URL="${MIGRATE_URL}" api pnpm --filter @gd/db exec prisma migrate deploy
else
  $COMPOSE run --rm api pnpm --filter @gd/db exec prisma migrate deploy
fi

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
