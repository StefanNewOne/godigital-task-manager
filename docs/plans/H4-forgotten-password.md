# План H4 — Заборавена лозинка (reset flow)

**Type:** Improvement (design-gap H4 од `docs/backlog.md §3`) · **Фаза:** A1 доопределување
**Summary:** Додади „Заборавена лозинка" тек: барање преку email → еднократен токен со рок → поставување нова лозинка. Login екранот добива линк „Заборавена лозинка?". Нема user-enumeration; токенот се чува само како hash.

---

## Извор на вистина

- Auth: `apps/api/src/routes/auth.ts` (login/refresh/logout), `apps/api/src/lib/auth.ts` (`hashPassword`/`verifyPassword`, JWT). Лозинки = bcryptjs.
- Email: `apps/api/src/lib/mailer.ts` → `sendEmail(to, subject, text)` (nodemailer/SMTP, локално Mailhog).
- Модел: `Employee { email @unique, passwordHash }` — нема reset поле.
- `WEB_ORIGIN` постои (reset линк).

## Податочен модел (Prisma миграција — адитивна)

Нов модел `PasswordResetToken` (наместо полиња на Employee — почисто, поддржува историја/поништување):

```
model PasswordResetToken {
  id          String   @id @default(...)   // uuid v7 (И8)
  tenantId    String                         // И1
  employeeId  String
  tokenHash   String                         // sha-256 на опаковиот токен; НИКОГАШ plaintext (§12)
  expiresAt   DateTime
  usedAt      DateTime?
  createdAt   DateTime @default(now())
  employee    Employee @relation(...)
  @@index([employeeId])
}
```

Миграција: не менува постоечки табели; ново `@@index`. pgvector DROP INDEX линии да се исчистат (TD-9).

## Backend (route → controller тенок → service → Prisma)

`packages/core`: Zod schemas `forgotPasswordSchema { email }`, `resetPasswordSchema { token, password (min 8) }` (споделено FE/BE).

Рути во `auth.ts` (rate-limited како login, §9):

- `POST /api/auth/forgot-password { email }` → **секогаш 200** генерички („Ако постои сметка, испративме линк.") — без enumeration. Ако employee постои + активен: поништи претходни токени, создади токен (`crypto.randomBytes(32)` hex), сними само `sha256(token)`, `expiresAt = now+1h`, испрати email со линк `${WEB_ORIGIN}/reset-password?token=<plaintext>`. Email преку `sendEmail` (мк текст, без PII во логови).
- `POST /api/auth/reset-password { token, password }` → најди по `sha256(token)`, провери `expiresAt>now && usedAt==null`; ако важи → `passwordHash = hashPassword(password)`, `usedAt=now`; инаку 400 `RESET_TOKEN_INVALID` (генеричка порака). По успех: EventLog запис (без токен/лозинка).

Service: `apps/api/src/services/auth/passwordReset.ts` (createResetToken, consumeResetToken). Токенот и лозинката никогаш не се враќаат/логираат (§12).

## Frontend (mk.json + t(), без hardcoded — §4)

- `Login.tsx`: линк „Заборавена лозинка?" → `/forgot-password`.
- `ForgotPassword.tsx` (нов екран): email input → submit → генерична success порака (без откривање дали постои).
- `ResetPassword.tsx` (нов екран, чита `?token=`): нова лозинка + потврда → submit → success → redirect на `/login`.
- Рути во `App.tsx`: `/forgot-password`, `/reset-password` (јавни, без auth gate).
- Hooks: `useForgotPassword`, `useResetPassword` (TanStack Query, `api.post`).
- Нов namespace `auth` во `mk.json`.

## Тестови (задолжителни, ист PR)

- **core**: unit за двете Zod schemas (валидна/невалидна).
- **api integration** (реален Postgres): forgot за постоечки → токен создаден + `sendEmail` повикан; forgot за непостоечки → 200, нема токен (no enumeration); reset со важечки токен → `passwordHash` сменет + `usedAt` поставен; reset со искористен/истечен/невалиден → 400; стар токен поништен при нов forgot.
- **e2e**: Login → „Заборавена лозинка?" → `/forgot-password` рендерира + submit прикажува success; `/reset-password?token=x` рендерира форма (data-independent).

## Security чеклиста (§9/§12)

- Нема enumeration (генерички одговори + иста латентност колку што е разумно).
- Токен само како hash во база; plaintext само во email линкот; никогаш во логови/error.
- Еднократен + краток рок (1h). Rate-limit на двете рути.
- Лозинка min 8; bcrypt hash. По reset — постоечки refresh сесии остануваат (refresh е stateless JWT); опционо: напомена во backlog за session invalidation ако се воведе server-side session store.

## Rollback

Целосно адитивно: нова табела + 2 рути + 2 екрани + 1 линк. Без промена на постоечки текови. Rollback = revert PR + `prisma migrate resolve`/нова down миграција (табелата е празна во прод на почеток).

## Risk

Низок. Единствена нова зависност: нема (crypto е Node core; nodemailer/bcrypt веќе постојат). Не менува workflow матрица (нема `workflow-change`).
