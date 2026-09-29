# Модул 3 · Мета — техничка спецификација

Верзија 1.0 · 29.09.2026 · Прототип: `GoDigital Task Manager v3.dc.html`
Извор на барањата: `reference/PRD - GoAds Meta Ads & Social Operations System (v1.0).md`, прилагоден кон одлуките на сопственикот (дел 1).
Усогласено со репото `StefanNewOne/godigital-task-manager@develop`, со состојба на 28.09.2026: Prisma миграции, `services/meta/*`, `routes/meta.ts`, `routes/campaigns.ts`, `apps/worker`.

---

## 0. Една реченица

Мета е модул **само за читање кон Meta**. Системот ги синхронизира рекламите, органиката, пораките и коментарите, прикажува алерти и аналитика, и води **планови за промена**. Плановите ги предлага Аналитичарот, а ги одобрува Директорот, кој промената ја прави **рачно во Ads Manager**. Синхронизацијата ја потврдува промената и ја запишува во архивата.

---

## 1. Одлуки на сопственикот (обврзувачки)

| #   | Одлука                                            | Последица за код                                                                                                                                                           |
| --- | ------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| D1  | Системот **не пишува** во Meta                    | Нема Executor сервис. Нема `ads_management` во токенот. Ниту еден POST/DELETE кон Graph API за реклами, пораки или коментари.                                              |
| D2  | Аналитичар = чита + предлага                      | `ana` креира `MetaChangePlan` со статус `pending`. Не одобрува.                                                                                                            |
| D3  | Директор = одобрува + менува рачно во Ads Manager | `dir` одобрува или одбива; означува „Направено“ → `syncing` → sync потврдува → `done`. Директорот може да креира и свој план, кој е веднаш `approved`.                     |
| D4  | Акаунт менаџер = само Инбокс и Коментари          | `am` гледа само `metaInbox`, `metaComments`. Без реклами, планови и архива.                                                                                                |
| D5  | Алертите живеат **само во Мета**                  | Meta алертите НЕ одат во постоечкиот `Notification` / „Аларми“ панел. Посебна табела и екран.                                                                              |
| D6  | Посебен AI чат во Мета                            | Посебен асистент со Meta алатки. Не е постоечкиот `claudeAssistant` модул во таскот, но може да ја користи истата `KnowledgeChunk` база.                                   |
| D7  | „Аналитика“ останува кратко резиме                | Екранот `/analytics` ги задржува KPI, органско/платено и „По клиент“. „Кампањи во тек“ и „Топ објави“ се тргнати и заменети со картичка „Отвори Мета“ (само `ana`, `dir`). |
| D8  | „Платено“ во таскот отвора предлог во Мета        | `Promotion(decision=paid)` + `MetaChangePlan(op=O4, taskId)`. Види дел 9.                                                                                                  |
| D9  | Филтер по клиент                                  | Избран клиент во левиот панел ги филтрира Инбокс, Коментари, Планови и Архива. „Сите клиенти“ = без филтер.                                                                |

---

## 2. Што веќе постои во продукција (не се менува, се надградува)

| Постоечко                                                               | Каде                           | Како се користи во Мета                                                                                  |
| ----------------------------------------------------------------------- | ------------------------------ | -------------------------------------------------------------------------------------------------------- |
| `Client.metaAdAccountId / metaPageId / metaIgId / usesMetaAds`          | init migration                 | Основа за поврзувања. Види 4.1 за проширување.                                                           |
| `MetaClient` адаптер (stub + graph)                                     | `services/meta/metaClient*.ts` | Се проширува со нови методи за читање (дел 6). Stub моделот останува: dev работи без токен.              |
| `Publication` (taskId nullable, clientId, metaMediaId, backfill unique) | migrations 0922 + 0928         | Органските постови во Мета = `Publication`. Врската со таскот е `taskId`.                                |
| `MetricSnapshot` (append-only, 8 метрики)                               | init                           | Останува за органика по пост. Платените метрики на ниво ad set/ad одат во нова `MetaInsightDaily` (4.4). |
| `PageSnapshot` (FB page-ниво)                                           | 0928                           | FB органика по страница. FB по пост нема reach/views (Meta v21). UI веќе го покажува ова.                |
| `Campaign` + `Promotion`                                                | init                           | `Promotion` се реупотребува за врската таск → реклама. `Campaign` станува огледало (4.2).                |
| `EventLog` (append-only, oldValue/newValue JSONB)                       | init                           | Архивата на промени = EventLog со `objectType` `meta_*` (4.7).                                           |
| `KnowledgeChunk` (pgvector)                                             | init                           | Асистентот чита `metricSummary` и `clientProfile` chunks.                                                |
| worker cron → API cron endpoint                                         | `apps/worker/src/index.ts`     | Новите Meta sync jobs се регистрираат на ист начин (дел 7).                                              |
| `routes/meta.ts` (само dir/am)                                          | api                            | Се проширува: `ana` добива читање; `am` само inbox/comments (дел 8).                                     |

### ⚠ Судири со постоечкиот код што мора да се решат

1. **`routes/campaigns.ts` POST/PATCH** дозволува `ana`/`dir` директно да креираат и менуваат `Campaign`. Според D1 и D2 ова е спротивно. Предлог: POST/PATCH се исклучуваат за Meta кампањи (`metaCampaignId != null`). Рачните „планирани“ кампањи без Meta ID, ако се уште потребни, остануваат само за `dir`.
2. **`Campaign.budget` е во €** (narrative во кодот). Рекламните акаунти можат да бидат во USD. Се додава `currency` по акаунт (4.1), без тивка конверзија.
3. **Токенот** (`META_SYSTEM_TOKEN`) нема дозволи за пораки и коментари. Потребен е втор токен (дел 5).
4. **`Role` enum** нема `sales` (Модул 2, CRM). Не е дел од Мета, но е во истата миграција ако се спојуваат.
5. **`metrics.pull` на 6 часа** не е доволно за алерти A01–A06 (потребни се 15 минути). Се додаваат посебни jobs (дел 7). Постоечкиот pull останува за органика.

---

## 3. Улоги и пристап (backend enforcement, не само UI)

| Ресурс / дејство                                           | dir            | ana           | am  | други |
| ---------------------------------------------------------- | -------------- | ------------- | --- | ----- |
| Утрински преглед, алерти (читање, видено, одложи)          | ✓              | ✓             | —   | —     |
| Клиенти, Пресек, Клиент·Реклами, Органика, Профил (читање) | ✓              | ✓             | —   | —     |
| Профил на клиент: уредување белешки, цели, прагови         | ✓              | —             | —   | —     |
| Инбокс (пораки)                                            | ✓              | ✓             | ✓   | —     |
| Коментари                                                  | ✓              | ✓             | ✓   | —     |
| Внатрешни ознаки на разговор/коментар                      | ✓              | ✓             | ✓   | —     |
| Креирање план (`MetaChangePlan`)                           | ✓ (→ approved) | ✓ (→ pending) | —   | —     |
| Одобри / одбиј план                                        | ✓              | —             | —   | —     |
| „Направено во Ads Manager“                                 | ✓              | —             | —   | —     |
| Повлечи сопствен pending план                              | —              | ✓ (само свој) | —   | —     |
| Архива (читање, CSV)                                       | ✓              | ✓             | —   | —     |
| Поврзувања и токени (читање)                               | ✓              | ✓             | —   | —     |
| Асистент                                                   | ✓              | ✓             | —   | —     |

Правила:

- Акаунт со Partner задача „View performance“ (`access=read`) → UI ги крие предлозите, а API враќа `403 META_READ_ONLY` за креирање план.
- Аналитичарот ги гледа **само своите** планови. Директорот ги гледа сите.
- Секое отворање на разговор се логира (`EventLog eventType=meta.conversation.opened`) заради приватност.

---

## 4. Податочен модел: промени и нови табели

Сите нови табели имаат `tenantId`, tenant scope, `createdAt`/`updatedAt` како постоечките.

### 4.1 `MetaConnection` (ново) + проширување на `Client`

Еден клиент може да има повеќе асети (PRD §5). Засега UI прикажува по еден, но моделот не треба да го ограничи.

```
MetaConnection
  id, clientId FK, kind enum(adAccount|page|igAccount|pixel|catalog)
  metaId TEXT            -- act_…, page id, ig id
  name TEXT
  currency TEXT NULL     -- само за adAccount (EUR/USD)
  accessLevel enum(write|read|none)   -- Partner задача: Manage campaigns / View performance
  igMessagesEnabled BOOLEAN NULL      -- „Allow access to messages“ (детектирано)
  spendCap DECIMAL NULL, amountSpent DECIMAL NULL, accountStatus TEXT NULL, disableReason TEXT NULL
  lastSyncAt, lastSyncError TEXT NULL, syncFailCount INT
  UNIQUE(clientId, kind, metaId)
```

`Client.metaAdAccountId/metaPageId/metaIgId` остануваат како примарни (компатибилност). Миграција: за секој постоечки клиент се креира по еден ред `MetaConnection`.

`Client` + нови полиња за профил (или `MetaClientProfile` 1:1):

```
metaTargetText TEXT NULL       -- „€0,80 по разговор“ (прикажување)
metaTargetValue DECIMAL NULL, metaTargetMetric TEXT NULL
metaMaxDailyBudget DECIMAL NULL  -- предупредување во план (не блокада, D1)
metaFreqThreshold DECIMAL DEFAULT 3.0
metaCprAlertPct INT DEFAULT 40   -- A07
metaNamingConvention TEXT NULL
metaNotes TEXT NULL              -- белешки за асистентот
```

### 4.2 Огледало на рекламната структура (ново / проширено)

```
MetaCampaign            (или проширен постоечки Campaign со metaCampaignId NOT NULL)
  id, clientId, connectionId FK(adAccount), metaId UNIQUE
  name, objective TEXT, objectiveKey enum(msg|thru|cart|buy|reach|traffic|lead|leadWeb)
  buyingType, budgetStrategy (CBO/ABO), dailyBudget DECIMAL, bidStrategy
  status, effectiveStatus, startTime, stopTime
  pausedExternally BOOLEAN   -- паузирана надвор од системот (без план) → предупредување при O1
  raw JSONB, syncedAt
MetaAdSet
  id, campaignId FK, metaId UNIQUE, name, status, effectiveStatus
  optimizationGoal, conversionLocation, destination
  targeting JSONB, placements JSONB, learningStage TEXT, learningStageSince TIMESTAMP
  raw JSONB, syncedAt
MetaAd
  id, adSetId FK, metaId UNIQUE, name, status, effectiveStatus
  reviewStatus enum(approved|rejected|pending|no_delivery), reviewFeedback JSONB
  creativeId, sourcePostMetaId TEXT NULL  -- „Use existing post“
  publicationId FK NULL                    -- врска кон Publication (→ Task)
  cta TEXT, messageTemplate TEXT, enhancements JSONB, raw JSONB, syncedAt
```

Правило (PRD §5): сè се врзува преку **Meta ID**, никогаш преку име.

### 4.3 Органика

Се реупотребува `Publication`. Додатоци:

```
Publication + mediaType TEXT, caption TEXT, thumbnailFileId FK NULL (локален кеш во R2)
```

`MetricSnapshot` останува (views, reach, engagement, saves во `raw`). За UI се пресметува „во реклама“ = постои `MetaAd.publicationId = Publication.id` или `sourcePostMetaId = metaMediaId`.

### 4.4 `MetaInsightDaily` (ново, append/upsert по ден)

```
id, level enum(campaign|adset|ad), objectMetaId, clientId, date DATE
spend DECIMAL, impressions, reach, frequency, clicks, ctr
results DECIMAL, resultType TEXT     -- според Objective мапата (дел 10)
actions JSONB, raw JSONB, fetchedAt, isFinal BOOLEAN (false за последни 7 дена)
UNIQUE(level, objectMetaId, date)
```

Чување 24 месеци. Последните 7 дена се освежуваат ноќно, бидејќи Meta ги доуредува конверзиите.

### 4.5 Инбокс

```
MetaConversation
  id, clientId, connectionId(page|ig), metaThreadId UNIQUE, channel enum(messenger|instagram)
  participantName, sourceAdMetaId NULL, lastMessageAt, unread BOOLEAN, waitingSince TIMESTAMP NULL
  topic TEXT NULL (AI класификација), tags TEXT[] (обработено|за клиентот|важно)
MetaMessage
  id, conversationId, metaMessageId UNIQUE, fromPage BOOLEAN, text, sentAt, viaTemplate TEXT NULL
  bodyPurgedAt TIMESTAMP NULL   -- по 12 месеци текстот се брише, бројките остануваат
MetaComment
  id, clientId, metaCommentId UNIQUE, parentObjectType enum(ad|post), parentMetaId, publicationId NULL, adId NULL
  authorName, text, createdTime, isQuestion BOOLEAN, isComplaint BOOLEAN (AI), tags TEXT[]
```

### 4.6 `MetaAlert` (ново)

```
id, clientId, code (A01…A13), severity enum(crit|high|mid|info)
objectType, objectMetaId, title, detail, deepLink JSONB {view, tab, adSetId}
state enum(new|seen|snoozed|resolved), snoozedUntil TIMESTAMP NULL
firstSeenAt, lastSeenAt, occurrences INT   -- групирање: „2-ри ден по ред“
dedupeKey UNIQUE  (code + objectMetaId)
```

Автоматски `resolved` кога условот исчезне при следната евалуација.

### 4.7 Планови и архива

```
MetaChangePlan
  id (P-###), clientId, op enum(O1…O12), target JSONB {campaignId?, adSetId?, adId?}
  params JSONB, before JSONB, after JSONB, consequences TEXT[], warnings TEXT[]
  status enum(pending|approved|syncing|done|rejected|mismatch|withdrawn)
  createdById, createdVia enum(manual|assistant), command TEXT NULL (оригиналната наредба)
  note TEXT NULL, rejectNote TEXT NULL, taskId FK NULL, promotionId FK NULL
  approvedById, approvedAt, markedDoneAt, confirmedAt, idempotencyKey UNIQUE
```

**Архивата** = `EventLog` (append-only). Нови `eventType`:

- `meta.plan.created|approved|rejected|withdrawn|marked_done|confirmed|mismatch`
- `meta.change.detected`: секоја разлика што ја наоѓа sync-от, со `oldValue`/`newValue` и `context.planId` ако е поврзана.
- `meta.profile.updated`, `meta.conversation.opened`

---

## 5. Токени и дозволи (Meta)

| System User     | env                          | Scopes                                                                                                                                                        | Статус денес                                                                 |
| --------------- | ---------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------- |
| GoAds Monitor   | `META_SYSTEM_TOKEN` (постои) | ads_read, read_insights, business_management, pages_show_list, pages_read_engagement, instagram_basic, instagram_manage_insights, pages_manage_metadata       | Постои без `pages_read_engagement` и `pages_manage_metadata` → да се додадат |
| GoInbox Monitor | `META_INBOX_TOKEN` (ново)    | pages_messaging, instagram_manage_messages, pages_read_user_content, pages_read_engagement, instagram_manage_comments, pages_show_list, pages_manage_metadata | Не постои                                                                    |

- **`ads_management` намерно НЕ се бара** (D1).
- Дозволите за пораки технички дозволуваат праќање. Правило за code review: **не постојат** ендпоинти или методи во `MetaClient` за send, reply, delete или hide.
- Advanced Access за `ads_read` (rate limits за 30+ акаунти). Business Verification.
- `debug_token` при старт и на 24 ч. Истек за 7 дена или повлечен токен → алерт A12.
- Ротација на 90 дена: генерирај нов → замени → повлечи стар. Шифрирано (постоечки AES-GCM, §9.2).

---

## 6. `MetaClient`: нови методи (само читање)

Постоечките остануваат. Се додаваат (stub + graph):

```ts
listAdAccountsDetailed(): {id, name, currency, accountStatus, disableReason, spendCap, amountSpent, userTasks}[]
fetchStructure(adAccountId): {campaigns[], adsets[], ads[]}          // fields: status, effective_status, issues_info, learning_stage_info, review_feedback
fetchInsightsDaily(adAccountId, level, since, until): InsightRow[]  // time_increment=1, async job за големи опсези
fetchPageConversations(pageId, sinceCursor), fetchIgConversations(igId, sinceCursor)
fetchConversationMessages(threadId, sinceCursor)
fetchComments(objectMetaId, since)                                   // за ad и post објекти
checkIgMessagingAccess(igId): boolean                               // детекција за A11
debugToken(token): {expiresAt, scopes, isValid}
```

Централен rate limiter по ad account (читање = 1 поен), exponential backoff, batch барања. Грешките од Meta се чуваат со код и се преведуваат на македонски.

---

## 7. Синхронизација (worker → API cron, ист образец како денес)

| Job                      | Cron (Europe/Skopje) | Endpoint                            | Што прави                                                                          |
| ------------------------ | -------------------- | ----------------------------------- | ---------------------------------------------------------------------------------- |
| `meta.status`            | `*/15 * * * *`       | `/api/cron/meta-status`             | effective_status, review, issues → евалуира A01, A05, A06                          |
| `meta.structure`         | `*/30 * * * *`       | `/api/cron/meta-structure`          | diff на кампањи/ad sets/ads → `meta.change.detected`, потврда на `syncing` планови |
| `meta.insights.today`    | `0 * * * *`          | `/api/cron/meta-insights-today`     | MetaInsightDaily за денес → A07, A09                                               |
| `meta.insights.backfill` | `0 2 * * *`          | `/api/cron/meta-insights-backfill`  | последни 7 дена повторно (isFinal)                                                 |
| `meta.account`           | `15 * * * *`         | `/api/cron/meta-account`            | spend cap, статус, плаќање → A02, A03, A04                                         |
| `meta.organic`           | `0 */3 * * *`        | постоечки `metrics.pull` + backfill | Publication + MetricSnapshot + PageSnapshot                                        |
| `meta.inbox.fallback`    | `*/15 * * * *`       | `/api/cron/meta-inbox`              | резерва за webhooks; A11 проверка                                                  |
| `meta.token`             | `0 5 * * *`          | `/api/cron/meta-token`              | debug_token → A12                                                                  |
| `meta.alerts.digest`     | `30 8 * * *`         | `/api/cron/meta-alerts-digest`      | збирен Viber/email за dir и ana (A01–A04 веднаш)                                   |
| `meta.retention`         | `0 4 * * *`          | `/api/cron/meta-retention`          | брише тело на пораки постари од 12 месеци                                          |

**Webhooks** (`POST /api/webhooks/meta`, GET за verify): messages, comments, `in_process_ad_objects`, `with_issues_ad_objects`. Се проверува `X-Hub-Signature-256` со `META_APP_SECRET`. Бара **јавен URL**: ако апликацијата е зад VPN, webhook патеката мора да е исклучок.

Неуспешен sync 3 пати по ред за еден акаунт → алерт A11 (асет недостапен).

---

## 8. API (нови рути под `/meta`)

```
GET  /meta/overview                         → KPI, отворени алерти по сериозност, sync статус, пристап    [dir, ana]
GET  /meta/alerts?state=&severity=          PATCH /meta/alerts/:id {state, snoozedUntil}               [dir, ana]
GET  /meta/clients                          → ред по клиент: цел, денес, месец, кампањи, алерти, пораки, последна промена
GET  /meta/cross?period=7|30|month          → по кампања: objective, spend (EUR со курс НБРСМ + датум), results, cpr, Δ, цел
GET  /meta/clients/:id/structure?period=    → кампањи → ad sets → ads + KPI по Objective
GET  /meta/clients/:id/organic?type=&free=&sort=
GET  /meta/clients/:id/profile              PATCH (само dir) → EventLog meta.profile.updated
GET  /meta/conversations?clientId=&unread=  GET /meta/conversations/:id (логира отворање)  PATCH tags
GET  /meta/conversations/summary?clientId=&period=  → теми, извор по реклама, колку чекаат
GET  /meta/comments?clientId=&filter=open|q|ads|bad   PATCH /meta/comments/:id {tags}
GET  /meta/plans?clientId=&status=          (ana: само свои)
POST /meta/plans                            {op, clientId, target, params, note, taskId?, via, command?}   [dir→approved, ana→pending]
POST /meta/plans/:id/approve | /reject {note} | /mark-done                                               [dir]
POST /meta/plans/:id/withdraw                                                                            [ana, свој pending]
GET  /meta/archive?clientId=&from=&to=      GET /meta/archive.csv
GET  /meta/connections                      → MetaConnection + токени (без вредности на токенот)
POST /meta/assistant/chat                   → види дел 11
```

`clientId` параметарот одговара на филтерот од левиот панел (D9). Без `clientId` = сите клиенти.
`am` на `/meta/*` има пристап само до `conversations*` и `comments*`, сè друго враќа `403`.

---

## 9. Врска Task Manager ↔ Мета

```
Task (status=analitika)
  └─ Publication (taskId, metaMediaId)  ← AM ја потврдува објавата со линк (постоечки тек)
       ├─ MetricSnapshot (органски метрики)
       ├─ Promotion (decision organic|paid)          ← „Органски“ / „Платено“ во таскот
       └─ MetaAd.publicationId                        ← кога рекламата ќе се открие при sync
            └─ MetaAdSet → MetaCampaign
```

Тек на „Платено“ (`analyticsPaid` во прототипот):

1. Ако клиентот нема `usesMetaAds` или акаунтот е `read` → порака, без предлог.
2. Ако `Publication` уште не е синхронизирана → порака „ќе се појави по следното влечење“.
3. Ако објавата **веќе е во реклама** → отвори го ad set-от каде се користи, без дупликат.
4. Инаку отвори предлог O4 со `params.post = publication.metaMediaId`, `taskId`, целен ad set = првиот активен. Аналитичарот може да го смени.
5. Создај `Promotion(decision=paid)`. По `done`: `Promotion.campaignId` = синхронизираната кампања, `MetaAd.publicationId` = објавата.
6. Таскот останува во `analitika` додека кампањата е активна. Кога кампањата ќе заврши (`stopTime` или пауза) → предлог-известување до Аналитичарот да го затвори таскот (не автоматски).

Во Мета секоја објава и реклама покажува „Од таск: …“ со линк кон таскот.

### 9.1 Метрики во таскот (детал на таск)

Метриките во таскот повеќе не се статични. Се читаат од поврзаната објава и од рекламите што ја користат.

**API:** `GET /tasks/:id/meta` враќа:

```
{
  publication: {platform, postType, publishedAt, metaMediaId, resolveStatus} | null,
  organic: {views, reach?, engagement, saves, comments, retention?, capturedAt} | null,   // последен MetricSnapshot
  fbPerPostUnavailable: boolean,                                                          // FB по пост нема reach/views (v21)
  paid: [{adId, adName, campaignName, adSetName, objectiveKey, results, resultType, spend, currency, cpr, status, reviewStatus}],  // MetaAd.publicationId = publication.id, сома од MetaInsightDaily
  plans: [{id, status}],                                                                  // MetaChangePlan.taskId = task.id
  promotion: {decision, campaignId} | null,
  freshness: {organicAt, paidAt, paidIsFinal}
}
```

**Каде се прикажува:**

| Место во таскот            | Кога                                | Кој                        | Што                                                                                                                                                                              |
| -------------------------- | ----------------------------------- | -------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| Работна зона „Аналитика“   | `status=analitika`                  | ana (сопственик), dir чита | статус на врската со Meta; Органски (5 метрики); Платено (секоја реклама: кампања·ad set, резултат по Objective, потрошено, цена, статус); планови со статус; „Отвори во Мета ›“ |
| Копче „Во реклами“         | `analitika`                         | ana                        | ако објавата е веќе во реклама → „Види ја рекламата“ (отвора ad set); инаку предлог O4 (дел 9)                                                                                   |
| Секција „Објава“ (Publish) | `objaveno`, `analitika`, `zavrseno` | сите што го гледаат таскот | ред „Meta“: поврзано / чека резолуција; органски метрики; „Во реклама: …“; „Отвори во Мета“ само за ana/dir                                                                      |

**Правила:**

- Поврзувањето се прави преку постоечкиот `publication.resolve`. Додека `resolveStatus ≠ resolved`, таскот пишува „Објавата уште не е поврзана со Meta“, а „Во реклами“ не отвора предлог.
- Платените метрики се собираат само за реклами на истата објава и само во ист Objective. Ако објавата е во реклами со различен Objective, се прикажуваат одвоено, по реклама.
- Валутата е онаа на акаунтот.
- Се прикажува свежината. Органските се последен `MetricSnapshot` (на 6 ч). Платените се од `MetaInsightDaily`, при што последните 7 дена не се конечни.
- Истите бројки се гледаат во Мета · Органика и во Мета · Реклами, бидејќи изворот е еден. Нема втора пресметка во таскот.
- Постоечкиот статичен блок „Досег / Импресии / … / Цена/резултат“ во зоната Аналитика се заменува со ова.

---

## 10. Мапа на метрики по Objective (од PRD §12, задолжителна)

| key     | Objective             | Резултат              | Цена по резултат          |
| ------- | --------------------- | --------------------- | ------------------------- |
| msg     | Engagement · Пораки   | Conversations started | Cost per conversation     |
| thru    | Engagement · ThruPlay | ThruPlays             | Cost per ThruPlay         |
| reach   | Awareness · Reach     | Reach                 | CPM                       |
| traffic | Traffic · Website     | Landing page views    | Cost per LPV              |
| lead    | Leads · Instant Form  | Leads                 | Cost per lead             |
| cart    | Sales · Add to cart   | Adds to cart          | Cost per add to cart      |
| buy     | Sales · Purchase      | Purchases             | Cost per purchase (+ROAS) |

- Никогаш ROAS кај пораки, никогаш cost per conversation кај продажби. Пресекот низ клиенти **не ги собира** резултатите со различен Objective.
- Секој екран носи период, атрибуција (Standard) и време на последно освежување. Последните 7 дена се означени како „не се конечни“.
- Оценка („под целта“) се прикажува само ако е внесена цел во профилот.
- Сумите се во валутата на акаунтот. Збирните суми се во EUR по курс на НБРСМ, со датум.

---

## 11. AI асистент (посебен чат во Мета)

- **Алатки за читање** (преку внатрешен API, никогаш директно кон Meta): `get_overview`, `get_alerts`, `get_cross(period)`, `get_client_structure(clientId, period)`, `get_organic(clientId)`, `get_inbox_summary(clientId, period)`, `search_knowledge(query, clientId)`.
- **Алатка за нацрт-план**: `draft_plan(op, clientId, target, params)` враќа before, after, consequences и warnings. **Не креира** `MetaChangePlan` сама. Корисникот кликнува „Прати на одобрување“ (ana) или „Отвори како план“ (dir), и тогаш се отвора истиот модал како рачниот тек, со `via=assistant` и `command`.
- Правила во системскиот промпт (PRD §11):
  - Не одлучува место корисникот.
  - При двосмисленост прашува, со најмногу 2–3 опции од вистинските податоци.
  - Никогаш не погодува кој објект се мисли.
  - Ги објаснува последиците (learning, делење буџет).
  - Не измислува бројки и секогаш го наведува периодот.
  - Пишува на македонски.
- Акаунт `read` → асистентот одбива да подготви план и објаснува зошто.
- Прототипот користи клучни зборови за намера. Продукцијата користи Claude со tool use.

---

## 12. Операции O1–O12 (планови, не извршување)

| Op                   | Ниво                       | Полиња во модалот             | Предупредувања                                                   |
| -------------------- | -------------------------- | ----------------------------- | ---------------------------------------------------------------- |
| O1 Пауза/активирај   | кампања / ad set / реклама | —                             | активирање на `pausedExternally`                                 |
| O2 Дневен буџет      | кампања (CBO)              | нов износ                     | Δ > 20%; над `metaMaxDailyBudget`                                |
| O3 Закажан буџет     | кампања                    | износ, кога                   | —                                                                |
| O4 Реклама од пост   | ad set                     | органски пост (само слободни) | различни CTA во ad set-от                                        |
| O5 Ново видео        | ad set                     | видео фајл                    | —                                                                |
| O6 Копирај ad set    | ad set                     | ново име, нова креатива       | learning + делење буџет                                          |
| O7 Нов ad set        | кампања                    | име, локација/возраст/пол     | learning                                                         |
| O8 Нова кампања      | акаунт                     | име, Objective, буџет         | стандарди: Auction · CBO · Highest volume · без Audience Network |
| O9 Распоред          | кампања                    | краен датум                   | —                                                                |
| O10 CTA/линк/шаблон  | реклама                    | поле, вредност (од листа)     | —                                                                |
| O11 Преименување     | било кое                   | ново име                      | конвенција за имиња                                              |
| O12 Дуплирај кампања | кампања                    | име, старт                    | —                                                                |

Ако има предупредување, модалот бара штиклирање „Ги прочитав предупредувањата“. Ова **не е блокада**, бидејќи промената ја прави човек во Ads Manager (D1).

### Состојби на план

```
pending ──approve──▶ approved ──mark-done──▶ syncing ──sync match──▶ done
   │                     │                        └──no match 24h──▶ mismatch (алерт до dir)
   ├──reject(note)──▶ rejected
   └──withdraw (ana)──▶ withdrawn
dir креира → approved директно
```

**Совпаѓање при sync:** за `syncing` план, `meta.structure` ја споредува `after` вредноста со огледалото на целниот објект, на пример `dailyBudget == params.amount` или `status == PAUSED`. Совпаѓање → `done` + `meta.plan.confirmed`. Промена најдена без план → само `meta.change.detected` („Надворешна · без план“ во архивата).

---

## 13. Каталог на алерти (евалуација)

| Код | Услов                                                                 | Сериозност | Job                   |
| --- | --------------------------------------------------------------------- | ---------- | --------------------- |
| A01 | `MetaAd.reviewStatus=rejected`                                        | crit       | meta.status + webhook |
| A02 | `accountStatus` оневозможен/ограничен                                 | crit       | meta.account          |
| A03 | неуспешно плаќање                                                     | crit       | meta.account          |
| A04 | `amountSpent/spendCap ≥ 0.9`                                          | crit       | meta.account          |
| A05 | активна кампања, spend=0 за 24 ч                                      | high       | meta.insights.today   |
| A06 | активна реклама, `effective_status`/`issues_info` → нема испорака     | high       | meta.status           |
| A07 | CPR ↑ ≥ `metaCprAlertPct` наспроти претходни 7 дена (мин. spend праг) | mid        | meta.insights.today   |
| A08 | `learningStage=LIMITED` > 5 дена                                      | mid        | meta.structure        |
| A09 | frequency 7д > `metaFreqThreshold`                                    | mid        | meta.insights.today   |
| A10 | `stopTime` за ≤ 48 ч                                                  | info       | meta.structure        |
| A11 | асет недостапен (2 неуспеха) или IG пораки исклучени                  | high       | sync / meta.inbox     |
| A12 | токен истекува ≤ 7 дена или е повлечен                                | crit       | meta.token            |
| A13 | legacy Advantage+ Shopping кампања                                    | info       | meta.structure        |

Групирање по `dedupeKey`, бројач на денови. Одложено = `snoozedUntil` утре 08:30.

---

## 14. Екран → API → табели

| Екран (прототип)                    | API                              | Табели                                                                           |
| ----------------------------------- | -------------------------------- | -------------------------------------------------------------------------------- |
| Утрински преглед                    | /meta/overview, /meta/alerts     | MetaAlert, MetaConnection, MetaInsightDaily                                      |
| Клиенти                             | /meta/clients                    | Client, MetaConnection, MetaCampaign, MetaAlert, MetaConversation, EventLog      |
| Пресек                              | /meta/cross                      | MetaCampaign, MetaInsightDaily, Client (цели)                                    |
| Клиент · Реклами                    | /meta/clients/:id/structure      | MetaCampaign/AdSet/Ad, MetaInsightDaily, Publication                             |
| Клиент · Органика                   | /meta/clients/:id/organic        | Publication, MetricSnapshot, PageSnapshot, MetaAd, Task                          |
| Клиент · Профил                     | /meta/clients/:id/profile        | Client (meta* полиња)                                                            |
| Инбокс                              | /meta/conversations*             | MetaConversation, MetaMessage                                                    |
| Коментари                           | /meta/comments                   | MetaComment                                                                      |
| Планови                             | /meta/plans*                     | MetaChangePlan, Promotion, Task                                                  |
| Архива                              | /meta/archive                    | EventLog (meta.*)                                                                |
| Поврзувања                          | /meta/connections                | MetaConnection, токен метаподатоци                                               |
| Асистент                            | /meta/assistant/chat             | сите горе (read), KnowledgeChunk                                                 |
| Аналитика (скратена)                | постоечки /analytics             | непроменето                                                                      |
| Таск · Аналитика · „Платено“        | POST /meta/plans (op O4, taskId) | Promotion, MetaChangePlan                                                        |
| Таск · Аналитика / Објава · метрики | GET /tasks/:id/meta              | Publication, MetricSnapshot, MetaAd, MetaInsightDaily, MetaChangePlan, Promotion |

---

## 15. Приватност

- Пристапот до пораките е по улога (dir, ana, am). Секое отворање на разговор се логира.
- Телото на пораките се брише по 12 месеци (`meta.retention`), а бројките остануваат.
- Лични податоци од Instant Forms не се складираат, само бројот на лидови.
- Логовите се без токени и без содржина на пораки.
- Потребен е додаток за обработка на податоци кон договорите со клиентите (PRD §16).

---

## 16. Редослед на развој (предлог)

1. Миграции: MetaConnection, Client meta*, огледало, MetaInsightDaily, MetaAlert, MetaChangePlan. Нов токен и scopes.
2. Sync jobs (status, structure, account, insights) + алерти → Утрински преглед, Клиенти, Пресек, Клиент·Реклами (read).
3. Органика (надградба на постоечкиот pull) + врска со таск + `GET /tasks/:id/meta` (метрики во таскот, §9.1).
4. Webhooks + Инбокс + Коментари + retention.
5. Планови + потврда при sync + Архива.
6. Асистент со алатки за читање и нацрт-план.
7. Скратување на Аналитика (D7) и затворање на `campaigns.ts` POST/PATCH.

## 17. Прифатни критериуми

- Одбиена реклама на тест акаунт → A01 во Утрински преглед за < 15 мин.
- План O2 → approve → промена во Ads Manager → „Направено“ → `done` во првиот `meta.structure` циклус, со EventLog запис пред/после.
- Промена направена директно во Ads Manager без план → архива „Надворешна · без план“.
- `am` повик кон `/meta/plans` → 403. `ana` approve → 403.
- Пресекот никогаш не собира метрики со различен Objective.
- Нема ниту еден POST/DELETE кон Graph API во кодот (grep во CI).

## 18. Отворени прашања

1. Дали `am` ги гледа пораките за сите клиенти или само за своите (доделување по клиент)?
2. Webhook патека надвор од VPN: дали е прифатливо?
3. Праг за A07 (минимален spend) по клиент или глобално?
4. Дали рачните „планирани“ `Campaign` без Meta ID остануваат, или целосно се заменуваат со огледалото?
5. Повеќе рекламни акаунти по клиент: кога ќе треба во UI?
6. Затворање на таскот од `analitika` по крај на кампањата: предлог или автоматски?
