# План P4 — Deployment подготовка (TD-1, TD-5, production docs)

**Type:** Improvement · **Фаза:** Deployment (§11) · **Бара одобрување** (§19.6 — staging/prod конфиг).
**Опсег:** Само **код/конфиг/докси** што јас можам да ги подготвам и верификувам. **НЕ** провизионирање на VPS, реални тајни, DNS или сертификати — тоа ги прави сопственикот на доверлива машина (§12/§19.6).

Постоечко: Dockerfiles (api/web/worker), `docker-compose.production.yml`, `scripts/deploy.sh`, `docs/deployment/staging.md`. Недостига: прод-резолвабилен `@gd/db` (TD-1), append-only DB привилегии (TD-5), `production.md`.

---

## PR 1 — TD-1: `@gd/db` прод build (dual exports)

**Проблем:** `packages/db/package.json` `main/exports` = `./src/index.ts`. tsup го остава `@gd/db` external во api/worker bundle → во runtime `node dist/index.js` увезува `.ts` → **паѓа во прод**.
**Решба:**

- Додади build за `@gd/db` (tsup или `tsc`) што емитира `dist/index.js` (+ d.ts) од `src/index.ts` (кој re-export-ира `generated/client`). Prisma client НЕ се bundle-ира (external) — се копира како што е.
- Conditional exports: `{ "development": "./src/index.ts", "default": "./dist/index.js" }` + `main: dist`, `types: dist`. Dev (tsx/vite) продолжува со src преку `development` условот; прод (node) користи dist.
- `build` скрипта: `prisma generate && tsup` (или tsc). Dockerfile (api/worker build stage): додади `pnpm --filter @gd/db build`.
- **Верификација:** `pnpm --filter @gd/db build` → постои `dist/index.js`; `node -e "require('@gd/db')"` резолвира; `pnpm --filter @gd/api build` + smoke на bundled dist (import не паѓа). Dev серверите + сите тестови остануваат зелени (development услов).
  **Ризик:** среден (пакување). Rollback = revert; dev не зависи од dist.

## PR 2 — TD-5: append-only преку DB привилегии

**Проблем:** EventLog/MetricSnapshot/Revision/Approval се „append-only" само во код. §И6 бара DB-ниво.
**Решба:**

- Миграција/иницијал SQL: `REVOKE UPDATE, DELETE ON <tables> FROM <app_role>` — но само ако app role ≠ owner. Во `docker-compose.production.yml` + `production.md`: создади **апликациски DB role** (не owner) што апликацијата го користи (`DATABASE_URL`), додека миграциите ги вози owner role (посебен `MIGRATE_DATABASE_URL` или одделен чекор).
- Guard: SQL е идемпотентен и no-op во dev (единствен owner role — `REVOKE` нема ефект, како што вели TD-5).
- **Верификација:** во staging со two-role setup — app role не може `UPDATE/DELETE` на тие табели (integration smoke). Во dev: миграцијата поминува без ефект.
  **Ризик:** среден. Rollback = revert миграција + врати привилегии.
  **Напомена:** бара одлука за `MIGRATE_DATABASE_URL` (owner) vs `DATABASE_URL` (app) — ADR-мала.

## PR 3 — `docs/deployment/production.md` + HTTPS

- Чекор-по-чекор прод deploy (огледало на staging.md): secrets (`.env.production` само на VPS, никогаш committed), `deploy.sh production`, backup→migrate→health→rollback.
- **HTTPS**: Nginx + Let's Encrypt/Certbot (документирано; сертификатите ги вади сопственикот). Local = HTTP, staging/prod = HTTPS (§11).
- Secrets чеклиста (§12): сите `TWILIO_*`, `META_*`, `JWT_*`, R2, `ANTHROPIC_API_KEY`, `VOYAGE_API_KEY`, `CRON_SECRET` — имиња, не вредности.
- Review на `deploy.sh` + `docker-compose.production.yml` за конзистентност со two-role DB.

## Што НЕ е во опсег (сопственикот, на доверлива машина)

VPS провизионирање, реални вредности на тајни, DNS/домен, издавање TLS сертификати, прв прод `deploy.sh production`.

## Испорака

3 последователни PR-а (TD-1 → TD-5 → docs). Секој со верификација/тестови каде е применливо; зелена CI.
