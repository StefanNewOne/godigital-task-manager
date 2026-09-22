# Handoff: GoDigital Task Manager v2.0

## Overview

An internal task manager for GoDigital, a Macedonian video and graphics agency. It tracks every piece of client content — video and graphics — from monthly planning through production, internal approval, client approval, publication and analytics. The workflow model is Asana-like (list, board, calendar, task detail panel) but the status flow, role ownership and approval gates are specific to GoDigital and defined in the PRD.

Two things drive the whole product:

1. **Capa tasks (капа таск)** — a monthly container per client per content type. It carries the pre-production work (scenarios, shoot appointment, shared materials) and the reserved calendar slots. When the capa closes, its reserved slots activate into real tasks.
2. **Role ownership per status** — every status is owned by exactly one role. Only that role can act in the task's work zone; everyone else sees a locked zone. Status changes are automatic handoffs, not free-form.

## About the Design Files

The files in this bundle are **design references created in HTML** — prototypes showing intended look and behavior. They are **not production code to copy**.

The task is to **recreate these designs in the target codebase's existing environment** (React, Vue, Svelte, native, whatever the team uses) following its established patterns, component library, routing and state management. If no environment exists yet, choose the framework appropriate for the project and implement the designs there.

The HTML prototypes use a custom template runtime (`support.js`) that is part of the design tooling, not part of the product. Do not port it. Read the files for layout, spacing, colors, copy and interaction logic; then rebuild.

Seed data in the prototypes (clients, employees, tasks, metrics) is **illustrative sample data**, not a fixture to ship. Employee names came from the client; client names and all numbers are examples.

## Fidelity

**High-fidelity.** Final colors, typography, spacing, component styling, copy (Macedonian) and interaction behavior. Recreate the UI pixel-perfectly using the codebase's existing libraries. All values below are exact.

Exception: the four mobile screens in `GoDigital Mobile.dc.html` are **static mockups** — layout and content reference only, no interaction wired.

---

## Files

| File | Contains |
|---|---|
| `GoDigital Task Manager.dc.html` | The whole desktop application: all screens, all roles, all interactions |
| `GoDigital Mobile.dc.html` | Four static phone mockups (Cameraman, Editor, Account manager, Director) |
| `support.js` | Design-tool runtime. **Not product code** — do not port |
| `reference/PRD - GoDigital Task Manager v2.0.md` | Source product requirements |
| `reference/Design Brief - GoDigital Task Manager.md` | Source design brief (tokens, screen list) |

Inside `GoDigital Task Manager.dc.html`: the markup is between `<x-dc>` and `</x-dc>`; the logic class is in the `<script data-dc-script>` block at the bottom. Data model constants (`ST`, `CAP_ST`, `ROLE_CFG`, `STEP_LEAD`, `ALLOWED`, `DEFAULT_ASSIGNEES`) are at the top of that script and are the authoritative spec for the workflow.

---

## Design Tokens

### Colors

| Token | Hex | Use |
|---|---|---|
| Primary | `#0866FF` | Primary buttons, active nav, links, focus |
| Primary hover | `#0052D9` | Button hover, link hover, active nav text |
| Primary tint | `#EBF2FF` | Active nav background, selected row, hover on tinted surfaces |
| Primary border | `#C7DCFF` | Borders on tinted surfaces |
| Primary wash | `rgba(8,102,255,.04)` | Capa banner, module block background |
| Ink | `#12161C` | Primary text |
| Ink secondary | `#5C6672` | Secondary text, labels |
| Ink muted | `#8A93A0` | Tertiary text, counts, placeholders |
| Border | `#E2E7EB` | All default borders and dividers |
| Border strong | `#8A93A0` | Border on hover for secondary buttons |
| Surface | `#FFFFFF` | Cards, rows, panels |
| Surface alt | `#F7F8FA` | Table headers, column backgrounds, rail, hover rows |
| Surface pad | `#FAFBFC` | Calendar padding cells, weekends, holidays |
| Divider light | `#C9D0D8` | Unchecked checkbox border, unassigned avatar |

### Status colors

Each status has one color used for: the dot, the badge text (darkened), the badge background (10% alpha), and the calendar bar.

| Status | Label (mk) | Color |
|---|---|---|
| `mrtov` | Резервиран слот | `#9AA3AF` (dashed border; red `#DC2626` when the slot is at risk) |
| `brifing` | Брифинг | `#6B7280` |
| `scenarija` | Сценарија | `#0D9488` |
| `dizajn` | Дизајн | `#0D9488` |
| `montaza` | Монтажа | `#0D9488` |
| `chekaRezija` | Чека режија | `#7C3AED` |
| `vnatresno` | Внатрешно одобрување | `#7C3AED` |
| `scenKajKlient` | Сценарија кај клиент | `#D97706` |
| `kajKlient` | Кај клиент | `#D97706` |
| `zaObjavuvanje` | За објавување | `#65A30D` |
| `objaveno` | Објавено | `#16A34A` (rendered muted grey `#9AA3AF` on `#F7F8FA` with a `✓` prefix — completed work recedes) |
| `analitika` | Аналитика | `#DB2777` (prefix `◔`) |
| `pauza` | Пауза | `#9AA3AF` |
| `otkazano` | Откажано | `#6B7280`, title in muted grey |

Badge text color is a darkened variant of the status color: `#9AA3AF→#5C6672`, `#6B7280→#4B5563`, `#0D9488→#0F766E`, `#7C3AED→#6D28D9`, `#D97706→#B45309`, `#65A30D→#4D7C0F`, `#16A34A→#15803D`, `#DB2777→#BE185D`.

### Semantic

| Meaning | Hex |
|---|---|
| Danger / overdue | `#DC2626`, text `#B91C1C`, tint `rgba(220,38,38,.1)` |
| Warning / due soon | `#D97706`, text `#B45309`, tint `rgba(217,119,6,.1)` |
| Success / on track | `#16A34A`, text `#15803D`, tint `rgba(22,163,74,.1)` |

### Coverage thresholds

Days of planned content remaining: `> 14` green `#16A34A`, `7–14` amber `#D97706`, `< 7` red `#DC2626`.

### Client identity colors

Assigned per client, used for the 3–4px left stripe on rows and cards and the dot next to the client name: `#0D9488`, `#7C3AED`, `#D97706`, `#DB2777`, `#65A30D`, `#0EA5E9`.

### Employee avatar colors

`#7C3AED` (Director/rez), `#0284C7` (scenarist), `#0D9488` (cameraman), `#0866FF` (director), `#DB2777` (account manager), `#D97706` (editor), `#65A30D` (designer), `#0EA5E9` (graphic creator), `#DC2626` (analyst).

### Typography

Inter (400, 500, 600, 700), Cyrillic + Latin subsets, `-webkit-font-smoothing: antialiased`. `font-variant-numeric: tabular-nums` on the app shell so dates and counts align.

| Role | Size / line-height / weight |
|---|---|
| Page title | 20 / 28 / 600 |
| Screen title (mobile page) | 24 / 32 / 600, `letter-spacing:-.01em` |
| KPI number | 28 / 32 / 600, `letter-spacing:-.02em` |
| Card title | 16 / 24 / 600 |
| Panel task title | 18 / 26 / 600 |
| Body / row text | 14 / 20 / 400 (500 for names and emphasis) |
| Secondary text | 13 / 18 / 400 |
| Label / meta / badge | 12 / 16 / 500 |
| Micro (rail label) | 9 / 10 / 500, `letter-spacing:-.01em` |

### Spacing

4px base. Used: 2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 48. Card padding 16px, page padding 24px 20px, section gap 24–32px, row gap 12px, inline gap 8px.

### Radius

Buttons and inputs 6px (textarea/select 8px), badges 4px, cards and panels 8px, pills 9999px, avatars 50%, phone bezel 36px / screen 28px.

### Shadows

Popover / panel / modal: `0 12px 32px rgba(0,0,0,.14)`. Toast: `0 12px 32px rgba(0,0,0,.24)`. Card hover: `0 1px 3px rgba(0,0,0,.08)`. Knob: `0 1px 2px rgba(0,0,0,.2)`.

### Motion

`slideIn` 200ms ease-out (`translateX(24px)` → 0, opacity 0→1) for right-side panels. `fadeUp` 150ms ease-out (`translateY(8px)` → 0) for popovers, modals, toasts. No other animation.

### Sizes

Rail 64px wide, rail button 48×48. Context sidebar 240px. Top bar 56px. Toolbar 48px. Task detail panel 480px (full width when expanded). Creative viewer comment sidebar 320px. Board column 300px. Row height 44px (32px in compact mode). Control height 28px (toolbar) / 36px (form). Avatar 24px (rows) / 32px (profile). Status dot 6–8px.

---

## Data Model

### Task

`id`, `cl` (client id), `type` (`video` | `graphic`), `title`, `status`, `asg` (employee id or null), `date` (day of month), `m` (`sep` | `oct` — month key), `v` (version, starts 1), `cm` (comment count), `at` (attachment count), `urgent` (bool), `stuck` (days in current status).

Absolute day for cross-month comparison: `date + (m === 'oct' ? 30 : 0)`.

### Capa task

`id`, `cl`, `type`, `month` (display name), `status`, plus for video: `rez`, `scen`, `kam`, `shoot` (free text `"9 окт 2026, 11:30 · Скопје, студио"`), `approved` (scenarios approved), `slots` (contract slot count), `files`, `raw`; for graphics: `krea`, `files`.

**A capa's children are derived, never stored**: all tasks with the same client + same type + same month key. Slot counts and "N tasks in progress" read from that derivation. The only authored number is video `slots`, which is the contract count used for the "N of M scenarios approved" counter.

### Client

`id`, `name`, `color`, `videos` (per month), `graphics` (per month), `meta` (Meta Ads on/off), `channel` (`Viber` | `WhatsApp` | `Мејл`), `calType` (`стандарден` | `специфичен`).

**Coverage is derived, never stored.** For a client and content type: take the latest absolute day among that client's tasks of that type excluding `mrtov` and `otkazano`; coverage = that day minus today, floored at 0. A client's overall coverage is the worse of its video and graphic lines. This single derivation feeds the list group chip, the Преглед card, the Клиенти table and the coverage alarm text — do not duplicate it.

### Employee

`id`, `name`, `role`, `roleFull` (display), `color`, `email`, `last` (last activity), optional `isScenaristToo`.

Roles: `dir` Director, `am` Account manager, `rez` Director of photography (Режисер), `scen` Scenarist, `kam` Cameraman, `mon` Editor, `krea` Graphic creator, `diz` Graphic designer, `ana` Analyst.

---

## Role Permissions

Per role: which nav sections are visible, task visibility scope, whether they can create work, whether they can change publish dates, which statuses they own, which capa statuses they own, and which content types they touch.

| Role | Nav | Scope | Creates | Changes date | Owns task statuses | Owns capa statuses |
|---|---|---|---|---|---|---|
| `dir` | Преглед, Задачи, Календар, Клиенти, Аналитика, Админ | all | — | yes | — (special transitions only) | — |
| `am` | Преглед, Задачи, Календар, Клиенти, Аналитика | all | — | yes | `zaObjavuvanje` | — |
| `rez` | Преглед, Задачи, Календар, Клиенти, Аналитика | all | video | yes | `chekaRezija`, `vnatresno`, `kajKlient` | `podgotovka`, `scenKajKlient` |
| `scen` | Задачи, Календар | own | — | — | — | `scenarija` |
| `kam` | Задачи | own | — | — | — | `snimanje` |
| `mon` | Задачи | own | — | — | `montaza` | — |
| `krea` | Задачи, Календар, Клиенти, Аналитика | all | graphic | yes | `brifing`, `vnatresno`, `kajKlient` | `gPodgotovka` |
| `diz` | Задачи | own | — | — | `dizajn` | — |
| `ana` | Задачи, Клиенти, Аналитика | all | — | — | `analitika` | — |

Director's special transitions: Пауза, Откажан, Мртов → Активен, Промена на датум.

**Scope** controls visibility only: `own` sees only tasks assigned to them; `all` sees every client's tasks in List and Board. **Ownership** controls action: the task detail work zone is interactive only for the role that owns the current status (plus Director). For everyone else it renders at 55% opacity with `pointer-events:none` and a lock line "🔒 Чека {role} · {name}". Terminal statuses (`objaveno`, `zavrseno`, `otkazano`, `pauza`) are never locked.

For `vnatresno` and `kajKlient` the owner depends on content type: video → `rez`, graphics → `krea`.

**Creation rights**: only `rez` (video) and `krea` (graphics) see "+ Нова капа" and "+ Ново видео" / "+ Нова графика". The content type is not a choice — it is derived from the role. Other roles do not see the buttons at all (not disabled — absent).

---

## Status Flow

Status changes are automatic handoffs: the owning role enters the mandatory input, the task moves to the next status and appears for the next role. Transitions outside the matrix are rejected with a toast naming the attempted transition.

### Video capa (pre-production)

| Status | Owner | Mandatory input | Internal deadline | Next |
|---|---|---|---|---|
| Подготовка | Режисер | Scenarist, shoot date, time, place — all four | 10 days before shoot | Сценарија |
| Сценарија | Сценарист | One document with all scenarios, marked `СЦЕНАРИО 1:`, `СЦЕНАРИО 2:` — split on the markers, manually correctable | 7 days before shoot | Сценарија кај клиент |
| Сценарија кај клиент | Режисер | Client outcome per scenario | 3 days before shoot | Снимање |
| Снимање | Камерман | Raw footage uploaded | on the shoot day | Затворен (automatic) |
| Затворен | system | — | — | children activate |

If approved scenarios < reserved slots, the surplus slot turns red and an alarm fires.

### Graphic capa

| Status | Owner | Mandatory input | Internal deadline | Next |
|---|---|---|---|---|
| Подготовка | Гр. креатор | Shared materials for the month + general notes | 3 days before the first slot | Затворен, children activate |

### Video task

| Status | Owner | Mandatory input | Internal deadline | Next | Return |
|---|---|---|---|---|---|
| Чека режија | Режисер | Editing notes + editor assignment | 8 days before publish | Монтажа | — |
| Монтажа | Монтажер | Edited video uploaded | 6 days before publish | Внатрешно одобрување | — |
| Внатрешно одобрување | Режисер | Approve, or return with a mandatory comment | 4 days before publish | Кај клиент | → Монтажа |
| Кај клиент | Режисер | Client outcome + channel | 3 days before publish | За објавување | → Монтажа |
| За објавување | Акаунт менаџер | Copy, platforms, post link | 1 day before publish | Објавено | — |
| Објавено | Акаунт менаџер | Publication confirmed | on the publish day | Аналитика | — |
| Аналитика | Аналитичар | Decision: organic or paid | 7 days after publish | end | — |

### Graphic task

| Status | Owner | Mandatory input | Internal deadline | Next | Return |
|---|---|---|---|---|---|
| Резервиран слот | Гр. креатор | Briefing + designer assignment | — | Брифинг | — |
| Брифинг | Гр. креатор | Saved briefing with references | 7 days before publish | Дизајн | — |
| Дизајн | Гр. дизајнер | Graphic uploaded | 5 days before publish | Внатрешно одобрување | — |
| Внатрешно одобрување | Гр. креатор | Approve, or return with a mandatory comment | 3 days before publish | Кај клиент | → Дизајн |
| Кај клиент | Гр. креатор | Client outcome + channel | 2 days before publish | За објавување | → Дизајн |
| За објавување | Акаунт менаџер | Copy, platforms, post link | 1 day before publish | Објавено | — |
| Објавено | Акаунт менаџер | Publication confirmed | on the publish day | Аналитика | — |
| Аналитика | Аналитичар | Decision: organic or paid | 7 days after publish | end | — |

A return always creates a new version (`v+1`) and requires a comment.

### Internal deadlines

Each status carries its own deadline, computed backwards from the publish date (tasks) or the shoot date (capa). Leads in days: video `chekaRezija:8, montaza:6, vnatresno:4, kajKlient:3, zaObjavuvanje:1, objaveno:0, analitika:-7`; graphics `brifing:7, dizajn:5, vnatresno:3, kajKlient:2, zaObjavuvanje:1, objaveno:0, analitika:-7`; capa `podgotovka:10, scenarija:7, scenKajKlient:3, snimanje:0` before the shoot.

Rendered as: `рок пречекорен N дена` (red `#DC2626`, weight 600, prefix `⚠`), `рок денес` / `рок утре` (amber `#D97706`, prefix `◷`), `рок за N дена` (grey `#5C6672`). Singular: `1 ден`, not `1 дена`.

### Capa closing and slot assignment

Reserved slots keep their generated date while dead. **On activation each child takes the first free date** from the client's calendar for its content type, skipping any day already taken by another task of the same client (any type). Video days are Tuesday and Friday; graphics take the other weekdays; Sundays and holidays are excluded; September holidays 8 and 11. If the month runs out of free days, the remaining tasks keep their old date and a toast says how many need manual placement.

On activation the task also gets a title `{Client} {V|G}-{month}-{day}` and is assigned to the capa's owning role.

---

## Screens

### 1. Мои задачи (My tasks)

**Purpose** — the working home screen for every role: what I owe, ordered by urgency.

**Layout** — 900px max width, 24px 20px 48px padding. Summary line ("Имаш N задачи, N доцни."), then sections: Капа таскови, Доцни, Денес и утре, Наскоро, Подоцна овој месец, Во тек · објавени. Each section: dot + 16/24/600 title + muted count, then a white card with 1px `#E2E7EB` border, 8px radius, rows inside.

**Row** — 44px tall, 16px horizontal padding, 12px gap: 3px client stripe (24px tall, 2px radius) · title (14/20/500, ellipsis) · status badge · per-status deadline label · publish date, right-aligned, 88px. Hover `#F7F8FA`. Click opens the detail panel.

**Sidebar** — Мои прегледи: Сите мои, Доцни, Оваа недела, with counts; single-select, active item `#EBF2FF` / `#0052D9` / 600.

Content is filtered to tasks assigned to me **and** in a status my role owns. The Director sees all non-reserved tasks.

### 2. Список (List)

**Purpose** — the full month across clients, grouped and scannable.

**Layout** — capa strip on top, then one card containing a sticky header row and collapsible groups.

**Capa strip** — with one matching capa: a full banner (1px `#C7DCFF`, `rgba(8,102,255,.04)`, 8px radius, 16px padding) with `🎬` + title + status badge + counter + "+ Нова капа" + "Отвори капа", a 4-step progress row (20px circles: done `#16A34A` with ✓, active `#0866FF`, future white with `#E2E7EB` border; connector 1px, 3px under the active step), and a meta row (Снимање / Сценарист / Режисер). With several capas: a grid of 300px-min cards. With none: a dashed row offering "+ Нова капа" (only for `rez` / `krea`).

**Table** — 7 columns: `minmax(240px,2.2fr) 104px 190px 172px 104px 56px 60px`, 12px gap, 16px row padding. Headers: Име, Датум на објава, Статус, Улога и доделен, Датум, Верзија, Прилози. The card scrolls horizontally; the header row, group headers and data rows share **one** `width:max-content; min-width:100%` wrapper so all columns align and row backgrounds span the full table width.

**Name cell** — 3px client stripe · 16px type box (`▶` video `#7C3AED`, `▧` graphics `#0D9488`) · title · optional `▲ итно` in `#DC2626`.

**Group header** — caret, client dot, name (14/600), count, then a coverage chip: 4px color bar + "покриеност N дена".

**Reserved slots** — dashed `#DC2626` border, title "{Client} · резервиран слот · {date}", muted text, dashed date box.

**Toolbar** — 48px: create split-button (only for `rez` / `krea`), then right-aligned: group-by toggle (Board only), type toggle (Calendar only), client select, Филтер, Подреди, Групирај, Опции, search field. The toolbar never shows its own scrollbar; the search field shrinks instead.

Филтер opens a 280px popover: month checkboxes (multi-select, with counts) above a status checkbox list, plus "Исчисти филтри". Подреди cycles date → client → status. Групирај switches the List between grouping by client and by status. Опции toggles compact rows (44px → 32px).

**Sidebar** — Месеци as **multi-select checkboxes** (Септември, Октомври, Август with counts — click to add, click again to remove; several months show as one chronological stream), then Клиенти with counts.

### 3. Табла (Board)

**Purpose** — pipeline view, drag to advance.

**Layout** — fills the viewport height, horizontal scroll at the bottom, 300px columns with 16px gaps. Each column: `#F7F8FA`, 1px border, 8px radius, 8px padding; pinned header (dot, title, count, `⋯`) and footer (create button); cards scroll vertically inside the column.

**Card** — white, 1px border, 8px radius, 12px padding with 16px left (4px client stripe inset at the left edge). Two-line clamped title, status badge, assignee line, then a meta row: deadline · comments `💬` · attachments `📎` · version · module mark `✦`. Urgent: a 14px red corner triangle top-right. Stuck > 3 days: `◷ N дена во статус` in `#D97706`.

**Grouping** — by client, or by status. Selecting a single client forces status grouping.

**Drag and drop** — dragged card drops to 40% opacity. Valid targets get a `#C7DCFF` dashed border; the hovered target turns green `#16A34A` if the transition is allowed, red `#DC2626` if not. An invalid drop is rejected with a toast naming both statuses. Returning to Монтажа or Дизајн requires a comment and is rejected from the board.

### 4. Календар (Calendar)

**Purpose** — the publication schedule, and where free and reserved slots live.

**Layout** — month grid (7 columns, ≥112px cells) plus a 300px day panel on the right (floats over the grid below 1100px).

**Header** — ‹ month label › and a legend: Монтажа/Дизајн, Одобрување, Кај клиент, ✓ Објавено, ◔ Аналитика, Празен слот (dashed red). Weekday names are full (Понеделник…Недела), abbreviated below 820px.

**Cell** — day number (today: white on `#16A34A` circle; past: muted), a day-type hint (видео / графика / празник), then task bars: 3px 6px padding, 4px radius, status tint background, 1px border (dashed for reserved), dot + label. Selected day `#EBF2FF`; weekends and holidays `#FAFBFC`.

Bars are draggable onto another day — this opens the date-change modal. Past days reject the drop. Months with no content show an empty state offering "Генерирај распоред".

The calendar has its **own** month navigation, independent of the multi-month selection in Задачи.

### 5. Task detail panel

**Purpose** — everything about one task, and the one place work happens.

**Layout** — 480px right panel (expandable to full width), `slideIn` animation. Three parts: a 48px header, a scrolling body, a fixed comment composer.

**Header** — status badge · overlapping 24px avatars of the task team (−8px margin, 2px white border) + overflow count · `✦ Прашај` (only if the client has the Claude module) · expand · `⋯` · close.

The **team** is derived from content type, not fixed: video → Режисер, Сценарист, Камерман, Монтажер, Акаунт менаџер; graphics → Гр. креатор, Гр. дизајнер, Акаунт менаџер. The Analyst joins only if the client has Meta Ads.

**Fields** — a 120px/1fr grid: Клиент, Тип, Доделен, Датум на објава (+ "Промени датум" where permitted), Рок за овој статус, Приоритет.

**Module block** — only when the client has the relevant AI module for the current status (GraficarAI in Дизајн, AI копирајтер in За објавување): 1px `rgba(8,102,255,.2)`, `rgba(8,102,255,.04)`, `✦` icon, name, description, action button. The result lands in the work zone for manual review. If the module is not assigned to the client, the button does not exist.

**Work zone** — bordered box, `#F7F8FA` header showing the owning role. Content per status:

- *Брифинг* — briefing textarea (1200 char counter), attach references, designer select, "Зачувај брифинг и активирај".
- *Дизајн* — read-only briefing, then **Материјали за работа**: client document, partner logo, month image set (all three inherited from the capa) and briefing references, each with a Симни button, plus "Симни сите"; then the upload dropzone.
- *Монтажа* — scenario text, raw footage from the capa with a low-res Прегледај, editing notes, "Прикачи монтирано видео".
- *Внатрешно одобрување* — creative preview (click for fullscreen), Одобри / Врати со коментар; returning reveals a mandatory comment field and states the new version and target status.
- *Кај клиент* — sent-via line, three outcome buttons (Одобрено, Одобрено со измени, Врати на доработка), comment field, attachment from the conversation, channel select.
- *За објавување* — copy textarea (2200 char counter), platform chips, post type select, post link field, Симни креатива, "Потврди објава" (blocked without copy and link).
- *Аналитика* — Органски / Во реклами, then a metrics grid.
- *Locked* — dashed box, `🔒 Чека {role} · {name}`.

**Sections** — collapsible: Контекст (briefing, scenario, inherited capa materials), Креатива (preview + version thumbnails), Објава (copy, platforms, link), Активност (chronological log with author avatars and a right-aligned type tag).

### 6. Капа таск panel

Same panel shell. Header shows `Капа · {status}`. The banner carries the 4-step progress. Work zone per capa status implements the mandatory-input gates in the flow tables above; the Подготовка gate refuses to advance and marks the empty fields red. Graphic Подготовка lists the reserved slots in the package and offers "Активирај N таска".

### 7. Преглед (Overview)

**Purpose** — the Director's morning screen. Also available to the Режисер, scoped to video only.

**Layout** — responsive grid, `minmax(420px,1fr)`, on `#F7F8FA`.

**Покриеност по клиент** — one row per client, sorted worst first, **clickable** → opens that client in Список. Each row: coverage color bar (full height), client dot, name, then one line per content type: label, monthly quota, progress bar, "до {date}", days remaining in the threshold color. For the Режисер the card is titled "Покриеност по клиент · видео" and shows only the video line.

**Отворени аларми** — count badge, rows with severity dot, title, meta, level pill (Критичен / Аларм / Потсетник) and "Во таскот". Alarms are filtered by recipient role per the PRD; the coverage alarm text derives its number from the same coverage calculation as the card.

**Работа по статус** — one row per status, **clickable** → opens Табла grouped by status and filtered to that status. Row: status dot, label, bar, count, average days in status.

**Кампањи во тек** — per campaign: client dot, name, period, budget-spent bar, then budget / spent / reach / cost per result. Header links to the full Аналитика.

### 8. Клиенти

Table: Клиент, Видео/мес, Графика/мес, Активни таскови, Покриеност, Канал. Rows are clickable → that client's list. Coverage here is always the unscoped worst-of-both number, never role-scoped.

### 9. Аналитика

Six KPI cards (Досег, Прегледи, Ангажман, Потрошено, Цена по резултат, Објави) with month-over-month deltas; organic vs paid split with a stacked bar and per-segment detail; campaigns in progress; top posts by engagement with a relative bar; a per-client table. Footer states data freshness: last pull today 06:00, next in 6 hours, each pull a new snapshot that never overwrites the previous.

### 10. Преглед на креатива (Creative viewer)

Fullscreen `#12161C` overlay. Top bar: file name, version pill, client · task, Симни, close. Center: the creative on a neutral `#22262E` stage, max 60vh, 4:5 aspect. Bottom: version thumbnail strip (72×64, active outlined `#0866FF`). Right: 320px comment sidebar on `#161920` with авторите, timestamps, a composer, and Одобри / Врати.

### 11. Админ конзола

240px sidebar (Клиенти, Вработени и улоги, Улоги и дозволи, Календари, Автоматизации, Аларми, Модули, Сторидж, Извештаи) plus a 56px header with the section title and its primary action. Sections:

- **Клиенти** — cards with contract, channel, Meta Ads, calendar type and assigned modules.
- **Вработени и улоги** — table: name + email, role, status, last activity, who entered them.
- **Улоги и дозволи** — the PRD permission matrix, read-only (П / Ч / —).
- **Календари** — the standard weekly schedule, excluded dates, and next-month slot generation (automatic on the 20th, confirmed by the Account manager).
- **Автоматизации** — the status flow as four read-only tables (video capa, video task, graphic capa, graphic task) with columns Статус, Кој го носи, Што мора да се внесе, Внатрешен рок, Следен статус; return paths in red. The flow is the process definition, not a toggle. Below: **Автоматско доделување** — per-client designer assignment rules, each with a real on/off toggle.
- **Аларми** — the six time and threshold rules with on/off toggles and severity pills: 15 days before a video date, 7 days before, 2 days before, 24h after a shoot with no footage, stalled in status > 3 days, coverage below 7 days.
- **Модули** — client × module checkbox matrix (GoScripterAI, GraficarAI, AI копирајтер, Claude помошник). An unassigned module means the button does not exist in the task.
- **Сторидж** — retention per asset class with usage bars.
- **Извештаи** — per-client metric table.

Admin is visible only to the Director.

### 12. Mobile (separate file)

Four static 340×700 mockups: Cameraman (shoot appointment, scenarios, upload in progress with a resumable progress bar), Editor (status, editing notes, low-res preview of the raw footage), Account manager (overdue publication, copy, mandatory link), Director (coverage and alarms). Each has a 36px status bar, 48px title bar, content area, primary action button and a 5-item bottom tab bar. These are layout references — in production this is the same app on a phone, not a separate section.

---

## Interactions & Behavior

- **Navigation** — rail switches section; tabs switch Мои задачи / Список / Табла within Задачи. The detail panel stays open while switching tabs inside Задачи and closes when leaving the section.
- **Detail panel** — opens on row or card click, closes on ✕, expands to full width on ⤢. Below 1200px it floats over the content with a shadow instead of taking layout space.
- **Context sidebar** — collapsible; hidden entirely below 1200px (month selection then lives in the Филтер popover).
- **Toasts** — bottom right, dark `#12161C`, 4.2s auto-dismiss, one at a time. Used for rejected transitions, validation failures and the result of every handoff.
- **Validation** — mandatory inputs block the transition and explain what is missing; empty required fields get a red border. Publication requires copy and link. Returns require a comment. Date changes require a reason.
- **Date change modal** — old date (read-only), new date from free slots, mandatory reason. States that the old slot is released and turns red in the calendar and that the task is not deleted.
- **Alarms panel** — 400px right panel grouped by client, each alarm with severity and a jump into the task.
- **Claude assistant** — 360px right panel, answers questions about process, rules and clients; explicitly changes no data. Only for clients with the module.
- **Empty states** — every list and calendar has one, and it names the real cause (no month selected, month not planned yet, filters match nothing, August archived) with an action that resolves it.
- **Hover** — rows `#F7F8FA`; secondary buttons border `#E2E7EB` → `#8A93A0`; primary buttons `#0866FF` → `#0052D9`; cards gain `0 1px 3px rgba(0,0,0,.08)`.

## State Management

Screen state: `view`, `inAdmin`, `adminSec`, `contextOpen`, `openId` (task or capa), `wide`, `claudeOpen`, `alarmsOpen`, `dateModal`, `creative`, `newTaskOpen`, `newCapOpen`, `adminFormOpen`, `moreOpen`, `roleMenu`, `toast`.

Filter state: `months` (array), `clientFilter`, `statusFilter` (array), `q` (search), `sortBy`, `listGroupBy`, `groupBy` (board), `calType`, `compact`, `myView`, `month` (calendar), `dayPick`, `dayPanelOpen`, `groupsOpen`, `secOpen`.

Data state: `tasks`, `caps`, `modules`, `rulesOff`, `assignOff`.

Form state: `nt` (new task), `nc` (new capa), `shoot` (capa preparation: date, time, place, notes), `shootTried`, `scenPick`.

Interaction state: `drag`, `dragOver`, `w` (viewport width, measured live).

Session: `me` (current employee id) — in production this comes from auth, not state.

**Data fetching** — the prototype holds everything in memory. In production expect: clients, employees, tasks and capas per month; metric snapshots pulled from Meta every 6 hours and stored append-only; presigned URLs for uploads and downloads; chunked resumable upload for raw footage (multi-GB, must survive connection loss).

## Assets

No images or icon libraries. All icons are Unicode glyphs (`⌂ ☑ ▦ ◍ ◔ ⚙ ✓ ✕ ⇤ ⇥ ⤢ ⋯ ▾ ▸ ‹ › ⌕ ✦ 🔒 ⚠ ◷ 🎬 💬 📎 📄 🖼 🗂 🎞 ▶ ▧`). Replace these with the codebase's icon set during implementation — they are placeholders chosen so the prototype has no asset dependencies.

The GoDigital logo is rendered as a 32×32 `#0866FF` rounded square with "GD" in white 12/700. Replace with the real logo asset; a vector version was not available when the design was made.

Fonts: Inter via Google Fonts, Cyrillic + Latin. The design brief specifies Inter.

## Notes for Implementation

1. **Derive, never store, anything computable.** Coverage, capa children, slot counts and deadlines are all derived in the prototype after a series of bugs caused by duplicated authored values. Keep it that way — a second source of truth for coverage produced three screens disagreeing with each other.
2. **Role ownership is the core rule.** Visibility and action are separate concerns: scope controls what you see, ownership controls what you can do. Do not collapse them.
3. **Every transition is gated.** The mandatory input is not advisory; the transition must fail and explain itself.
4. **Copy is Macedonian and final.** Do not translate or rewrite it. Mind the singular/plural: `1 ден` vs `2 дена`.
5. **The reference date in the prototype is 20 September 2026**, with September as the fully planned month and October generated as reserved slots. This is sample data.
