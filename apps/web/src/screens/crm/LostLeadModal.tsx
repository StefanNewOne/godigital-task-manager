import type React from 'react';
import { useState } from 'react';
import { LOSS_REASONS, type LossReason } from '@gd/core';
import { t } from '@gd/ui';

/** Модал „Изгубен лид". Причината е задолжителна; за „Друго" и белешката. */
export function LostLeadModal({
  name,
  onCancel,
  onConfirm,
}: {
  name: string;
  onCancel: () => void;
  onConfirm: (reason: LossReason, note: string) => void;
}) {
  const [reason, setReason] = useState<LossReason | ''>('');
  const [note, setNote] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const confirm = () => {
    if (!reason) return setErr(t('crm.pickReason'));
    if (reason === 'Друго' && !note.trim()) return setErr(t('crm.otherReason'));
    onConfirm(reason, note.trim());
  };

  return (
    <div style={overlay} onClick={onCancel}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{t('crm.lostTitle')}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--gd-ink-muted)', fontSize: 13 }}>
          {t('crm.lostHint', { name })}
        </p>
        <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
          {LOSS_REASONS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => {
                setReason(r);
                setErr(null);
              }}
              style={{
                textAlign: 'left',
                padding: '10px 12px',
                borderRadius: 6,
                border: `1px solid ${reason === r ? '#0866FF' : 'var(--gd-border)'}`,
                background: reason === r ? '#EBF2FF' : '#fff',
                cursor: 'pointer',
                fontSize: 13,
                fontWeight: reason === r ? 600 : 500,
              }}
            >
              {r}
            </button>
          ))}
        </div>
        {reason === 'Друго' && (
          <textarea
            style={{ ...taStyle, marginTop: 10 }}
            placeholder={t('crm.describeReason')}
            value={note}
            onChange={(e) => setNote(e.target.value)}
          />
        )}
        {err && <div style={{ color: '#B91C1C', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onCancel} style={btnGhost}>
            {t('crm.cancel')}
          </button>
          <button type="button" onClick={confirm} style={btnDanger}>
            {t('crm.markLost')}
          </button>
        </div>
      </div>
    </div>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(18,22,28,.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 80,
};
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 24,
  width: 420,
  maxWidth: '92vw',
};
const taStyle: React.CSSProperties = {
  width: '100%',
  minHeight: 70,
  padding: 10,
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  fontSize: 13,
  boxSizing: 'border-box',
  resize: 'vertical',
};
const btnGhost: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  background: '#fff',
  fontSize: 13,
  cursor: 'pointer',
};
const btnDanger: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid #FCA5A5',
  background: '#fff',
  color: '#B91C1C',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};
