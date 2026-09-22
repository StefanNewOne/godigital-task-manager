# CLAUDE.md — GoDigital Task Manager

Ова е **живата уставна книга** на проектот. Claude Code го чита на секоја сесија. Сите правила подолу се задолжителни; отстапка се прави само со експлицитна одлука на сопственикот, запишана во `docs/backlog.md` или во ADR.

---

## 0. Редослед на читање документи (извор на вистина)

Кога работиш на нешто, читај по овој ред. Кога се косат — победува погорниот.

| #   | Документ                                                                                                 | За што е извор на вистина                                                                                                                                                                      |
| --- | -------------------------------------------------------------------------------------------------------- | ---------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- |
| 1   | **`PRD_v3_Revizija_i_Specifikacija.md`**                                                                 | **Врховен извор** за логика, податочен модел, state machine, guards, дозволи, покриеност, рокови, API, векторски слој, редослед на градење. Каде и да се коси со било што друго — важи PRD v3. |
| 2   | `PRD — GoDigital Task Manager v2.0.md`                                                                   | Процесен контекст (улоги, тек, принципи) за сè што v3 не спомнува.                                                                                                                             |
| 3   | `design_handoff_godigital_task_manager/README.md` + `reference/Design Brief - GoDigital Task Manager.md` | **Само визуелен дизајн**: токени, распоред, копи (кирилица, финална), состојби на компоненти. **Не** за податочен модел и логика.                                                              |
| 4   | `design_handoff_godigital_task_manager/GoDigital Task Manager.dc.html`                                   | Копи и распоред екран-по-екран. Читај го само за визуелна референца. **`support.js` НЕ се чита и НЕ се порта** — тоа е дизајн-алат, не производ.                                               |
| 5   | Овој `CLAUDE.md`                                                                                         | Инженерски правила, инваријанти, конвенции, работен процес.                                                                                                                                    |

**Кога PRD и Handoff се косат и не е решено во PRD v3 §1** → **застани и прашај го сопственикот**, не претпоставувај. PRD v3 §1 веќе ги реши 11-те познати контрадикции (D-1…D-12) — не ги отворај повторно.

### Што се порта од прототипот, што НЕ

- **Се порта:** токени, распоред, копи, состојби на компоненти, `ROLE_CFG.nav` (видливост на екрани), бои од `ST`, текстови на toast-ови.
- **НЕ се порта:** `absDay`, `m:'sep'|'oct'`, `date` како ден во месец, `freeSlotsFor`, `capActivate`, `STEP_LEAD` како хардкодирана константа, `DEFAULT_ASSIGNEES` како глобал, seed податоци како фикстур, целиот `support.js`.

---

## 1. Што е овој проект

**GoDigital Task Manager** — интерен таск-менаџер за GoDigital, македонска агенција за видео и графика. Го следи секое парче контент (видео и графика) од месечно планирање, преку продукција, внатрешно одобрување, одобрување од клиент, објава, до аналитика. Работниот модел е сличен на Asana (список, табла, календар, детален панел), но статусниот тек, сопственоста по улога и одобрувачките порти се специфични за GoDigital.

Два концепта го носат целиот производ:

1. **Капа таск (`TaskGroup`)** — месечен контејнер по клиент по тип содржина. Ја носи претпродукциската работа (сценарија, термин за снимање, заеднички материјали) и резервираните слотови. Кога капата се затвора, нејзините слотови оживуваат во реални таскови.
2. **Сопственост по статус** — секој статус го „носи" точно една улога. Само таа улога (плюс Директорот, D-5) може да дејствува во работната зона; за сите други таа е заклучена. Промените на статус се автоматски предавања, не слободни.

Дизајн-цел: **полесен од Asana за нашата специфична работа** — препознатлива структура, разлики само таму каде процесот е поинаков.

---

## 2. Stack (НЕ се менува без експлицитна одлука + ADR)

- **Frontend:** React 19 + TypeScript (strict) + Vite + TailwindCSS 4 + Zustand (само UI state) + TanStack Query 5 (server state) + React Router 7 + React Hook Form. PWA-ready од старт.
- **Backend:** Node.js 22 + Express 5 + Prisma 6 + PostgreSQL 16 (+ **pgvector**) + Redis + BullMQ (worker).
- **Real-time:** Socket.io (соби `all`, `client:{id}`, `employee:{id}`; payload од Outbox, не од контролер).
- **Storage:** **Cloudflare R2** (S3-компатибилен), presigned multipart, делови 50 MB.
- **Медиа:** ffmpeg worker за прегледи (видео 720p, слика 1200px).
- **AI (Фаза B4+):** Claude API **само** преку backend proxy (НИКОГАШ API клуч на frontend); pgvector RAG.
- **Auth:** **JWT** access 15 мин + refresh 30 дена (httpOnly cookie). НЕ express-session. (PRD §4.14 победува над Template1.)

---

## 3. Структура на repo (monorepo)

```
/apps
  /web        # React + Vite + TS, PWA-ready (интерна web/PWA)
  /api        # Express backend
  /worker     # BullMQ jobs + ffmpeg (slots.generate, knowledge.index, publication.resolve, files.preview, notifications.digest)
/packages
  /core       # чист TS, БЕЗ I/O: статуси, матрица на преоди, guards, effects,
              #   покриеност, рокови, дозволи, наративи. 100% unit тестови.
  /db         # Prisma schema, миграции, seed
  /ui         # токени (од Handoff) + заеднички компоненти + i18n/mk.json
/docs
  /architecture   # ADR, system-overview, legacy/reference
  /plans          # планови пред имплементација
  /deployment     # local.md, staging.md, production.md (со HTTPS)
  backlog.md      # „Фаза 2+" листа + технички долг + одлуки (замена за Jira)
```

**Златно правило за архитектура (PRD §0, §4.3):** статуси, преоди, guards, дозволи, покриеност, рокови и наративи живеат на **едно место — `packages/core`** — како **податок, не `if` гранки**, и се увезуваат од API, UI, Board drag-and-drop, Rule Builder и ботот. Ако ти треба `if (status === …)` **надвор** од `packages/core`, тоа е сигнал дека недостасува функција во `core`.

---

## 4. Јазик и текстови

- **Сите UI стрингови: македонска кирилица**, финални од прототипот. Не преведувај, не преформулирај.
- UI стрингови во **`packages/ui/i18n/mk.json`** — НИКОГАШ hardcoded во компоненти.
- Плурали со ICU: `1 ден / N дена`, `1 таск / N таска / N таскови`. Внимавај: `1 ден`, не `1 дена`.
- Код, коментари, имиња на променливи, commit пораки, идентификатори: **англиски**. Никогаш мешан јазик во идентификатор.
- Датуми на екран: `DD.MM.YYYY`, време 24h, недела почнува **понеделник**, зона `Europe/Skopje`. Без ГОЛЕМИ БУКВИ во македонски текст.

---

## 5. ТВРДИ ИНВАРИЈАНТИ — прекршување е bug, не стилска разлика

### И1. Tenant scope (tenant-ready)

Иако денес GoDigital е единствен тенант, системот се гради **tenant-ready** (одлука на сопственикот): **секоја примарна табела носи `tenantId`** (default = тенантот GoDigital), и **секој query носи експлицитен `tenantId` предикат**. `tenantId` доаѓа **исклучиво од JWT claim** — никогаш од request body, query или header. Спроведи го преку Prisma middleware/extension, не преку дисциплина на девелоперот. Ова важи и за R2 патеки, Redis клучеви, BullMQ payload-и и pgvector retrieval. Идна мулти-тенантност = конфигурација, не пренапишување. Raw SQL / `$queryRaw` мора да го носи условот и да има тест.

### И2. Статус се менува само преку transition функција

```ts
transitionTask(taskId, toStatus, actor, payload, ctx);
transitionTaskGroup(groupId, toStatus, actor, payload, ctx);
```

**НИКОГАШ** `prisma.task.update({ data: { status } })`. Матрицата е податок во `packages/core/src/workflow/transitions.ts` (PRD §4.3). Секој преод се извршува во **една DB трансакција**: провери `guards` → промени статус → изврши `effects` → запиши `EventLog` (со наратив) → испиши `Outbox` настан (real-time / знаење / известување). Нема преод без EventLog; нема EventLog без наратив. Lint правило: `status =` забрането надвор од state machine.

### И3. Derive, never store — сè што е пресметливо

Покриеност, деца на капа, број слотови, рокови по статус, денови во статус, публикациски датум на таск (од слотот), тим на таск, број коментари/прилози — **функции во `packages/core`, никогаш колони**. Втор извор на вистина за покриеност во прототипот направи три екрани да не се согласуваат. Една функција: `plannedCoverage`, `readyCoverage`, `clientCoverage` (PRD §4.9).

### И4. Сопственост ≠ видливост

Два одвоени концепта, не ги спојувај:

- **Scope** (видливост) — `own` гледа само свои таскови; `all` гледа сè. Од `ROLE_CFG` (Handoff).
- **Ownership** (акција) — работната зона е интерактивна само за улогата што го носи тековниот статус (плюс Директор со `onBehalfOfRole` + причина, D-5). За другите: 55% opacity, `pointer-events:none`, линија „🔒 Чека {улога} · {име}". За `vnatresno`/`kajKlient` сопственикот зависи од тип: видео → `rez`, графика → `krea`. Терминалните (`objaveno` без Meta Ads, `zavrseno`, `otkazano`, `pauza`) никогаш не се заклучени.

Дозволите се **една табела** `packages/core/src/permissions.ts`: по улога `{ nav, scope, canCreate, canChangeDate, write }`. Серверот проверува на **секој** повик; UI само крие копчиња.

### И5. Секој преод е гатиран

Задолжителниот внес не е совет — преодот **мора да падне** и да објасни што недостасува. Guards враќаат `{ ok } | { ok:false, code, missing[] }`; пораката се гради од `missing` на македонски. Празните задолжителни полиња добиваат црвена рамка. Публикацијата бара копи + линк. Враќањата бараат коментар и креираат нова верзија (`v+1`). Промена на датум бара причина.

### И6. Ништо не се брише, ништо не се презапишува

Нема тврдо бришење во целиот систем — каде треба, `archivedAt`. `EventLog`, `MetricSnapshot`, `Revision`, `Approval` се **append-only**: апликацискиот DB корисник **нема `UPDATE`/`DELETE`** привилегија (спроведено во база, не само во код).

### И7. Фајлови само преку presigned URLs

Frontend-от **никогаш** не праќа фајл низ API серверот. Presigned multipart кон R2 (`UploadSession` за продолжување по прекин). Дозволени mime: `video/*`, `image/*`, `pdf`, `docx`, `txt`; макс 20 GB/фајл; R2 URL важност 15 мин (download) / 24 ч (multipart).

### И8. Датуми и време

Сè во база `timestamptz` (UTC); `publishDate` и `Holiday.date` како `date`. Конверзија во `Europe/Skopje` **само на рабовите** (API/UI). Забранет `new Date(string)` без зона; користи `date-fns-tz` или `Temporal`. ID = **uuid v7** (сортабилни).

### И9. Прототипски идентификатори не се портаат

`m:'sep'|'oct'` и `date` како ден во месец **не постојат** во производот. API враќа ISO датуми; UI форматира.

---

## 6. Канонски спецификации (сите во `packages/core`, детали во PRD §4)

- **Статуси на таск** (PRD §4.1): `mrtov, cekaSnimanje, brifing, dizajn, chekaRezija, montaza, vnatresno, kajKlient, zaObjavuvanje, objaveno, analitika, zavrseno, pauza, otkazano`. Терминални: `objaveno` (само ако `client.usesMetaAds=false`), `zavrseno`, `otkazano`.
- **Статуси на капа** (PRD §4.2): видео `podgotovka → scenarija → scenKajKlient → snimanje → zatvoren`; графика `gPodgotovka → zatvoren`.
- **State machine матрица** (PRD §4.3): секој ред `{ from, to, contentType, actor, guards[], effects[] }`. Guards: `G_ROLE, G_ASSIGNEE_REQUIRED, G_NOT_SELF_APPROVAL, G_FILE, G_COMMENT, G_TEXT, G_PUBLICATION, G_CAPA_FIELDS, G_SCENARIOS_SPLIT, G_SCENARIO_OUTCOMES, G_META_ADS, G_DECISION, G_SLOT_FREE`. Effects: `E_ASSIGN, E_VERSION_BUMP, E_REVISION, E_APPROVAL, E_ACTIVATE_CHILDREN, E_CLOSE_GROUP, E_BIND_SCENARIOS, E_CREATE_EXTRA_SLOTS, E_RELEASE_SLOT, E_NOTIFY, E_ALARM, E_SCHEDULE_METRICS, E_STORAGE_TIMER, E_AUTO_NEXT`.
- **Board drag-and-drop:** дозволен само за преоди **без** guards што бараат внес (пр. `chekaRezija→montaza` ако монтажерот е доделен, `vnatresno→kajKlient`). Сè друго Board-от го одбива со toast „Отвори го панелот — овој преод бара {што}".
- **Покриеност** (PRD §4.9): `plannedCoverage` (∉ `mrtov, otkazano, pauza`) за аларм и ленти; праг `client.coverageAlarmDays` (default 7); бои > 14 зелено, 7–14 портокалово, < 7 црвено. `readyCoverage` е втор индикатор.
- **Слотови и календар** (PRD §4.5): детерминистички алгоритам за рамномерно распоредување; животен циклус `predlog → reserved → used`, и `reserved → free → missed`. Cron `slots.generate` на 20-ти во 06:00 (Europe/Skopje), идемпотентен. Датумот на слотот **останува** при активација (D-2).
- **Рокови по статус** (PRD §4.10): `StatusDeadlineConfig` (глобално + по клиент), seed вредности од прототипот, уредливо во Админ → Автоматизации. **Не хардкодирано.** Етикети по Handoff.
- **Наративи на настан** (PRD §4.12): детерминистички шаблон по `eventType`, на македонски, **без LLM**, во истата трансакција. `packages/core/src/events/narratives.ts`; секој нов `eventType` мора да има шаблон (тест).

---

## 7. Домен глосар (кирилица UI ↔ код)

| Домен (UI)                                | Код                                                                                   |
| ----------------------------------------- | ------------------------------------------------------------------------------------- |
| Парче / таск                              | `Task` (`contentType: video                                                           | graphic`) |
| Капа таск / месечен контејнер             | `TaskGroup`                                                                           |
| Резервиран слот / мртов таск              | `PublishingSlot` (`status: predlog/free/reserved/used/missed`) + `Task(status=mrtov)` |
| Сценарио                                  | `Scenario` (`status: predlozeno/odobreno/odobrenoSoIzmeni/otfrleno`)                  |
| Одобрување                                | `Approval` (`type: internal/client`, `onBehalfOfRole?`)                               |
| Ревизија / враќање                        | `Revision` (`source: internal/client`) + `E_VERSION_BUMP`                             |
| Коментар (@таг)                           | `Comment` (`mentions[]`, `kind: comment/systemNote`)                                  |
| Објава по платформа                       | `Publication` (`platform`, `postType`, `permalink`, `externalRef`, `metaMediaId`)     |
| Кампања                                   | `Campaign`; одлука органски/платено = `Promotion`                                     |
| Метрики                                   | `MetricSnapshot` (append-only)                                                        |
| Фајл / прикачување                        | `FileAsset` (+ `UploadSession`)                                                       |
| Промена на датум                          | `DateChange`                                                                          |
| Правило за автоматизација / рок           | `AutomationRule`, `StatusDeadlineConfig`                                              |
| Модул на клиент                           | `ModuleAssignment` (`goScripterAi/graficarAi/aiCopywriter/claudeAssistant`)           |
| Известување                               | `Notification` (`level: potsetnik/alarm/kritichen`, `dedupeKey`)                      |
| Дневник на настани                        | `EventLog` (+ `Outbox`)                                                               |
| Знаење за бот                             | `KnowledgeChunk`                                                                      |
| Зачуван преглед                           | `SavedView`                                                                           |
| Директор / Акаунт менаџер                 | `dir` `DIRECTOR` / `am` `ACCOUNT_MANAGER`                                             |
| Режисер / Сценарист / Камерман / Монтажер | `rez` / `scen` / `kam` / `mon`                                                        |
| Гр. креатор / Гр. дизајнер / Аналитичар   | `krea` / `diz` / `ana`                                                                |

---

## 8. Дизајн — протокол на предавање

Frontend работата е **дизајн-водена**. Пред да пишуваш било каков FE код:

1. Прочитај го `design_handoff_godigital_task_manager/README.md` и `Design Brief` во целост за релевантниот екран.
2. **Токените се извор на вистина** — никогаш hardcoded hex, растојание, радиус или големина покриени во Handoff-от. Референцирај ги преку токени во `packages/ui`.
3. **Бренд сина `#0866FF` е само за:** примарна акција, активна навигација, избран ред, фокус — и **модул блок** (единствено место каде е позадина). Статусите користат тиркизна/виолетова/портокалова/магента, никогаш сина.
4. **Боја на клиент** = само 4px лента лево + точка до името. Никогаш како позадина.
5. **Без сиви исклучени копчиња** — ако нешто не е достапно, го **нема** (не е disabled).
6. Иконите во прототипот се Unicode плејсхолдери — замени со icon set (`lucide-react`). Логото е плејсхолдер.
7. Пиксел-точна реизградба: бои, типографија (Inter, кирилица, `tabular-nums`), растојанија (скала 4), радиуси, сенки, движење (`slideIn` 200ms, `fadeUp` 150ms) — сите точни вредности се во README §Design Tokens.
8. Достапност: контраст ≥ 4.5:1 текст / 3:1 икони; боја никогаш единствен носител на значење; целосна тастатура; фокус прстен 3px `brand-50`; допирни цели ≥ 44×44px.

Claude Code **не ги менува** фајловите во `design_handoff_…/` — тие се read-only референца.

---

## 9. Инженерска поставеност (production-grade)

Системот се гради до SaaS стандард (tenant-ready), иако денес го користи една агенција. Нема „ќе го зацврстиме подоцна" пат.

1. **Defense in depth** — секој endpoint валидира AuthN + AuthZ на ниво на контролер, дури и кога middleware веќе проверил.
2. **Кратки, scoped токени** — JWT access 15 мин + refresh 30 дена (httpOnly). Meta токен шифриран (AES-GCM, клуч во env).
3. **Audit секоја mutation** — `EventLog`: актер (id + улога), објект, old/new, `context`, наратив, време. Append-only.
4. **Целиот податок = PII** — без PII во логови, URL-и, query, error пораки, аналитика.
5. **Генерички client-facing грешки** — stack trace никогаш до клиент; детали серверски, по `correlationId`. `404` vs `403` не смеат да овозможат enumeration.
6. **Rate limit** на секој endpoint; login + refresh со IP + акаунт лимити и backoff.
7. **Observability по функција** — структурирани JSON логови, correlation IDs, метрики за бизнис настани — со функцијата, не после.
8. **Rollback пат по функција** — backwards-compatible миграции или експлицитна rollback процедура во PR описот.
9. **Без интерни кратенки** — ако контрола би била прифатлива само за демо, не ја прави; подигни ја до сопственикот со побезбедна алтернатива и запис во `docs/backlog.md`.

---

## 10. Git и верзионирање

**Тек:** прво локално → GitHub → deploy на VPS (одлука на сопственикот).

### Гранки

```
main     → продукција (само Release PR)
develop  → staging
feature/<slug>  · bugfix/<slug>  · hotfix/<slug>  → работа
```

Без директни commit-и на `main` или `develop`. **Нема Jira** — работата се следи преку `docs/backlog.md` (Фаза 2+ листа, технички долг, одлуки). Идеја надвор од тековната фаза оди во backlog, не во тековниот sprint.

### Две PR порти

- **Gate 1 (feature → develop):** локални проверки мора да поминат пред merge — `lint → typecheck → build` (pre-push hook) + `npm test` со кренат Docker стек. Ова е примарниот code-review checkpoint.
- **Gate 2 (develop → main):** Release PR; staging верификуван и стабилен пред продукциски deploy.

### Conventional Commits

```
<type>(<scope>): <кратко, императив, мали букви, без точка, < 72 знака>

[тело: зошто, не што]
```

Types: `feat`(minor) · `fix`/`perf`(patch) · `feat!`/`BREAKING CHANGE`(major) · `docs/style/refactor/test/build/ci/chore/revert`(none). Scopes: `web api worker core db ui auth tasks capa slots calendar approvals publications analytics ai notifications admin`. Toolchain: Husky + commitlint + lint-staged (committed во `.husky/`). Верзионирање рачно (bump `package.json` + `CHANGELOG.md` + tag).

**Ако PR менува workflow** (статуси/преоди/guards): мора да е обележан `workflow-change`, да го ажурира `transitions.fixture.json` и PRD, инаку матрицата останува непроменета.

---

## 11. Околини, Docker, деплој

Три нивоа: **local (Docker, localhost)** → **staging** → **production (VPS)**. Конфигурации никогаш не се мешаат.

- `.env.example` (committed, без вредности, документира СЕ) · `.env.local` (gitignored) · `.env.staging` / `.env.production` (само во secrets, никогаш committed). Секоја нова env променлива оди во `.env.example` со коментар.
- Секретите се валидираат со Zod при старт — апликацијата одбива да стартува ако недостасува задолжителен секрет.
- `docker compose up` крева цел локален стек: PostgreSQL 16 (+pgvector), Redis 7, api, web, worker, MinIO (локален R2-сурогат), Mailhog, Nginx.
- Local = plain HTTP; staging/production = **HTTPS задолжително** (Let's Encrypt/Certbot), документирано во `docs/deployment/`.
- Deploy: прво GitHub како remote; VPS деплој преку `scripts/deploy.sh <staging|production>` од доверлива машина (backup DB → pull → build → `prisma migrate deploy` → health check → rollback при неуспех). Деталите се потврдуваат во `docs/deployment/` пред првиот прод деплој.

---

## 12. Секрети и безбедност

1. **Нула hardcoded секрети** во изворен код (API клучеви, лозинки, токени, `DATABASE_URL`, `JWT_SECRET`/`JWT_REFRESH_SECRET`, R2 credentials, `META_APP_SECRET`, Claude/embedding клучеви, `CRON_SECRET`).
2. Само од `.env.*`, валидирани со Zod при старт.
3. `gitleaks` како `pre-commit` hook — commit со детектиран секрет се блокира.
4. Никогаш секрети во `docs/`, backlog, PR описи или во промпт до Claude Code — референцирај имиња, не вредности.
5. GCP/сервис-акаунт JSON фајлови надвор од web root, референцирани по патека.

---

## 13. Тестирање

- Секоја функционалност доаѓа со тестови во истиот PR (unit + integration +, каде важи, E2E).
- **`packages/core` = 100% покриеност.** Матрицата се тестира **табеларно**: `transitions.fixture.json` со секој ред од PRD §4.3 (from, to, role, payload, очекувано `ok`/код). Истиот фикстур го генерира `processDoc` за ботот и Админ → Автоматизации табелите.
- Backend ≥ 70%, frontend ≥ 60% покриеност.
- Acceptance критериумите од PRD §18 = e2e (Playwright), еден тест по чекбокс.
- Алати: **Vitest** (+ React Testing Library), **Playwright** (E2E), реален PostgreSQL преку Docker за integration (без DB mock-ови).
- Тест за секој ред од матрицата: погрешна улога добива `FORBIDDEN_ROLE`; секој нов `eventType` има наратив шаблон.
- Тестовите се значајни (проверуваат однесување), не тавтолошки.

---

## 14. Квалитет на код и линтирање

- **Prettier** (auto, lint-staged) · **ESLint** + `@typescript-eslint/recommended` (errors блокираат merge).
- TypeScript `strict: true` секаде. Без `any`. Без `@ts-ignore` без коментар зошто.
- Заеднички типови и Zod schemas во `packages/core`/`packages/db` — споделени backend ↔ frontend, никогаш дуплирани.
- Без бизнис логика во React компоненти: компонента → hook (TanStack Query) → API. Backend: route → controller (тенок) → service (логика) → Prisma.
- Zustand само за UI state (отворени панели, филтри); податоци секогаш низ TanStack Query.
- Мртов код се брише пред merge. TODO формат: `// TODO(scope): опис`.
- **Lint правило:** `status =` (или директен Prisma update на `status`) забрането надвор од state machine.
- Пари (ако има): Prisma `Decimal`, никогаш float.

---

## 15. Миграции (Prisma)

1. **Непроменливи** — никогаш не менувај applied миграција; создади нова.
2. Живеат во repo, во истиот PR со кодот. `npx prisma migrate dev --name descriptive_name`.
3. **Auto-run на deploy** — `prisma migrate deploy`, никогаш рачно на споделена околина без потврда.
4. Неуспешна миграција на staging блокира Release PR кон `main`.
5. Инваријанти спроведени **во база** (constraints/triggers): `Task.slotId` unique и ист `clientId`/`contentType`; `TaskGroup` unique (клиент, тип, месец); `PublishingSlot` unique (клиент, тип, датум, orderInDay); `Publication` unique (taskId, платформа); `Employee.isScenaristToo` само за `role=rez`; `EventLog`/`MetricSnapshot`/`Revision`/`Approval` без UPDATE/DELETE grant; `tenantId` на сите примарни табели.
6. pgvector: `KnowledgeChunk` со HNSW индекс (`vector_cosine_ops`, m=16, ef_construction=64) + GIN на `tsv`. Embedding провајдер = **Voyage `voyage-multilingual-2`**, `EMBED_DIM=1024` (конфигурабилно преку env; конечна потврда по тест на 20 реални коментари во Фаза B4 — D-10).

---

## 16. Логирање и грешки

- **Структурирани JSON логови (Pino).** Без `console.log` во продукциски код.
- Нивоа: `error` / `warn` / `info` (бизнис настани: login, task.created, transition, capa.closed, publication.created, ai.called) / `debug` (само dev).
- Секој error лог: `message`, `stack`, `userId`, `endpoint`, `correlationId`, ISO timestamp. Никогаш sensitive/PII.
- API одговори: `{ data }` или `{ code, message, details? }` со **`message` на македонски, спремна за toast**. Error codes SCREAMING_SNAKE: `TRANSITION_NOT_ALLOWED`, `GUARD_FAILED` (`details.missing[]`), `FORBIDDEN_ROLE`, `SELF_APPROVAL`, `SLOT_TAKEN`, `DATE_IN_PAST`, `TENANT_SCOPE_DENIED`, `CLIENT_SCOPE_DENIED`, `COMMENT_REQUIRED`, `PUBLICATION_REQUIRED`.
- Toasts: долу десно, `#12161C`, 4.2s, еден по еден — за одбиени преоди, валидации и резултат од секое предавање.
- **Известувања (`Notification`, Фаза B1)** се channel-agnostic со `dedupeKey` (PRD §4.13). Канали по ниво: `potsetnik` = in-app; `alarm` = in-app + email; `kritichen` = in-app + email + **SMS** (нема Viber — D-12) + модал што бара „Видено". Вработен може да исклучи само `potsetnik`.

---

## 17. API конвенции

- REST (Express), сите одговори JSON. Целосна листа на рути во PRD §4.11. Пример: `POST /tasks/:id/transition {to, payload}`, `POST /tasks/:id/date-change`, `POST /clients/:id/slots/confirm`, `POST /knowledge/search`.
- Real-time преку Socket.io од Outbox (< 2s), payload = целиот ентитет по трансакцијата.
- Секој endpoint валидиран со Zod; дозволи проверени серверски во middleware **и** контролер.
- (Опционо) OpenAPI 3.1 генериран од Zod; `/api/v1/` префикс.

---

## 18. Управување со зависности

- Оправдај секоја нова зависност во PR описот. **Не воведувај нова зависност без прашање.**
- Прифери добро одржувани, широко прифатени пакети; чиста лиценца.
- Без игнорирани peer dependency warnings; безбедносни закрпи веднаш.

---

## 19. Кога Claude Code МОРА да застане и да праша

1. Архитектонска одлука меѓу две валидни опции со траен ефект (→ ADR).
2. Проширување на опсег (ако X бара и Y да се менува).
3. Деструктивни операции (drop табела, бришење фајлови, force-push, reset).
4. Двосмислено барање со две разумни толкувања.
5. **Нова зависност.**
6. Подготовка на staging/production конфигурација.
7. **Кога PRD и Handoff се косат и не е решено во PRD v3 §1** — стоп, прашање, не претпоставка.
8. Кога задачата бара заобиколување на инваријанта од §5 — тоа е знак дека нешто во спецификацијата не е дорешено.

НЕ прашувај за: детали што следат директно од одобрен план/AC, форматирање/именување во воспоставени конвенции, одлуки веќе дефинирани овде.

---

## 20. Редослед на градење (PRD §5) — фазите се затворени

**Прво таск-менаџерот целосно, потоа модул по модул, на крај двете PWA.** Секоја фаза има gate со реални податоци од еден клиент пред следната.

- **Фаза A — Јадро:** A1 монорепо + `core` + Prisma шема комплетна (вкл. `KnowledgeChunk`, `EventLog`, `Outbox`, pgvector) + auth + Client/Employee/Calendar CRUD + Админ (read-only дозволи) + i18n + toast/error. → A2 слотови + календар + промена на датум + cron. → A3 Task/TaskGroup + state machine + Task Detail + List + Board + Мои задачи + коментари/активност. → A4 видео капа (документ, поделба, одговор по сценарио, `cekaSnimanje`, суров материјал multipart). → A5 графика капа. → A6 одобрување/верзии + преглед на креатива + објава + терминали. → A7 Преглед + Клиенти + Аналитика (празна) + email известувања. **Gate: пилот еден клиент цел месец паралелно со Viber.**
- **Фаза B — Модули (еден по еден):** B1 Аларми + Rule Builder · B2 Meta метрики + Аналитика · B3 Сторидж животен циклус · B4 Знаење + Claude помошник (RAG) · B5 GoScripterAI · B6 GraficarAI · B7 AI копирајтер.
- **Фаза C — PWA за вработени** (manifest, offline, background upload, push, мобилни екрани).
- **Фаза D — PWA за клиенти** (magic link, `Approval.source=clientPwa`, `visibility=clientVisible`).

Пред секоја фаза: провери ги отворените D-1…D-12 и PRD v2 §20 прашањата што ја наведуваат.

---

## 21. Модел стратегија

Проектот работи на **Claude Opus (default)** за сè — архитектура, планирање, имплементација, поправки. **Без автоматска промена на модел.** Разработувачот ја носи финалната одлука; никогаш не менувај модел тивко.

За секоја повеќе-фајлна функционалност или архитектонска одлука: напиши план во `docs/plans/` пред имплементација и чекај експлицитно одобрување.

---

## 22. Работен процес на Claude Code сесија

1. Прочитај го барањето + релевантната секција од **PRD v3** пред код (§0 редослед).
2. Ако е FE: прочитај го Handoff-от за тој екран прво.
3. Редослед на имплементација: типови/schemas + логика во **`packages/core`** (со тест) → Prisma миграција → backend service + тест → рута → frontend hook → компонента.
4. По секоја функционалност: `npm run typecheck && npm run test && npm run lint` — мора зелено пред commit.
5. Секој преод = трансакција (guards → промена → effects → EventLog → Outbox). Серверот одлучува; UI само крие.
6. Копи само низ i18n (мк, плурали). Ништо не се брише од append-only табелите.
7. Не воведувај зависности без прашање. Не заобиколувај инваријанта од §5 — застани и прашај.

---

## Hotfix / Improvement Fast-Track

Промпти што почнуваат со **`Hotfix:`** или **`Improvement:`** (case-insensitive) се ticketless fast-track (нема Jira; следењето е во `docs/backlog.md`).

1. **План прво** во `docs/plans/HI-<N>-<slug>.md` (Type, број, Summary, Files, Approach, Tests, Rollback, Risk). Бројачот е во `docs/hi-counter.txt` (инкремент + запиши пред код). **Чекај одобрување.**
2. **Гранка** од најнова `develop`: `hotfix/HI-<N>-<slug>` или `improvement/HI-<N>-<slug>`.
3. **Имплементирај** по сите правила овде. Hotfix = само скршеното, нула scope creep (сродно → `// TODO(scope):` + стоп). Improvement = само опишаното; поголема архитектонска промена → посебен план.
4. **Тестови задолжителни:** Hotfix = регресиски тест што паѓа без поправката; Improvement = тест за изменетото однесување. `npm test && npm run typecheck && npm run lint` зелено.
5. **Commit** (Conventional): `fix(scope):` (Hotfix) / `feat|perf(scope):` (Improvement), footer `Refs HI-<N>`.
6. **PR** во `develop`, наслов `[HI-<N>] опис`, тело со линк до планот. **Claude Code не merge-ува PR.**
7. **Deploy** по merge преку `scripts/deploy.sh staging` → верификуван → `production`. Rollback веднаш при неуспех на smoke тест.

---

_Оваа датотека е живата уставна книга на GoDigital Task Manager._
_Stack: React 19 + TS + Vite + Tailwind (web) · Express 5 + Prisma + PostgreSQL 16 + pgvector + Redis + BullMQ (backend) · Cloudflare R2 · Socket.io._
_Извор на вистина за логика: `PRD_v3_Revizija_i_Specifikacija.md`. Извор за дизајн: `design_handoff_godigital_task_manager/`._
