# План: Модул 3 · Мета (GoAds — Meta Ads & Social Operations)

Статус: **ОДЛУКИТЕ РЕШЕНИ — чека зелено за М1.** Не е имплементирано.
Извор: `design_handoff_meta/` (`README.md`, `CHANGES.md`, `META_TECH_SPEC.md`, `reference/PRD — GoAds v1.0`, `prototype/… v3.dc.html`). Read-only референца.

## 0. Решени одлуки (сопственик, 29.09.2026)

Отворени прашања (§18):

1. **АМ ги гледа пораките/коментарите за СИТЕ клиенти** (без доделување по клиент).
2. **Webhook надвор од VPN — Опција А:** се изложува само `POST/GET /api/webhooks/meta` јавно (речиси инстант пораки/алерти); останатото приватно.
3. **A07 минимален spend праг — ГЛОБАЛЕН** (една вредност за сите; опционен per-client override подоцна).
4. **Рачни `Campaign` без Meta ID — ОТСТРАНЕТИ.** Се покажуваат само вистински Meta кампањи од огледалото (sync). Планирање = `MetaChangePlan O8`, не лажен Campaign ред.
5. **Прво еден рекламен акаунт по клиент во UI**; multi-account UI подоцна (ретки такви клиенти). Моделот (`MetaConnection`) веќе го поддржува повеќе.
6. **Таскот го затвора Аналитичарот кога ќе го изгаси контентот од платените реклами** (не автоматски; системот само потсетува при крај на кампања).

Судири (§2):

1. `campaigns.ts` POST/PATCH — **се отстрануваат** (следи од одлука 4; само огледало, read-only).
2. Валута по акаунт (`currency`), **без тивка конверзија** — прифатено.
3. Втор токен `META_INBOX_TOKEN` — прифатено.
4. `Role.sales` — **веќе решено** (Модул 2 · CRM). ✅
5. Посебни 15-мин sync jobs за алерти — прифатено; постоечки `metrics.pull` останува за органика.

---

## 1. Што е модулот (една реченица)

Мета е модул **само за читање кон Meta**: синхронизира реклами, органика, пораки и коментари, прикажува алерти и аналитика, и води **планови за промена** што Аналитичарот ги предлага, Директорот ги одобрува и **рачно ги прави во Ads Manager** — а синхронизацијата ја потврдува промената и ја запишува во архивата. **Системот НИКОГАШ не пишува во Meta.**

## 2. Централен работен тек (го разбирам вака)

```
Аналитичар: чита → предлага план (pending)
   → Директор: одобри (approved)  [или Директор креира → веднаш approved]
   → Директор рачно менува во Ads Manager → „Направено" (syncing)
   → meta.structure sync ја споредува `after` со огледалото на објектот
        совпаѓа → done + EventLog `meta.plan.confirmed`
        не совпаѓа 24ч → mismatch (алерт до Директор)
   Промена најдена БЕЗ план → само `meta.change.detected` („Надворешна · без план")
```

Ова е **предлог/потврда јамка**, не извршување. Нема Executor, нема `ads_management`, нула POST/DELETE кон Graph API (CI grep го спроведува).

## 3. Улоги (backend enforcement, §3)

- **dir** — сè: чита, одобрува/одбива планови, „Направено", уредува профил (цели/прагови).
- **ana** — чита + предлага (план → `pending`), гледа **само свои** планови, повлекува свој pending. НЕ одобрува.
- **am** — **само** Инбокс + Коментари. Сè друго на `/meta/*` → `403`.
- Акаунт со Partner „View performance" (`access=read`) → UI крие предлози, API враќа `403 META_READ_ONLY`.
- Секое отворање разговор се логира (приватност).

## 4. Екрани (10, §README)

Утрински преглед (`meta`), Клиенти (`metaClients`), Клиент·Реклами/Органика/Профил (`metaClient`), Пресек (`metaCross`), Инбокс (`metaInbox`), Коментари (`metaComments`), Планови (`metaPlans`), Архива (`metaArchive`), Асистент (`mChat`), Поврзувања (`metaConn`). Нов главен таб „Мета" (dir/ana/am).

## 5. Податочен модел (§4)

**Нови табели** (сите `tenantId`, tenant scope): `MetaConnection` (асети по клиент: adAccount/page/ig/pixel/catalog + currency + accessLevel + spendCap/amountSpent + sync статус), **огледало** `MetaCampaign → MetaAdSet → MetaAd` (врзани преку **Meta ID**, `MetaAd.publicationId` → Task), `MetaInsightDaily` (spend/impressions/reach/frequency/results по Objective, upsert по ден, 24 месеци, последни 7 дена `isFinal=false`), Инбокс `MetaConversation/MetaMessage/MetaComment` (со retention на тело), `MetaAlert` (A01–A13, dedupe, auto-resolve), `MetaChangePlan` (P-###, op O1–O12, before/after/consequences/warnings, статус машина).
**Проширување:** `Client` + meta* полиња (цел `metaTargetValue/Metric/Text`, `metaMaxDailyBudget`, `metaFreqThreshold`, `metaCprAlertPct`, `metaNamingConvention`, `metaNotes`); `Publication` + `mediaType/caption/thumbnailFileId`.
**Реупотреба:** `Publication`, `MetricSnapshot`, `PageSnapshot` (постоечки од мојата работа), `Promotion` (таск↔реклама), `EventLog` (**архивата = `meta.*` настани**), `KnowledgeChunk` (асистент).

## 6. Токени (§5)

Два System User-и:

- `META_SYSTEM_TOKEN` (постои) — реклами/insights/органика; **да се додадат** `pages_read_engagement`, `pages_manage_metadata`.
- `META_INBOX_TOKEN` (**нов**) — `pages_messaging`, `instagram_manage_messages`, `pages_read_user_content`, `instagram_manage_comments`.
  `ads_management` **намерно НЕ** се бара. `debug_token` при старт + на 24ч. Ротација 90 дена (постоечки AES-GCM). Advanced Access + Business Verification за 30+ акаунти.

## 7. `MetaClient` — нови методи (само читање, stub+graph, §6)

`listAdAccountsDetailed`, `fetchStructure(adAccountId)`, `fetchInsightsDaily(level, since, until)` (async job за големи опсези), `fetchPageConversations`/`fetchIgConversations`, `fetchConversationMessages`, `fetchComments`, `checkIgMessagingAccess`, `debugToken`. Централен rate-limiter по акаунт, backoff, batch. **Ниту еден** send/reply/delete/hide метод. (Постоечките `fetchAdInsightsTree`/`listAdAccounts`/`fetchPageMetrics` од мојата работа се основа.)

## 8. Синхронизација (§7) — worker cron → API cron, ист образец

10 нови/надградени jobs: `meta.status` (15м → A01/A05/A06), `meta.structure` (30м → diff + потврда на планови), `meta.insights.today` (1ч → A07/A09), `meta.insights.backfill` (2:00), `meta.account` (:15 → A02/A03/A04), `meta.organic` (постоечки `metrics.pull` 6ч), `meta.inbox.fallback` (15м), `meta.token` (5:00 → A12), `meta.alerts.digest` (8:30 Viber/email), `meta.retention` (4:00 — тело пораки > 12м). **Webhooks** `POST /api/webhooks/meta` (+GET verify) со `X-Hub-Signature-256` (`META_APP_SECRET`) — messages/comments/issues. Бара **јавен URL** (VPN исклучок).

## 9. API (§8) — нови рути под `/meta`

`overview`, `alerts` (+PATCH state/snooze), `clients`, `cross?period` (EUR по курс НБРСМ), `clients/:id/structure|organic|profile` (PATCH профил само dir), `conversations*` (логира отворање, PATCH tags), `comments` (+PATCH tags), `plans*` (POST dir→approved/ana→pending; approve/reject/mark-done [dir]; withdraw [ana]), `archive`(+`.csv`), `connections`, `assistant/chat`. `am` → само `conversations*`+`comments*`, инаку 403. `clientId` = филтер од лев панел (D9).

## 10. Мапа на метрики по Objective (§10, ЗАДОЛЖИТЕЛНА)

| key                                                                                                                                                                                                                                                                                  | Objective    | Резултат              | Цена                      |
| ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | ------------ | --------------------- | ------------------------- |
| msg                                                                                                                                                                                                                                                                                  | Пораки       | Conversations started | Cost per conversation     |
| thru                                                                                                                                                                                                                                                                                 | ThruPlay     | ThruPlays             | Cost per ThruPlay         |
| reach                                                                                                                                                                                                                                                                                | Reach        | Reach                 | CPM                       |
| traffic                                                                                                                                                                                                                                                                              | Website      | Landing page views    | Cost per LPV              |
| lead                                                                                                                                                                                                                                                                                 | Instant Form | Leads                 | Cost per lead             |
| cart                                                                                                                                                                                                                                                                                 | Add to cart  | Adds to cart          | Cost per add to cart      |
| buy                                                                                                                                                                                                                                                                                  | Purchase     | Purchases             | Cost per purchase (+ROAS) |
| **Правило:** никогаш ROAS кај пораки; **Пресекот НИКОГАШ не собира различни Objective**. Секој екран: период + атрибуција (Standard) + време на освежување; последни 7 дена „не се конечни"; оценка „под целта" само ако има внесена цел; збирни суми во EUR по курс НБРСМ со датум. |

## 11. Врска Task Manager ↔ Мета (§9)

`Task(analitika) → Publication(metaMediaId) → Promotion(organic|paid) → MetaAd.publicationId → AdSet → Campaign`.

- Копче **„Платено"** во таскот → предлог **O4** (`params.post=publication.metaMediaId`, `taskId`, целен ad set = прв активен) + `Promotion(decision=paid)`; ако објавата е веќе во реклама → отвора тој ad set (без дупликат).
- **`GET /tasks/:id/meta`** → живи метрики: `organic` (последен MetricSnapshot, 5 метрики), `paid[]` (по реклама, по Objective, од MetaInsightDaily), `plans[]`, `promotion`, `freshness`, `fbPerPostUnavailable`.
- Статичниот блок метрики во зоната Аналитика **се заменува** со ова. Секцијата Објава добива ред „Meta".
- Таскот останува `analitika` додека кампањата е активна; по крај → **предлог** до Аналитичар да го затвори (не автоматски).

## 12. Алерти (§13) — A01–A13, живеат САМО во Мета

crit: A01 одбиена реклама, A02 акаунт оневозможен, A03 неуспешно плаќање, A04 spend≥90% cap, A12 токен истекува ≤7д. high: A05 spend=0 24ч, A06 нема испорака, A11 асет недостапен/IG пораки off. mid: A07 CPR↑≥праг, A08 learning LIMITED >5д, A09 frequency>праг. info: A10 крај ≤48ч, A13 legacy кампања. Групирање по `dedupeKey`, авто-`resolved` кога условот исчезне. **НЕ** одат во постоечкиот „Аларми" панел (D5).

## 13. Операции O1–O12 (§12) — планови, не извршување

O1 пауза/активирај · O2 дневен буџет · O3 закажан буџет · O4 реклама од пост · O5 ново видео · O6 копирај ad set · O7 нов ad set · O8 нова кампања · O9 распоред · O10 CTA/линк/шаблон · O11 преименување · O12 дуплирај кампања. Модалот покажува before/after + последици + предупредувања; ако има предупредување → штиклирање „Ги прочитав" (не блокада, D1).

## 14. Асистент (§11) — посебен AI чат во Мета

Алатки само за читање преку внатрешен API (`get_overview`, `get_alerts`, `get_cross`, `get_client_structure`, `get_organic`, `get_inbox_summary`, `search_knowledge`) + `draft_plan(op,…)` што враќа before/after/consequences/warnings но **не креира** план — корисникот кликнува „Прати на одобрување"/„Отвори како план" (`via=assistant`, `command`). Claude со tool use (не клучни зборови); на македонски; не одлучува место корисникот; акаунт `read` → одбива план.

## 15. Промени во постоечки екрани (CHANGES.md)

- **`/analytics` (D7):** тргнати „Кампањи во тек" + „Топ објави"; додадена картичка „Отвори Мета" (ana/dir). ⚠ Забелешка: богатата кампања→adset→ad хиерархија што ја изградив во Аналитика (Модул 2 сесија) **се преместува во Мета** — Аналитика останува кратко KPI резиме.
- **Таск · зона Аналитика / Објава / копче „Платено"** — §11.
- **Лев панел** — избран клиент филтрира Инбокс/Коментари/Планови/Архива (D9).
- **`campaigns.ts` POST/PATCH** — се затвораат за Meta кампањи (`metaCampaignId != null`).

## 16. Судири со постоечкиот код (§2) — бараат одлука/акција

1. `campaigns.ts` POST/PATCH дозволува директно менување → **затвори** за Meta кампањи (спротивно на D1/D2).
2. `Campaign.budget` во € vs USD акаунти → додади `currency` по акаунт, **без тивка конверзија**.
3. Токенот нема дозволи за пораки/коментари → **втор токен** (§6).
4. `Role` enum нема `sales` → **веќе решено** (го додадов во Модул 2 · CRM). ✅
5. `metrics.pull` на 6ч е преретко за алерти → **посебни 15-мин jobs** (§8); постоечкиот pull останува за органика.

## 17. Отворени прашања (§18) — одлука на сопственик пред развој

1. `am` ги гледа пораките за **сите** клиенти или само за свои (доделување по клиент)?
2. Webhook патека надвор од VPN — прифатливо?
3. Праг A07 (минимален spend) — по клиент или глобално?
4. Рачни „планирани" `Campaign` без Meta ID — остануваат или целосно се заменуваат со огледалото?
5. Повеќе рекламни акаунти по клиент во UI — кога?
6. Затворање таск од `analitika` по крај на кампања — предлог или автоматски? (Спецификацијата предлага **предлог**.)

## 18. Фази на градење (§16, предлог)

- **М1 · Темели:** миграции (MetaConnection, Client meta*, огледало, MetaInsightDaily, MetaAlert, MetaChangePlan) + втор токен + scopes + `MetaClient` read методи (stub+graph).
- **М2 · Sync + read екрани:** jobs (status/structure/account/insights) + алерти → Утрински преглед, Клиенти, Пресек, Клиент·Реклами.
- **М3 · Органика + таск:** надградба на `metrics.pull` + врска со таск + `GET /tasks/:id/meta` (метрики во таскот §11).
- **М4 · Инбокс/Коментари:** webhooks + Инбокс + Коментари + retention.
- **М5 · Планови:** state machine + потврда при sync + Архива.
- **М6 · Асистент:** алатки за читање + нацрт-план (Claude tool use).
- **М7 · Чистење:** скратување на Аналитика (D7) + затворање `campaigns.ts` POST/PATCH.
  Секоја фаза со тестови + gate, како кај Модул 1/2.

## 19. Прифатни критериуми (§17)

Одбиена реклама → A01 < 15 мин · O2 план→approve→„Направено"→`done` во прв structure циклус со EventLog пред/после · надворешна промена без план → „Надворешна · без план" · `am`→`/meta/plans`=403, `ana` approve=403 · Пресекот не собира различни Objective · **нула POST/DELETE кон Graph во кодот (CI grep)**.

## 20. Проценка

**Најголемиот модул досега** — ~10 нови табели, ~10 cron jobs, webhooks, ~25 API рути, 10 екрани, посебен AI асистент, длабока врска со таскот, строги Meta-специфични правила (read-only, objective мапа, потврда преку sync). Реално повеќе-неделна работа по фази, со gate по секоја. Постоечкиот Meta фундамент (metaClient graph/stub, insights tree, PageSnapshot, backfill, Promotion) е добра основа.
