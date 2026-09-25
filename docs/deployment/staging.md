# Deploy — Staging (Hetzner VPS)

Самостоен Docker стек со автоматски HTTPS (Caddy + Let's Encrypt). Тајните се во `.env.staging`
(никогаш committed). AI = Claude преку CLI (претплата, headless токен).

## 0. Предуслови (еднократно на VPS)

- Ubuntu 22.04+ VPS на Hetzner, отворени порти **80** и **443**.
- Docker + Docker Compose plugin:
  ```bash
  curl -fsSL https://get.docker.com | sh
  ```
- **DNS**: A запис `staging.<домен>` → јавното IP на VPS (потребно за Let's Encrypt).
- Git пристап до repo-то (deploy key или token).

## 1. Клонирај + конфигурирај

```bash
git clone <repo> godigital && cd godigital
git checkout develop            # staging = develop гранка
cp .env.staging.example .env.staging
nano .env.staging               # пополни ги сите __smeni__ + домен + токени
```

Генерирај тајни:

```bash
openssl rand -base64 48   # за JWT_ACCESS_SECRET, JWT_REFRESH_SECRET, CRON_SECRET, лозинки
```

VAPID (за push) — од локалниот repo или:

```bash
node -e "console.log(require('web-push').generateVAPIDKeys())"
```

## 2. Claude CLI токен (за CLAUDE_MODE=cli)

Внатре во api контејнерот, еднократно, интерактивно:

```bash
docker compose -f docker-compose.production.yml --env-file .env.staging build api
docker compose -f docker-compose.production.yml --env-file .env.staging run --rm api claude setup-token
```

Копирај го издадениот токен во `.env.staging` како `CLAUDE_CODE_OAUTH_TOKEN=...`.
(Ако не сакаш AI сега → стави `CLAUDE_MODE=stub` и прескокни го овој чекор.)

## 3. Deploy

```bash
./scripts/deploy.sh staging
```

Скриптата: backup DB → build → `prisma migrate deploy` → up → health check.
Caddy автоматски вади TLS сертификат за доменот при првото барање (може да потрае ~30s).

## 4. Seed (прв пат)

```bash
COMPOSE="docker compose -f docker-compose.production.yml --env-file .env.staging"
$COMPOSE run --rm api pnpm --filter @gd/db seed        # вработени/улоги/клиенти
$COMPOSE run --rm api pnpm --filter @gd/db exec tsx prisma/demo-seed.ts   # демо месец (по потреба)
```

## 5. Верификација

- `https://staging.<домен>` се отвора (валиден TLS).
- Најава со seed корисник (пр. Директор), менување улоги, тек по статус.
- `$COMPOSE ps` — сите healthy. Логови: `$COMPOSE logs -f api`.

## 6. Ажурирање (следни deploy-и)

```bash
git pull && ./scripts/deploy.sh staging
```

## Rollback

- Миграциите се backwards-compatible; при проблем: `git checkout <претходен таг>` + `./scripts/deploy.sh staging`.
- Backup од базата е во `backups/staging-*.sql` (пред секој deploy).

## Забелешки

- Storage е MinIO во compose (staging). За продукција → Cloudflare R2 (смени ги `R2_*`).
- Email е Mailhog за staging; за прод → вистински SMTP.
- Claude CLI во контејнер е за интерна алатка; не е официјалниот прод пат (види ADR при потреба).
