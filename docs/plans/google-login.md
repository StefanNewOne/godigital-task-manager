# План — Google најава (@godigital.mk)

**Type:** Feature (auth) · **Бара одобрување + ADR** (CLAUDE.md §2). Дизајн: [ADR-002](../architecture/adr/ADR-002-google-oauth.md).

## Опсег

Дополнителен Google login (GIS, активен профил на прелистувачот), ограничен на `@godigital.mk`, без само-регистрација (email мора да е активен Employee). JWT моделот непроменет.

### packages/db

- Миграција: `Employee.googleSub String? @unique` (опционо цврсто врзување по Google subject). Адитивно.

### apps/api

- `lib/googleAuth.ts`: `verifyGoogleIdToken(idToken)` преку `google-auth-library` `OAuth2Client.verifyIdToken({ audience: GOOGLE_CLIENT_ID })` → `{ email, emailVerified, sub, hd }`. Инјектабилно за тест (`setGoogleVerifier`).
- `POST /auth/google { idToken }` (routes/auth.ts): verify → гејт (`emailVerified` && email `@godigital.mk` && активен `Employee`) → издај JWT access+refresh (иста `signAccessToken`/cookie логика) + `lastActiveAt`; (опц.) сними `googleSub`. Инаку `403`.
- env (Zod): `GOOGLE_CLIENT_ID: z.string().optional()`; `.env.example` + коментар. Ако недостасува → `/auth/google` враќа генеричка грешка (feature-gated).
- Зависност: `google-auth-library` (нова — бара одобрување §18).

### apps/web

- `lib/google.ts`: лениво вчитување на GIS скриптата; render Google копче.
- `screens/Login.tsx`: копче „Најави се со Google" под email/лозинка → GIS credential → `POST /auth/google { idToken }` → invalidate `['me']` (ист `useLogin` образец).
- Стринг во `mk.json` (`login.google`). Копчето се крие ако `GOOGLE_CLIENT_ID` не е конфигуриран (се чита преку мал `/auth/config` или build env).

## Тестови

- Integration (mock verifier): @godigital.mk + постоечки активен Employee → 200 + cookie; туѓ домен → 403; непостоечки/неактивен Employee → 403; `emailVerified=false` → 403; невалиден idToken → 401.
- core: (ако има) помошник за domain-check.

## Креденцијали (сопственикот)

Google Cloud **OAuth Web client ID** со authorized JS origins `http://localhost:5173` (+ прод). Client secret НЕ е потребен (GIS id_token верификација со јавни клучеви).

## Rollback / Risk

Адитивно (ново копче + endpoint); password login непроменет. Rollback = revert + drop `googleSub`. Ризик: низок-среден (нов auth пат) — митигиран со domain+Employee гејт, audience-pinned верификација, feature-gate преку env. `workflow-change`: НЕ.
