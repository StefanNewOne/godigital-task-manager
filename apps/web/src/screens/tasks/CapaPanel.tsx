import type React from 'react';
import { useEffect, useState } from 'react';
import { GROUP_STATUS_META, PERMISSIONS, ROLE_LABEL, type GroupStatus, type Role } from '@gd/core';
import { Button, t } from '@gd/ui';
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
import { useAddShoot, useGroupShoots, type ShootSessionRow } from '../../api/shoots.js';
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
    window.setTimeout(() => setToast((cur) => (cur === m ? null : cur)), 4200);
  };
  const onErr = (e: unknown) =>
    pushToast(e instanceof ApiRequestError ? e.message : t('capaPanel.genericError'));

  useEffect(() => {
    const h = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', h);
    return () => window.removeEventListener('keydown', h);
  }, [onClose]);

  if (!group) {
    return (
      <aside style={panel} className="gd-slide-in">
        <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>{t('capaPanel.loading')}</div>
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
        <span style={{ fontSize: 14, fontWeight: 600 }}>
          {t('capaPanel.capaTitle', { status: gLabel(status) })}
        </span>
        <button
          onClick={onClose}
          style={iconBtn}
          title={t('capaPanel.close')}
          aria-label={t('capaPanel.close')}
        >
          <X size={16} />
        </button>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <div style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, lineHeight: '26px', fontWeight: 600, margin: '0 0 4px' }}>
            {group.client.name}
          </h2>
          <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginBottom: 16 }}>
            {group.contentType === 'video' ? t('capaPanel.video') : t('capaPanel.graphic')} ·{' '}
            {group.monthKey} · {t('capaPanel.slotsCount', { count: group.plannedCount })}
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
            <div style={workHeader}>
              {t('capaPanel.workZone', {
                owner: owner ? ROLE_LABEL[owner] : t('capaPanel.ownerNobody'),
              })}
            </div>
            {locked ? (
              <div style={lockedBox}>
                <Lock size={14} />{' '}
                {t('capaPanel.waitingFor', { owner: owner ? ROLE_LABEL[owner] : '—' })}
              </div>
            ) : (
              <div style={{ padding: 12, opacity: 1 }}>
                {actingOnBehalf && (
                  <div style={behalfBox}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 6, marginBottom: 8 }}>
                      <Lock size={14} aria-hidden />
                      <span style={{ fontSize: 12, fontWeight: 600 }}>
                        {t('capaPanel.actingOnBehalf', {
                          owner: owner ? ROLE_LABEL[owner] : t('capaPanel.ownerRole'),
                        })}
                      </span>
                    </div>
                    <label style={{ display: 'block', fontSize: 12, fontWeight: 500 }}>
                      {t('capaPanel.reasonRequired')}
                      <textarea
                        className="gd-field"
                        rows={2}
                        value={behalfReason}
                        onChange={(e) => setBehalfReason(e.target.value)}
                        placeholder={t('capaPanel.behalfPlaceholder', {
                          owner: owner ? ROLE_LABEL[owner] : t('capaPanel.ownerRole'),
                        })}
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
        <div style={{ fontWeight: 500 }}>{t('capaPanel.rawArchivedLocally')}</div>
        <code style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{group.localArchivePath}</code>
      </div>
    );
  }
  if (!group.rawDeleteAt) return null;

  const days = Math.ceil((new Date(group.rawDeleteAt).getTime() - Date.now()) / 86_400_000);
  return (
    <div style={storageBox}>
      <div>
        {t('capaPanel.rawDeleteIn')} <strong>{t('capaPanel.days', { count: days })}</strong>.
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
                onSuccess: () => pushToast(t('capaPanel.extended')),
                onError: onErr,
              })
            }
          >
            {t('capaPanel.extendBtn')}
          </Button>
          <input
            value={path}
            onChange={(e) => setPath(e.target.value)}
            placeholder={t('capaPanel.localArchivePlaceholder')}
            style={pathInput}
          />
          <Button
            size="toolbar"
            variant="ghost"
            disabled={!path.trim() || archive.isPending}
            onClick={() =>
              archive.mutate(path.trim(), {
                onSuccess: () => pushToast(t('capaPanel.markedLocalArchive')),
                onError: onErr,
              })
            }
          >
            {t('capaPanel.localArchiveBtn')}
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

  const move = (to: string, payload?: Record<string, unknown>, ok = t('capaPanel.capaMoved')) => {
    if (p.onBehalf && !p.behalfReason.trim()) {
      p.pushToast(t('capaPanel.behalfToast'));
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
        { onSuccess: () => p.pushToast(t('capaPanel.fileUploaded')), onError: p.onErr },
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
            { onSuccess: () => p.pushToast(t('capaPanel.scenariosSaved')), onError: p.onErr },
          )
        }
        onApprove={() => move('scenKajKlient', undefined, t('capaPanel.sentToClient'))}
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
            { onSuccess: () => p.pushToast(t('capaPanel.outcomesSaved')), onError: p.onErr },
          )
        }
        onActivate={() => move('snimanje', undefined, t('capaPanel.activatedForShoot'))}
        onReturn={(comment) => move('scenarija', { comment }, t('capaPanel.returnedToScenarist'))}
        pending={outcomes.isPending || transition.isPending}
      />
    );
  }

  // ── Снимање (видео) ──
  if (status === 'snimanje') {
    return (
      <SnimanjeZone
        groupId={group.id}
        canManage={p.meRole === 'kam' || p.meRole === 'dir'}
        onUploadRaw={doUpload('raw')}
        uploadPending={upload.isPending}
        onConfirm={() => move('zatvoren', undefined, t('capaPanel.shootConfirmed'))}
        confirmPending={transition.isPending}
        onErr={p.onErr}
      />
    );
  }

  // ── gPodgotovka (графика) ──
  if (status === 'gPodgotovka') {
    return (
      <>
        <p style={sectionText}>{t('capaPanel.gPodgotovkaHint')}</p>
        <UploadButton
          label={t('capaPanel.uploadShared')}
          onChange={doUpload('sharedMaterial')}
          pending={upload.isPending}
        />{' '}
        <Button
          variant="primary"
          size="form"
          disabled={bulk.isPending}
          onClick={() =>
            bulk.mutate(undefined, {
              onSuccess: (r) => p.pushToast(t('capaPanel.activated', { count: r.activated })),
              onError: p.onErr,
            })
          }
        >
          {t('capaPanel.activateTasks', { count: group.plannedCount })}
        </Button>
      </>
    );
  }

  // ── Затворен (терминал) ──
  if (status === 'zatvoren') {
    return (
      <p style={sectionText}>
        {t('capaPanel.closedInfo', {
          active: group.activeChildren,
          shared: group.sharedFiles,
        })}
      </p>
    );
  }

  return <p style={sectionText}>{t('capaPanel.noActions')}</p>;
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
      <Field label={t('capaPanel.scenarist')}>
        <select
          className="gd-field"
          value={scenaristId}
          onChange={(e) => setScenaristId(e.target.value)}
        >
          <option value="">{t('capaPanel.pickOption')}</option>
          {scenarists.map((e) => (
            <option key={e.id} value={e.id}>
              {e.name}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('capaPanel.shootTerm')}>
        <input
          className="gd-field"
          type="datetime-local"
          value={shootDate}
          onChange={(e) => setShootDate(e.target.value)}
        />
      </Field>
      <Field label={t('capaPanel.shootLocation')}>
        <input
          className="gd-field"
          value={shootLocation}
          onChange={(e) => setShootLocation(e.target.value)}
          placeholder={t('capaPanel.phShootLocation')}
        />
      </Field>
      <Field label={t('capaPanel.scenaristNotes')}>
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
        {t('capaPanel.releaseForScenarios')}
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
      <UploadButton label={t('capaPanel.uploadScenarioDoc')} onChange={onUpload} pending={false} />
      <div
        style={{
          fontSize: 12,
          fontWeight: 600,
          color: 'var(--gd-ink-muted)',
          margin: '12px 0 6px',
        }}
      >
        {t('capaPanel.scenariosSplit')}
      </div>
      {items.map((it, i) => (
        <div key={i} style={scenarioCard}>
          <input
            className="gd-field"
            value={it.title}
            onChange={(e) => setItem(i, { title: e.target.value })}
            placeholder={t('capaPanel.phScenarioTitle', { n: i + 1 })}
          />
          <textarea
            className="gd-field"
            rows={2}
            style={{ marginTop: 6 }}
            value={it.body ?? ''}
            onChange={(e) => setItem(i, { body: e.target.value })}
            placeholder={t('capaPanel.phScenarioDesc')}
          />
          {items.length > 1 && (
            <button
              style={removeLink}
              onClick={() => setItems((arr) => arr.filter((_, j) => j !== i))}
            >
              {t('capaPanel.remove')}
            </button>
          )}
        </div>
      ))}
      <button style={addLink} onClick={() => setItems((arr) => [...arr, { title: '' }])}>
        {t('capaPanel.addScenario')}
      </button>
      <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
        <Button
          variant="secondary"
          size="form"
          disabled={!valid || pending}
          onClick={() => onSplit(items)}
        >
          {t('capaPanel.saveScenarios')}
        </Button>
        <Button
          variant="primary"
          size="form"
          disabled={pending || scenarios.length === 0}
          onClick={onApprove}
        >
          {t('capaPanel.approveScenarios')}
        </Button>
      </div>
    </>
  );
}

type OutcomeStatus = 'odobreno' | 'odobrenoSoIzmeni' | 'otfrleno';
const OUTCOME_OPTS: { value: OutcomeStatus; label: string }[] = [
  { value: 'odobreno', label: t('capaPanel.outcomeApproved') },
  { value: 'odobrenoSoIzmeni', label: t('capaPanel.outcomeWithChanges') },
  { value: 'otfrleno', label: t('capaPanel.outcomeRejected') },
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
            placeholder={t('capaPanel.phClientComment')}
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
          {t('capaPanel.saveOutcomes')}
        </Button>
        <Button variant="primary" size="form" disabled={pending} onClick={onActivate}>
          {t('capaPanel.activateForShoot')}
        </Button>
      </div>
      <div style={{ marginTop: 12 }}>
        <input
          className="gd-field"
          value={returnComment}
          onChange={(e) => setReturnComment(e.target.value)}
          placeholder={t('capaPanel.phReturnReason')}
        />
        <div style={{ marginTop: 6 }}>
          <Button
            variant="danger"
            size="form"
            disabled={pending || !returnComment.trim()}
            onClick={() => onReturn(returnComment)}
          >
            {t('capaPanel.returnToScenarist')}
          </Button>
        </div>
      </div>
    </>
  );
}

/** Снимање: термини (основен + дополнителни), суров материјал, и Камерман „Потврди снимање". */
function SnimanjeZone({
  groupId,
  canManage,
  onUploadRaw,
  uploadPending,
  onConfirm,
  confirmPending,
  onErr,
}: {
  groupId: string;
  canManage: boolean;
  onUploadRaw: (e: React.ChangeEvent<HTMLInputElement>) => void;
  uploadPending: boolean;
  onConfirm: () => void;
  confirmPending: boolean;
  onErr: (e: unknown) => void;
}) {
  const { data: shoots } = useGroupShoots(groupId);
  const addShoot = useAddShoot(groupId);
  const [date, setDate] = useState('');
  const [time, setTime] = useState('');
  const [loc, setLoc] = useState('');

  const fmt = (s: ShootSessionRow) => {
    const d = new Date(s.date);
    const time =
      d.getUTCHours() || d.getUTCMinutes()
        ? ` ${String(d.getUTCHours()).padStart(2, '0')}:${String(d.getUTCMinutes()).padStart(2, '0')}`
        : '';
    return `${d.getUTCDate()}.${d.getUTCMonth() + 1}${time}`;
  };

  const submit = () => {
    if (!date || !loc.trim()) {
      onErr(new Error(t('capaPanel.dateLocationRequired')));
      return;
    }
    addShoot.mutate(
      { date: `${date}T${time || '00:00'}:00.000Z`, location: loc.trim() },
      {
        onSuccess: () => {
          setDate('');
          setTime('');
          setLoc('');
        },
        onError: onErr,
      },
    );
  };

  return (
    <>
      <p style={sectionText}>{t('capaPanel.shootTerms')}</p>
      <ul style={{ margin: '0 0 10px', paddingLeft: 18, fontSize: 13 }}>
        {(shoots ?? []).map((s) => (
          <li key={s.id}>
            {fmt(s)} · {s.location || '—'}
            {s.kind === 'additional' ? t('capaPanel.shootAdditionalTag') : ''}
          </li>
        ))}
        {(shoots ?? []).length === 0 && (
          <li style={{ color: 'var(--gd-ink-muted)' }}>{t('capaPanel.none')}</li>
        )}
      </ul>
      {canManage && (
        <div
          style={{
            display: 'flex',
            gap: 6,
            flexWrap: 'wrap',
            alignItems: 'center',
            marginBottom: 12,
          }}
        >
          <input
            type="date"
            className="gd-field"
            value={date}
            onChange={(e) => setDate(e.target.value)}
          />
          <input
            type="time"
            className="gd-field"
            value={time}
            onChange={(e) => setTime(e.target.value)}
          />
          <input
            className="gd-field"
            placeholder={t('capaPanel.phLocation')}
            value={loc}
            onChange={(e) => setLoc(e.target.value)}
            style={{ minWidth: 140 }}
          />
          <Button variant="secondary" size="form" disabled={addShoot.isPending} onClick={submit}>
            {t('capaPanel.addShoot')}
          </Button>
        </div>
      )}
      <p style={sectionText}>{t('capaPanel.uploadRawHint')}</p>
      <UploadButton
        label={t('capaPanel.uploadRaw')}
        onChange={onUploadRaw}
        pending={uploadPending}
      />{' '}
      {canManage && (
        <Button variant="primary" size="form" disabled={confirmPending} onClick={onConfirm}>
          {t('capaPanel.confirmShoot')}
        </Button>
      )}
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
      {pending ? t('capaPanel.uploading') : label}
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
