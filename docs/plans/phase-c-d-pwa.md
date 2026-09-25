# План: Фаза C (PWA за вработени) + Фаза D (PWA за клиенти)

Статус: **ПРЕДЛОГ — чека одобрување** (§22). Не е имплементирано.
Извор: PRD v3 §5 (Фаза C/D), Brief §10 (мобилни екрани), CLAUDE.md §20.
Редослед: **прво C, па D** (секоја со свој gate). B5–B7 остануваат последни.

Тековна состојба (проверено):

- Нема PWA инфраструктура (нема `vite-plugin-pwa`, manifest, service worker); `index.html` има само viewport.
- Шемата веќе има `ApprovalSource { employee, clientPwa }` и `Visibility { internal, clientVisible }`.
- `visibility` се користи само на `KnowledgeChunk` — НЕ на креатива/сценарија/копи.
- Нема magic-link / session / push модели; `ClientContact` нема auth-полиња; каналите се `system/email/sms` (нема `push`).
- Web е responsive од A3; Socket.io соби `client:{id}`/`employee:{id}` веќе постојат (Outbox).

---

## Фаза C — PWA за вработени

### C1. PWA школка (инсталабилност)

- Нова завИсност: **`vite-plugin-pwa`** (Workbox) — _бара одобрување (§18)._
- `manifest.webmanifest`: име „GoDigital", икони (192/512/maskable), `theme_color #0866FF`, `background_color`, `display: standalone`, `start_url: /`, кирилица копи.
- `index.html`: `theme-color`, `apple-touch-icon`, `apple-mobile-web-app-*`.
- Service worker (Workbox `generateSW`): precache на школката; `registerType: autoUpdate` + toast „Нова верзија — освежи".
- Икони: од Handoft/бренд (логото е плейсхолдер — бара бренд asset).

### C2. Офлајн читање (read-only)

- Persist на TanStack Query кеш во **IndexedDB** (`@tanstack/query-persist-client` + `idb-keyval`) — _можни нови завИсности._
- Workbox runtime caching (StaleWhileRevalidate) за `GET /tasks`, `/me`, `/overview`, `/task-groups`.
- UI: офлајн-банер („Офлајн — прикажани се последно вчитани податоци"); акциите се оневозможени.

### C3. Ред на промени офлајн (queue + sync)

- IndexedDB ред за мутации направени офлајн (transition, коментар, промена датум).
- Синхронизација при враќање мрежа (Workbox Background Sync или рачен flush со `online` настан).
- Идемпотентност серверски: `Idempotency-Key` header по мутација (нов middleware + мала табела `IdempotencyKey` или Redis SETNX) за да не се дуплира преод.
- Конфликт: ако статусот се сменил во меѓувреме → мутацијата паѓа со јасна порака, ставката се прикажува за рачно решавање. (Без автоматско спојување.)
- Опсег: само коментар + прости преоди без фајл; upload оди преку C4.

### C4. Позадинско качување со продолжување

- Реупотреба на постоечкиот presigned multipart + `UploadSession` (веќе продолжливо по прекин).
- Мобилно: чување на `uploadId`+делови во IndexedDB; продолжување по враќање мрежа/апликација.
- (Опц.) Background Fetch API каде е поддржано; fallback на resume при отворање.

### C5. Push известувања

- Нова завИсност: **`web-push`** (VAPID) на backend — _бара одобрување._
- Секрети: `VAPID_PUBLIC_KEY` / `VAPID_PRIVATE_KEY` (Zod при старт, `.env.example`).
- Модел: `PushSubscription { id, tenantId, employeeId, endpoint, keys(json), createdAt }` (миграција).
- Ендпоинти: `POST /push/subscribe`, `POST /push/unsubscribe`.
- Нов канал `push` во `notificationChannels` (core) + `createNotification` праќа push кога има претплата (worker, best-effort). Нивоа: `potsetnik/alarm/kritichen` → push вклучен.
- Тест: канали по ниво (core), subscribe/unsubscribe (api).

### C6. Мобилни екрани (Brief §10)

- Долна навигациска лента (иконки по улога), неделен календар, лебдечка акција (+).
- Мобилен Task Detail (полн екран), мобилни листи; breakpoints во `packages/ui` токени.
- Пиксел-водено по Brief §10 (кога ќе се потврди дизајн-хендоф за мобилно).

**Gate C:** Камерман работи цел месец само од телефон (инсталирано PWA, push, качување суров материјал офлајн/на терен).

---

## Фаза D — PWA за клиенти

### D1. Најава со magic link

- Модел: `ClientAuthToken { id, tenantId, clientContactId, tokenHash, expiresAt, usedAt }` (кратко траење, еднократен).
- Тек: `POST /client-auth/request { email }` → ако постои `ClientContact` со тој email → испрати magic link (реупотреба на постоечкиот mailer/SMTP). `GET/POST /client-auth/verify?token=…` → издава **client JWT** (посебна публика `aud: client`, кратко траење + refresh), httpOnly cookie.
- Middleware `requireClientAuth` (одвоен од `requireAuth`); клиентот гледа/дејствува само на свој `clientId`.
- Rate-limit на request/verify (§9.6).

### D2. Видливост на содржина (`clientVisible`)

- **Одлука (Brief отворено #3):** што гледа клиентот — креатива (preview), сценарија на `scenKajKlient`, копи? Предлог: креатива preview + сценарија (на scenKajKlient) + копи (на kajKlient/zaObjavuvanje). _Бара потврда._
- Додади `visibility` каде треба (пр. `FileAsset`, `Scenario`) или изведи серверски по статус (derive, И3) — предлог: **изведено по статус/тип**, без нова колона каде е можно.
- Клиентските queries строго филтрирани: свој `clientId` + само clientVisible проекција (без внатрешни коментари/наративи/тимови).

### D3. Одобрување од клиент

- Ендпоинти (client-auth): `GET /client/approvals` (чекаат одобрување за мојот клиент — таскови на `kajKlient`, капи на `scenKajKlient`), `GET /client/approvals/:id` (детаљ со clientVisible содржина), `POST /client/approvals/:id/decide { outcome, comment? }`.
- Дејството поминува низ **истата state machine** (`transitionTask`/`setScenarioOutcomes`) со `Approval.source = clientPwa`, actor мапиран на носечката улога (сервер одлучува; клиентот не бира улога). Гардовите важат (коментар за измени/враќање).
- Real-time: соба `client:{id}` (веќе постои) — клиентот и вработените добиваат ажурирање од Outbox.

### D4. Клиентска PWA (посебен минимален дизајн)

- Посебен минимален дизајн систем (Brief #3) — _бара дизајн-хендоф._ Дотогаш: неутрална школка со брендот на агенцијата.
- Екрани: најава (magic link), список „Чека твое одобрување", детаљ (види креатива/сценарија/копи), Одобри / Одобри со измени / Врати (коментар).
- Посебен manifest/иконки (клиентска PWA), инсталабилна.

**Gate D:** еден клиент одобрува без Viber цел месец (`Approval.source=clientPwa`).

---

## Нови завИсности (бараат одобрување, §18)

| Пакет                                                | За што                    | Фаза |
| ---------------------------------------------------- | ------------------------- | ---- |
| `vite-plugin-pwa` (+ Workbox)                        | manifest + service worker | C1   |
| `@tanstack/query-persist-client-core` + `idb-keyval` | офлајн кеш                | C2   |
| `web-push`                                           | Web Push (VAPID)          | C5   |

## Отворени одлуки за сопственикот (§19)

1. **Нови завИсности** горе — ОК?
2. **Клиентска видливост (Brief #3):** што точно гледа клиентот (креатива/сценарија/копи) и дали изведено по статус или со `visibility` колони.
3. **Клиентски дизајн систем:** има ли Handoff за клиентската PWA, или неутрална школка засега?
4. **Офлајн queue опсег:** само коментар+прост преод (предлог), или пошироко?
5. **Икони/лого:** бренд asset за manifest (логото е плейсхолдер).
6. **Push наспроти SMS за kritичен:** push е нов канал; SMS провајдер сè уште е одделно (D-12).

## Тестови (по компонента, §13)

- core: `notificationChannels` со `push`; клиентска видливост-проекција (чисти функции).
- api integration: push subscribe/unsubscribe; magic-link request/verify (истечен/искористен токен → 401); client approval низ state machine со `source=clientPwa`; идемпотентност на офлајн-replay.
- web: офлајн-банер, install prompt, мобилна долна-лента; клиентски список/детаљ/одобри.
- e2e (Playwright): Камерман офлајн→sync (C gate); клиент одобрува преку magic link (D gate).

## Rollback / безбедност

- Сите миграции backwards-compatible (нови табели: `PushSubscription`, `ClientAuthToken`).
- Клиентскиот JWT е строго одвоен (посебна публика, свој middleware, само свој `clientId`); без пристап до внатрешни податоци (§9).
- Секретите (VAPID) преку `.env.*` + Zod; никогаш во код (§12).
- Service worker зад feature-проверка; лесно исклучлив (deregister) ако прави проблем.

## Редослед на имплементација (по одобрување, §22)

1. **C1→C2** (школка + офлајн читање) → gate меѓу-чекор.
2. **C5** (push) → **C4** (upload resume) → **C3** (offline queue) → **C6** (мобилни екрани) → **Gate C**.
3. **D1** (magic link) → **D2** (видливост) → **D3** (одобрување) → **D4** (клиентска PWA) → **Gate D**.

_По одобрување: за секој чекор — core/schema → миграција → API сервис+тест → рута → worker (push) → frontend hook → компонента._
