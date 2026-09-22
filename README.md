# GoDigital Task Manager

Интерен таск-менаџер за GoDigital — следи видео и графика од месечно планирање до аналитика.

- **Мозок на проектот:** [`CLAUDE.md`](./CLAUDE.md) — правила, инваријанти, конвенции.
- **Извор на вистина (логика):** [`PRD_v3_Revizija_i_Specifikacija.md`](./PRD_v3_Revizija_i_Specifikacija.md)
- **Дизајн:** [`design_handoff_godigital_task_manager/`](./design_handoff_godigital_task_manager)
- **План:** [`docs/plans/implementation-plan.md`](./docs/plans/implementation-plan.md) · **Backlog:** [`docs/backlog.md`](./docs/backlog.md)

## Стек

pnpm + Turborepo монорепо. React 19 + Vite + Tailwind 4 (web) · Express 5 + Prisma + PostgreSQL 16 + pgvector + Redis + BullMQ (backend) · Cloudflare R2 · Socket.io.

```
apps/     web · api · worker
packages/ core (домен, 100% тестови) · db (Prisma) · ui (токени + i18n)
```

## Локален setup

Барања: Node ≥ 22, pnpm 11, Docker.

```bash
pnpm install                 # инсталира сè, генерира Prisma client
cp .env.example .env.local   # пополни ги вредностите
docker compose up -d         # postgres+pgvector, redis, minio, mailhog
pnpm dev                     # api (:3001) + web (:5173) + worker
```

MinIO конзола: http://localhost:9101 · Mailhog: http://localhost:8135

> Портовите се нестандардни (Postgres 5532, Redis 6479, MinIO 9100/9101, Mailhog 1135/8135) за да коегзистира со другите локални Docker стекови.

## Скрипти (root)

```bash
pnpm dev         # сите апликации (turbo)
pnpm build       # build на сè
pnpm test        # тестови (core = 100% покриеност)
pnpm typecheck   # tsc --noEmit на сите пакети
pnpm lint        # ESLint
pnpm format      # Prettier
pnpm db:deploy   # примени миграции (prisma migrate deploy)
pnpm db:seed     # seed податоци (9 вработени, 6 клиенти; dev лозинка gd-devpass-2026)
pnpm db:setup    # deploy + seed
pnpm commit      # воден Conventional Commit prompt
```

### Интеграциски тестови (бараат жив Postgres + env)

Одвоени од `pnpm test` (не паѓаат во CI без база). Пуштање:

```bash
DATABASE_URL="postgresql://gd:gd@localhost:5532/godigital?schema=public" \
REDIS_URL="redis://localhost:6479" \
JWT_ACCESS_SECRET="dev-access-secret-min16" JWT_REFRESH_SECRET="dev-refresh-secret-min16" \
NODE_ENV=test pnpm --filter @gd/api test:integration
```

Покриваат: auth, RBAC (403), tenant scope, валидација, и A2 слот тек (generate → confirm → мртви таскови + автоматска капа).

## Работен тек

Гранки: `main` (прод) · `develop` (staging) · `feature/*`. Без Jira — работата е во `docs/backlog.md`. Детали: `CLAUDE.md §10`.
