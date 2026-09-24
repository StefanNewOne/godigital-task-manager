# План — Фаза B3: Сторидж животен циклус

Верзија 1.0 · 2026-09-24 · Статус: **✅ ЗАВРШЕН** (B3.1–B3.4; реален ffmpeg зад адаптер, се активира со бинар)

Извор: PRD_v3 §4 (сторидж), implementation-plan.md §4 (B3), backlog §2 (O-B3), §3 (H7).

**Цел:** суровиот материјал има ограничен животен век (7 дена + продолжување 30), прегледите се генерираат автоматски, а квотата се следи.

**Веќе готово:** `E_STORAGE_TIMER` (при `snimanje→zatvoren` поставува `TaskGroup.rawDeleteAt = затворање + 7 дена`); `TaskGroup.rawDeleteAt`/`localArchivePath` во шема; `FileLifecycle` enum (active/scheduledDeletion/deleted/archivedLocally).

**O-B3 (провизорно):** суров 7 дена + продолжување 30; финал/преглед траен.

**ffmpeg зад адаптер** (одлука на сопственикот): `PreviewGenerator` со dev-stub; реалната ffmpeg импл. се активира кога бинарот е во worker сликата.

## Под-единици

### B3.1 — Cleanup cron + продолжување + локална архива

- `deleteObject(key)` во `lib/storage.ts`.
- `services/storage.ts`: `runStorageCleanup()` — групи со `rawDeleteAt ≤ сега` и без локална архива → raw `FileAsset` lifecycle→`deleted` + R2 delete; исчисти `rawDeleteAt`. `extendRaw(groupId, +30)`; `archiveLocally(groupId, path)` → lifecycle `archivedLocally`, спречи бришење.
- Cron `/api/cron/storage-cleanup` (дневно) + worker job.
- Endpoints: `POST /task-groups/:id/storage/extend`, `POST /task-groups/:id/storage/archive`.
- Тестови: cleanup брише истечен суров; extend поместува +30; archive спречува бришење.

### B3.2 — Прегледи (ffmpeg зад адаптер)

- `services/preview/previewGenerator.ts` интерфејс + `.stub.ts` (детерминистички: враќа preview key без обработка) + `.ffmpeg.ts` (реален, gated на env/бинар).
- При `POST /files/:id/complete` за `video`/`image` → генерирај preview `FileAsset(kind=preview)` + постави `source.previewFileId`.
- Тестови (stub): complete на видео создава preview + врзување.

### B3.3 — Квота аларм

- `services/storage.ts`: сума `FileAsset.size` (active) по клиент; праг (env `STORAGE_QUOTA_GB`, default висок) → критично известување до Директор (како аларм за покриеност). Cron.
- Тест: над праг создава известување.

### B3.4 — Сторидж акции UI (H7)

- Во Капа панел / Task Detail: суров материјал со одбројување до бришење + „Продолжи +30 дена" + „Локална архива".

## Инваријанти

- Бришењето суров материјал е НАМЕРНА retention политика (не ги допира append-only табелите §И6). Lifecycle e мек премин; R2 објектот се брише за да се ослободи простор.
- tenant scope на сите queries (§И1); presigned само (§И7); без hardcoded секрети (§12).

## DoD (gate B3)

Суров материјал се брише по 7 дена (или +30 продолжување), локална архива го спречува; прегледите се создаваат; квота аларм работи; PRD §18 „Сторидж" зелено.
