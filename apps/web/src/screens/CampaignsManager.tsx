import type React from 'react';
import { useState } from 'react';
import { Button, Modal } from '@gd/ui';
import { useClients } from '../api/admin.js';
import {
  useCampaigns,
  useCreateCampaign,
  useUpdateCampaign,
  type CampaignRow,
} from '../api/campaigns.js';
import { ApiRequestError } from '../lib/api.js';

const STATUS_LABEL: Record<string, string> = {
  planned: 'Планирана',
  active: 'Активна',
  closed: 'Затворена',
};

/** Аналитичар: управување со платени кампањи (H9). */
export function CampaignsManager({ onClose }: { onClose: () => void }) {
  const { data: clients } = useClients();
  const [clientId, setClientId] = useState('');
  const effectiveClient = clientId || clients?.[0]?.id || '';
  const { data: campaigns } = useCampaigns(effectiveClient);
  const [editing, setEditing] = useState<CampaignRow | 'new' | null>(null);

  return (
    <Modal open onClose={onClose} title="Кампањи" width={640}>
      <label style={fieldLabel}>Клиент</label>
      <select
        value={effectiveClient}
        onChange={(e) => {
          setClientId(e.target.value);
          setEditing(null);
        }}
        style={input}
      >
        {(clients ?? []).map((c) => (
          <option key={c.id} value={c.id}>
            {c.name}
          </option>
        ))}
      </select>

      <div style={{ display: 'flex', justifyContent: 'flex-end', margin: '12px 0' }}>
        <Button variant="primary" size="toolbar" onClick={() => setEditing('new')}>
          + Нова кампања
        </Button>
      </div>

      {editing && (
        <CampaignForm
          clientId={effectiveClient}
          campaign={editing === 'new' ? undefined : editing}
          onDone={() => setEditing(null)}
        />
      )}

      <div style={{ display: 'flex', flexDirection: 'column', gap: 8, marginTop: 8 }}>
        {(campaigns ?? []).length === 0 && (
          <p style={{ color: 'var(--gd-ink-muted)', fontSize: 13 }}>Нема кампањи за овој клиент.</p>
        )}
        {(campaigns ?? []).map((c) => (
          <div key={c.id} style={row}>
            <div style={{ minWidth: 0 }}>
              <div style={{ fontWeight: 500 }}>{c.name}</div>
              <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>
                {fmtDate(c.periodFrom)}–{fmtDate(c.periodTo)} · {Math.round(Number(c.budget))} € ·{' '}
                {STATUS_LABEL[c.status]}
              </div>
            </div>
            <Button variant="ghost" size="toolbar" onClick={() => setEditing(c)}>
              Уреди
            </Button>
          </div>
        ))}
      </div>
    </Modal>
  );
}

function CampaignForm({
  clientId,
  campaign,
  onDone,
}: {
  clientId: string;
  campaign?: CampaignRow;
  onDone: () => void;
}) {
  const isEdit = !!campaign;
  const create = useCreateCampaign();
  const update = useUpdateCampaign(campaign?.id ?? '');
  const [name, setName] = useState(campaign?.name ?? '');
  const [objective, setObjective] = useState(campaign?.objective ?? '');
  const [budget, setBudget] = useState(campaign ? String(Math.round(Number(campaign.budget))) : '');
  const [periodFrom, setFrom] = useState(campaign ? isoDay(campaign.periodFrom) : '');
  const [periodTo, setTo] = useState(campaign ? isoDay(campaign.periodTo) : '');
  const [status, setStatus] = useState<CampaignRow['status']>(campaign?.status ?? 'planned');
  const [metaCampaignId, setMeta] = useState(campaign?.metaCampaignId ?? '');
  const [error, setError] = useState<string | null>(null);

  const pending = create.isPending || update.isPending;
  const valid = name.trim() && objective.trim() && budget !== '' && periodFrom && periodTo;

  const submit = () => {
    setError(null);
    const base = {
      name: name.trim(),
      objective: objective.trim(),
      budget: Number(budget),
      periodFrom,
      periodTo,
      status,
      metaCampaignId: metaCampaignId.trim() || undefined,
    };
    const onErr = (e: unknown) =>
      setError(e instanceof ApiRequestError ? e.message : 'Грешка при зачувување.');
    if (isEdit) {
      update.mutate(base, { onSuccess: onDone, onError: onErr });
    } else {
      create.mutate({ ...base, clientId }, { onSuccess: onDone, onError: onErr });
    }
  };

  return (
    <div style={formCard}>
      <div style={twoCol}>
        <Labeled label="Име">
          <input value={name} onChange={(e) => setName(e.target.value)} style={input} />
        </Labeled>
        <Labeled label="Цел">
          <input value={objective} onChange={(e) => setObjective(e.target.value)} style={input} />
        </Labeled>
      </div>
      <div style={twoCol}>
        <Labeled label="Буџет (€)">
          <input
            type="number"
            value={budget}
            onChange={(e) => setBudget(e.target.value)}
            style={input}
          />
        </Labeled>
        <Labeled label="Статус">
          <select
            value={status}
            onChange={(e) => setStatus(e.target.value as CampaignRow['status'])}
            style={input}
          >
            <option value="planned">Планирана</option>
            <option value="active">Активна</option>
            <option value="closed">Затворена</option>
          </select>
        </Labeled>
      </div>
      <div style={twoCol}>
        <Labeled label="Од">
          <input
            type="date"
            value={periodFrom}
            onChange={(e) => setFrom(e.target.value)}
            style={input}
          />
        </Labeled>
        <Labeled label="До">
          <input
            type="date"
            value={periodTo}
            onChange={(e) => setTo(e.target.value)}
            style={input}
          />
        </Labeled>
      </div>
      <Labeled label="Meta ID на кампања (по потреба)">
        <input value={metaCampaignId} onChange={(e) => setMeta(e.target.value)} style={input} />
      </Labeled>
      {error && <div style={{ color: 'var(--gd-danger)', fontSize: 13 }}>{error}</div>}
      <div style={{ display: 'flex', justifyContent: 'flex-end', gap: 8, marginTop: 4 }}>
        <Button variant="ghost" size="form" onClick={onDone}>
          Откажи
        </Button>
        <Button variant="primary" size="form" disabled={!valid || pending} onClick={submit}>
          {pending ? 'Се зачувува…' : isEdit ? 'Зачувај' : 'Креирај'}
        </Button>
      </div>
    </div>
  );
}

function Labeled({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label style={{ display: 'block' }}>
      <span style={fieldLabel}>{label}</span>
      {children}
    </label>
  );
}

const isoDay = (iso: string): string => iso.slice(0, 10);
const pad = (n: number): string => String(n).padStart(2, '0');
const fmtDate = (iso: string): string => {
  const d = new Date(iso);
  return `${pad(d.getUTCDate())}.${pad(d.getUTCMonth() + 1)}.${d.getUTCFullYear()}`;
};

const input: React.CSSProperties = {
  width: '100%',
  height: 36,
  padding: '0 10px',
  borderRadius: 8,
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  fontSize: 14,
  boxSizing: 'border-box',
};
const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  color: 'var(--gd-ink-muted)',
  margin: '8px 0 4px',
};
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '10px 12px',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
};
const formCard: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 12,
  marginBottom: 12,
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
  background: 'var(--gd-surface-alt)',
};
