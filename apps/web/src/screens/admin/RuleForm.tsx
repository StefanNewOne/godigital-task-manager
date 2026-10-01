import type React from 'react';
import { useState } from 'react';
import { type AutomationRuleInput, NOTIFY_LEVELS, RECIPIENT_KINDS } from '@gd/core';
import { Modal, t } from '@gd/ui';
import { useClients } from '../../api/admin.js';
import { useCreateRule, useUpdateRule } from '../../api/notifications.js';
import type { RuleRow } from '../../lib/types.js';

/** Типови тригери со жив евалуатор (H3/ADR-001). Се проширува како се додаваат евалуатори. */
const CREATABLE_TYPES = ['coverage_below'] as const;

/** Rule Builder форма (H3 Фаза 4). Создавање/уредување правило за аларм. */
export function RuleForm({ rule, onClose }: { rule?: RuleRow; onClose: () => void }) {
  const editing = !!rule;
  const create = useCreateRule();
  const update = useUpdateRule();
  const { data: clients } = useClients();

  const spec = (rule?.conditions ?? {}) as { type?: string; days?: number };
  const action = (rule?.actions ?? {}) as { level?: string; recipients?: string };

  const [name, setName] = useState(rule?.name ?? '');
  const [type] = useState<string>(spec.type ?? rule?.trigger?.type ?? 'coverage_below');
  const [days, setDays] = useState(String(spec.days ?? 7));
  const [level, setLevel] = useState(action.level ?? 'kritichen');
  const [recipients, setRecipients] = useState(action.recipients ?? 'directors');
  const [scope, setScope] = useState(rule?.scope ?? 'global');
  const [clientId, setClientId] = useState(rule?.clientId ?? '');
  const [err, setErr] = useState<string | null>(null);

  const submit = () => {
    setErr(null);
    const input: AutomationRuleInput = {
      name: name.trim(),
      scope: scope as 'global' | 'client',
      clientId: scope === 'client' ? clientId || null : null,
      // Само coverage_below е жив; spec се гради по тип.
      spec: { type: 'coverage_below', days: Number(days) || 0 },
      action: {
        level: level as (typeof NOTIFY_LEVELS)[number],
        recipients: recipients as (typeof RECIPIENT_KINDS)[number],
      },
      enabled: rule?.enabled ?? true,
    };
    const onErr = () => setErr(t('admin.error'));
    if (editing) {
      update.mutate({ id: rule!.id, input }, { onSuccess: onClose, onError: onErr });
    } else {
      create.mutate(input, { onSuccess: onClose, onError: onErr });
    }
  };

  const typeLabel = (ty: string) => (ty === 'coverage_below' ? t('admin.trigCoverageBelow') : ty);

  return (
    <Modal
      open
      onClose={onClose}
      title={editing ? t('admin.editRuleTitle') : t('admin.newRuleTitle')}
      width={440}
    >
      <Field label={t('admin.ruleName')}>
        <input style={input} value={name} onChange={(e) => setName(e.target.value)} />
      </Field>
      <Field label={t('admin.ruleTrigger')}>
        {/* Типот е заклучен (еден жив евалуатор; системски правила не менуваат тип). */}
        <select style={input} value={type} disabled>
          {CREATABLE_TYPES.map((ty) => (
            <option key={ty} value={ty}>
              {typeLabel(ty)}
            </option>
          ))}
        </select>
      </Field>
      <Field label={t('admin.ruleDays')}>
        <input style={input} type="number" value={days} onChange={(e) => setDays(e.target.value)} />
      </Field>
      <Field label={t('admin.ruleLevel')}>
        <select style={input} value={level} onChange={(e) => setLevel(e.target.value)}>
          <option value="potsetnik">{t('admin.lvlPotsetnik')}</option>
          <option value="alarm">{t('admin.lvlAlarm')}</option>
          <option value="kritichen">{t('admin.lvlKritichen')}</option>
        </select>
      </Field>
      <Field label={t('admin.ruleRecipients')}>
        <select style={input} value={recipients} onChange={(e) => setRecipients(e.target.value)}>
          <option value="directors">{t('admin.rcpDirectors')}</option>
          <option value="accountManagers">{t('admin.rcpAccountManagers')}</option>
          <option value="owner">{t('admin.rcpOwner')}</option>
        </select>
      </Field>
      <Field label={t('admin.ruleScope')}>
        <select style={input} value={scope} onChange={(e) => setScope(e.target.value)}>
          <option value="global">{t('admin.global')}</option>
          <option value="client">{t('admin.perClient')}</option>
        </select>
      </Field>
      {scope === 'client' && (
        <Field label={t('admin.ruleClient')}>
          <select style={input} value={clientId} onChange={(e) => setClientId(e.target.value)}>
            <option value="">—</option>
            {(clients ?? []).map((c) => (
              <option key={c.id} value={c.id}>
                {c.name}
              </option>
            ))}
          </select>
        </Field>
      )}
      {err && <div style={{ color: '#B91C1C', fontSize: 13, marginTop: 8 }}>{err}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
        <button type="button" onClick={onClose} style={btnGhost}>
          {t('admin.cancel')}
        </button>
        <button
          type="button"
          onClick={submit}
          disabled={create.isPending || update.isPending}
          style={btnPrimary}
        >
          {t('admin.save')}
        </button>
      </div>
    </Modal>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  fontSize: 13,
  boxSizing: 'border-box',
};
const btnGhost: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  background: '#fff',
  fontSize: 13,
  cursor: 'pointer',
};
const btnPrimary: React.CSSProperties = {
  padding: '8px 14px',
  borderRadius: 6,
  border: 'none',
  background: '#0866FF',
  color: '#fff',
  fontWeight: 600,
  fontSize: 13,
  cursor: 'pointer',
};
