# План — Фаза B2: Meta метрики + Аналитика

Верзија 1.0 · 2026-09-24 · Статус: **предлог (чека одобрување)**

Извор: PRD_v3 §4.7 (метрики), §4.8 (објава/resolve), §11 B2, implementation-plan.md §4 (B2), backlog §2 (O-B2a, O-B2b), §3 (H9, H10).

**Цел:** реални Meta метрики течат во `MetricSnapshot`, Аналитика екранот прикажува живи бројки, Аналитичарот работи со кампањи/промоции, и се генерира месечен извештај + CSV.

**Клучен принцип за да не сме блокирани:** сите надворешни Graph API повици одат зад **`MetaClient` адаптер**. Во dev (без credentials) се користи детерминистички **stub** што враќа примерок insights → целиот пајплајн (pull → snapshot → analytics → екран) работи и се тестира сега. Кога ќе стигнат вистински credentials, само се вклучува реалниот адаптер — без пренапишување.

---

## Отворени прашања (се решаваат пред/во B2)

- **O-B2a — кои Meta метрики + мапирање.** Шемата на `MetricSnapshot` веќе ги фиксира 8-те полиња: `reach, impressions, views, engagement, spend, cpr, ctr, frequency`, а `@gd/core` `normalizeMetaInsights`/`deriveMetrics` веќе ги мапираат (со синоними) и тестирани се. **Провизорно = финализирано во шемата;** потребна само потврда.
- **O-B2b — ads decision прагови** (кога реел/карусел влегува во decision queue). Влијае само на **авто-предлог** во промоција одлуката. План: B2.4 гради **рачна** одлука (органско/платено) веднаш; авто-предлогот по праг е тенок додаток гатиран од системско правило (како аларм-от, D-13) — се додава кога прагот ќе се потврди. **Не блокира.**

---

## Под-единици (по ред, секоја со тест и посебен commit)

### B2.1 — MetaClient адаптер + `metrics.pull` + `publication.resolve`

- `apps/api/src/services/meta/metaClient.ts` — интерфејс `MetaClient { resolveMediaId(pub), fetchMediaInsights(mediaId), fetchAdInsights(campaignId) }`.
- `metaClient.stub.ts` — детерминистички dev stub (без мрежа; бројки изведени од `externalRef`/id за стабилност).
- `metaClient.graph.ts` — реален Graph API (gated на `META_APP_SECRET` + per-client `metaAdAccountId/metaPageId/metaIgId`); шифриран токен (AES-GCM, §9.2). Фабрика бира stub/graph по присуство на credentials.
- `publication.resolve` (PRD §4.8): endpoint + worker cron → пополни `Publication.metaMediaId` од `externalRef`.
- `metrics.pull`: worker cron (на 6ч) → `/api/cron/metrics-pull` → за секоја објавена `Publication` (и активна `Campaign`) земи insights → `normalizeMetaInsights`+`deriveMetrics` (core) → **append** `MetricSnapshot` (append-only, време-серија). `raw` го чува целиот одговор.
- Env: додади опциони `META_*` во `env.ts` + `.env.example` (dev без нив → stub).
- Тест: pull со stub создава snapshots; resolve пополнува `metaMediaId`; append-only се почитува.

### B2.2 — `/analytics` агрегација (backend)

- `GET /analytics?month&clientId?` → од **последниот** snapshot по публикација/кампања во месецот: KPI-и (reach, impressions, views, engagement, spend, cpr, ctr, објави), per-campaign роллап, топ објави. Role-scoped (Аналитичар/Директор; Режисер = само видео).
- Тест: агрегација од сеани snapshots дава очекувани збирови.

### B2.3 — Аналитика екран (реално врзување)

- `apps/web/src/screens/Analytics.tsx`: замени ги хардкодираните `KPIS/CAMPAIGNS/TOP_POSTS` со `/analytics` податоци преку hook. **Распоредот останува ист** (финален). Празна состојба кога нема податоци. Демо-банерот се тргнува кога има реални бројки.
- Тест: екранот рендерира од mock `/analytics`.

### B2.4 — Кампањи + Промоции UI (H9)

- Campaign CRUD endpoints + hooks + Аналитичар работна зона: форма (име, objective, буџет, период) + листа.
- Промоција одлука (органско/платено) по публикација → врзи со кампања (endpoint веќе постои); UI за одлуката. Авто-предлог по праг = подоцна (O-B2b).
- Тест: create кампања, донеси промоција одлука.

### B2.5 — Извештај по клиент и месец (H10) + CSV

- `GET /reports/clients?month` → по клиент: покриеност, објавени, метрики роллап. CSV export (сервер или клиент).
- Екран Админ → Извештаи (или од Аналитика) со табела + „Преземи CSV".
- Тест: извештај враќа очекувани редови; CSV колони точни.

---

## Инваријанти/ризици

- `MetricSnapshot` е **append-only** (§И6) — само `create`, никогаш update/delete. Време-серија; агрегацијата зема најнов по објект.
- Meta токен **шифриран** (§9.2, AES-GCM, клуч во env); никогаш на frontend (§2 AI/Meta правило).
- Decimal во база, `number` во core, конверзија на работ (§И3/§14).
- Без реални credentials во dev → stub; **никогаш** hardcoded Meta таен (§12).
- tenant scope на сите нови queries (§И1).

## DoD (gate B2)

Месечен извештај излегува од системот; Аналитика прикажува живи бројки (stub во dev, реални во прод); PRD §18 „Meta" редови зелени; `metrics.pull` идемпотентно додава snapshots.
