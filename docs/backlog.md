# Backlog — GoDigital Task Manager

Замена за Jira (одлука на сопственикот). Ова е единствениот извор на вистина за: (1) заклучени одлуки, (2) отворени прашања по фаза, (3) дизајн-дупки што чекаат мокап, (4) Фаза 2+ идеи, (5) технички долг. Идеја надвор од тековната фаза оди тука, **не** во тековниот sprint.

Последно ажурирано: 2026-09-22

---

## 1. Заклучени одлуки (D-1…D-12)

Потврдени од сопственикот на 2026-09-22. Овие се финални; не се отвораат повторно без ADR.

| #    | Одлука                                                                  | Исход                                                                    | Каде е спроведена                                    |
| ---- | ----------------------------------------------------------------------- | ------------------------------------------------------------------------ | ---------------------------------------------------- |
| D-1  | Нов статус `cekaSnimanje` (Чека снимање) меѓу `mrtov` и `chekaRezija`   | ✅ Прифатено                                                             | `packages/core` статуси + матрица (A3/A4)            |
| D-2  | Датумот на слотот останува при активација (без прераспоредување)        | ✅ Прифатено                                                             | `E_ACTIVATE_CHILDREN` без промена на датум (A4)      |
| D-3  | Графика: поединечна активација + bulk „Активирај ги сите"               | ✅ Прифатено                                                             | Капа графика панел (A5)                              |
| D-4  | Покриеност = испланиран контент; „готово до" втор индикатор             | ✅ Прифатено                                                             | `plannedCoverage` / `readyCoverage` (A2/A7)          |
| D-5  | Директор работи наместо секоја улога со причина + `onBehalfOfRole`      | ✅ Прифатено                                                             | `G_ROLE` + `Approval.onBehalfOfRole` (A3)            |
| D-6  | `objaveno` терминален без Meta Ads; `zavrseno` само по Аналитика        | ✅ Прифатено                                                             | Матрица + `E_AUTO_NEXT` (A6/B2)                      |
| D-7  | Капата се креира автоматски при потврда на месец                        | ✅ Прифатено                                                             | `POST /clients/:id/slots/confirm` (A2)               |
| D-8  | Табла: default по клиент; статус-колони при еден клиент; DnD само тогаш | ✅ Прифатено                                                             | Board (A3)                                           |
| D-9  | Коментари со @тагирање (потсетник)                                      | ✅ Прифатено                                                             | `Comment.mentions[]` (A3)                            |
| D-10 | Embedding провајдер + димензија                                         | ✅ **Voyage `voyage-multilingual-2`, `EMBED_DIM=1024`** (конфигурабилно) | `KnowledgeChunk` (A1 шема) / pipeline (B4) — види §2 |
| D-11 | Мобилно качување во A4 низ прелистувач (responsive); PWA во C           | ✅ Прифатено                                                             | Multipart upload (A4), PWA (C)                       |
| D-12 | Канал за критични аларми                                                | ✅ **Без Viber → in-app + email + SMS**                                  | `Notification` каналски слој (B1)                    |

Дополнителна инфраструктурна одлука (2026-09-22): **monorepo = pnpm workspaces + Turborepo**; **tenant-ready** (`tenantId` на сите примарни табели, default GoDigital); **модел = Opus default**; **тек = локално → GitHub → VPS deploy**.

---

## 2. Отворени прашања (мора да се затворат пред наведената фаза)

| #     | Прашање                                                                           | Извор                           | Мора пред  | Провизорно решение засега                                                                                                |
| ----- | --------------------------------------------------------------------------------- | ------------------------------- | ---------- | ------------------------------------------------------------------------------------------------------------------------ |
| O-A2  | Точен формат на „специфичен" календар (клиент со рачни слотови) — правила за внес | PRD v2 §20 #4                   | A2         | Рачен внес слотови во истиот екран за потврда; уникатност (клиент, тип, датум, orderInDay)                               |
| O-A4  | Политика за суров материјал: макс големина, формат, повеќе фајлови по капа        | PRD v2 §20 #5                   | A4         | Multipart 50MB делови, макс 20 GB/фајл, `video/*`                                                                        |
| O-D10 | Финална потврда на embedding по тест на 20 реални коментари од клиент             | D-10                            | B4         | Voyage `voyage-multilingual-2`, dim 1024; ако тестот падне → Cohere `embed-multilingual-v3.0` (исто 1024, без миграција) |
| O-B2a | Кои точни Meta метрики се влечат и мапирање кон `MetricSnapshot` полиња           | PRD v2 §20 #6                   | B2         | reach, impressions, views, engagement, spend, cpr, ctr, frequency                                                        |
| O-B2b | Ads decision прагови (кога реел/carousel влегува во decision queue)               | PRD v2 §20 #8                   | B2         | Од Template2 логика како почетна конфигурација, потврди со сопственик                                                    |
| O-B3  | Retention периоди по класа на asset (суров, финал, преглед)                       | PRD v2 §20 #9                   | B3         | Суров 7 дена + продолжување 30; финал/преглед траен                                                                      |
| O-B1  | SMS провајдер за критични аларми (Twilio / друг) + број на Директор               | D-12                            | B1         | Twilio adapter зад channel-agnostic слој                                                                                 |
| O-A7  | Формат/поле на извештај по клиент и месец (CSV колони)                            | PRD v2 §20 #7                   | A7/B2      | Табела од Админ → Извештаи + CSV export                                                                                  |
| O-gen | Точни GoDigital бои/лого/фонт (светла + темна тема)                               | Design Brief §12 отворено #1,#2 | пред A3 FE | Токени од Handoff README (финални); лого = GD плејсхолдер до реален asset                                                |
| O-D   | Ист дизајн систем за клиентска PWA?                                               | Design Brief отворено #3        | D          | Одлука во Фаза D                                                                                                         |

---

## 3. Дизајн-дупки (екрани што PRD ги бара, Handoff ги нема — дизајнирај пред фазата)

Од PRD v3 §3. Минимален прифатлив дизајн е опишан во PRD ако нема нов мокап.

| #   | Екран                                                            | Фаза | Статус                                                                                                                                                                                              |
| --- | ---------------------------------------------------------------- | ---- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| H1  | Предлог-распоред (преглед на слотови пред потврда)               | A2   | ✅ `Calendar.tsx` предлог режим                                                                                                                                                                     |
| H2  | Рачна корекција на поделба на сценарија                          | A4   | ✅ `CapaPanel.tsx` ScenarijaZone (split + исход по сценарио)                                                                                                                                        |
| H3  | Rule Builder (Автоматизации е read-only во прототип)             | B1   | ⛔ нема генерички engine (D-13); тенок on/off toggle                                                                                                                                                |
| H4  | Најава + заборавена лозинка                                      | A1   | ✅ РЕШЕНО (2026-10-01) — reset flow: `PasswordResetToken` + `/auth/forgot-password` + `/auth/reset-password` + екрани `ForgotPassword`/`ResetPassword` (план `docs/plans/H4-forgotten-password.md`) |
| H5  | Форми за клиент и вработен во Админ                              | A1   | ✅ `admin/Clients.tsx`, `admin/Employees.tsx`                                                                                                                                                       |
| H6  | Поставки за известувања по вработен                              | B1   | ✅ РЕШЕНО (2026-09-24) — `screens/Settings.tsx`; toggle за потсетници (alarm/kritичен задолжителни); `/me` враќа `notificationPrefs`, `/me/notification-prefs` PATCH; влез преку аватар             |
| H7  | Сторидж акции (продолжи +30 дена, локална архива)                | B3   | ✅ `CapaPanel` StoragePanel (одбројување + продолжи +30 + локална архива)                                                                                                                           |
| H8  | Прикачување суров материјал на десктоп (multipart, продолжување) | A4   | ✅ presigned multipart + `UploadSession`                                                                                                                                                            |
| H9  | Аналитичар — форма за кампања                                    | B2   | ✅ `CampaignsManager.tsx` (create/edit) + Campaign CRUD                                                                                                                                             |
| H10 | Извештај по клиент и месец                                       | B2   | ✅ `ReportModal.tsx` + `/reports/clients(.csv)` (табела + CSV)                                                                                                                                      |

---

## 4. Фаза 2+ (одложено, не се работи сега)

- Мулти-тенант активација (кога системот ќе се лиценцира на друга агенција) — шемата е веќе tenant-ready, преостанува: tenant-scoped auth realms, tenant onboarding, per-tenant конфигурација.
- Дополнителни AI модули надвор од B5–B7.
- Напреден извештаен слој / BI dashboard.
- Интеграции (Google Drive, надворешни календари) — само ако се појави потреба.
- Двофакторна автентикација за Директор/Админ.
- **Клиентско одобрување на CRM понуда/договор (Фаза D)** — одложено од D2 (2026-10-01). D2 покри САМО креативи на `kajKlient` (task), бидејќи тоа чисто се вклопува во постоечкиот `E_APPROVAL` ефект + `Approval.source`. CRM одобрувањето е посебен дизајн: `transitionLead` е **owner-gated на sales агентот** и CRM **не создава `Approval` записи** (клиентската одлука денес е имплицитна во преодот `ponudaKlient→sostanok`/`dogKlient→strategija`). За клиентски PWA пат низ CRM треба: client-realm пат што го заобиколува owner-check, начин за запис на клиентска одлука (Approval или ново поле), и видливост на `clientVisible` CRM полиња. Посебен план пред имплементација.

---

## 5. Технички долг

| #    | Опис                                                                                | Зошто настанал                                                                                                                                                 | Предложена поправка                                                                                                                                                                                                                                                                                                                                                                  | Ризик                                  |
| ---- | ----------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ | -------------------------------------- |
| TD-1 | ✅ РЕШЕНО (2026-10-01) — прод build/резолуција на `@gd/db`                          | `@gd/db.main/exports` сега → `dist/index.js` (JS); dev (tsx/vite) резолвира преку tsconfig `paths`→src, vitest преку alias→src; прод `node` преку exports→dist | `build` = `prisma generate && tsc -p tsconfig.build.json && copy generated→dist`; `tsconfig.build.json`; Dockerfile (api/worker) прави `@gd/db build`. Prisma client НЕ се bundle-ира. Верификувано: `node` резолвира `@gd/db`→dist од apps/api; dev + unit/typecheck/lint зелени.                                                                                                   | Решен                                  |
| TD-2 | ✅ РЕШЕНО (2026-10-01) — `package.json#prisma` → `prisma.config.ts`                 | Prisma 6.19 предупредуваше                                                                                                                                     | Создаден `packages/db/prisma.config.ts` (`defineConfig`, `schema` + `migrations.seed`), отстранет deprecated блок. generate/migrate/seed потврдени без предупредување. НАПОМЕНА: config исклучува auto-`.env` — env доаѓа од process.env (CI env / source .env.local).                                                                                                               | Решен                                  |
| TD-3 | ✅ РЕШЕНО (2026-09-24) — ESLint правило за `status` запис надвор од state machine   | Беше само коментар + code review; наменско правило бара `@gd/eslint-plugin`                                                                                    | Создаден `@gd/eslint-plugin` со `no-task-status-write`: фаќа `<x>.task\|taskGroup.update\|updateMany\|upsert` со `data.status`; allowlist `apps/api/src/services/workflow/**` + тестови/seed преку `ignores`; wired во root `eslint.config.js` (`error`); RuleTester + end-to-end проверка. Slot/upload/scenario status не се фаќаат.                                                | Решен                                  |
| TD-4 | Tenant extension не пресретнува `findUnique`/`update`/`delete` (unique-where по id) | Инјектирање tenantId во unique-where би паднало во Prisma; денес е еден тенант, id е глобален uuid                                                             | При активација на мулти-тенант: замени со `findFirst`/`updateMany` со tenant-guard, или post-fetch проверка на `tenantId`                                                                                                                                                                                                                                                            | Низок денес, критичен при мулти-тенант |
| TD-5 | ✅ РЕШЕНО (2026-10-01) — append-only преку DB привилегии (прод two-role)            | Dev = единствен owner role (no-op); прод = `gd_app` (app) ≠ owner (migrate)                                                                                    | Миграција `append_only_revoke` (guarded `REVOKE UPDATE,DELETE … FROM gd_app`); postgres bootstrap `docker/postgres-init/01-app-role.sh` создава `gd_app` + grants + ALTER DEFAULT PRIVILEGES; `DATABASE_URL`=gd_app, `MIGRATE_DATABASE_URL`=owner; `deploy.sh` migrate чекор како owner. Верификувано: миграцијата поминува (no-op во dev). Вистинска заштита = staging со two-role. | Решен (активен во прод two-role)       |

**TD-6 — ✅ РЕШЕНО (2026-09-23).** `turbo` паѓаше со `spawn UNKNOWN` (errno -4094) од root: `pnpm test/lint/typecheck/build` не работеа. Вистинска причина: turbo **daemon**-от не може да се spawn-не под Node 26.7 (`turbo --version` и `turbo run … --no-daemon` работеа; само daemon child-spawn паѓаше). Поправка: `"daemon": false` во `turbo.json` — сите root скрипти + pre-push hook работат нормално (FULL TURBO кеш активен).

**TD-7 — ✅ РЕШЕНО (2026-09-24).** `packages/core` беше на 99.41% (gate 90/85/90/90). Додадени тестови за достижните празнини: `coverage.ts` (`readyCoverage`/`clientCoverage` враќаат 0 на празни влезови), `metrics.ts` (toNum fall-through за boolean/object/празен string/нефинитен број, named-array со примитивна вредност / `value` наместо `values[]` / невалидни записи, `gte` оператор). `publications.ts` рефакториран во циклус со патерни; единствената недостижна `?? null` гранка (задолжителна capture група под `noUncheckedIndexedAccess`) означена со `/* v8 ignore */` + образложение. Gate кренат на **100/100/100/100** (vitest.config.ts). Сега 86 тестови, целосно зелено. CLAUDE §13 задоволен.

**TD-8 — ✅ РЕШЕНО (2026-09-24).** Доделување при враќање можеше да остане без извршител. `E_ASSIGN(mon)`/`E_ASSIGN(diz)` при враќање (`vnatresno→montaza`, `vnatresno→dizajn`, `kajKlient→montaza/dizajn`) немаат `G_ASSIGNEE_REQUIRED`, па ако немаше `payload.assigneeId` ниту `client.defaultAssignees[role]`, `resolveAssignee` враќаше `null` и таскот беше недоделен — own-scope улогата (mon/diz) не го гледаше. Причина: оригиналниот монтажер/дизајнер не се чуваше одделно. Поправка: додадени `Task.monId`/`Task.dizId` (мигрирано, како `rezId`/`kreaId`); `E_ASSIGN` ги перзистира по улога; `resolveAssignee` сега чита `payload → перзистиран извршител по улога → default по клиент`, па враќањето го наследува претходниот извршител (важи и за rez/krea што порано ги чуваа но не ги читаа колоните). Регресиски тестови во `transition.integration.test.ts`. Нема промена во матрицата (guards/преоди непроменети).

**TD-11 — Мета fidelity: две ситници одложени (MF6, 2026-09-29).** По усогласувањето на Мета со прототипот (MF0–MF6), останаа две козметички рефинирања: (1) **AI асистент како страничен панел-toggle** покрај содржината (сега е full таб „Асистент" — функционално комплетен, но прототипот го прикажува како 380px странечки панел што се отвора преку toggle во топ-барот); (2) **полн ad-set master-detail** во табот „Реклами" на „Мета · Клиент" (сега е структура-дрво со KPI + акции преку Планови; прототипот има двоколонски master-detail со десен панел на избран ad set — KPI грид, листа реклами со thumbnails/CTA/пауза). Двете се UI-рефинирања без функционална празнина. Ризик: низок.

**TD-10 — i18n runtime постои, но само Мета е мигриран; остатокот од апликацијата е hardcoded.** До 2026-09-29 `packages/ui/i18n/mk.json` постоеше но никаде не се консумираше — сите UI стрингови беа hardcoded во компоненти (спротивно на CLAUDE.md §4). Изграден е лесен runtime без зависност (`t()` + `plural()` во `@gd/ui`, ICU-plural со македонски one/few/other, тестиран во `apps/web/src/lib/i18n.test.ts`). **Мета модулот се мигрира во mk.json фаза-по-фаза (MF0–MF6).** Обврска: мигрирај ги преостанатите екрани (Задачи, Календар, Клиенти, Аналитика, Админ, Преглед, Login…) во `mk.json` + `t()`, отстрани ги hardcoded стринговите. Ризик: низок (функционално работи; само конзистентност/§4 долг). План: посебна chore по завршување на Мета fidelity.

**TD-9 — `prisma migrate dev` генерира `DROP INDEX` за pgvector индексите.** `knowledge_chunk_embedding_hnsw` (HNSW) и `knowledge_chunk_tsv_gin` (GIN) се создадени преку raw SQL во init миграцијата и не постојат во `schema.prisma`, па shadow-DB diff-от ги гледа како drift и **секоја** нова автогенерирана миграција почнува со `DROP INDEX` за нив. Ако тоа помине во commit → индексите се губат на deploy. Обврска: при секоја нова миграција **избриши ги DROP INDEX линиите за овие два индекси** пред commit (видено и рачно поправено при TD-8, 2026-09-24). Трајна поправка (кога ќе стигне B4): претстави ги индексите во schema.prisma преку `@@index(..., type: ...)` каде Prisma поддржува, или задржи ја дисциплината + тест што проверува дека индексите постојат по `migrate deploy`. Ризик: среден (тивка загуба на векторски/FTS индекси при невнимание).

---

## 5b. Известувања и автоматизации — заклучена архитектура (2026-09-24)

Потврдено од сопственикот. Направено во оваа фаза (замена на мртвите B1 stub-ови со работечка in-app основа):

- **`E_NOTIFY`/`E_ALARM` се живи** — effect runner-ите собираат intent, преодните сервиси праќаат по commit (best-effort). Нова задача/враќање → `potsetnik` до извршителот; 3-то враќање од клиент → `kritichen` до Директор; вишок сценарија → `kritichen` до Директор. Известувањата се кликливи (навигација до таск/капа + означи прочитано); `kritichen` бара модал „Видено".
- **Email** (`alarm`/`kritichen`) преку SMTP (nodemailer). Локално = Mailhog (`SMTP_PORT=1135`); прод = env. Само за нов запис (не се re-emil-ира дедуплициран аларм). **SMS сè уште одложен** — бара надворешен провајдер (Twilio/сл.) + credentials; одлука во deployment фаза.
- **Аларм за покриеност** сега го почитува `AutomationRule.enabled` (Админ → Аларми toggle работи).

**Одлука за Rule Builder (D-13):** НЕ се гради генерички engine што чита `trigger/conditions/actions` JSON и извршува. Системските правила остануваат **тенок on/off + прагови над хардкодираните евалуатори** (како аларм за покриеност). Причина: генерички engine би го дуплирал state machine-от (спротивно на §3 „derive, not duplicate") и е преголем за една агенција. Кога ќе затреба нов аларм, се пишува хардкодиран евалуатор гатиран од неговото правило. `AutomationRule.trigger/conditions/actions` и `AutomationRun` остануваат како идна проширливост; денес се празни. **Rule Builder UI/engine = Фаза B1, само ако се потврди потреба.**

**Статус на B1 (ажур. 2026-10-01):** ✅ H6 (поставки за известувања) · ✅ `notifications.digest` · ✅ **Rule Builder engine + UI (H3, ADR-001 отповика D-13)** — bounded data-driven engine (нема дуплирање на state machine), Админ → Аларми со create/edit/delete · ✅ **SMS за `kritichen` (O-B1)** — Twilio adapter (`lib/sms.ts`, raw HTTP, dev-stub без credentials) жичен во `createNotification`; **активација во deployment со `TWILIO_*` env + број на Директор**. B1 функционално комплетен; SMS испраќањето чека само prod credentials.

**Статус на B2/B3/B4 (2026-09-24):** сите изградени зад адаптери со dev-stub (одлука: гради сè сега, вклучи со credentials).

**Статус на Фаза C / D (ажур. 2026-10-02):**

- **Фаза C (PWA за вработени) ✅ КОМПЛЕТНА** (потврдено со инвентар + build): VitePWA manifest (mk, standalone, икони) + service worker, offline банер + offline-read кеш (NetworkFirst за `/api` GET), update prompt „нова верзија", offline mutation queue (`lib/offlineQueue` + `api.ts` enqueue/flush), Web Push (Settings toggle → `enablePush` → `/push/subscribe` → `sendPushToEmployee`, VAPID). Build емитира `manifest.webmanifest` + `sw.js` + `push-sw.js` + workbox. Опционо рафинирање (не-блокира): Background Sync за resumable file-upload; mobile responsive аудит. Runtime PWA (install/offline/push) најдобро се тестира рачно на уред.
- **Фаза D (PWA за клиенти) ✅ КОМПЛЕТНА (2026-10-02, PR #54/#55/#56)** — план `docs/plans/PD-client-pwa.md`. **D1** (#54): одделен client auth realm (`ClientJwtPayload`, `requireClient`, realm-rejection во `requireAuth`), `ClientMagicToken` модел. **D2** (#55): magic-link (hashed еднократен токен, no-enumeration) + client approvals API (`/client/*`); `E_APPROVAL` стампа `source=clientPwa` + `enteredById=clientContactId`; одлука на сопственикот = server „on behalf of" носечката улога (rez/krea), матрицата непроменета; вклопен bugfix `E_APPROVAL(client,return)`→`returned`; 13 integration тестови. **D3** (#56): тенок мобилно-прв client PWA (`/client` landing+consume, листа, детал Одобри/Врати), одделен realm во `App` (без employee `useMe`), стрингови `client.*` во mk.json, 3 e2e. **Опсег:** само креативи на `kajKlient`; **CRM понуда/договор клиентско одобрување одложено** (§4 — CRM моторот е owner-gated на sales, нема clientPwa/Approval пат).

- **B2 (Meta + Аналитика) ✅:** `metrics.pull` (MetaClient stub/Graph), `/analytics`, жив Аналитика екран, Кампањи (H9), извештај+CSV (H10). План: `docs/plans/B2-meta-metrics-analytics.md`.
- **B3 (Сторидж) ✅:** retention cleanup + продолжи +30 + локална архива (H7), прегледи (PreviewGenerator stub/ffmpeg), квота аларм. План: `docs/plans/B3-storage-lifecycle.md`.
- **B4 (Знаење + Claude) ✅:** embedding pipeline (Voyage stub/real), `knowledge.index` + backfill, `/knowledge/search` (hybrid + RRF + ACL, pgvector raw SQL со tenantId), `/knowledge/assistant/ask` (Claude помошник stub/real преку backend proxy, raw HTTP за да не воведе `@anthropic-ai/sdk` — §18), панел UI (✦ Прашај). Гатиран по клиент со `claudeAssistant` модул.
- **Останати credentials/одлуки за прод:** Meta (`META_SYSTEM_TOKEN`), ffmpeg бинар (`FFMPEG_PATH`), Voyage (`VOYAGE_API_KEY` + O-D10 тест на 20 реални коментари), Claude (`ANTHROPIC_API_KEY`), SMS провајдер (O-B1). До тогаш stub адаптерите го носат целиот тек.

**Локална тест-околина — две замки (не се регресии, CI е чист):** (1) ако `.env.local` има `META_SYSTEM_TOKEN`, `metrics`/`analytics`/`reports` integration тестовите паѓаат — `getMetaClient()` оди на вистински Graph (→ 400); пушти ги со празен `META_SYSTEM_TOKEN` (како CI) за stub. (2) Заостанати непрочитани `kritichen` известувања прикажуваат блокирачки модал „Критичен аларм" што ги кине e2e навигациските клик-ови; `UPDATE "Notification" SET "readAt"=now() WHERE level='kritichen' AND "readAt" IS NULL;` пред e2e. Полн локален статус (02.10.2026): core 170/170 (100%), web 55/55, api 257/257, e2e 21/21.

**Конформност-ревизија (02.10.2026) — резултати:** И1–И9, дозволи §4, покриеност §4.9, рокови §4.10, наративи §4.12, state machine §4.3 — потврдени (enforced + tested). Зацврстено: G1 `transitions.fixture.json` + табеларен тест (#58), G2 token-completeness guardrail (#58), G3 централен `EventType` каталог + празен-наратив гард (#58).

**§18 e2e-покриеност (G4):** PRD §18 бара „еден e2e по чекбокс". Проценка по критериум:

- **Најден реален пропуст → поправен:** `POST /tasks/:id/date-change` немаше НИКАКОВ тест (ни integration) → додаден `date-change.integration.test.ts` (дозволи, причина-И5, минато, слот-резолуција, DateChange + EventLog).
- **Покриено (integration/unit, цитирано):** bulk активација `activate-all` (group.integration:290), @mention коментар (tasks.integration:87), сторидж +30 `storage/extend` (storage.integration:71), Meta аларми `evaluateAlerts` (meta-sync.integration:88), Board DnD draggability (core `isBoardDraggable`, transitions.test).
- **e2e task-seeding harness ИЗГРАДЕН:** `e2e/fixtures.ts` (Prisma од генерираниот клиент) + `global-setup`/`global-teardown` seed-ираат детерминистички ентитети (капа во gPodgotovka + мртви деца; активен graphic таск) во изолирани месеци за „Филтер Вода", ID-евата во `.seed-ids.json`. Spec-овите навигираат преку deep-link URL (`/tasks?capa=…` / `?task=…` / `?tab=board&client=…`) → стабилно, без click-through. **Додадени e2e:** `board.spec.ts` (seeded таск во Табла), `capa-bulk.spec.ts` (gPodgotovka → активирај → toast), `date-change.spec.ts` (модал → Потврди → Готово). Полн e2e: 24/24.
- **Останува integration-only (свесно):** преглед на креатива со реална медиа (R2 presigned — не се тврди медиа-рендер), Board реален HTML5 DnD (flaky во Playwright; draggability логиката е unit-тестирана), наследување заеднички материјал = референцен модел (фајлови по `ownerType`+`ownerId`, нема copy-логика за тестирање).

---

## 6. Hotfix / Improvement бројач

Тековниот бројач е во `docs/hi-counter.txt`. Секое Hotfix/Improvement fast-track го инкрементира (види CLAUDE.md → Hotfix / Improvement Fast-Track).
