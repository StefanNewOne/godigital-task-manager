# План — Мета: вистинско поврзување на клиенти (per-client Page/Ad/IG)

**Type:** Feature (Модул 3 · Мета, активација на вистински режим) · **Бара одобрување** (§22; надворешна интеграција, креденцијали, §19.6).
**Цел (одлука 2026-10-02):** секој клиент во системот да биде поврзан со Meta (вистински Page/Ad-account/IG ID) и да влече вистински податоци.

## Што веќе постои (не се гради повторно)

- `Client.metaPageId / metaAdAccountId / metaIgId` полиња; `MetaConnection` модел (kind=page/adAccount/ig, accessLevel, lastSync…).
- `GET /meta/accounts` (достапни страници + IG business), `GET /meta/ad-accounts` (достапни рекламни сметки) — за доделба по клиент.
- `POST /meta/clients/:id/backfill` (IG постови + кампањи + page метрики + pull).
- Sync worker: `metrics.pull`, `meta.connections`, `meta.structure`, `meta.inbox` (идемпотентни).
- `getMetaClient()` → вистински `GraphMetaClient` кога има `META_SYSTEM_TOKEN`, инаку stub.

## Што се гради

### apps/web — Админ → Клиенти (Уреди), Meta секција

- Поле за доделба на **metaPageId** (избор од `GET /meta/accounts`), **metaAdAccountId** (од `GET /meta/ad-accounts`), **metaIgId**. Само Директор (§4.1 „уредува само Директор").
- Статус на врската по клиент (поврзан / последен sync / грешка) од `MetaConnection`.
- Копче по клиент: **„Поврзи / Синхронизирај"** → validate + create/update `MetaConnection` + backfill.

### apps/api

- (Ако недостасува) прошири `clientUpdateSchema` + сервис да прифати `metaPageId/metaAdAccountId/metaIgId` (валидирано; само dir).
- `POST /meta/connect-all` (dir): за сите активни клиенти со доделен ID → создади/освежи `MetaConnection` + backfill. Идемпотентно, best-effort по клиент (грешката на еден не паѓа цел), врати резиме. (Барањето „секој клиент поврзан".)
- Validate при доделба: `getMetaClient().debugToken` / fetch page — потврди дека ID-то е достапно со токенот (во stub секогаш ок).

### Креденцијали / одлуки (сопственикот обезбедува, §12 — јас референцирам имиња)

- `META_SYSTEM_TOKEN` (+ `META_APP_SECRET`) во env (staging/prod secrets).
- Вистински **Page ID / Ad-account ID / IG business ID** по клиент (или мапирање на примерните клиенти кон вистински страници што ги контролираш).
- Meta app со дозволи: `pages_read_engagement`, `pages_show_list`, `instagram_basic`, `instagram_manage_insights`, `ads_read`, `read_insights` + **app review** за live.
- O-D10/O-B2a прагови и мапирање метрики (веќе во backlog).

## Тестови

- Integration (stub): доделба на metaPageId/adAccount по клиент; `connect-all` создава `MetaConnection` за сите со ID + backfill; дозволи (само dir).
- Без вистински Graph повици во тест (stub детерминистички).

## Rollback / Risk

- Адитивно (нова секција + endpoint). Rollback = revert. Ризик: среден (надворешна зависност) — митигиран со stub default, best-effort по клиент, validate пред connect. Вистински режим се вклучува со `META_SYSTEM_TOKEN` + вистински ID-а на staging прво.
- `workflow-change`: НЕ.
