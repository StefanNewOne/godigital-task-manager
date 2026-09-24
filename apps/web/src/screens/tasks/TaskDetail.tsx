import type React from 'react';
import { useEffect, useState } from 'react';
import {
  Ban,
  CalendarClock,
  ChevronDown,
  ChevronRight,
  Film,
  Lock,
  Maximize2,
  Minimize2,
  MoreHorizontal,
  Paperclip,
  Pause,
  Play,
  Send,
  Upload,
  X,
} from 'lucide-react';
import {
  ROLE_LABEL,
  TASK_STATUS_META,
  allowedTaskTargets,
  canChangeDate,
  findTaskTransition,
  formatDeadlineLabel,
  isTerminal,
  isWorkZoneLockable,
  ownerOf,
  taskDeadline,
  type ContentType,
  type Role,
  type TaskStatus,
} from '@gd/core';
import { Button, tokens } from '@gd/ui';
import { useMe } from '../../api/auth.js';
import { useClients, useEmployees } from '../../api/admin.js';
import { useFileUpload, useFiles } from '../../api/files.js';
import {
  useActivity,
  useAddComment,
  useAddPublication,
  useCancel,
  useDateChange,
  usePause,
  useResume,
  useTask,
  useTransition,
} from '../../api/tasks.js';
import { ApiRequestError } from '../../lib/api.js';
import type { TaskDetailData } from '../../lib/types.js';
import { StatusBadge } from '../../components/StatusBadge.js';
import { CreativeViewer } from './CreativeViewer.js';

const ROLE_COLOR: Record<Role, string> = {
  dir: '#0866FF',
  rez: '#7C3AED',
  scen: '#0284C7',
  kam: '#0D9488',
  mon: '#D97706',
  krea: '#0EA5E9',
  diz: '#65A30D',
  am: '#DB2777',
  ana: '#DC2626',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  return `${String(d.getUTCDate()).padStart(2, '0')}.${String(d.getUTCMonth() + 1).padStart(2, '0')}.${d.getUTCFullYear()}`;
}
function inits(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}

type Modal = null | 'pause' | 'cancel' | 'date' | 'resume';

export function TaskDetail({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task } = useTask(taskId);
  const { data: activity } = useActivity(taskId);
  const { data: employees } = useEmployees();
  const { data: clients } = useClients();
  const { data: files } = useFiles('task', taskId);
  const { data: me } = useMe();

  const transition = useTransition(taskId);
  const addComment = useAddComment(taskId);
  const pause = usePause(taskId);
  const cancel = useCancel(taskId);
  const resume = useResume(taskId);
  const dateChange = useDateChange(taskId);
  const addPublication = useAddPublication(taskId);
  const upload = useFileUpload(taskId);

  const [expanded, setExpanded] = useState(false);
  const [menuOpen, setMenuOpen] = useState(false);
  const [viewer, setViewer] = useState(false);
  const [modal, setModal] = useState<Modal>(null);
  const [reason, setReason] = useState('');
  const [modalDate, setModalDate] = useState('');
  const [toasts, setToasts] = useState<Array<{ id: number; text: string }>>([]);
  const [open, setOpen] = useState({
    context: true,
    creative: true,
    publication: true,
    activity: true,
  });
  const [wz, setWz] = useState({
    brief: '',
    copy: '',
    comment: '',
    assigneeId: '',
    channel: 'viber',
    permalink: '',
    postType: 'reel',
    platform: 'ig',
  });

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  useEffect(() => {
    if (!toasts.length) return;
    const t = setTimeout(() => setToasts((x) => x.slice(1)), 4200);
    return () => clearTimeout(t);
  }, [toasts]);

  const pushToast = (text: string) =>
    setToasts((t) => [...t, { id: Date.now() + Math.random(), text }]);
  const onErr = (e: unknown) =>
    pushToast(e instanceof ApiRequestError ? e.message : 'Настана грешка.');
  const set = (patch: Partial<typeof wz>) => setWz((w) => ({ ...w, ...patch }));

  if (!task) {
    return (
      <aside style={panel(false)}>
        <div style={{ padding: 24, color: 'var(--gd-ink-muted)' }}>Вчитување…</div>
      </aside>
    );
  }

  const status = task.status as TaskStatus;
  const ct = task.contentType as ContentType;
  const owner = ownerOf(status, ct);
  const creativeVersions = (files ?? []).filter((f) =>
    ['final', 'graphic', 'preview'].includes(f.kind),
  );
  const empName = (id: string | null) =>
    id ? (employees?.find((e) => e.id === id)?.name ?? '—') : 'Недоделен';
  const assigneeEmp = task.assigneeId
    ? employees?.find((e) => e.id === task.assigneeId)
    : undefined;
  const metaInitials = (name: string) => {
    const p = name.trim().split(/\s+/);
    return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
  };
  const terminal = isTerminal(status, task.client.usesMetaAds);
  const locked = isWorkZoneLockable(status) && !!me && me.role !== 'dir' && me.role !== owner;

  // Тим по тип содржина (реални луѓе што ги знаеме).
  const teamIds = Array.from(
    new Set([task.rezId, task.kreaId, task.assigneeId].filter(Boolean)),
  ) as string[];
  const team = teamIds
    .map((id) => employees?.find((e) => e.id === id))
    .filter((e): e is NonNullable<typeof e> => !!e);

  // Рок за статусот.
  let deadline: { text: string; level: 'overdue' | 'soon' | 'normal' } | null = null;
  if (task.slot?.date) {
    const d = taskDeadline(status, ct, new Date(task.slot.date));
    if (d) deadline = formatDeadlineLabel(d, new Date());
  }
  const dlColor =
    deadline?.level === 'overdue'
      ? tokens.color.danger
      : deadline?.level === 'soon'
        ? tokens.color.warning
        : tokens.color.inkMuted;
  const dlPrefix = deadline?.level === 'overdue' ? '⚠ ' : deadline?.level === 'soon' ? '◷ ' : '';

  const canDate =
    !!me && (me.role === 'dir' || me.role === 'am' || canChangeDate(me.role, ct)) && !terminal;
  const canPauseNow = !!me && (me.role === 'dir' || me.role === 'am') && isWorkZoneLockable(status);
  const canCancelNow = !!me && me.role === 'dir' && status !== 'otkazano' && status !== 'zavrseno';

  const doTransition = (to: string, payload: Record<string, unknown> = {}) => {
    transition.mutate(
      { to, payload },
      {
        onSuccess: () => {
          pushToast(`Пренесено во „${TASK_STATUS_META[to as TaskStatus]?.label ?? to}".`);
          set({ brief: '', copy: '', comment: '', assigneeId: '', permalink: '' });
        },
        onError: onErr,
      },
    );
  };

  const runUpload =
    (kind: 'graphic' | 'final', next: string) => (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;
      upload.mutate(
        { ownerType: 'task', ownerId: task.id, kind, file },
        {
          onSuccess: () => {
            pushToast('Фајлот е прикачен.');
            doTransition(next, { comment: undefined });
          },
          onError: onErr,
        },
      );
    };

  return (
    <aside style={panel(expanded)} className="gd-slide-in">
      {/* Header 48px */}
      <div style={header}>
        <StatusBadge status={task.status} />
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <div style={{ display: 'flex', marginRight: 8 }}>
            {team.slice(0, 4).map((e, i) => (
              <span
                key={e.id}
                title={`${e.name} · ${ROLE_LABEL[e.role]}`}
                style={avatar(ROLE_COLOR[e.role], i)}
              >
                {inits(e.name)}
              </span>
            ))}
            {team.length > 4 && <span style={avatar('#8A93A0', 4)}>+{team.length - 4}</span>}
          </div>
          <button
            style={iconBtn}
            title={expanded ? 'Собери' : 'Прошири'}
            onClick={() => setExpanded((v) => !v)}
          >
            {expanded ? <Minimize2 size={16} /> : <Maximize2 size={16} />}
          </button>
          <div style={{ position: 'relative' }}>
            <button style={iconBtn} title="Повеќе" onClick={() => setMenuOpen((v) => !v)}>
              <MoreHorizontal size={18} />
            </button>
            {menuOpen && (
              <div style={menu} className="gd-fade-up" onMouseLeave={() => setMenuOpen(false)}>
                {status === 'pauza' && canPauseNow && (
                  <button
                    style={menuItem}
                    onClick={() => {
                      setModal('resume');
                      setMenuOpen(false);
                    }}
                  >
                    <Play size={14} /> Врати од пауза
                  </button>
                )}
                {canPauseNow && status !== 'pauza' && (
                  <button
                    style={menuItem}
                    onClick={() => {
                      setModal('pause');
                      setReason('');
                      setMenuOpen(false);
                    }}
                  >
                    <Pause size={14} /> Пауза
                  </button>
                )}
                {canDate && (
                  <button
                    style={menuItem}
                    onClick={() => {
                      setModal('date');
                      setReason('');
                      setModalDate('');
                      setMenuOpen(false);
                    }}
                  >
                    <CalendarClock size={14} /> Промени датум
                  </button>
                )}
                {canCancelNow && (
                  <button
                    style={{ ...menuItem, color: tokens.color.danger }}
                    onClick={() => {
                      setModal('cancel');
                      setReason('');
                      setMenuOpen(false);
                    }}
                  >
                    <Ban size={14} /> Откажи
                  </button>
                )}
              </div>
            )}
          </div>
          <button style={iconBtn} title="Затвори" onClick={onClose}>
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ overflow: 'auto', flex: 1 }}>
        <div style={{ padding: 24 }}>
          <h2 style={{ fontSize: 18, lineHeight: '26px', fontWeight: 600, margin: '0 0 16px' }}>
            {task.title}
          </h2>

          {/* Мета */}
          <dl style={metaGrid}>
            <dt style={dt}>Клиент</dt>
            <dd style={{ ...dd, display: 'flex', alignItems: 'center', gap: 6 }}>
              <span
                style={{
                  width: 8,
                  height: 8,
                  borderRadius: '50%',
                  background: clients?.find((c) => c.id === task.clientId)?.color ?? '#ccc',
                  flex: '0 0 auto',
                }}
              />
              {task.client.name}
            </dd>
            <dt style={dt}>Тип</dt>
            <dd style={dd}>{ct === 'video' ? 'Видео' : 'Графика'}</dd>
            <dt style={dt}>Доделен</dt>
            <dd style={{ ...dd, display: 'flex', alignItems: 'center', gap: 6 }}>
              {assigneeEmp && (
                <span style={metaAvatar(assigneeEmp.color)}>{metaInitials(assigneeEmp.name)}</span>
              )}
              {empName(task.assigneeId)}
            </dd>
            <dt style={dt}>Датум на објава</dt>
            <dd style={dd}>
              {task.slot ? fmtDate(task.slot.date) : '—'}
              {canDate && (
                <button
                  style={linkBtn}
                  onClick={() => {
                    setModal('date');
                    setReason('');
                    setModalDate('');
                  }}
                >
                  Промени датум
                </button>
              )}
            </dd>
            {deadline && (
              <>
                <dt style={dt}>Рок за овој статус</dt>
                <dd
                  style={{
                    ...dd,
                    color: dlColor,
                    fontWeight: deadline.level === 'normal' ? 400 : 600,
                  }}
                >
                  {dlPrefix}
                  {deadline.text}
                </dd>
              </>
            )}
            <dt style={dt}>Приоритет</dt>
            <dd style={dd}>
              <span style={priorityChip(task.priority === 'iten')}>
                {task.priority === 'iten' ? 'итен' : 'нормален'}
              </span>
            </dd>
          </dl>

          {/* Работна зона */}
          <WorkZone
            locked={locked}
            terminal={terminal}
            status={status}
            ownerLabel={owner ? ROLE_LABEL[owner] : 'никој'}
            assigneeName={empName(task.assigneeId)}
          >
            {renderZone({
              task,
              status,
              ct,
              wz,
              set,
              employees: employees ?? [],
              pending: transition.isPending || upload.isPending,
              doTransition,
              addPublication: (input) =>
                addPublication.mutate(input, {
                  onSuccess: () => pushToast('Објавата е зачувана.'),
                  onError: onErr,
                }),
              runUpload,
            })}
          </WorkZone>

          {/* Секции */}
          <Section
            title="Контекст"
            badge="брифинг · сценарио · заеднички"
            openState={open.context}
            onToggle={() => setOpen((o) => ({ ...o, context: !o.context }))}
          >
            {task.brief ? (
              <div style={ctxRow}>
                <div style={{ flex: 1, minWidth: 0 }}>{task.brief}</div>
                <span style={ctxTag}>брифинг</span>
              </div>
            ) : (
              <p style={sectionText}>Нема внес во контекстот.</p>
            )}
            {task.copy && (
              <div style={ctxRow}>
                <div style={{ flex: 1, minWidth: 0 }}>{task.copy}</div>
                <span style={ctxTag}>копи</span>
              </div>
            )}
          </Section>
          <Section
            title="Креатива"
            badge={`v${task.version}`}
            openState={open.creative}
            onToggle={() => setOpen((o) => ({ ...o, creative: !o.creative }))}
          >
            {creativeVersions.length > 0 && (
              <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginBottom: 8 }}>
                {creativeVersions.map((f) => (
                  <button
                    key={f.id}
                    style={thumbBtn}
                    onClick={() => setViewer(true)}
                    title={f.kind}
                  >
                    v.{f.version ?? 1}
                  </button>
                ))}
              </div>
            )}
            <Button variant="secondary" size="form" onClick={() => setViewer(true)}>
              Отвори преглед на креатива
            </Button>
          </Section>
          {(status === 'zaObjavuvanje' || status === 'objaveno' || status === 'analitika') && (
            <Section
              title="Објава"
              openState={open.publication}
              onToggle={() => setOpen((o) => ({ ...o, publication: !o.publication }))}
            >
              <p style={sectionText}>{task.copy || 'Нема копи внесено.'}</p>
            </Section>
          )}
          <Section
            title="Активност"
            badge={`${(activity ?? []).filter((a) => a.kind === 'comment').length} коментари`}
            openState={open.activity}
            onToggle={() => setOpen((o) => ({ ...o, activity: !o.activity }))}
          >
            <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
              {(activity ?? []).map((a, i) => (
                <div key={i} style={{ fontSize: 13, lineHeight: '18px' }}>
                  <span style={{ color: 'var(--gd-ink-muted)' }}>
                    {a.at.slice(0, 16).replace('T', ' ')} ·{' '}
                  </span>
                  {a.kind === 'comment' ? <strong>{a.text}</strong> : a.text}
                </div>
              ))}
              {(activity ?? []).length === 0 && (
                <div style={sectionText}>Сè уште нема активност.</div>
              )}
            </div>
          </Section>
        </div>
      </div>

      {/* Композер за коментар */}
      <div style={composer}>
        {me && <span style={metaAvatar(me.color)}>{metaInitials(me.name)}</span>}
        <input
          className="gd-field"
          value={wz.comment}
          onChange={(e) => set({ comment: e.target.value })}
          placeholder="Напиши коментар"
          style={{ flex: 1 }}
        />
        <button style={iconBtn} title="Прикачи" type="button">
          <Paperclip size={16} />
        </button>
        <Button
          variant="primary"
          size="form"
          disabled={addComment.isPending || !wz.comment.trim()}
          onClick={() =>
            addComment.mutate(
              { body: wz.comment },
              {
                onSuccess: () => {
                  set({ comment: '' });
                  pushToast('Коментарот е додаден.');
                },
                onError: onErr,
              },
            )
          }
        >
          <Send size={14} /> Прати
        </Button>
      </div>

      {/* Модали (пауза/откажи/датум/врати) */}
      {modal && (
        <div style={modalBackdrop} onClick={() => setModal(null)}>
          <div style={modalBox} className="gd-fade-up" onClick={(e) => e.stopPropagation()}>
            <h3 style={{ margin: '0 0 12px', fontSize: 16, fontWeight: 600 }}>
              {modal === 'pause' && 'Пауза на таск'}
              {modal === 'cancel' && 'Откажување на таск'}
              {modal === 'date' && 'Промена на датум'}
              {modal === 'resume' && 'Враќање од пауза'}
            </h3>
            {(modal === 'date' || modal === 'resume') && (
              <label style={fieldLabel}>
                Нов датум
                <input
                  type="date"
                  className="gd-field"
                  value={modalDate}
                  onChange={(e) => setModalDate(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </label>
            )}
            {(modal === 'pause' || modal === 'cancel' || modal === 'date') && (
              <label style={fieldLabel}>
                Причина
                <textarea
                  className="gd-field"
                  rows={2}
                  value={reason}
                  onChange={(e) => setReason(e.target.value)}
                  style={{ marginTop: 4 }}
                />
              </label>
            )}
            <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
              <Button variant="secondary" size="form" onClick={() => setModal(null)}>
                Откажи
              </Button>
              <Button
                variant={modal === 'cancel' ? 'danger' : 'primary'}
                size="form"
                onClick={() => {
                  const done = () => {
                    setModal(null);
                    pushToast('Готово.');
                  };
                  if (modal === 'pause')
                    pause.mutate({ reason }, { onSuccess: done, onError: onErr });
                  if (modal === 'cancel')
                    cancel.mutate({ reason }, { onSuccess: done, onError: onErr });
                  if (modal === 'resume')
                    resume.mutate({ newDate: modalDate }, { onSuccess: done, onError: onErr });
                  if (modal === 'date')
                    dateChange.mutate(
                      { newDate: modalDate, reason },
                      { onSuccess: done, onError: onErr },
                    );
                }}
              >
                Потврди
              </Button>
            </div>
          </div>
        </div>
      )}

      {toasts[0] && (
        <div style={toastStyle} onClick={() => setToasts((x) => x.slice(1))}>
          {toasts[0].text}
        </div>
      )}

      {viewer && <CreativeViewer taskId={task.id} onClose={() => setViewer(false)} />}
    </aside>
  );
}

/* ── Работна зона (обвивка со заклучување И4) ── */
function WorkZone(props: {
  locked: boolean;
  terminal: boolean;
  status: TaskStatus;
  ownerLabel: string;
  assigneeName: string;
  children: React.ReactNode;
}) {
  if (props.status === 'mrtov') {
    return null;
  }
  return (
    <div style={workZone}>
      <div style={workHeader}>Работна зона · носи {props.ownerLabel}</div>
      {props.locked ? (
        <div style={lockedBox}>
          <Lock size={14} /> Чека {props.ownerLabel} · {props.assigneeName}
        </div>
      ) : (
        <div style={{ padding: 12 }}>{props.children}</div>
      )}
    </div>
  );
}

/* ── Содржина на работната зона по статус ── */
interface ZoneArgs {
  task: TaskDetailData;
  status: TaskStatus;
  ct: ContentType;
  wz: {
    brief: string;
    copy: string;
    comment: string;
    assigneeId: string;
    channel: string;
    permalink: string;
    postType: string;
    platform: string;
  };
  set: (patch: Partial<ZoneArgs['wz']>) => void;
  employees: Array<{ id: string; name: string; role: Role }>;
  pending: boolean;
  doTransition: (to: string, payload?: Record<string, unknown>) => void;
  addPublication: (input: {
    platform: 'fb' | 'ig' | 'tiktok';
    postType: 'reel' | 'post' | 'story' | 'carousel';
    permalink?: string;
  }) => void;
  runUpload: (
    kind: 'graphic' | 'final',
    next: string,
  ) => (e: React.ChangeEvent<HTMLInputElement>) => void;
}

function renderZone(a: ZoneArgs): React.ReactNode {
  const { status, ct, wz, set, employees, pending, doTransition } = a;
  const designers = employees.filter((e) => e.role === 'diz');

  if (status === 'brifing') {
    return (
      <>
        <label style={fieldLabel}>
          Брифинг
          <textarea
            className="gd-field"
            rows={4}
            maxLength={1200}
            value={wz.brief}
            onChange={(e) => set({ brief: e.target.value })}
            style={{ marginTop: 4 }}
          />
          <span style={counter}>{wz.brief.length}/1200</span>
        </label>
        <label style={fieldLabel}>
          Дизајнер
          <select
            className="gd-field"
            value={wz.assigneeId}
            onChange={(e) => set({ assigneeId: e.target.value })}
            style={{ marginTop: 4 }}
          >
            <option value="">— избери —</option>
            {designers.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <Button
          variant="primary"
          size="form"
          disabled={pending || wz.brief.trim().length < 50 || !wz.assigneeId}
          onClick={() => doTransition('dizajn', { brief: wz.brief, assigneeId: wz.assigneeId })}
        >
          Зачувај брифинг и активирај
        </Button>
      </>
    );
  }

  if (status === 'dizajn') {
    return (
      <>
        <p style={sectionText}>Прикачи ја готовата графика, потоа испрати на одобрување.</p>
        <label style={{ ...uploadBox }}>
          <Upload size={16} /> Прикачи графика
          <input
            type="file"
            accept="image/*"
            hidden
            onChange={a.runUpload('graphic', 'vnatresno')}
          />
        </label>
        <p style={{ ...counter, marginTop: 8 }}>Прикачувањето бара кренат MinIO/R2.</p>
      </>
    );
  }

  if (status === 'chekaRezija') {
    const monteurs = employees.filter((e) => e.role === 'mon');
    return (
      <>
        <p style={sectionText}>
          Прегледај го материјалот, додели монтажер на овој таск и додади насоки за монтажа.
          Различни таскови може да добијат различни монтажери.
        </p>
        <div style={rawBox}>
          <div style={rawBoxLabel}>Суров материјал од капата</div>
          <div style={{ display: 'flex', alignItems: 'center', gap: 10, fontSize: 14 }}>
            <Film size={16} aria-hidden /> Спремен за монтажа
          </div>
        </div>
        <label style={fieldLabel}>
          Монтажер · задолжително
          <select
            className="gd-field"
            value={wz.assigneeId}
            onChange={(e) => set({ assigneeId: e.target.value })}
            style={{ marginTop: 4 }}
          >
            <option value="">— избери —</option>
            {monteurs.map((e) => (
              <option key={e.id} value={e.id}>
                {e.name}
              </option>
            ))}
          </select>
        </label>
        <label style={fieldLabel}>
          Насоки за монтажа
          <textarea
            className="gd-field"
            rows={3}
            value={wz.comment}
            onChange={(e) => set({ comment: e.target.value })}
            style={{ marginTop: 4 }}
          />
        </label>
        <Button
          variant="primary"
          size="form"
          disabled={pending || !wz.assigneeId}
          onClick={() =>
            doTransition('montaza', { assigneeId: wz.assigneeId, comment: wz.comment })
          }
        >
          Додели монтажер и продолжи
        </Button>
      </>
    );
  }

  if (status === 'montaza') {
    return (
      <>
        <p style={sectionText}>Прикачи го монтираното видео, потоа испрати на одобрување.</p>
        <label style={{ ...uploadBox }}>
          <Upload size={16} /> Прикачи монтирано видео
          <input type="file" accept="video/*" hidden onChange={a.runUpload('final', 'vnatresno')} />
        </label>
        <p style={{ ...counter, marginTop: 8 }}>Прикачувањето бара кренат MinIO/R2.</p>
      </>
    );
  }

  if (status === 'vnatresno') {
    const back = ct === 'video' ? 'montaza' : 'dizajn';
    return (
      <>
        <p style={sectionText}>Прегледај ја креативата и одлучи.</p>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap' }}>
          <Button
            variant="primary"
            size="form"
            disabled={pending}
            onClick={() => doTransition('kajKlient')}
          >
            Одобри
          </Button>
          <Button
            variant="danger"
            size="form"
            disabled={pending || !wz.comment.trim()}
            onClick={() => doTransition(back, { comment: wz.comment })}
          >
            Врати со коментар
          </Button>
        </div>
        <label style={fieldLabel}>
          Коментар (за враќање)
          <textarea
            className="gd-field"
            rows={2}
            value={wz.comment}
            onChange={(e) => set({ comment: e.target.value })}
            style={{ marginTop: 4 }}
          />
        </label>
      </>
    );
  }

  if (status === 'kajKlient') {
    const back = ct === 'video' ? 'montaza' : 'dizajn';
    return (
      <>
        <label style={fieldLabel}>
          Канал
          <select
            className="gd-field"
            value={wz.channel}
            onChange={(e) => set({ channel: e.target.value })}
            style={{ marginTop: 4 }}
          >
            <option value="viber">Viber</option>
            <option value="whatsapp">WhatsApp</option>
            <option value="email">Мејл</option>
          </select>
        </label>
        <label style={fieldLabel}>
          Коментар (за измени/враќање)
          <textarea
            className="gd-field"
            rows={2}
            value={wz.comment}
            onChange={(e) => set({ comment: e.target.value })}
            style={{ marginTop: 4 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', marginTop: 8 }}>
          <Button
            variant="primary"
            size="form"
            disabled={pending}
            onClick={() =>
              doTransition('zaObjavuvanje', { outcome: 'approved', channel: wz.channel })
            }
          >
            Одобрено
          </Button>
          <Button
            variant="secondary"
            size="form"
            disabled={pending || !wz.comment.trim()}
            onClick={() =>
              doTransition('zaObjavuvanje', {
                outcome: 'approvedWithChanges',
                comment: wz.comment,
                channel: wz.channel,
              })
            }
          >
            Одобрено со измени
          </Button>
          <Button
            variant="danger"
            size="form"
            disabled={pending || !wz.comment.trim()}
            onClick={() => doTransition(back, { comment: wz.comment })}
          >
            Врати на доработка
          </Button>
        </div>
      </>
    );
  }

  if (status === 'zaObjavuvanje') {
    return (
      <>
        <label style={fieldLabel}>
          Копи
          <textarea
            className="gd-field"
            rows={4}
            maxLength={2200}
            value={wz.copy}
            onChange={(e) => set({ copy: e.target.value })}
            style={{ marginTop: 4 }}
          />
          <span style={counter}>{wz.copy.length}/2200</span>
        </label>
        <div style={{ display: 'flex', gap: 8 }}>
          <label style={{ ...fieldLabel, flex: 1 }}>
            Платформа
            <select
              className="gd-field"
              value={wz.platform}
              onChange={(e) => set({ platform: e.target.value })}
              style={{ marginTop: 4 }}
            >
              <option value="ig">Instagram</option>
              <option value="fb">Facebook</option>
              <option value="tiktok">TikTok</option>
            </select>
          </label>
          <label style={{ ...fieldLabel, flex: 1 }}>
            Тип
            <select
              className="gd-field"
              value={wz.postType}
              onChange={(e) => set({ postType: e.target.value })}
              style={{ marginTop: 4 }}
            >
              <option value="reel">Reel</option>
              <option value="post">Post</option>
              <option value="story">Story</option>
              <option value="carousel">Carousel</option>
            </select>
          </label>
        </div>
        <label style={fieldLabel}>
          Линк до објава
          <input
            className="gd-field"
            value={wz.permalink}
            onChange={(e) => set({ permalink: e.target.value })}
            style={{ marginTop: 4 }}
          />
        </label>
        <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
          <Button
            variant="secondary"
            size="form"
            disabled={pending || !wz.permalink.trim()}
            onClick={() =>
              a.addPublication({
                platform: wz.platform as 'fb' | 'ig' | 'tiktok',
                postType: wz.postType as 'reel' | 'post' | 'story' | 'carousel',
                permalink: wz.permalink,
              })
            }
          >
            Зачувај објава
          </Button>
          <Button
            variant="primary"
            size="form"
            disabled={pending || !wz.copy.trim()}
            onClick={() => doTransition('objaveno', { copy: wz.copy })}
          >
            Потврди објава
          </Button>
        </div>
        <p style={{ ...counter, marginTop: 6 }}>
          Потребни се копи и барем една зачувана објава со линк.
        </p>
      </>
    );
  }

  if (status === 'analitika') {
    return (
      <>
        <p style={sectionText}>Одлука за промоција и завршување.</p>
        <p style={{ ...counter }}>Органски / Во реклами се внесува по објавата — потоа „Заврши".</p>
        <Button
          variant="primary"
          size="form"
          disabled={pending}
          onClick={() => doTransition('zavrseno')}
        >
          Заврши
        </Button>
      </>
    );
  }

  // Фолбек: matrix-driven целни статуси (ништо не регресира).
  const targets = allowedTaskTargets(status, ct);
  if (targets.length === 0) {
    return <p style={sectionText}>Нема достапни преоди за овој статус.</p>;
  }
  return (
    <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
      {targets.map((to) => {
        const rule = findTaskTransition(status, to, ct);
        const isReturn = rule?.effects.some((x) => x.startsWith('E_REVISION'));
        return (
          <Button
            key={to}
            variant={isReturn ? 'danger' : 'primary'}
            size="form"
            disabled={pending}
            onClick={() => doTransition(to)}
          >
            → {TASK_STATUS_META[to].label}
          </Button>
        );
      })}
    </div>
  );
}

/* ── Секција (склоплива) ── */
function Section(props: {
  title: string;
  badge?: string;
  openState: boolean;
  onToggle: () => void;
  children: React.ReactNode;
}) {
  return (
    <div style={{ borderTop: '1px solid var(--gd-border)', padding: '12px 0' }}>
      <button style={sectionHead} onClick={props.onToggle}>
        {props.openState ? <ChevronDown size={16} /> : <ChevronRight size={16} />}
        <span style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600 }}>{props.title}</span>
        {props.badge && (
          <span style={{ marginLeft: 4, fontSize: 12, color: 'var(--gd-ink-muted)' }}>
            {props.badge}
          </span>
        )}
      </button>
      {props.openState && <div style={{ paddingTop: 8 }}>{props.children}</div>}
    </div>
  );
}

/* ── Стилови ── */
const panel = (expanded: boolean): React.CSSProperties => ({
  width: expanded ? '100%' : 480,
  maxWidth: '100%',
  borderLeft: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  display: 'flex',
  flexDirection: 'column',
  height: '100%',
});
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
  color: 'var(--gd-ink-secondary)',
  display: 'inline-flex',
  alignItems: 'center',
  padding: 4,
};
const avatar = (bg: string, i: number): React.CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: bg,
  color: '#fff',
  fontSize: 10,
  fontWeight: 600,
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  border: '2px solid #fff',
  marginLeft: i === 0 ? 0 : -8,
});
const menu: React.CSSProperties = {
  position: 'absolute',
  top: 32,
  right: 0,
  width: 200,
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  boxShadow: 'var(--gd-shadow-popover)',
  padding: 4,
  zIndex: 20,
};
const menuItem: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  width: '100%',
  border: 'none',
  background: 'transparent',
  padding: '8px 10px',
  fontSize: 13,
  cursor: 'pointer',
  borderRadius: 6,
  color: 'var(--gd-ink)',
  textAlign: 'left',
};
const metaGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '120px 1fr',
  rowGap: 8,
  margin: '0 0 20px',
  fontSize: 14,
};
const dt: React.CSSProperties = { color: 'var(--gd-ink-muted)', fontSize: 13 };
const dd: React.CSSProperties = { margin: 0 };
const metaAvatar = (bg: string): React.CSSProperties => ({
  width: 24,
  height: 24,
  borderRadius: '50%',
  background: bg,
  color: '#fff',
  display: 'inline-flex',
  alignItems: 'center',
  justifyContent: 'center',
  fontSize: 10,
  fontWeight: 600,
  flex: '0 0 auto',
});
const priorityChip = (urgent: boolean): React.CSSProperties => ({
  fontSize: 12,
  fontWeight: 500,
  padding: '1px 8px',
  borderRadius: 9999,
  color: urgent ? 'var(--gd-danger-text)' : 'var(--gd-ink-secondary)',
  background: urgent ? 'rgba(220,38,38,.1)' : 'var(--gd-surface-alt)',
  border: `1px solid ${urgent ? 'var(--gd-danger)' : 'var(--gd-border)'}`,
});
const thumbBtn: React.CSSProperties = {
  width: 72,
  height: 64,
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface-alt)',
  color: 'var(--gd-ink-secondary)',
  fontSize: 12,
  fontWeight: 600,
  cursor: 'pointer',
};
const linkBtn: React.CSSProperties = {
  marginLeft: 8,
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-primary)',
  cursor: 'pointer',
  fontSize: 13,
  padding: 0,
};
const workZone: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  overflow: 'hidden',
  marginBottom: 8,
};
const workHeader: React.CSSProperties = {
  background: 'var(--gd-surface-alt)',
  padding: '8px 12px',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  borderBottom: '1px solid var(--gd-border)',
};
const lockedBox: React.CSSProperties = {
  margin: 12,
  padding: 12,
  border: '1px dashed var(--gd-border)',
  borderRadius: 8,
  opacity: 0.55,
  pointerEvents: 'none',
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  fontSize: 13,
  color: 'var(--gd-ink-secondary)',
};
const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  marginBottom: 10,
};
const counter: React.CSSProperties = {
  display: 'block',
  fontSize: 11,
  color: 'var(--gd-ink-muted)',
  marginTop: 4,
};
const rawBox: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 12,
  background: 'var(--gd-surface-alt)',
  marginBottom: 12,
};
const rawBoxLabel: React.CSSProperties = {
  fontSize: 12,
  lineHeight: '16px',
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  marginBottom: 6,
};
const uploadBox: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 8,
  border: '1px dashed var(--gd-border-strong)',
  borderRadius: 8,
  padding: '16px',
  cursor: 'pointer',
  fontSize: 14,
  color: 'var(--gd-ink-secondary)',
};
const sectionText: React.CSSProperties = {
  fontSize: 13,
  lineHeight: '18px',
  color: 'var(--gd-ink-secondary)',
  margin: 0,
};
const ctxRow: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'flex-start',
  padding: '8px 0',
  borderBottom: '1px solid var(--gd-border)',
  fontSize: 13,
  lineHeight: '18px',
  color: 'var(--gd-ink-secondary)',
};
const ctxTag: React.CSSProperties = {
  flex: '0 0 auto',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
  borderRadius: 9999,
  padding: '1px 8px',
};
const sectionHead: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  width: '100%',
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  padding: 0,
  color: 'var(--gd-ink)',
};
const composer: React.CSSProperties = {
  flex: '0 0 auto',
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  padding: 12,
  borderTop: '1px solid var(--gd-border)',
};
const modalBackdrop: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.3)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 50,
};
const modalBox: React.CSSProperties = {
  width: 360,
  background: 'var(--gd-surface)',
  borderRadius: 8,
  boxShadow: 'var(--gd-shadow-popover)',
  padding: 20,
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
  boxShadow: 'var(--gd-shadow-toast)',
  zIndex: 60,
};
