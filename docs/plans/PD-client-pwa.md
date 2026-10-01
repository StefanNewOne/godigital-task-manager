# План PD — Фаза D: PWA за клиенти (magic-link одобрување)

**Type:** Feature (Фаза D, PRD §5/§20) · **Бара одобрување** (§22; надворешно-насочена auth, безбедносно чувствително §9/§12).
**Summary:** Клиентите (ClientContact со `isApprover`) добиваат **magic-link** на email → без лозинка влегуваат во ограничен **клиентски PWA** каде гледаат само што им припаѓа (`clientVisible`) и одобруваат/враќаат понуди/договори (CRM) и креативи (task на `kajKlient`). Секое дејство → `Approval(source=clientPwa)` + соодветниот преод преку state machine (И2).

## Постоечка основа

- `Approval { source ApprovalSource @default(employee) }` — `clientPwa` enum постои.
- `ClientContact { isApprover, email }`.
- `Visibility { internal, clientVisible }` (денес само на `KnowledgeChunk`).
- Auth: JWT (вработени). Magic-link = **одделен auth realm** (client-contact identity, НЕ employee).
- Magic-link образец веќе постои (H4 `PasswordResetToken` — сличен hashed-token + TTL).

## Безбедност (§9/§12) — водечки принципи

- Токен: `randomBytes(32)`, се чува само **hash** (§12); краток TTL (пр. 24ч за magic-link, кратка сесија потоа); еднократен за влез.
- Клиентската сесија = тесен JWT со `clientContactId` + `clientId` + `realm:'client'` (никогаш employee права). Серверот на **секој** client endpoint проверува realm + дека објектот припаѓа на `clientId` (tenant + client scope, И1 + client scope).
- Без enumeration (генерички одговори). Rate-limit на magic-link барање. `clientVisible` scoping: клиентот гледа само client-соодветни полиња (без интерни наративи/цени/интерни коментари).
- Никогаш employee-only рути достапни со client realm (defense in depth, посебен middleware `requireClient`).

## Фаза D1 — core + db + client auth realm (PR 1)

- `packages/db`: `model ClientMagicToken { id, tenantId, clientContactId, tokenHash, expiresAt, usedAt, createdAt }` (миграција; TD-9 DROP INDEX дисциплина). `visibility` поле каде треба за task-ниво client scope (ако не се деривира).
- `packages/core`: Zod `magicLinkRequestSchema { email }`, `clientApprovalSchema { outcome, comment? }`; client-scope helper (што е `clientVisible`).
- `apps/api`: `requireClient` middleware (верификува client JWT realm); `signClientToken`/`verifyClientToken` (нов realm, кратки TTL).
- Тестови: core schemas; token hashing.

## Фаза D2 — client approval API (PR 2)

- `POST /client/auth/magic-link { email }` → генерички 200; ако `ClientContact.isApprover` постои → еднократен токен + email со линк `${WEB_ORIGIN}/client?token=…`.
- `POST /client/auth/consume { token }` → валидира → издава client сесија (cookie/JWT realm=client).
- `GET /client/approvals` (requireClient) → pending ставки за тој `clientId`: CRM понуди/договори на `ponudaKlient`/`dogKlient` + task креативи на `kajKlient` — **само `clientVisible` полиња**.
- `GET /client/approvals/:kind/:id` → детал (клиент-safe).
- `POST /client/approvals/:kind/:id/decide { outcome, comment? }` → создава `Approval(source=clientPwa)` + вика соодветен **transition** (клиент прифати → напред; бара измени → назад v+1) преку постоечкиот state machine (НЕ дуплира логика). Guard: објектот мора да припаѓа на сесискиот `clientId`.
- Тестови (integration): magic-link (no-enumeration, еднократен, истечен→400); client realm не може employee рути (403); approve/reject создава Approval(clientPwa) + точен преод; client-scope (туѓ клиент → 404/403).

## Фаза D3 — client PWA (web) (PR 3)

- Рути (јавни, client realm): `/client` (magic-link landing + consume од `?token`), `/client/approvals` (листа), детал + Одобри/Врати со коментар. Одделен тенок layout (без employee nav), мобилно-прв; строго само `clientVisible` содржина. Сите стрингови во `mk.json` (§4). PWA manifest scope веќе покрива `/`.
- Тестови: e2e (magic-link landing рендерира; листа/детал/одобри — data-independent каде може).

## Што е НАДВОР од опсег (засега)

Клиентски registration/self-service, плаќања, chat. Само одобрување + преглед на client-safe содржина.

## Rollback / Risk

- Адитивно (нов realm + рути + екрани; нема промена на employee текови). Rollback = revert + drop ClientMagicToken.
- Ризик: **среден-висок** (надворешна auth). Митигација: тесен client realm + per-request client-scope проверки + hashed еднократни токени + rate-limit + no-enumeration; фазна испорака (3 PR-а) со тестови.
- `workflow-change`: **НЕ** (клиентските дејства ги вики постоечките преоди; матрицата непроменета).

## Испорака

3 последователни PR-а (D1 core/auth → D2 api → D3 web). Секој со тестови + зелена CI.
