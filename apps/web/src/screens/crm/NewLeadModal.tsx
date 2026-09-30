import type React from 'react';
import { useState } from 'react';
import { CRM_SOURCES, type CrmSource } from '@gd/core';
import { t } from '@gd/ui';
import { useCreateLead, type CrmAgent } from '../../api/crm.js';
import { ApiRequestError } from '../../lib/api.js';

/** Модал „Нов лид". Агент → на себе; Директор → избира агент. */
export function NewLeadModal({
  isDir,
  agents,
  onClose,
  onCreated,
}: {
  isDir: boolean;
  agents: CrmAgent[];
  onClose: () => void;
  onCreated: (id: string) => void;
}) {
  const create = useCreateLead();
  const [name, setName] = useState('');
  const [person, setPerson] = useState('');
  const [phone, setPhone] = useState('');
  const [email, setEmail] = useState('');
  const [source, setSource] = useState<CrmSource>('Instagram');
  const [pkgHint, setPkgHint] = useState('');
  const [agentId, setAgentId] = useState(agents[0]?.id ?? '');
  const [err, setErr] = useState<string | null>(null);
  const [tried, setTried] = useState(false);

  // Задолжителни (И5): име на бизнис, контакт лице, и телефон ИЛИ мејл.
  // По обид за поднесување, празните добиваат црвена рамка; серверот сепак валидира.
  const nameBad = tried && !name.trim();
  const personBad = tried && !person.trim();
  const contactBad = tried && !phone.trim() && !email.trim();

  const save = () => {
    setErr(null);
    setTried(true);
    create.mutate(
      {
        name,
        person,
        phone: phone || undefined,
        email: email || undefined,
        source,
        pkgHint: pkgHint || undefined,
        agentId: isDir ? agentId : undefined,
      },
      {
        onSuccess: (lead) => onCreated(lead.id),
        onError: (e) => setErr(e instanceof ApiRequestError ? e.message : t('crm.error')),
      },
    );
  };

  return (
    <div style={overlay} onClick={onClose}>
      <div style={modal} onClick={(e) => e.stopPropagation()}>
        <h2 style={{ margin: '0 0 4px', fontSize: 18 }}>{t('crm.newLead')}</h2>
        <p style={{ margin: '0 0 16px', color: 'var(--gd-ink-muted)', fontSize: 13 }}>
          {t('crm.newLeadHint')}
        </p>
        <Field label={t('crm.fBusiness')}>
          <input
            style={nameBad ? inputErr : input}
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <Field label={t('crm.fPerson')}>
          <input
            style={personBad ? inputErr : input}
            value={person}
            onChange={(e) => setPerson(e.target.value)}
          />
        </Field>
        <div style={{ display: 'flex', gap: 10 }}>
          <Field label={t('crm.fPhone')}>
            <input
              style={contactBad ? inputErr : input}
              value={phone}
              onChange={(e) => setPhone(e.target.value)}
            />
          </Field>
          <Field label={t('crm.fEmail')}>
            <input
              style={contactBad ? inputErr : input}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
            />
          </Field>
        </div>
        <Field label={t('crm.fSource')}>
          <select
            style={input}
            value={source}
            onChange={(e) => setSource(e.target.value as CrmSource)}
          >
            {CRM_SOURCES.map((s) => (
              <option key={s} value={s}>
                {s}
              </option>
            ))}
          </select>
        </Field>
        <Field label={t('crm.fPackage')}>
          <input
            style={input}
            value={pkgHint}
            placeholder={t('crm.phPackage')}
            onChange={(e) => setPkgHint(e.target.value)}
          />
        </Field>
        {isDir && (
          <Field label={t('crm.fAgent')}>
            <select style={input} value={agentId} onChange={(e) => setAgentId(e.target.value)}>
              {agents.map((a) => (
                <option key={a.id} value={a.id}>
                  {a.name}
                </option>
              ))}
            </select>
          </Field>
        )}
        {err && <div style={{ color: '#B91C1C', fontSize: 13, marginTop: 8 }}>{err}</div>}
        <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 16 }}>
          <button type="button" onClick={onClose} style={btnGhost}>
            {t('crm.cancel')}
          </button>
          <button type="button" onClick={save} disabled={create.isPending} style={btnPrimary}>
            {t('crm.createLead')}
          </button>
        </div>
      </div>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block', marginBottom: 12, flex: 1 }}>
      <span style={{ display: 'block', fontSize: 12, fontWeight: 600, marginBottom: 4 }}>
        {label}
      </span>
      {children}
    </label>
  );
}

const overlay: React.CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(18,22,28,.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 70,
};
const modal: React.CSSProperties = {
  background: '#fff',
  borderRadius: 12,
  padding: 24,
  width: 460,
  maxWidth: '92vw',
  maxHeight: '90vh',
  overflowY: 'auto',
};
const input: React.CSSProperties = {
  width: '100%',
  padding: '8px 10px',
  borderRadius: 6,
  border: '1px solid var(--gd-border)',
  fontSize: 13,
  boxSizing: 'border-box',
};
const inputErr: React.CSSProperties = { ...input, border: '1px solid #B91C1C' };
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
