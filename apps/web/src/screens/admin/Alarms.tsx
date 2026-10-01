import type React from 'react';
import { useState } from 'react';
import { t } from '@gd/ui';
import { useRules, useToggleRule, useDeleteRule } from '../../api/notifications.js';
import { tableStyles as s } from '../../components/table.js';
import type { RuleRow } from '../../lib/types.js';
import { RuleForm } from './RuleForm.js';

/** Админ → Аларми (H3): системски + сопствени правила — on/off + Rule Builder (create/edit/delete). */
export function AdminAlarms() {
  const { data: rules, isLoading } = useRules();
  const toggle = useToggleRule();
  const del = useDeleteRule();
  const [form, setForm] = useState<{ rule?: RuleRow } | null>(null);
  const [confirmId, setConfirmId] = useState<string | null>(null);

  return (
    <div>
      <div
        style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', gap: 12 }}
      >
        <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13, marginTop: -8 }}>
          {t('admin.alarmsHint')}
        </p>
        <button type="button" onClick={() => setForm({})} style={newBtn}>
          {t('admin.newRule')}
        </button>
      </div>
      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>{t('admin.loading')}</p>}
      {rules && (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>{t('admin.colRule')}</th>
                <th style={s.th}>{t('admin.colScope')}</th>
                <th style={s.th}>{t('admin.colType')}</th>
                <th style={{ ...s.th, textAlign: 'right' }}>{t('admin.colState')}</th>
                <th style={{ ...s.th, textAlign: 'right' }}>{t('admin.colActions')}</th>
              </tr>
            </thead>
            <tbody>
              {rules.map((r) => {
                const editable = !!r.trigger?.type; // само правила со жив тип се уредливи
                return (
                  <tr key={r.id}>
                    <td style={{ ...s.td, fontWeight: 500 }}>{r.name}</td>
                    <td style={s.td}>
                      {r.scope === 'global' ? t('admin.global') : t('admin.perClient')}
                    </td>
                    <td style={s.td}>{r.isSystem ? t('admin.system') : t('admin.custom')}</td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', alignItems: 'center', gap: 8 }}>
                        <button
                          onClick={() => toggle.mutate(r.id)}
                          disabled={toggle.isPending}
                          role="switch"
                          aria-checked={r.enabled}
                          aria-label={r.name}
                          style={{
                            width: 40,
                            height: 22,
                            borderRadius: 9999,
                            border: 'none',
                            padding: 2,
                            display: 'flex',
                            justifyContent: r.enabled ? 'flex-end' : 'flex-start',
                            background: r.enabled ? 'var(--gd-primary)' : 'var(--gd-border)',
                            cursor: 'pointer',
                            transition: 'background 150ms',
                          }}
                        >
                          <span
                            style={{
                              width: 18,
                              height: 18,
                              borderRadius: '50%',
                              background: '#fff',
                              boxShadow: '0 1px 2px rgba(0,0,0,.2)',
                            }}
                          />
                        </button>
                        <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)', width: 64 }}>
                          {r.enabled ? t('admin.on') : t('admin.off')}
                        </span>
                      </div>
                    </td>
                    <td style={{ ...s.td, textAlign: 'right' }}>
                      <div style={{ display: 'inline-flex', gap: 6 }}>
                        {editable && (
                          <button
                            type="button"
                            onClick={() => setForm({ rule: r })}
                            style={linkBtn}
                          >
                            {t('admin.edit')}
                          </button>
                        )}
                        {!r.isSystem &&
                          (confirmId === r.id ? (
                            <button
                              type="button"
                              onClick={() => {
                                del.mutate(r.id);
                                setConfirmId(null);
                              }}
                              style={dangerBtn}
                            >
                              {t('admin.ruleDeleteConfirm')}
                            </button>
                          ) : (
                            <button
                              type="button"
                              onClick={() => setConfirmId(r.id)}
                              style={linkBtn}
                            >
                              {t('admin.ruleDelete')}
                            </button>
                          ))}
                      </div>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
      {form && <RuleForm rule={form.rule} onClose={() => setForm(null)} />}
    </div>
  );
}

const newBtn: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#0866FF',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};
const linkBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: 'var(--gd-primary)',
  fontSize: 13,
  cursor: 'pointer',
};
const dangerBtn: React.CSSProperties = {
  border: '1px solid #FCA5A5',
  background: '#fff',
  color: '#B91C1C',
  fontSize: 12,
  fontWeight: 600,
  padding: '2px 8px',
  borderRadius: 6,
  cursor: 'pointer',
};
