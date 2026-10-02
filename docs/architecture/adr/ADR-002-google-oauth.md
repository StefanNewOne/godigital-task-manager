# ADR-002 — Google најава (ограничена на @godigital.mk)

**Статус:** Предложено (чека одобрување) · **Датум:** 2026-10-02 · **Контекст:** CLAUDE.md §2 (auth stack), §9 (безбедност).

## Контекст

CLAUDE.md §2 го заклучува auth stack-от: **JWT** access 15м + refresh 30д (httpOnly cookie), **НЕ** express-session (PRD §4.14). Сопственикот бара **најава со Google** користејќи го активниот профил на прелистувачот. Промена на auth stack бара ADR (§2).

Безбедносен ризик (§9): „регистрација со било кој Google профил" во интерен алат значи секој со Google сметка добива пристап. Одлука на сопственикот: **само `@godigital.mk` домен, без само-регистрација** — email-от мора да постои како активен `Employee`.

## Одлука

Google е **дополнителен identity provider**, НЕ замена на auth моделот. JWT-от останува единствениот механизам за сесија.

- **Frontend:** Google Identity Services (GIS) копче „Најави се со Google" на login формата. Користи го **активниот Google профил на прелистувачот** → враќа `id_token` (credential). Копчето постои покрај email/лозинка (не ја заменува).
- **Backend:** `POST /auth/google { idToken }`:
  1. Верификувај го `id_token` преку Google (audience = `GOOGLE_CLIENT_ID`, issuer = accounts.google.com) — **јавни клучеви на Google, без client secret** за верификација.
  2. Извади `email`, `email_verified`, `hd` (hosted domain).
  3. Прифати САМО ако: `email_verified === true` **И** `email` завршува на `@godigital.mk` (и/или `hd === 'godigital.mk'`) **И** постои активен `Employee` со тој email.
  4. Издај ист JWT access+refresh (иста `signAccessToken`/cookie логика како `/auth/login`). Освежи `lastActiveAt`.
  5. Инаку → `403 FORBIDDEN_ROLE` (или `UNAUTHENTICATED`), генеричка мк порака. **Никогаш не создава нов Employee** (нема само-регистрација).
- **Линкување (опционо):** `Employee.googleSub String? @unique` за цврсто врзување по Google subject (наместо само по email). Миграција адитивна.

## Последици

- **Нова env:** `GOOGLE_CLIENT_ID` (јавен OAuth client id; во `.env.example`). Client secret **не е потребен** за GIS id_token верификација.
- **Нова зависност:** `google-auth-library` (официјална, за `OAuth2Client.verifyIdToken`) — бара одобрување (§18). Алтернатива без нова dep: раచно JWKS fetch + RS256 verify со постоечкиот `jsonwebtoken` + мал `jwks-rsa`. Предлог: `google-auth-library` (посигурно, официјално).
- Auth моделот **непроменет**: сè уште JWT, без express-session. Google е само извор на идентитет за издавање на постоечкиот JWT. Минимален удар на §2.
- **Безбедност:** domain + постоечки-Employee гејт (§9); `email_verified` задолжително; audience-pinned верификација; нема auto-register.
- **Тестови:** верификацијата се mock-ира (инјектирај verifier) → integration тест: валиден @godigital.mk + постоечки Employee → 200 + cookie; туѓ домен → 403; непостоечки Employee → 403; неверификуван email → 403.

## Што бара од сопственикот

Google Cloud OAuth **client ID** (Web) со `http://localhost:5173` + прод origin како authorized origins. (Client secret не е потребен за овој тек.)
