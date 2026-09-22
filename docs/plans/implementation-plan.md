# План за имплементација — GoDigital Task Manager

Верзија 1.0 · 2026-09-22 · Статус: **активен**

Овој документ е детален, редослед-по-редослед план за градење на таск-менаџерот **без грешки**, изведен од `PRD_v3_Revizija_i_Specifikacija.md` (врховен извор за логика), Handoff (визуелен дизајн) и `CLAUDE.md` (инженерски правила). Секоја фаза има конкретни задачи, патеки на фајлови, PRD референци и **Definition of Done (DoD) gate**. Фаза не почнува додека претходниот gate не помине со реални податоци.

**Како се користи:** пред секоја задача → прочитај ја наведената PRD секција → имплементирај по редоследот „core → db → api → hook → component" → зелени `typecheck/test/lint` пред commit. Отстапка од план = ажурирај го овој фајл во истиот PR.

---

## 0. Резиме на анализата (крос-проверка на трите документи)

Пред планот, наодите од деталната анализа — што е конзистентно, што беше конфликт, што е решено:

### Што е цврсто и конзистентно

- **Улоги (9):** `dir, am, rez, scen, kam, mon, krea, diz, ana` — идентични во PRD v3 §4, Handoff `ROLE_CFG` и CLAUDE.md глосар.
- **Статуси и бои:** Handoff `ST`/`CAP_ST` се совпаѓаат со PRD v3 §4.1/§4.2; PRD додава `cekaSnimanje` и `zavrseno` (D-1/D-6).
- **Дизајн токени:** финални и целосни во Handoff README (бои, типографија, растојанија, радиуси, сенки, движење, димензии). Нема двосмисленост.
- **Принцип „Derive, never store":** и прототипот (README) и PRD (§4.4) го налагаат — усогласено.

### Конфликти што беа решени (не се отвораат повторно)

- 11-те PRD↔Handoff контрадикции → PRD v3 §1 + одлуки D-1…D-12 (сите потврдени, види `backlog.md §1`).
- Auth: express-session (Template1) → **JWT** (PRD победува).
- Storage: MinIO/Cloudinary (Template1) → **Cloudflare R2** (PRD победува); MinIO само како локален R2-сурогат во dev.
- Multi-tenant: PRD молчи → **tenant-ready** (одлука на сопственикот).
- Model/Jira/deploy: → Opus / без Jira (backlog) / локално→GitHub→VPS.

### Ризични точки за внимание при имплементација (детали во §9)

1. **`E_ACTIVATE_CHILDREN` семантика** (D-2 vs прототипски `freeSlotsFor`) — датумот **останува**; не порта `freeSlotsFor`.
2. **Единствен извор на логика** — секое `if (status===…)` надвор од `packages/core` е bug.
3. **Append-only спроведено во база** (DB привилегии), не само во код.
4. **Активациски тек видео** е двостепен: `scenKajKlient→snimanje` активира деца во `cekaSnimanje`; `snimanje→zatvoren` (при суров материјал) ги носи во `chekaRezija`.
5. **Покриеност** — една функција, три места на прикажување; не дуплирај.

---

## 1. Архитектура и монорепо (pnpm + Turborepo)

```
godigital-task-manager/
├─ pnpm-workspace.yaml          # apps/*, packages/*
├─ turbo.json                   # pipeline: build, dev, test, lint, typecheck
├─ package.json                 # root scripts + devDeps (turbo, prettier, husky, commitlint)
├─ tsconfig.base.json           # strict, paths кон @gd/*
├─ .eslintrc / eslint.config.js · .prettierrc · commitlint.config.js
├─ .husky/                      # pre-commit (lint-staged, gitleaks), commit-msg, pre-push
├─ docker-compose.yml           # postgres+pgvector, redis, minio, mailhog, nginx, api, web, worker
├─ .env.example
├─ apps/
│  ├─ web/     @gd/web    React 19 + Vite + TS + Tailwind 4 + Zustand + TanStack Query
│  ├─ api/     @gd/api    Express 5 + Prisma client + Socket.io + Zod
│  └─ worker/  @gd/worker BullMQ + ffmpeg
├─ packages/
│  ├─ core/    @gd/core   чист TS: statuses, transitions, guards, effects, permissions,
│  │                       coverage, deadlines, narratives, slot-algorithm. 100% тестови.
│  ├─ db/      @gd/db     Prisma schema, migrations, seed, generated client re-export
│  └─ ui/      @gd/ui     токени (tokens.css + ts), компоненти, i18n/mk.json
└─ docs/       (веќе постои)
```

**Пакетни зависности (насока на увоз):** `web/api/worker → core, db, ui`; `core` не увезува ништо од apps/db (чист домен); `db` увезува `core` само за enum вредности ако треба (или ги дуплира enum-ите генерирани од core). **Забрането:** `core` да има I/O (нема Prisma, нема fetch).

**Turbo pipeline:** `build` (dependsOn `^build`), `test`, `lint`, `typecheck`, `dev` (persistent). Кеш на `core`/`ui` builds.

---

## 2. Заеднички темели (се прават во A1, важат секаде)

| Тема                   | Задача                                                                                         | Патека                                                                |
| ---------------------- | ---------------------------------------------------------------------------------------------- | --------------------------------------------------------------------- |
| Env валидација         | Zod schema за сите env; апликацијата паѓа ако недостасува                                      | `apps/*/src/env.ts`                                                   |
| Грешки                 | `AppError(code, messageMk, details?)`; Express error middleware → `{ code, message, details }` | `apps/api/src/lib/errors.ts` + `packages/core/src/errors.ts` (кодови) |
| i18n                   | `mk.json` + `t(key, params)` со ICU плурали                                                    | `packages/ui/src/i18n/`                                               |
| Toast/loading/skeleton | компоненти по Design Brief §11                                                                 | `packages/ui/src/feedback/`                                           |
| EventLog + Outbox      | `recordEvent()` во иста трансакција; Outbox drainer во worker                                  | `packages/core/src/events/` + `apps/api/src/lib/tx.ts`                |
| Real-time              | Socket.io сервер, соби `all`/`client:{id}`/`employee:{id}`, payload од Outbox                  | `apps/api/src/realtime/`                                              |
| tenant scope           | Prisma extension што инјектира `tenantId` од JWT во секој query                                | `apps/api/src/db/tenantExtension.ts`                                  |

---

## 3. Фаза A — Таск-менаџер (јадро)

### A1 — Темели, `core`, шема, auth, Админ read-only

**Цел:** работлив монорепо + целосна Prisma шема + auth + основен Админ. `docker compose up` крева сè.

Задачи:

1. **Монорепо + tooling** (§1): pnpm workspace, turbo, tsconfig.base, ESLint/Prettier/Husky/commitlint/gitleaks, Vitest + Playwright config, `.env.example`.
2. **`docker-compose.yml`:** postgres 16 + pgvector, redis 7, minio, mailhog, nginx, api, web, worker; health checks; single `pnpm dev` / `docker compose up`.
3. **`packages/core` — домен (со тестови):**
   - `statuses.ts` — `ALL_STATUSES`, `TaskStatus`, `GroupStatus`, owner по статус, терминали (PRD §4.1/§4.2).
   - `workflow/transitions.ts` — матрица како податок (PRD §4.3), сите редови видео/графика/капа/специјални.
   - `workflow/guards.ts` — сите `G_*` (PRD §4.3), враќаат `{ ok } | { ok:false, code, missing[] }`.
   - `workflow/effects.ts` — типизирани `E_*` дескриптори (извршувањето е во api service; core само ги дефинира).
   - `permissions.ts` — по улога `{ nav, scope, canCreate, canChangeDate, write }` (PRD §4.11; `nav`/`scope` од `ROLE_CFG`).
   - `coverage.ts` — `plannedCoverage`, `readyCoverage`, `clientCoverage` (PRD §4.9).
   - `deadlines.ts` — `deadlineFor(task|group)` со `StatusDeadlineConfig` резолуција (PRD §4.10).
   - `slots/algorithm.ts` — детерминистички распоред (PRD §4.5).
   - `events/narratives.ts` — шаблон по `eventType` (PRD §4.12); тест: секој enum има шаблон.
   - **Тестови:** табеларен `transitions.fixture.json` + unit за секоја функција. **100% покриеност — gate.**
4. **`packages/db` — Prisma шема КОМПЛЕТНА** (PRD §4.4): сите модели (`Client, Employee, CalendarConfig, Holiday, PublishingSlot, TaskGroup, Task, Scenario, Revision, Approval, Comment, Publication, Campaign, Promotion, MetricSnapshot, FileAsset, UploadSession, DateChange, StatusDeadlineConfig, AutomationRule, AutomationRun, ModuleAssignment, Notification, SavedView, EventLog, Outbox, KnowledgeChunk`). `tenantId` на сите. pgvector инсталиран, `KnowledgeChunk.embedding vector(1024)`. DB инваријанти како constraints/triggers (CLAUDE.md §15.5). Append-only grant за `EventLog/MetricSnapshot/Revision/Approval`.
5. **Auth (JWT):** `POST /auth/login|refresh|logout`, `GET /me`; access 15м + refresh 30д httpOnly; rate limit на login; `tenantId`+`role` во claim; middleware `requireAuth`, `requireRole`, `requireClientAccess`.
6. **CRUD:** `Client`, `Employee`, `CalendarConfig`, `Holiday` (Zod валидација, EventLog на секоја mutation).
7. **Админ конзола (read-only каде треба):** Клиенти (форми H5), Вработени и улоги (форми H5), Улоги и дозволи (read-only матрица од `permissions.ts`), Календари. + Најава екран (H4).
8. **App shell:** rail 64px + context 240px + top 56px + toolbar 48px (Design Brief §4); rout­ер; light/dark токени; toast/skeleton/empty states.
9. **Seed** (`packages/db/seed`): 6 клиенти + 9 вработени (илустративно, од прототип), стандарден календар, празници (8, 11 сеп), `StatusDeadlineConfig` default, 15 системски правила (само записи), модули.

**DoD gate A1:** `docker compose up` работи; `core` тестови 100% зелени; секој API повик без дозвола → `FORBIDDEN_ROLE`/`401` (тест); секоја mutation има EventLog со наратив; сите вработени + барем неколку клиенти внесени; миграцијата тргнува чиста.

---

### A2 — Слотови и календар

**Цел:** генерирање, предлог, потврда на месец, мртви таскови, промена на датум.

Задачи:

1. `slots.generate` BullMQ repeatable job, cron `0 6 20 * *` Europe/Skopje, идемпотентен по (клиент, месец) (PRD §4.5); при активација на клиент — тековен + следен месец.
2. Endpoints: `GET /clients/:id/slots?month`, `POST /clients/:id/slots/generate`, `PATCH /slots/:id`, `POST /clients/:id/slots/confirm` (PRD §4.5).
3. **Потврда на месец** = `predlog → reserved` + креира `Task(status=mrtov)` по слот + `TaskGroup` по тип (D-7, автоматска капа). Клиент `specificen` → рачен внес слотови во истиот екран.
4. **Календар екран** (Handoff §4): месечна мрежа + ден-панел; сопствена месечна навигација; режим **„Предлог за {месец}"** (H1) — испрекинати слотови, влечење без причина, „Потврди месец".
5. **Промена на датум** `POST /tasks/:id/date-change {newDate, orderInDay?, reason}` (PRD §4.5): дозволи `dir/am/rez(видео)/krea(графика)`; `newDate ≥ денес`; стар слот → `free`; `DateChange` + EventLog; наслов се регенерира ако `titleIsAuto`. Модал по Handoff.
6. Покриеност ленти/чипови користат `plannedCoverage` (A1 функција).

**DoD gate A2:** PRD §18 „Клиенти и календар" + „Датуми" чекбоксови зелени; еден клиент има целосно резервиран месец со мртви таскови.

---

### A3 — Таскови, state machine, List/Board/Мои задачи

**Цел:** реалните таскови поминуваат низ статуси преку state machine; трите работни прегледи.

Задачи:

1. **`transitionTask` / `transitionTaskGroup` сервис** (api) — извршува guards → статус → effects → EventLog → Outbox, во **една трансакција** (CLAUDE.md И2). `POST /tasks/:id/transition`, `POST /task-groups/:id/transition`.
2. **Task Detail панел** (Handoff §5, Design Brief §8): header (статус, тим аватари, `✦ Прашај` ако модул, expand, ⋯, close); мета грид; **работна зона по статус** (сите видови од Handoff, заклучување по ownership — CLAUDE.md И4); собирливи секции Контекст/Креатива/Објава/Активност; composer за коментари.
3. **List** (Handoff §2): капа strip, sticky header, собирливи групи по клиент/статус, 7 колони, покриеност чип, резервирани слотови стил, toolbar (Филтер/Подреди/Групирај/Опции/search), sidebar месеци (multi-select) + клиенти. `SavedView` (G14).
4. **Board** (Handoff §3, D-8): default групирање по клиент; еден клиент → статус-колони; DnD само во статус-групирање и само за преоди без input-guards (CLAUDE.md §6); валиден/невалиден drop feedback; toast за одбиени.
5. **Мои задачи** (Handoff §1): филтер = мои таскови во статус што мојата улога го носи; секции по итност; Директор посебно.
6. **Коментари/Активност** (D-9): `Comment` со @тагирање → потсетник; `GET /tasks/:id/activity` (EventLog + Comment споени хронолошки).
7. **In-app известувања 1–2** (основни): `nov_task`, `vraten`.

**DoD gate A3:** еден таск поминува рачно низ **целиот видео тек и целиот графички тек** (без капа претпродукција — почни од `mrtov` рачно); PRD §18 „Таскови и преоди" зелени; погрешна улога/невалиден преод одбиени со точен код.

---

### A4 — Видео капа (претпродукција + активација + суров материјал)

**Цел:** целиот видео претпродукциски тек до активација на децата.

Задачи:

1. Капа панел (Handoff §6): банер со 4-чекор прогрес; работна зона по капа статус.
2. `podgotovka → scenarija`: `G_CAPA_FIELDS` (сценарист, датум, час, место, насоки); `E_ASSIGN(scen)`.
3. `scenarija`: прикачување документ + **поделба на сценарија** со маркери + рачна корекција (H2); `G_SCENARIOS_SPLIT`.
4. `scenKajKlient`: **одговор по сценарио** (D-10 од v2 → PRD §4.7): исход по сценарио + „Заврши одговор"; ≥1 одобрено → `snimanje`; 0 → `scenarija` (враќање, нова верзија).
5. **Активација** `scenKajKlient → snimanje` (PRD §4.6): врзи одобрени сценарија 1:1 со мртви деца → `cekaSnimanje` (D-1); вишок/помалку → аларм 9 + `E_CREATE_EXTRA_SLOTS`. **Датумите остануваат (D-2).**
6. **Суров материјал** (H8, D-11): presigned multipart кон R2, `UploadSession`, продолжување по прекин, десктоп dropzone + responsive мобилен прелистувач; `snimanje → zatvoren`, деца `cekaSnimanje → chekaRezija`, `E_ASSIGN(rez)`, `E_STORAGE_TIMER`.

**DoD gate A4:** PRD §18 „Капа таск — видео" зелени; Камерман качува ~5 GB од телефон низ прелистувач со симулиран прекин и продолжување.

---

### A5 — Графика капа

Задачи:

1. Капа графика панел: заеднички материјали (документ, лого, месечни слики) + општи насоки; `gPodgotovka`.
2. Активација (PRD §4.6, D-3): поединечна (`mrtov → brifing` при „Започни брифинг") + bulk „Активирај ги сите слотови"; првата активација ја затвора капата (`gPodgotovka → zatvoren`); заедничките фајлови остануваат уредливи до крај на месец.
3. Наследување во деца: во статус Дизајн децата ги гледаат заедничките материјали (derived, не копирани).

**DoD gate A5:** еден месец графика од брифинг до внатрешно одобрување, со наследени материјали.

---

### A6 — Одобрување, верзии, објава, терминали

Задачи:

1. `Revision`/`Approval` ентитети + effects (`E_VERSION_BUMP`, `E_REVISION`, `E_APPROVAL`); враќања бараат коментар и креираат `v+1`.
2. **Преглед на креатива** (Handoff §10): fullscreen overlay, верзии strip, коментар sidebar 320px, Одобри/Врати.
3. `kajKlient`: три исхода (Одобрено / со измени / Врати) + канал + `Approval(source=employee)`.
4. **Објава** (PRD §4.8): `Publication` по платформа; `zaObjavuvanje → objaveno` бара копи + линк (`G_TEXT`+`G_PUBLICATION`); `externalRef` извлекување по шема; `E_SCHEDULE_METRICS`.
5. Терминали (D-6): `objaveno` терминален ако `!usesMetaAds`; инаку `E_AUTO_NEXT(analitika)` во иста трансакција.

**DoD gate A6:** целиот тек за еден клиент крај-до-крај (видео и графика); PRD §18 „Таск не може во Објавено без копи и линк".

---

### A7 — Преглед, Клиенти, Аналитика (празна), email

Задачи:

1. **Преглед** (Handoff §7, role-scoped): Покриеност по клиент (кликлив → List), Отворени аларми, Работа по статус (кликлив → Board филтриран), Кампањи во тек. Режисер верзија = само видео.
2. **Клиенти** екран (Handoff §8): табела, кликливи редови, unscoped покриеност.
3. **Аналитика** екран во празна состојба (без Meta податоци сеуште) — скелет за B2.
4. Извештај по клиент (H10 минимум) + CSV.
5. **Email известувања** (аларм ниво): `alarm` = in-app + email преку worker.
6. `GET /overview` (role-scoped: coverage[], alarms[], byStatus[], campaigns[]).

**DoD gate A7 (ПИЛОТ):** еден клиент цел месец во системот, **паралелно со постоечкиот Viber процес**. Директорот работи од Прегледот. По пилот: +5 клиенти, па сите 30. **Дури тогаш Фаза B.**

---

## 4. Фаза B — Модули (еден по еден, секој со свој gate)

| #   | Модул                                     | Клучни задачи                                                                                                                                                                                                                                                                                                                          | Зависи         | DoD gate                                                                                      |
| --- | ----------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------- | --------------------------------------------------------------------------------------------- |
| B1  | **Аларми + Rule Builder**                 | 15 системски `AutomationRule (isSystem)`; Rule Builder UI (H3): тригер/услови/акции/опсег/toggle + `AutomationRun` лог; заштита од јамка; дневен преглед `notifications.digest` 07:00; channel-agnostic `Notification` слој со `dedupeKey`; **критичен = in-app+email+SMS (Twilio, D-12)** + модал „Видено"; поставки по вработен (H6) | A7             | PRD §18 „Автоматизации"; аларм стигнува пред датумот                                          |
| B2  | **Meta метрики + Аналитика**              | worker `metrics.pull` (6ч), `MetricSnapshot` append-only; `publication.resolve` (`metaMediaId`, PRD §4.8); Аналитичар работна зона + `Campaign`/`Promotion` (H9); Аналитика екран со реални бројки; извештаи (H10)                                                                                                                     | A6             | месечен извештај од системот; PRD §18 „Meta"                                                  |
| B3  | **Сторидж животен циклус**                | 7-дневен `rawDeleteAt` тајмер + продолжување +30 (H7); локална архива поле; прегледни верзии (ffmpeg); квота аларм                                                                                                                                                                                                                     | A4             | PRD §18 „Сторидж"                                                                             |
| B4  | **Знаење + Claude помошник**              | `KnowledgeChunk` pipeline (Outbox→`knowledge.index`), **Voyage `voyage-multilingual-2` (1024)**; backfill; `POST /knowledge/search` (hybrid + RRF + ACL); `POST /assistant/ask` (панел 360px, само чита); `ModuleAssignment` проверка                                                                                                  | A1–A7 податоци | ботот точно одговара „зошто доцни таск X" и „правила за враќање"; статус секогаш од жива база |
| B5  | GoScripterAI (капа Сценарија → документ)  | Claude API преку proxy; резултат во поле за сценарија, рачна корекција                                                                                                                                                                                                                                                                 | B4             | Сценарист прифаќа/коригира                                                                    |
| B6  | GraficarAI (таск Дизајн → прилог верзија) | резултат како `FileAsset` верзија                                                                                                                                                                                                                                                                                                      | B4             | —                                                                                             |
| B7  | AI копирајтер (таск За објавување → копи) | библиотека на копи + резултат во поле                                                                                                                                                                                                                                                                                                  | B4             | —                                                                                             |

**Пред B4:** затвори O-D10 (тест на 20 реални коментари; ако Voyage падне → Cohere 1024, без миграција).

---

## 5. Фаза C — PWA за вработени

Веб е responsive од A3. C додава: manifest + service worker; офлајн читање на последни таскови; ред на офлајн промени со синхронизација; позадинско качување со продолжување; web push; мобилни екрани по Design Brief §10 (долна лента 5 ставки, неделен календар, лебдечка акција). **Gate:** Камерман работи цел месец само од телефон.

---

## 6. Фаза D — PWA за клиенти

`ClientContact` magic-link најава; `Approval.source=clientPwa`; статус се менува при клик на клиент; `visibility=clientVisible` филтер на `KnowledgeChunk` и содржини; сопствен минимален дизајн систем (O-D). **Gate:** еден клиент одобрува без Viber цел месец.

---

## 7. Тест-стратегија (по CLAUDE.md §13)

- **`packages/core`:** 100% unit; матрицата табеларно преку `transitions.fixture.json` (истиот фикстур → `processDoc` за бот + Админ Автоматизации табели).
- **api:** integration со реален Postgres (Docker); тест за секој ред од матрицата дека погрешна улога → `FORBIDDEN_ROLE`; tenant scope тест.
- **web:** component (Vitest + RTL) ≥ 60%.
- **e2e (Playwright):** еден тест по чекбокс од PRD §18; клучни текови: цел видео тек, цел графички тек, потврда на месец, промена на датум, објава без копи→блок.

---

## 8. Definition of Done по PR (секој PR)

- `core` тестови зелени; матрицата непроменета освен ако PR е `workflow-change` + ажуриран фикстур + PRD.
- Копи само низ i18n (мк, плурали); нема литерал во компонента.
- Нема `status =` надвор од state machine (lint).
- Секоја mutation → EventLog со наратив; append-only табели непопречени.
- `typecheck && test && lint` зелени; нова env → `.env.example`; нова зависност → оправдана + одобрена.

---

## 9. Регистар на ризици (внимавај при имплементација)

| Ризик                                               | Каде         | Митигација                                                                      |
| --------------------------------------------------- | ------------ | ------------------------------------------------------------------------------- |
| Дуплирана логика (status/coverage) надвор од `core` | секаде       | Lint правило + code review; `core` е единствен извор                            |
| Погрешна активациска семантика (датум се менува)    | A4 §4.6      | Експлицитен тест: датум пред = датум по активација; **не** порта `freeSlotsFor` |
| Двостепена видео активација збркана                 | A4           | `cekaSnimanje` (D-1) е задолжителен; тест за двата преода                       |
| Race при паралелна потврда/креирање слотови         | A2           | Unique constraint + атомска трансакција                                         |
| EventLog/Outbox „dual write"                        | сите преоди  | Една трансакција + Outbox drainer; никогаш директен emit од контролер           |
| tenant scope пропуст                                | сите queries | Prisma extension + тест дека query без tenantId паѓа                            |
| Embedding димензија заклучена прерано               | A1 шема      | `EMBED_DIM=1024` конфигурабилно; Voyage/Cohere и двата 1024 → без миграција     |
| Мобилно качување паѓа при прекин                    | A4           | `UploadSession` + resumable multipart; тест со симулиран прекин                 |
| Копи/плурали грешки (`1 дена`)                      | UI           | ICU плурали во `mk.json`; тест на плурал форми                                  |

---

## 10. Непосредни следни чекори

1. ✅ Одлуки D-1…D-12 потврдени → `backlog.md`.
2. ⏭️ **Изгради инфраструктура (A1 темели):** монорепо pnpm+turbo, tooling, docker-compose, `packages/core` скелет + прв тест, Prisma шема нацрт, auth скелет.
3. Потоа A1 целосно до gate, па A2… по редослед.
