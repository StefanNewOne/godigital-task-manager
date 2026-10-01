# Deploy — Production (VPS)

Самостоен Docker стек со автоматски HTTPS (Caddy + Let's Encrypt). Тајните се во `.env.production`
(**никогаш committed** — §12). Продукција = гранка **`main`** (само преку Release PR, §10).

> Прво верификувај на staging (`docs/deployment/staging.md`) — Release PR кон `main` оди само по
> стабилен staging (Gate 2, §10).

## 0. Предуслови (еднократно на VPS)

- Ubuntu 22.04+ VPS, отворени порти **80** и **443**.
- Docker + Compose plugin: `curl -fsSL https://get.docker.com | sh`
- **DNS**: A запис `<домен>` (и по потреба `www`) → јавното IP на VPS (потребно за Let's Encrypt).
- Git пристап (deploy key/token).

## 1. Клонирај + конфигурирај

```bash
git clone <repo> godigital && cd godigital
git checkout main                     # production = main гранка
cp .env.production.example .env.production   # ако нема example — копирај од .env.example
nano .env.production                  # пополни СЀ (домен, тајни, провајдери)
```

Генерирај тајни: `openssl rand -base64 48` (JWT/CRON/лозинки). VAPID: `node -e "console.log(require('web-push').generateVAPIDKeys())"`.

## 2. База — two-role setup (TD-5, append-only §И6)

Апликацијата се поврзува како **`gd_app`** (без `UPDATE/DELETE` на append-only табелите), а миграциите
ги вози **owner** role-от. Во `.env.production`:

```
POSTGRES_USER=gd_owner            # owner (migrate)
POSTGRES_PASSWORD=__smeni__
POSTGRES_DB=godigital
APP_DB_PASSWORD=__smeni__         # лозинка за gd_app (bootstrap при прва иницијализација)
DATABASE_URL=postgresql://gd_app:__APP_DB_PASSWORD__@postgres:5432/godigital?schema=public
MIGRATE_DATABASE_URL=postgresql://gd_owner:__POSTGRES_PASSWORD__@postgres:5432/godigital?schema=public
```

- **Прва иницијализација:** `docker/postgres-init/01-app-role.sh` автоматски го создава `gd_app` + grants.
- **Постоечка база** (не прва иницијализација): создади го role-от рачно како owner:
  ```sql
  CREATE ROLE gd_app LOGIN PASSWORD '...';
  GRANT CONNECT ON DATABASE godigital TO gd_app;
  GRANT USAGE ON SCHEMA public TO gd_app;
  GRANT SELECT, INSERT, UPDATE, DELETE ON ALL TABLES IN SCHEMA public TO gd_app;
  GRANT USAGE, SELECT ON ALL SEQUENCES IN SCHEMA public TO gd_app;
  ALTER DEFAULT PRIVILEGES IN SCHEMA public GRANT SELECT, INSERT, UPDATE, DELETE ON TABLES TO gd_app;
  ```
  `deploy.sh` потоа ја применува миграцијата `append_only_revoke` (како owner) која ги REVOKE-ира
  `UPDATE/DELETE` на `EventLog/MetricSnapshot/Revision/Approval` од `gd_app`.

## 3. Claude CLI токен (ако `CLAUDE_MODE=cli`)

```bash
docker compose -f docker-compose.production.yml --env-file .env.production build api
docker compose -f docker-compose.production.yml --env-file .env.production run --rm api claude setup-token
```

Копирај го токенот во `.env.production` (`CLAUDE_CODE_OAUTH_TOKEN=...`). Инаку `CLAUDE_MODE=stub`.

## 4. Deploy

```bash
./scripts/deploy.sh production
```

Скриптата: backup DB → build → `prisma migrate deploy` (**како owner** преку `MIGRATE_DATABASE_URL`) →
up → health. Caddy вади TLS сертификат за доменот при првото барање (~30s).

## 5. Seed (прв пат)

```bash
COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.production"
$COMPOSE run --rm api pnpm --filter @gd/db seed        # вработени/улоги; БЕЗ demo во прод
```

Смени ги dev лозинките на вработените по првата најава.

## 6. Верификација

- `https://<домен>` се отвора (валиден TLS).
- Најава, тек по статус, аларми/email.
- `$COMPOSE ps` — сите healthy. Логови: `$COMPOSE logs -f api`.
- **TD-5 smoke:** `gd_app` не може `UPDATE/DELETE` на append-only табелите (очекувано `permission denied`).

## 7. Ажурирање (следни deploy-и)

```bash
git checkout main && git pull && ./scripts/deploy.sh production
```

## Rollback

- Миграциите се backwards-compatible; при проблем: `git checkout <претходен таг>` + `./scripts/deploy.sh production`.
- Backup од базата: `backups/production-*.sql` (пред секој deploy) → `psql < backup.sql` по потреба.

## Secrets чеклиста (§12 — имиња, НЕ вредности; само во `.env.production` на VPS)

`JWT_ACCESS_SECRET`, `JWT_REFRESH_SECRET`, `CRON_SECRET`, `POSTGRES_PASSWORD`, `APP_DB_PASSWORD`,
`DATABASE_URL`, `MIGRATE_DATABASE_URL`, `R2_*` (Cloudflare R2 за прод, не MinIO), `SMTP_*` (вистински SMTP,
не Mailhog), `TWILIO_ACCOUNT_SID/AUTH_TOKEN/FROM` (SMS, O-B1), `META_*`, `ANTHROPIC_API_KEY` /
`CLAUDE_CODE_OAUTH_TOKEN`, `VOYAGE_API_KEY`, `VAPID_*`. Ниедна не оди во git/docs/PR.

## Разлики од staging

- Гранка `main`; `.env.production`; вистински домен.
- Storage = **Cloudflare R2** (не MinIO); Email = **вистински SMTP** (не Mailhog).
- База = **two-role** (gd_app + owner, TD-5); staging може single-role.
- Без `demo-seed`.
