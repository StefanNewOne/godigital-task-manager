# UI Test Findings — детален преглед копче-по-копче

Метод: во живо во прелистувач (Chrome, localhost:5173) + проверка на позадина (network/конзола/DB) → потоа Playwright за клучните текови.
Опсег: цел софтвер, со фокус на **Мета** и **Продажба (CRM)**.
Политика за багови: каталогизирај сè, поправај по приоритет (одлука на сопственикот).

Средина: api :3001, web :5173, worker активен; Docker (postgres 5532 / redis 6479 / minio 9100 / mailhog 1135).
Најавени тест-корисници (dev seed, само локално): `aleks@godigital.mk` (dir), `marija@godigital.mk` (sales) — dev лозинка од seed.

Severity: **S1** блокира · **S2** голем · **S3** мал/козметика · **S4** предлог.

---

## Каталог на наоди

| #    | Екран                 | Опис                                                                                                                                                                                                                                                                                                                                                                             | Severity          | Позадина (потврда)                                             | Статус                    |
| ---- | --------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | ----------------- | -------------------------------------------------------------- | ------------------------- |
| F-01 | i18n (tech debt)      | `MetaScreen.tsx` (O1–O12 label-и, статуси), `MonthApproval.tsx`, `lib/api.ts`, `api/files.ts`, `App.tsx`, `main.tsx` сè уште имаа hardcoded кирилични стрингови. **Решено:** мигрирани во `t()` (нови namespace-и `errors`, `monthApproval` + проширен `meta`); typecheck/lint/55 тестови зелени, нула заостаната кирилица.                                                      | S3                | grep = 0; typecheck/lint/test OK                               | **Решено (мигрирано)**    |
| F-02 | Преглед (Директорски) | ~~CDP screenshot timeout при 30 аларми~~ — **истражено, НЕ е баг.** Нема socket-client во web (нула real-time storm); `useNotifications` polls 60s; Overview користи 2 queries + мали `.map` рендери; апликацијата беше функционална цело време. Timeout-ите се CDP `captureScreenshot` флакавост во Vite dev build веднаш по re-render/fetch — tooling артефакт, не app freeze. | ~~S2~~ нема       | code review: нема socket, poll 60s, лесен рендер               | **Затворен (не е баг)**   |
| F-03 | Продажба · Нов лид    | Празните задолжителни полиња не добиваа визуелна ознака. **Решено:** по обид за поднесување, празните задолжителни (име, контакт лице, телефон-или-мејл) добиваат црвена рамка (И5), без disable на копчето (§8.5). Серверот и понатаму валидира (round-trip намерно задржан — §8.5 забранува сиви исклучени копчиња).                                                           | S4                | NewLeadModal: `tried` + `inputErr`                             | **Решено (И5 рамки)**     |
| F-04 | Мета (сите табови)    | Во dev немаше seed-ирана Мета структура → празни екрани. **Решено:** додаден `packages/db/prisma/meta-demo-seed.ts` (script `db:meta-demo`) — 9 connections, 7 campaigns, 9 ad sets, 12 ads, 240 insights, 8 alerts (crit/high/mid/info), 7 plans (сите статуси, ops O1/O2/O3/O6/O8/O9/O11), 4 разговори, 4 коментари, 5 органик објави, 3 page snapshots за 3 клиенти.          | S2 (за тестирање) | `db:meta-demo` OK; `/overview` alerts 8, 6 кампањи, `/plans` 7 | **Решено (seed додаден)** |

---

## Verified working (позадина потврдена)

- **Најава** — `POST /api/auth/login` 200, JWT + employee payload; dev seed креденцијали.
- **KritichenModal** — блокира app-wide; „Видено" → `POST /api/notifications/{id}/read` 200 + refetch `?unread=1`. End-to-end точно.
- **Продажба pipeline** — 11 колони (Нов лид…Активиран/Изгубен), rail (Сите активни / Чекаат директор / Без промена 5+ дена), агенти филтер, табови Pipeline/Одобрувања/Изгубени.
- **Нов лид (create)** — `POST /api/crm/leads` 201; податоци персистирани точно (name/person/phone/email/source=Препорака/pkgHint); `status=novLid`; `agentId`=избраниот агент (Директор доделува); **`tenantId=godigital`** (И1); EventLog наратив „Директорот креираше лид… и го додели на агент." (И2 + on-behalf). Панелот се отвора автоматски.
- **Валидација Нов лид** — празно → 400 + порака „Потребни се: име на бизнис, контакт лице и телефон или мејл." + toast „Проверете ги внесените полиња." (И5).
- **Сопственост (read-only за Директор)** — `canActOnLead`: agent-чекори само за доделениот агент; dir-чекори (одобрување понуда/договор) само Директор; во CRM нема D-5 on-behalf. Точно по дизајн.
- **Транзиции (позадина, `POST /crm/leads/:id/transition`)**:
  - `novLid→analiza` како агент-сопственик (Марија) → **200**, статус `analiza`; наратив „Продажен агент: Започна анализа."
  - `analiza→ponudaIzr` без документ за анализа → **400 GUARD_FAILED**, `details.missing:["документ за анализа"]`, порака „Недостасува: документ за анализа." (И5).
  - `analiza→ponudaIzr` како Директор (не-сопственик) → **403 FORBIDDEN_ROLE** „Само продажниот агент-сопственик може да дејствува." (server-side authz, defense in depth §9).
  - EventLog е append-only, наративи детерминистички на македонски (§4.12).
- **Токен-освежување (web)** — 401 на истечен access токен → `lib/api.ts` прави dedup-иран `POST /auth/refresh` + retry еднаш. Работи (не е баг).
- **Мета · рендер** — екранот се вчитува со сите 8 табови (Утрински преглед, Клиенти, Пресек, Планови, Архива, Поврзувања, Инбокс, Коментари), период + severity филтри, клиент филтер (7 клиенти), Освежи сега / Асистент.
- **Мета · backend** — `/meta/overview`, `/plans`, `/connections` = 200; сите рути role-scoped (dir/ana/am, §9). **D1 read-only потврдено**: планови имаат proposal животен циклус (`approve/reject/mark-done/withdraw`) — нема „execute-on-Meta" рута; системот предлага, човек извршува во Мета и означува „done".
- **§12 секрети** — `/meta/connections` враќа само метаподатоци за токен (name/configured/valid/scopes), НЕ вредност на токенот.

### Мета — детален тест со seed-ирани податоци (по F-04 решен)

- **Утрински преглед** — „Што бара внимание" листа со severity chips (Критично/Високо/Средно), Одложи/Видено по аларм; десен панел: Состојба на синхронизација (3 акаунти, 0 со грешка), Ниво на пристап (2 manage / 1 read-only) + текст „Системот само чита од Meta. Промените ги прави Директорот рачно во Ads Manager." (**D1 read-only видлив во UI**), Прашај асистент.
- **Аларм „Видено"** — `PATCH /api/meta/alerts/{id}` 200 → refetch alerts + overview. ✓
- **Планови** — proposal картички со op (O6/O3/O11/O2…), статус badge (Повлечен/Несовпаѓање/Одбиен/…), Цел, Пред→После diff (пр. „После: dailyBudget: 300"). Филтри: Сите/На чекање/Одобрени/Се проверуваат/Несовпаѓања. Pending план има Одобри/Одбиј (само Директор).
- **План Одобри** — `POST /api/meta/plans/{id}/approve` 200 → статус `pending→approved` персистиран (op O2). D1: менува само proposal, нема Meta write. ✓
- **Клиент detail** — 3 кампањи, ad set-ови вгнездени (c[0]=2 ad set-ови). ✓
- **Инбокс** 4 разговори · **Коментари** 4 · **Пресек** 200. ✓
- Токен-refresh на 401 работи и низ Мета повиците.

### Продажба — целосен 11-чекор pipeline (точка 1, backend end-to-end)

Лид „Кафе Мока" (Марија агент, Алекс директор) поминат низ сите статуси со реални inputs:
`novLid→analiza→ponudaIzr→ponudaOdob→ponudaKlient→sostanok→dogIzr→dogOdob→dogKlient→strategija→aktivacija→aktiviran` — секој 200.

- **Presigned R2 upload (И7)** — `POST /files/presign` 201 (single mode) → **PUT на MinIO 200** → `POST /crm/leads/:id/docs` 201. Прикачени: analysis, offer, contract, signed, strategy, fable.
- **Guard-success** — по прикачување, file-гардираните преоди (analiza→ponudaIzr, ponudaIzr→ponudaOdob, dogIzr→dogOdob, dogKlient→strategija, strategija→aktivacija) поминуваат.
- **Директорски одобрувања (E_APPROVAL)** — ponudaOdob→ponudaKlient и dogOdob→dogKlient од Директор; наративи „Директорот ја одобри понудата/договорот v1".
- **Meeting / Package** — `PUT /meeting {held:true}` и `PUT /package` 200 како задолжителен внес пред соодветните преоди.
- **Активација (E_ACTIVATE)** — aktivacija→aktiviran **создаде реален `Client` „Кафе Мока"** (usesMetaAds=false, standarden календар); наратив „Активираше клиент во Task Manager."
- Сите наративи append-only, детерминистички, македонски; верзионирање (понуда/договор v1). ✓

---

## Тек на тестирање (лог)

1. Најава (dir) → Преглед (F-02) → Продажба.
2. Исчистени 30 аларми преку API (read-marking) за да не блокира KritichenModal.
3. Нов лид „Кафе Мока" создаден и верификуван во позадина.
4. Pipeline транзиции верификувани (валидна, guard-fail, wrong-owner) — види Verified working.
5. Мета: рендер + backend + read-only потврдени; DATA празна (F-04) → блокира деталниот Мета клик-тест.

---

## Преостанато за целосен копче-по-копче тест (план)

**A. Мета (приоритет, блокирано на податоци — F-04):** треба seed на Мета структура
(MetaCampaign / MetaAdSet / MetaInsight / MetaAlert / MetaPlan / MetaConversation) со детерминистички
тест-податоци, за да се тестираат: Утрински преглед (severity), Клиенти (структура/профил/органик),
Пресек, Планови O1–O12 (предлог→approve/reject/mark-done/withdraw), Архива (+CSV export), Поврзувања,
Инбокс, Коментари, „Освежи сега" (invalidate+schedule), Асистент.

**B. Продажба (остаток):** полн 11-чекор pipeline со upload на документи (presigned R2) за
guard-success патеките (analiza→ponudaIzr→ponudaOdob→ponudaKlient→sostanok→dogIzr→dogOdob→dogKlient→
strategija→aktivacija→aktiviran), одобрувања од Директор, враќања (v+1), Изгубен/Реактивирај, Content планер,
Тим, Состанок no-show. Drag-and-drop на pipeline таблата.

**C. Остаток од апликацијата:** Задачи (Список/Табла/Детал/Мои задачи, drag-and-drop, коментари/@таг,
капа панел, креатива преглед), Календар + Снимања (промена на датум со причина), Клиенти CRUD,
Аналитика, Админ (7 под-екрани: улоги/дозволи, вработени, календари, клиенти, автоматизации, аларми),
Преглед, известувања (in-app/email преку Mailhog :8135).

**D. Playwright:** по живиот тест, клучните текови се кодираат како E2E (по AC во PRD §18), се вртат во CI.

**Средината останува кренати:** api :3001, web :5173, worker; логирај се со dev seed корисници.
