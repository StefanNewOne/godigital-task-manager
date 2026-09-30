# План H3 — Rule Builder (bounded аларм engine)

**Type:** Improvement (design-gap H3, отповикува D-13 преку `ADR-001`) · **Фаза:** B1
**Summary:** Data-driven аларм engine со фиксен регистар на тип-тригери + Rule Builder UI (Директор). Евалуаторите само читаат состојба и креираат `Notification` — никогаш преод (ADR-001).

## Извор на вистина / постоечко

- Модели постојат: `AutomationRule { trigger/conditions/actions Json, enabled, isSystem, scope, clientId }`, `AutomationRun { result, detail }`.
- Постоечки евалуатор: `apps/api/src/services/alarms.ts` `evaluateCoverageAlarms()` (гатиран по име+`enabled`, праг хардкодиран) — се генерализира.
- Runner: cron `evaluate-alarms` → `apps/api/src/routes/cron.ts`. Notifications: `services/notifications.ts` (`createNotification`, дедуп по `eventKey`/ден).
- UI денес: `admin/Alarms.tsx` (тенок toggle, `POST /automation-rules/{id}/toggle`).

## Фаза 1 — core (типови + валидација + registry)

`packages/core/src/automations/`:

- `triggers.ts` — enum `TriggerType` + Zod дискриминирана унија за `trigger`+`conditions` по тип. Почетни типови (мапираат на постоечки хардкодирани аларми, PRD §4.13):
  `coverage_below {days, scope, clientId?}`, `status_age_exceeds {days, statuses[]}`, `deadline_approaching {daysBefore}`, `client_return_nth {n}`, `scenarios_exceed_slots {}`, `storage_quota {pct}`, `meta_token_expired {}`.
- `actions.ts` — Zod за `actions { level: potsetnik|alarm|kritichen, recipients: directors|owner|role:<role>, }`.
- `ruleSchema.ts` — целосна `automationRuleSchema` (name, scope, clientId?, trigger, conditions, actions, enabled) — споделено FE/BE.
- 100% unit тестови (валидна/невалидна по тип).

## Фаза 2 — API engine (евалуатор registry + runner)

`apps/api/src/services/automations/`:

- `evaluators/` — по тип-евалуатор `(rule, ctx) => NotificationIntent[]`. `coverage_below` = рефактор на `evaluateCoverageAlarms` (чита `conditions.days` наместо хардкод). Останатите генерализираат постоечки аларми каде веќе постојат.
- `engine.ts` — `runEnabledRules()`: земи `enabled` правила, dispatch по `trigger.type` до евалуаторот, креирај `Notification` (дедуп), логирај `AutomationRun {result, detail}`. **Никогаш не вика transition** (ADR-001; enforce во review).
- Cron `evaluate-alarms` → `runEnabledRules()`.
- **Инваријанта:** евалуаторите се `packages/core`-чисти таму каде можат (пресметка), API само I/O.

## Фаза 3 — API CRUD рути (Директор)

`apps/api/src/routes/automations.ts` (или прошири постоечка):

- `GET /automation-rules` (постои), `POST` (create), `PATCH /:id` (edit), `DELETE /:id` (archive/soft), `POST /:id/toggle` (постои). Сите `requireRole('dir')`, Zod-валидирани по тип. `isSystem` правила: enable/disable + прагови уредливи, но тип заклучен.

## Фаза 4 — Web Rule Builder UI

`apps/web/src/screens/admin/Alarms.tsx` (прошири) + нов `RuleForm`:

- Листа (постои) + „Ново правило" + уреди. Форма: избор тип-тригер (dropdown) → типизирани полиња за услови → акција (ниво + приматели + опсег global/client). Сите стрингови во `mk.json` (§4). Hooks во `api/admin.ts`.
- Без сиви disabled копчиња (§8.5); валидација со црвени рамки (И5).

## Тестови (§13, ист/по фаза)

- core: schema унит по тип (100%).
- api integration: секој евалуатор фира при исполнет услов + не фира при disabled/непополнет; `AutomationRun` логиран; **тест што потврдува дека engine НЕ повикува transition** (spy/architectural).
- e2e: Rule Builder — создади правило (пр. coverage_below 10 дена) → се појавува во листа; toggle; edit праг.

## Rollback / Risk

- Адитивно + рефактор на еден евалуатор; системските правила остануваат функционални. Rollback = revert (engine пад назад на постоечки toggle-гатирани евалуатори).
- Ризик: среден. Митигација: фазна испорака (4 PR-а: core → engine → CRUD → UI), read-only+notify-only евалуатори, типизирана валидација. Нова зависност: нема.
- `workflow-change`: **НЕ** (не ја менува матрицата на преоди; само аларми).

## Испорака

4 последователни PR-а (по фаза), секој со тестови и зелена CI. ADR-001 во првиот.
