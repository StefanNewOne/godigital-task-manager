# @gd/eslint-plugin

Наменски ESLint правила што ги спроведуваат тврдите инваријанти од `CLAUDE.md` што
генеричките правила (`@typescript-eslint`) не ги фаќаат.

## Правила

### `no-task-status-write` (И2)

Забранува директен Prisma запис на **Task.status** и **TaskGroup.status**:

```ts
// ❌ забрането надвор од state machine
await prisma.task.update({ where: { id }, data: { status: 'montaza' } });
await tx.taskGroup.updateMany({ where, data: { status: 'zatvoren' } });
await prisma.task.upsert({ where, create, update: { status: 'x' } });
```

Статусот се менува **само** преку `transitionTask` / `transitionTaskGroup`
(state machine, `packages/core/src/workflow/transitions.ts`). Ако ти треба нов
преод — додади ред во матрицата, не заобиколувај го engine-от.

**Опсег.** Правилото таргетира само моделите `task` и `taskGroup`. Другите
животни циклуси (`publishingSlot.status`, `uploadSession.status`,
`scenario.status`, …) не се workflow-статуси и се дозволени. `create` (иницијално
креирање) не е преод и не се фаќа.

**Изземање.** Единствениот легитимен писувач — самиот state machine во
`apps/api/src/services/workflow/**` — се изземa преку `ignores` во root
`eslint.config.js`, не преку исклучок во правилото. Тестовите и `packages/db/prisma`
(seed) исто така се изземени.

**Ограничување.** Правилото ја фаќа литералната форма (`data: { status: … }`).
Индиректен запис преку променлива (`data: someVar`) не се фаќа статички — ретко,
и живее само во изземениот workflow слој.

## Тест

```
pnpm --filter @gd/eslint-plugin test
```
