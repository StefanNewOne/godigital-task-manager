# План B5 — GoScripterAI (генерирање сценарија за видео капа)

**Type:** Feature (Фаза B5, PRD §5) · **Бара одобрување** (§22, повеќе-фајлна + AI интеграција).
**Зависности:** B4 (знаење/Claude proxy/embeddings/ModuleAssignment) — **целосно изградено**. Без нова зависност (raw HTTP, како B4).
**PRD AC (§5, ред B5):** „Сценарист прифаќа/коригира, поделбата работи."

## Концепт (AI како асист, не актер — И2)

GoScripterAI генерира **нацрт-сценарија** за видео капа во статус `scenarija`. Сценаристот (или Режисер/Директор) ги **прегледува, коригира и прифаќа** преку постоечкиот тек (`updateScenario`, `setScenarioOutcomes`), а поделбата/исходите работат непроменето. AI **не прави** state-machine преод и **не одобрува** — само предлага содржина што човек ја потврдува.

Интеграциска точка: постоечкиот `splitScenarios` (apps/api/src/services/scenarios.ts) создава `Scenario(source:'manual')` за `group.scenarioDocVersion`. B5 додава паралелен „generate" што создава `Scenario(source:'ai', status:predlozeno)` за истата docVersion (идемпотентно — заменува нацрти за тековната верзија, исто како split). `Scenario.source` веќе постои (`manual | ai`).

## Опсег

### packages/core

- `generateScenariosSchema` (Zod): `{ count?: int 1..12 (default 6), instructions?: string }`.
- Тип `ScenarioDraft { title, hook?, body?, notes? }` (повторно користен од UI).
- (Без нов transition/guard — генерирањето НЕ е преод; матрицата непроменета, `workflow-change: НЕ`.)

### apps/api

- **`services/ai/scenarioGen.ts`** — провајдер по B4 образец (фабрика по `CLAUDE_MODE`):
  - `StubScenarioGenerator` (dev/тест): детерминистички N нацрти од контекст (без LLM).
  - `ClaudeScenarioGenerator` (api): raw HTTP до Anthropic, `response`-focused систем промпт на македонски, бара **строг JSON** (низа од `{title,hook,body,notes}`), robust parse + refusal handling.
  - `ClaudeCliScenarioGenerator` (cli): преку локален claude CLI (STDIN, како B4).
  - Контекст преку `searchKnowledge(clientProfile+past scenarios/briefs/feedback, clientId)` + `group.scenaristNotes`.
  - `setScenarioGenerator()` за тест-инјекција.
- **`services/scenarios.ts`** — нова `generateScenarios(groupId, input, actor)`:
  - Guards (route+service, defense in depth): group постои, `contentType==='video'`, `status==='scenarija'`, `actor.role ∈ {scen,rez,dir}`, **ModuleAssignment(clientId, 'goScripterAi', active)** (иста проверка како `/assistant/ask`).
  - Повикај генератор → во трансакција: замени `Scenario` за тековната docVersion со `source:'ai'`, `status:predlozeno`; `recordEvent('scenarios.generated', наратив мк)`; врати ја листата.
- **`routes/taskGroups.ts`** (или scenarios рутер): `POST /task-groups/:id/generate-scenarios` (requireAuth + Zod + сервис).
- Нов наратив шаблон `scenarios.generated` (тест — §6/§13).

### apps/web

- Во капа панелот (видео, статус `scenarija`): копче **„Генерирај со GoScripterAI"** (видливо само ако модулот е активен за клиентот + улога scen/rez/dir). Отвора мал дијалог (број сценарија + опционални инструкции) → hook `useGenerateScenarios` → по успех ги полни сценаријата во постоечкиот уредувач за преглед/корекција. Toast за успех/грешка.
- Сите стрингови во `mk.json` под `goScripter.*`.
- (Без копче = нема модул/улога — §8.5 „без сиви исклучени копчиња".)

## Тестови

- **core:** `generateScenariosSchema` (default count, граници, invalid).
- **api integration (stub provider):** нема ModuleAssignment → одбиено; погрешна улога → 403; погрешен тип/статус → 400; happy path создава N `Scenario(source:'ai', predlozeno)` + EventLog `scenarios.generated`; идемпотентно по docVersion; потоа постоечкиот split/outcomes/updateScenario работат.
- **narrative:** шаблон за `scenarios.generated`.
- (Live LLM не се тестира — stub е детерминистички; `CLAUDE_MODE=stub` во тест.)

## Безбедност / инваријанти

- §2/§12: AI само преку backend proxy, клуч само во env, никогаш на frontend. Без нова зависност (§18).
- И2: генерирањето не е преод; статусите се менуваат само преку state machine од човек.
- И1: сите queries tenant-scoped; ModuleAssignment по клиент.
- §16: грешки од LLM → генеричка мк порака; без PII во логови; `ai.called` бизнис лог.

## Rollback / Risk

- Адитивно (нов сервис + рута + копче; нема промена на employee текови ниту матрица). Rollback = revert.
- Ризик: низок-среден (нова LLM точка, но човек-во-јамка + stub default + модул-гејт). Live режим се вклучува со env (`CLAUDE_MODE=api|cli` + клуч) на staging.
- `workflow-change`: **НЕ**.

## Испорака

Еден PR во `develop` (`improvement/B5-goscripter-ai`): core + api + web + тестови, зелена CI. B6/B7 следат по ист образец (посебни планови).
