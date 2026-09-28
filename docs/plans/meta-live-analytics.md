# План: Meta live analytics (B2 довршување)

Статус: **ЗАВРШЕНО** (докажано со реален токен: Poskok.mk backfill → reach 110/210/305/466).
Цел: реални Meta insights во екранот Аналитика.

## Потврдено во живо (истражување)

- Токен: SYSTEM_USER, не истекува, scopes: instagram_basic, instagram_manage_insights,
  read_insights, ads_read, business_management, pages_show_list.
- Пристап до **68 IG business сметки** (клиентски). Insights течат (пр. reach 199 за reel).
- Јаз: `resolveMediaId` (IG) враќа shortcode наместо нумерички media id.

## Одлуки (сопственик)

1. Врска клиент↔сметка: **Admin dropdown** (листа од 68-те → метаIgId/metaPageId по клиент).
2. Извор на дата: **само објави преку апката + backfill** на постоечки постови од сметката.

## Архитектура

Аналитика групира преку `Publication → Task → client` + `task.group.monthKey`.
Backfill = постови без таск → `Publication` мора да поддржи **account-ниво** (директен `clientId`).

## Чекори

1. **DB**: `Publication.taskId` nullable + `Publication.clientId` (FK, nullable) +
   `Publication.publishedAt` (постои) + partial unique `(clientId, platform, externalRef)`
   за backfill (task-објавите остануваат на `@@unique([taskId, platform])`).
2. **MetaClient**: `listAccounts()`, `resolveMediaId(pub, igId)` (match по shortcode во media edge),
   `fetchAccountMedia(igId, limit)`. Stub враќа детерминистички.
3. **services/meta/accounts.ts**: `listMetaAccounts()`.
4. **services/meta/metrics.ts**: `resolvePublications` праќа `igId`; нов `backfillClientMedia(clientId, limit)`
   → upsert account-Publications → `pullMetrics` ги покрива.
5. **routes**: `GET /meta/accounts` (dir/am); `POST /clients/:id/meta/backfill` (dir/am);
   доделба metaIgId/metaPageId преку постоечки client PATCH.
6. **Analytics**: query да вклучи и account-објави (`clientId` во месецот преку `publishedAt`).
7. **web**: Admin → избор на Meta сметка по клиент (dropdown) + копче „Повлечи метрики".
8. **Тестови**: metrics/analytics (stub) ажурирани + backfill тест.

## Инваријанти

- MetricSnapshot останува append-only. Тенант scope на сите queries. Токен само на backend.
- Без хардкодирани прагови (аларми = config, како порано).
