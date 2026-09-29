# Промени поради Мета

Сè што се менува во постоечкиот Task Manager и backend за да се внесе Модул 3. Деталите се во `META_TECH_SPEC.md` (број на дел во заграда).

## UI · нови делови

- Нов главен таб **„Мета“** во навигацијата, видлив за dir, ana и am. За am се прикажуваат само Инбокс и Коментари (§3).
- Подтабови: Утрински преглед, Клиенти, Пресек, Инбокс, Коментари, Планови, Архива, Асистент, Поврзувања.
- Модал за план со before/after, последици, предупредувања и штиклирање „Ги прочитав предупредувањата“ (§12).
- Статусна лента на план: pending → approved → syncing → done / rejected / mismatch / withdrawn (§12).

## UI · промени во постоечки екрани

| Екран                    | Промена                                                                                                                | Дел  |
| ------------------------ | ---------------------------------------------------------------------------------------------------------------------- | ---- |
| Аналитика (`/analytics`) | Тргнати „Кампањи во тек“ и „Топ објави“. Додадена картичка „Отвори Мета“ (ana, dir)                                    | D7   |
| Таск · зона Аналитика    | Статичниот блок метрики е заменет со живи метрики од Meta: Органски, Платено (по реклама), планови, „Отвори во Мета ›“ | §9.1 |
| Таск · копче „Платено“   | Отвора предлог O4 во Мета со објавата однапред избрана. Ако објавата е веќе во реклама, го отвора тој ad set           | §9   |
| Таск · секција Објава    | Ред „Meta“: поврзано / чека резолуција, органски метрики, „Во реклама: …“                                              | §9.1 |
| Лев панел · клиент       | Избраниот клиент ги филтрира Инбокс, Коментари, Планови, Архива                                                        | D9   |
| Аларми                   | Непроменето. Meta алертите не одат тука                                                                                | D5   |
| Клиент · поставки        | Приказ „Мета: вклучено / исклучено“ (`usesMetaAds`)                                                                    | §4.1 |

## Backend · база (миграции)

- Ново: `MetaConnection`, `MetaCampaign`, `MetaAdSet`, `MetaAd`, `MetaInsightDaily`, `MetaConversation`, `MetaMessage`, `MetaComment`, `MetaAlert`, `MetaChangePlan` (§4).
- Проширено: `Client` (meta* полиња за цели, прагови, белешки), `Publication` (mediaType, caption, thumbnailFileId) (§4.1, §4.3).
- Реупотреба: `Publication`, `MetricSnapshot`, `PageSnapshot`, `Promotion`, `EventLog` (нови `meta.*` eventType), `KnowledgeChunk` (§2).

## Backend · сервиси и рути

- `MetaClient`: нови методи само за читање (§6).
- `routes/meta.ts`: проширено со `/meta/*` рути; `ana` добива читање; `am` само conversations/comments (§8).
- Нов `GET /tasks/:id/meta` за метриките во таскот (§9.1).
- `POST /api/webhooks/meta` со проверка на потпис (§7).
- `routes/campaigns.ts`: POST/PATCH се затвораат за Meta кампањи (§2, судир 1).

## Backend · worker

10 нови cron jobs (`meta.status`, `meta.structure`, `meta.insights.today`, `meta.insights.backfill`, `meta.account`, `meta.inbox.fallback`, `meta.token`, `meta.alerts.digest`, `meta.retention`, органика преку постоечкиот `metrics.pull`) (§7).

## Токени

- `META_SYSTEM_TOKEN`: додај `pages_read_engagement`, `pages_manage_metadata`.
- Нов `META_INBOX_TOKEN`: pages_messaging, instagram_manage_messages, pages_read_user_content, instagram_manage_comments (§5).

## Судири што чекаат одлука (§2)

1. `campaigns.ts` дозволува директно менување.
2. Буџет во € наспроти USD акаунти.
3. Токенот нема дозволи за пораки/коментари.
4. `Role` enum нема `sales`.
5. `metrics.pull` на 6 ч е премногу ретко за алерти.

## Отворени прашања (§18)

1. am: сите клиенти или само свои?
2. Webhook патека надвор од VPN?
3. A07 праг: по клиент или глобално?
4. Рачни `Campaign` без Meta ID: остануваат?
5. Повеќе рекламни акаунти по клиент во UI: кога?
6. Затворање таск по крај на кампања: предлог или автоматски?
