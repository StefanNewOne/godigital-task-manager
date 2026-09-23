import type React from 'react';
import { useEffect, useState } from 'react';
import { Download, X } from 'lucide-react';
import {
  TASK_STATUS_META,
  allowedTaskTargets,
  findTaskTransition,
  type ContentType,
  type TaskStatus,
} from '@gd/core';
import { Button } from '@gd/ui';
import { useEmployees } from '../../api/admin.js';
import { useFiles } from '../../api/files.js';
import { useActivity, useAddComment, useTask, useTransition } from '../../api/tasks.js';
import { ApiRequestError } from '../../lib/api.js';
import type { FileAssetRow } from '../../lib/types.js';

const CREATIVE_KINDS = new Set(['final', 'graphic', 'preview']);

/**
 * Преглед на креатива (Handoff §2.10): цел екран, верзии + коментари.
 * Забелешка: реалниот приказ на медиа бара кренат MinIO/R2 (presigned GET); школката,
 * листата на верзии и коментарите работат независно.
 */
export function CreativeViewer({ taskId, onClose }: { taskId: string; onClose: () => void }) {
  const { data: task } = useTask(taskId);
  const { data: files } = useFiles('task', taskId);
  const { data: activity } = useActivity(taskId);
  const { data: employees } = useEmployees();
  const addComment = useAddComment(taskId);
  const transition = useTransition(taskId);

  const versions = (files ?? []).filter((f) => CREATIVE_KINDS.has(f.kind));
  const [selectedId, setSelectedId] = useState<string | null>(null);
  const [comment, setComment] = useState('');
  const [returnComment, setReturnComment] = useState('');
  const [toast, setToast] = useState<string | null>(null);

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => e.key === 'Escape' && onClose();
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  const selected: FileAssetRow | undefined =
    versions.find((v) => v.id === selectedId) ?? versions[versions.length - 1];

  const comments = (activity ?? []).filter((a) => a.kind === 'comment');

  // Одобри / Врати според матрицата за тековниот статус.
  const status = (task?.status ?? '') as TaskStatus;
  const ct = (task?.contentType ?? 'video') as ContentType;
  const targets = task ? allowedTaskTargets(status, ct) : [];
  const approveTarget = targets.find(
    (to) => !findTaskTransition(status, to, ct)?.effects.some((e) => e.startsWith('E_REVISION')),
  );
  const returnTarget = targets.find((to) =>
    findTaskTransition(status, to, ct)?.effects.some((e) => e.startsWith('E_REVISION')),
  );

  const doTransition = (to: string, payload: Record<string, unknown> = {}) =>
    transition.mutate(
      { to, payload },
      {
        onSuccess: () => {
          setToast(`Пренесено во „${TASK_STATUS_META[to as TaskStatus]?.label ?? to}".`);
          setReturnComment('');
        },
        onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
      },
    );

  return (
    <div style={overlay} className="gd-fade-up">
      {/* Топ лента */}
      <div style={topBar}>
        <div style={{ display: 'flex', alignItems: 'center', gap: 12, minWidth: 0 }}>
          <span style={{ fontWeight: 600, whiteSpace: 'nowrap' }}>
            {selected ? `${selected.kind}` : 'Креатива'}
          </span>
          {selected?.version != null && <span style={versionPill}>v{selected.version}</span>}
          <span style={{ color: '#8A93A0', overflow: 'hidden', textOverflow: 'ellipsis' }}>
            {task ? `${task.client.name} · ${task.title}` : ''}
          </span>
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
          {selected && (
            <a href={selected.url} target="_blank" rel="noreferrer" style={downloadLink}>
              <Download size={16} /> Симни
            </a>
          )}
          <button onClick={onClose} style={iconBtn} title="Затвори" aria-label="Затвори">
            <X size={18} />
          </button>
        </div>
      </div>

      <div style={{ flex: 1, display: 'flex', minHeight: 0 }}>
        {/* Централна сцена + верзии */}
        <div style={{ flex: 1, display: 'flex', flexDirection: 'column', minWidth: 0 }}>
          <div style={stage}>
            {!selected && <span style={{ color: '#8A93A0' }}>Нема прикачена креатива.</span>}
            {selected && selected.mime.startsWith('image/') && (
              <img src={selected.url} alt={selected.kind} style={media} />
            )}
            {selected && selected.mime.startsWith('video/') && (
              <video src={selected.url} controls style={media} />
            )}
            {selected && !/^(image|video)\//.test(selected.mime) && (
              <a href={selected.url} target="_blank" rel="noreferrer" style={downloadLink}>
                <Download size={16} /> Отвори фајл
              </a>
            )}
          </div>
          {versions.length > 0 && (
            <div style={thumbStrip}>
              {versions.map((v) => (
                <button
                  key={v.id}
                  onClick={() => setSelectedId(v.id)}
                  style={thumb(v.id === selected?.id)}
                  title={`v${v.version ?? '?'}`}
                >
                  v{v.version ?? '?'}
                </button>
              ))}
            </div>
          )}
        </div>

        {/* Странична лента: коментари + одлуки */}
        <aside style={sidebar}>
          <div style={{ padding: 16, borderBottom: '1px solid #262b33', fontWeight: 600 }}>
            Коментари
          </div>
          <div
            style={{
              flex: 1,
              overflow: 'auto',
              padding: 16,
              display: 'flex',
              flexDirection: 'column',
              gap: 10,
            }}
          >
            {comments.length === 0 && (
              <span style={{ color: '#8A93A0', fontSize: 13 }}>Сè уште нема коментари.</span>
            )}
            {comments.map((c, i) => {
              const who = employees?.find((e) => e.id === c.actorId);
              return (
                <div key={i} style={{ display: 'flex', gap: 8, fontSize: 13 }}>
                  <span style={cmtAvatar(who?.color ?? '#5C6672')}>
                    {who ? initials(who.name) : '—'}
                  </span>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: '#8A93A0', fontSize: 12 }}>
                      {who?.name ?? 'Систем'} · {c.at.slice(0, 16).replace('T', ' ')}
                    </div>
                    <div>{c.text}</div>
                  </div>
                </div>
              );
            })}
          </div>
          <div
            style={{
              padding: 16,
              borderTop: '1px solid #262b33',
              display: 'flex',
              flexDirection: 'column',
              gap: 8,
            }}
          >
            <div style={{ display: 'flex', gap: 8 }}>
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                placeholder="Додади коментар…"
                style={darkInput}
              />
              <Button
                variant="secondary"
                size="toolbar"
                disabled={!comment.trim() || addComment.isPending}
                onClick={() =>
                  addComment.mutate({ body: comment }, { onSuccess: () => setComment('') })
                }
              >
                Прати
              </Button>
            </div>
            {(approveTarget || returnTarget) && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: 8 }}>
                {returnTarget && (
                  <input
                    value={returnComment}
                    onChange={(e) => setReturnComment(e.target.value)}
                    placeholder="Коментар за враќање…"
                    style={darkInput}
                  />
                )}
                <div style={{ display: 'flex', gap: 8 }}>
                  {approveTarget && (
                    <Button
                      variant="primary"
                      size="form"
                      disabled={transition.isPending}
                      onClick={() => doTransition(approveTarget)}
                    >
                      Одобри
                    </Button>
                  )}
                  {returnTarget && (
                    <Button
                      variant="danger"
                      size="form"
                      disabled={transition.isPending || !returnComment.trim()}
                      onClick={() => doTransition(returnTarget, { comment: returnComment })}
                    >
                      Врати
                    </Button>
                  )}
                </div>
              </div>
            )}
          </div>
        </aside>
      </div>

      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  zIndex: 50,
  background: '#12161C',
  color: '#E2E7EB',
  display: 'flex',
  flexDirection: 'column',
};
const topBar: React.CSSProperties = {
  height: 56,
  flex: '0 0 56px',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 20px',
  borderBottom: '1px solid #262b33',
  gap: 12,
};
const versionPill: React.CSSProperties = {
  fontSize: 12,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 9999,
  background: 'rgba(124,58,237,.22)',
  color: '#C4B5FD',
};
const cmtAvatar = (bg: string): React.CSSProperties => ({
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
function initials(name: string): string {
  const p = name.trim().split(/\s+/);
  return ((p[0]?.[0] ?? '') + (p[1]?.[0] ?? '')).toUpperCase();
}
const downloadLink: React.CSSProperties = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: 6,
  color: '#E2E7EB',
  textDecoration: 'none',
  fontSize: 14,
  padding: '6px 10px',
  border: '1px solid #262b33',
  borderRadius: 6,
};
const iconBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#E2E7EB',
  cursor: 'pointer',
  display: 'flex',
  alignItems: 'center',
};
const stage: React.CSSProperties = {
  flex: 1,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  background: '#22262E',
  minHeight: 0,
  padding: 24,
};
const media: React.CSSProperties = { maxHeight: '60vh', maxWidth: '100%', borderRadius: 8 };
const thumbStrip: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  padding: 12,
  overflowX: 'auto',
  borderTop: '1px solid #262b33',
};
const thumb = (active: boolean): React.CSSProperties => ({
  width: 72,
  height: 64,
  flex: '0 0 auto',
  borderRadius: 6,
  border: active ? '2px solid #0866FF' : '1px solid #262b33',
  background: '#161920',
  color: '#E2E7EB',
  cursor: 'pointer',
  fontSize: 12,
  fontWeight: 600,
});
const sidebar: React.CSSProperties = {
  width: 320,
  flex: '0 0 320px',
  background: '#161920',
  borderLeft: '1px solid #262b33',
  display: 'flex',
  flexDirection: 'column',
  minHeight: 0,
};
const darkInput: React.CSSProperties = {
  flex: 1,
  height: 32,
  background: '#12161C',
  border: '1px solid #262b33',
  borderRadius: 6,
  color: '#E2E7EB',
  padding: '0 8px',
  fontSize: 13,
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
  border: '1px solid #262b33',
  zIndex: 60,
};
