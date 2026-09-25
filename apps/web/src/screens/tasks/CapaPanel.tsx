import type React from 'react';
import { useEffect, useState } from 'react';
import { GROUP_STATUS_META, PERMISSIONS, ROLE_LABEL, type GroupStatus, type Role } from '@gd/core';
import { Button } from '@gd/ui';
import { Check, Lock, X } from 'lucide-react';
import { useMe } from '../../api/auth.js';
import { useEmployees } from '../../api/admin.js';
import {
  useArchiveStorage,
  useBulkActivate,
  useExtendStorage,
  useGroupTransition,
  useScenarioOutcomes,
  useScenarios,
  useSplitScenarios,
  useTaskGroup,
} from '../../api/taskGroups.js';
import { useGroupUpload } from '../../api/files.js';
import { ApiRequestError } from '../../lib/api.js';
import type { ScenarioRow } from '../../lib/types.js';

const VIDEO_STEPS: GroupStatus[] = ['podgotovka', 'scenarija', 'scenKajKlient', 'snimanje'];
const GRAPHIC_STEPS: GroupStatus[] = ['gPodgotovka'];

/** Сопственик на капа статус (PRD §2 матрица, преку PERMISSIONS.ownsCapaStatuses). */
function groupOwner(status: GroupStatus): Role | null {
  for (const role of Object.keys(PERMISSIONS) as Role[]) {
    if (PERMISSIONS[role].ownsCapaStatuses.includes(status)) return role;
  }
  return null;
}

const gLabel = (s: string) => GROUP_STATUS_META[s as GroupStatus]?.label ?? s;

export function CapaPanel({ groupId, onClose }: { groupId: string; onClose: () => void }) {
  const { data: group } = useTaskGroup(groupId);
  const { data: scenarios } = useScenarios(groupId);
  const { data: me } = useMe();
  const { data: employees } = useEmployees();

  const [toast, setToast] = useState<string | null>(null);
  const [behalfReason, setBehalfReason] = useState('');
  const pushToast = (m: string) => {
    setToast(m);
    window.setTimeout(() => setToast((t) => (t === m ? null : t)), 4200);
  };
  const onErr = (e: unknown) =>
    pushToast(e instanceof ApiRequestError ? e.message : 'Настана грешка.');

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!group) {
    return (
      <aside style={panel} className="gd-slide-in">
        <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>Вчитување…</div>
      </aside>
    );
  }

  const status = group.status as GroupStatus;
  const steps = group.contentType === 'video' ? VIDEO_STEPS : GRAPHIC_STEPS;
  const terminal = status === 'zatvoren';
  const owner = groupOwner(status);
  const locked = !terminal && !!me && me.role !== 'dir' && me.role !== owner;
  // D-5: Директор во туѓа капа-зона мора да внесе причина (како кај таск-преоди).
  const actingOnBehalf = !terminal && !!me && me.role === 'dir' && !!owner && me.role !== owner;
  const activeIdx = terminal ? steps.length : steps.indexOf(status);

  return (
    <aside style={panel} className="gd-slide-in">
      <div style={header}>
        <span style={{ fontSize: 14, fontWeight: 600 }}>Капа · {gLabel(status)}</span>
        <button onClick={onClose} style={iconBtn} title="Затвори" aria-label="Затвори">
          <X size={16} />
        </button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <div style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, lineHeight: '26px', fontWeight: 600, margin: '0 0 4px' }}>
            {group.client.name}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginBottom: 16 }}>
            {group.contentType === 'video' ? 'Видео' : 'Графика'} · {group.monthKey} ·{' '}
            {group.plannedCount} слота
          </div>

          {/* 4-чекорна прогресија */}
          <div style={{ display: 'flex', alignItems: 'center', marginBottom: 20 }}>
            {steps.map((st, i) => (
              <div
                key={st}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  flex: i < steps.length - 1 ? 1 : '0 0 auto',
                }}
              >
                <span style={stepCircle(i < activeIdx, i === activeIdx)} title={gLabel(st)}>
                  {i < activeIdx ? <Check size={12} /> : ''}
                </span>
                {i < steps.length - 1 && <span style={stepConnector} />}
              </div>
            ))}
          </div>

          {/* Работна зона */}
          <div style={workZone}>
            <div style={workHeader}>Работна зона · носи {owner ? ROLE_LABEL[owner] : 'никој'}</div>
            {locked ? (
              <div style={lockedBox}>
                <Lock size={14} /> Чека {owner ? ROLE_LABEL[owner] : '—'}
              </div>
            ) : (
              <div style={{ padding: 12, opacity: 1 }}>
                {actingOnBehalf && (
                  <div style={behalfBox}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Lock size={14} aria-hidden />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        Дејствуваш наместо {owner ? ROLE_LABEL[owner] : 'улогата'} (D-5)
                      </span>
                    </div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500 }}>
                      Причина · задолжително
                      <textarea
                        className="gd-field"
                        rows={2}
                        value={behalfReason}
                        onChange={(e) => setBehalfReason(e.target.value)}
                        placeholder={`Зошто дејствуваш наместо ${owner ? ROLE_LABEL[owner] : 'улогата'}?`}
                        style={{ marginTop: 4 }}
                      />
                    </label>
                  </div>
                )}
                <Zone
                  group={group}
                  status={status}
                  scenarios={scenarios ?? []}
                  employees={employees ?? []}
                  meRole={me?.role}
                  onBehalf={actingOnBehalf}
                  behalfReason={behalfReason}
                  pushToast={pushToast}
                  onErr={onErr}
                />
              </div>
            )}
          </div>

          {group.contentType === 'video' && terminal && (
            <StoragePanel group={group} meRole={me?.role} pushToast={pushToast} onErr={onErr} />
          )}
        </div>
      </div>

      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </aside>
  );
}

type GroupData = NonNullable<ReturnType<typeof useTaskGroup>['data']>;

/** Сторидж акции на суров материјал (H7) — само за затворена видео капа. */
function StoragePanel({
  group,
  meRole,
  pushToast,
  onErr,
}: {
  group: GroupData;
  meRole?: Role;
  pushToast: (m: string) => void;
  onErr: (e: unknown) => void;
}) {
  const extend = useExtendStorage(group.id);
  const archive = useArchiveStorage(group.id);
  const [path, setPath] = useState('');
  const canManage = meRole === 'dir' || meRole === 'am';

  if (group.localArchivePath) {
    return (
      <div style={storageBox}>
        <div style={{ fontWeight: 500 }}>Суровиот материјал е архивиран локално</div>
        <code style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{group.localArchivePath}</code>
      </div>
    );
  }
  if (!group.rawDeleteAt) return null;

  const days = Math.ceil((new Date(group.rawDeleteAt).getTime() - Date.now()) / 86_400_000);
  return (
    <div style={storageBox}>
      <div>
        Суровиот материјал се брише за{' '}
        <strong>
          {days} {days === 1 ? 'ден' : 'дена'}
        </strong>
        .
      </div>
      {canManage && (
        <div
          style={{ display: 'flex', gap: 8, marginTop: 8, flexWrap: 'wrap', alignItems: 'center' }}
        >
          <Button
            size="toolbar"
            variant="secondary"
            disabled={extend.isPending}
            onClick={() =>
              extend.mutate(undefined, {
                onSuccess: () => pushToast('Продолжено за +30 дена.'),
                onError: onErr,
              })
            }
          >
            Продолжи +30 дена
          </Button>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder="Патека до локална архива"
            style={pathInput}
          />
          <Button
            size="toolbar"
            variant="ghost"
            disabled={!path.trim() || archive.isPending}
            onClick={() =>
              archive.mutate(path.trim(), {
                onSuccess: () => pushToast('Означено како локална архива.'),
                onError: onErr,
              })
            }
          >
            Локална архива
          </Button>
        </div>
      )}
    </div>
  );
}

interface ZoneProps {
  group: NonNullable<ReturnType<typeof useTaskGroup>['data']>;
  status: GroupStatus;
  scenarios: ScenarioRow[];
  employees: { id: string; name: string; role: Role }[];
  meRole: Role | undefined;
  onBehalf: boolean;
  behalfReason: string;
  pushToast: (m: string) => void;
  onErr: (e: unknown) => void;
}

function Zone(p: ZoneProps) {
  const { group, status } = p;
  const transition = useGroupTransition(group.id);
  const bulk = useBulkActivate(group.id);
  const split = useSplitScenarios(group.id);
  const outcomes = useScenarioOutcomes(group.id);
  const upload = useGroupUpload(group.id);

  const move = (to: string, payload?: Record<string, unknown>, ok = 'Капата е поместена.') => {
    if (p.onBehalf && !p.behalfReason.trim()) {
      p.pushToast('Внеси причина — дејствуваш наместо носителот на капата.');
      return;
    }
    const merged = p.onBehalf ? { reason: p.behalfReason, ...payload } : payload;
    transition.mutate(
      { to, payload: merged },
      { onSuccess: () => p.pushToast(ok), onError: p.onErr },
    );
  };

  const doUpload =
    (kind: 'scenarioDoc' | 'raw' | 'sharedMaterial') =>
    (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      upload.mutate(
        { ownerType: 'group', ownerId: group.id, kind, file },
        { onSuccess: () => p.pushToast('Фајлот е прикачен.'), onError: p.onErr },
      );
    };

  // ── Подготовка (видео) ──
  if (status === 'podgotovka') {
    return (
      <PodgotovkaZone
        group={group}
        employees={p.employees}
        onMove={move}
        pending={transition.isPending}
      />
    );
  }

  // ── Сценарија (видео) ──
  if (status === 'scenarija') {
    return (
      <ScenarijaZone
        scenarios={p.scenarios}
        onUpload={doUpload('scenarioDoc')}
        onSplit={(items) =>
          split.mutate(
            { scenarios: items },
            { onSuccess: () => p.pushToast('Сценаријата се зачувани.'), onError: p.onErr },
          )
        }
        onApprove={() => move('scenKajKlient', undefined, 'Испратено кај клиент.')}
        pending={split.isPending || transition.isPending}
      />
    );
  }

  // ── Сценарија кај клиент (видео) ──
  if (status === 'scenKajKlient') {
    return (
      <ScenKajKlientZone
        scenarios={p.scenarios}
        onSave={(items) =>
          outcomes.mutate(
            { items },
            { onSuccess: () => p.pushToast('Исходите се зачувани.'), onError: p.onErr },
          )
        }
        onActivate={() => move('snimanje', undefined, 'Активирано за снимање.')}
        onReturn={(comment) => move('scenarija', { comment }, 'Вратено на сценарист.')}
        pending={outcomes.isPending || transition.isPending}
      />
    );
  }

  // ── Снимање (видео) ──
  if (status === 'snimanje') {
    const canClose = p.meRole === 'kam' || p.meRole === 'dir';
    return (
      <>
        <p style={sectionText}>Прикачи го суровиот материјал, потоа затвори ја капата.</p>
        <UploadButton
          label="Прикачи суров материјал"
          onChange={doUpload('raw')}
          pending={upload.isPending}
        />{' '}
        {canClose && (
          <Button
            variant="primary"
            size="form"
            disabled={transition.isPending}
            onClick={() => move('zatvoren', undefined, 'Капата е затворена.')}
          >
            Затвори снимање
          </Button>
        )}
      </>
    );
  }

  // ── gPodgotovka (графика) ──
  if (status === 'gPodgotovka') {
    return (
      <>
        <p style={sectionText}>
          Заеднички материјали за месецот и активирање на сите слотови (D-3).
        </p>
        <UploadButton
          label="Прикачи заеднички материјал"
          onChange={doUpload('sharedMaterial')}
          pending={upload.isPending}
        />{' '}
        <Button
          variant="primary"
          size="form"
          disabled={bulk.isPending}
          onClick={() =>
            bulk.mutate(undefined, {
              onSuccess: (r) => p.pushToast(`Активирани ${r.activated} таска.`),
              onError: p.onErr,
            })
          }
        >
          Активирај {group.plannedCount} таска
        </Button>
      </>
    );
  }

  // ── Затворен (терминал) ──
  if (status === 'zatvoren') {
    return (
      <p style={sectionText}>
        Капа затворена · {group.activeChildren} таска во тек · {group.sharedFiles} заеднички фајла.
      </p>
    );
  }

  return <p style={sectionText}>Нема достапни дејства.</p>;
}

// ── Подзони ──

function PodgotovkaZone({
  group,
  employees,
  onMove,
  pending,
}: {
  group: ZoneProps['group'];
  employees: ZoneProps['employees'];
  onMove: (to: string, payload?: Record<string, unknown>) => void;
  pending: boolean;
}) {
  const [scenaristId, setScenaristId] = useState(group.scenaristId ?? '');
  const [shootDate, setShootDate] = useState(group.shootDate ? group.shootDate.slice(0, 16) : '');
  const [shootLocation, setShootLocation] = useState(group.shootLocation ?? '');
  const [notes, setNotes] = useState(group.scenaristNotes ?? '');
  const scenarists = employees.filter((e) => e.role === 'scen');
  const valid = scenaristId && shootDate && shootLocation.trim() && notes.trim();

  return (
    <>
      <Field label="Сценарист">
        <select
          className="gd-field"
          value={scenaristId}
          onChange={(e) => setScenaristId(e.target.value)}
        >
          <option value="">— избери —</option>
          {scenarists.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label="Термин за снимање">
        <input
          className="gd-field"
          type="datetime-local"
          value={shootDate}
          onChange={(e) => setShootDate(e.target.value)}
        />
      </Field>
      <Field label="Локација на снимање">
        <input
          className="gd-field"
          value={shootLocation}
          onChange={(e) => setShootLocation(e.target.value)}
          placeholder="пр. Скопје, студио"
        />
      </Field>
      <Field label="Белешки за сценаристот">
        <textarea
          className="gd-field"
          rows={3}
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
        />
      </Field>
      <Button
        variant="primary"
        size="form"
        disabled={!valid || pending}
        onClick={() =>
          onMove('scenarija', { scenaristId, shootDate, shootLocation, scenaristNotes: notes })
        }
      >
        Пушти за сценарии
      </Button>
    </>
  );
}

interface SplitItem {
  title: string;
  hook?: string;
  body?: string;
  notes?: string;
}

function ScenarijaZone({
  scenarios,
  onUpload,
  onSplit,
  onApprove,
  pending,
}: {
  scenarios: ScenarioRow[];
  onUpload: (e: React.ChangeEvent<HTMLInputElement>) => void;
  onSplit: (items: SplitItem[]) => void;
  onApprove: () => void;
  pending: boolean;
}) {
  const [items, setItems] = useState<SplitItem[]>(
    scenarios.length
      ? scenarios.map((s) => ({
          title: s.title,
          hook: s.hook ?? '',
          body: s.body ?? '',
          notes: s.notes ?? '',
        }))
      : [{ title: '' }],
  );
  const setItem = (i: number, patch: Partial<SplitItem>) =>
    setItems((arr) => arr.map((it, j) => (j === i ? { ...it, ...patch } : it)));
  const valid = items.length > 0 && items.every((it) => it.title.trim());

  return (
    <>
      <UploadButton label="Прикачи сценариски документ" onChange={onUpload} pending={false} />
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--gd-ink-muted)',
          margin: '12px 0 6px',
        }}
      >
        Поделба на сценарија
      </div>
      {items.map((it, i) => (
        <div key={i} style={scenarioCard}>
          <input
            className="gd-field"
            value={it.title}
            onChange={(e) => setItem(i, { title: e.target.value })}
            placeholder={`Наслов на сценарио ${i + 1}`}
          />
          <textarea
            className="gd-field"
            rows={2}
            style={{ marginTop: 6 }}
            value={it.body ?? ''}
            onChange={(e) => setItem(i, { body: e.target.value })}
            placeholder="Опис (по избор)"
          />
          {items.length > 1 && (
            <button
              style={removeLink}
              onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
            >
              Отстрани
            </button>
          )}
        </div>
      ))}
      <button style={addLink} onClick={() => setItems((arr) => [...arr, { title: '' }])}>
        + Додај сценарио
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button
          variant="secondary"
          size="form"
          disabled={!valid || pending}
          onClick={() => onSplit(items)}
        >
          Зачувај сценарија
        </Button>
        <Button
          variant="primary"
          size="form"
          disabled={pending || scenarios.length === 0}
          onClick={onApprove}
        >
          Одобри сценарии
        </Button>
      </div>
    </>
  );
}

type OutcomeStatus = 'odobreno' | 'odobrenoSoIzmeni' | 'otfrleno';
const OUTCOME_OPTS: { value: OutcomeStatus; label: string }[] = [
  { value: 'odobreno', label: 'Одобрено' },
  { value: 'odobrenoSoIzmeni', label: 'Со измени' },
  { value: 'otfrleno', label: 'Отфрлено' },
];
const isOutcome = (s: string): s is OutcomeStatus =>
  s === 'odobreno' || s === 'odobrenoSoIzmeni' || s === 'otfrleno';

function ScenKajKlientZone({
  scenarios,
  onSave,
  onActivate,
  onReturn,
  pending,
}: {
  scenarios: ScenarioRow[];
  onSave: (items: { scenarioId: string; status: OutcomeStatus; clientComment?: string }[]) => void;
  onActivate: () => void;
  onReturn: (comment: string) => void;
  pending: boolean;
}) {
  const [state, setState] = useState<
    Record<string, { status: OutcomeStatus | undefined; comment: string }>
  >(
    Object.fromEntries(
      scenarios.map((s) => [
        s.id,
        { status: isOutcome(s.status) ? s.status : undefined, comment: s.clientComment ?? '' },
      ]),
    ),
  );
  const [returnComment, setReturnComment] = useState('');
  const set = (id: string, patch: Partial<{ status: OutcomeStatus; comment: string }>) =>
    setState((st) => ({ ...st, [id]: { ...st[id]!, ...patch } }));
  const allDecided = scenarios.every((s) => state[s.id]?.status);

  return (
    <>
      {scenarios.map((s) => (
        <div key={s.id} style={scenarioCard}>
          <div style={{ fontWeight: 500, marginBottom: 6 }}>
            {s.ordinal}. {s.title}
          </div>
          <div style={{ display: 'flex', gap: 6, marginBottom: 6 }}>
            {OUTCOME_OPTS.map((o) => (
              <Button
                key={o.value}
                variant={state[s.id]?.status === o.value ? 'primary' : 'secondary'}
                size="toolbar"
                onClick={() => set(s.id, { status: o.value })}
              >
                {o.label}
              </Button>
            ))}
          </div>
          <input
            className="gd-field"
            value={state[s.id]?.comment ?? ''}
            onChange={(e) => set(s.id, { comment: e.target.value })}
            placeholder="Коментар од клиент (по избор)"
          />
        </div>
      ))}
      <div style={{ display: 'flex', gap: 8, marginTop: 12, flexWrap: 'wrap' }}>
        <Button
          variant="secondary"
          size="form"
          disabled={pending || scenarios.length === 0 || !allDecided}
          onClick={() =>
            onSave(
              scenarios.map((s) => ({
                scenarioId: s.id,
                status: state[s.id]!.status!,
                clientComment: state[s.id]?.comment || undefined,
              })),
            )
          }
        >
          Зачувај исходи
        </Button>
        <Button variant="primary" size="form" disabled={pending} onClick={onActivate}>
          Активирај за снимање
        </Button>
      </div>
      <div style={{ marginTop: 12 }}>
        <input
          className="gd-field"
          value={returnComment}
          onChange={(e) => setReturnComment(e.target.value)}
          placeholder="Причина за враќање…"
        />
        <div style={{ marginTop: 6 }}>
          <Button
            variant="danger"
            size="form"
            disabled={pending || !returnComment.trim()}
            onClick={() => onReturn(returnComment)}
          >
            Врати на сценарист
          </Button>
        </div>
      </div>
    </>
  );
}

function UploadButton({
  label,
  onChange,
  pending,
}: {
  label: string;
  onChange: (e: React.ChangeEvent<HTMLInputElement>) => void;
  pending: boolean;
}) {
  return (
    <label style={uploadBtn}>
      {pending ? 'Се прикачува…' : label}
      <input type="file" style={{ display: 'none' }} onChange={onChange} />
    </label>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 10 }}>
      <span
        style={{
          fontSize: 12,
          fontWeight: 500,
          color: 'var(--gd-ink-muted)',
          display: 'block',
          marginBottom: 4,
        }}
      >
        {label}
      </span>
      {children}
    </label>
  );
}

// ── стилови ──
const panel: React.CSSProperties = {
  width: 480,
  flex: '0 0 480px',
  borderLeft: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
};
const header: React.CSSProperties = {
  height: 48,
  flex: '0 0 48px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  borderBottom: '1px solid var(--gd-border)',
};
const iconBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: 'var(--gd-ink-muted)',
  display: 'flex',
};
const workZone: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  overflow: 'hidden',
};
const workHeader: React.CSSProperties = {
  background: 'var(--gd-surface-alt)',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  borderBottom: '1px solid var(--gd-border)',
};
const storageBox: React.CSSProperties = {
  marginTop: 16,
  padding: 12,
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  background: 'var(--gd-surface-alt)',
  fontSize: 13,
};
const pathInput: React.CSSProperties = {
  flex: 1,
  minWidth: 160,
  height: 28,
  padding: '0 8px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  fontSize: 12,
};
const lockedBox: React.CSSProperties = {
  padding: 16,
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  color: 'var(--gd-ink-muted)',
  fontSize: 13,
  opacity: 0.55,
  pointerEvents: 'none',
};
const behalfBox: React.CSSProperties = {
  border: '1px solid var(--gd-primary-border)',
  background: 'var(--gd-primary-wash)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
  color: 'var(--gd-primary-hover)',
};
const sectionText: React.CSSProperties = {
  fontSize: 13,
  color: 'var(--gd-ink-secondary)',
  margin: '0 0 12px',
};
const scenarioCard: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 10,
  marginBottom: 8,
};
const uploadBtn: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  height: 36,
  padding: '0 14px',
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  background: 'var(--gd-surface)',
  color: 'var(--gd-ink-secondary)',
  fontSize: 14,
  cursor: 'pointer',
};
const addLink: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-primary)',
  fontSize: 13,
  cursor: 'pointer',
  padding: '4px 0',
};
const removeLink: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-danger)',
  fontSize: 12,
  cursor: 'pointer',
  padding: '4px 0',
  marginTop: 4,
};
const toastStyle: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  right: 20,
  background: '#12161C',
  color: '#fff',
  padding: '10px 16px',
  borderRadius: 8,
  fontSize: 14,
  cursor: 'pointer',
  zIndex: 50,
};
const stepCircle = (done: boolean, active: boolean): React.CSSProperties => ({
  width: 20,
  height: 20,
  borderRadius: '50%',
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  color: done || active ? '#fff' : 'var(--gd-ink-muted)',
  background: done ? '#16A34A' : active ? 'var(--gd-primary)' : 'var(--gd-surface)',
  border: done || active ? 'none' : '1px solid var(--gd-border)',
});
const stepConnector: React.CSSProperties = {
  flex: 1,
  height: 1,
  background: 'var(--gd-border)',
  margin: '0 4px',
};
