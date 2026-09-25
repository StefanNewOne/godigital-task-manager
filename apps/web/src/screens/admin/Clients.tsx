import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  clientContactCreateSchema,
  clientCreateSchema,
  clientUpdateSchema,
  type ClientContactCreateInput,
  type ClientCreateInput,
} from '@gd/core';
import { Button, Modal } from '@gd/ui';
import {
  useClientContacts,
  useClients,
  useCreateClient,
  useCreateContact,
  useUpdateClient,
  useUpdateContact,
} from '../../api/admin.js';
import { ApiRequestError } from '../../lib/api.js';
import type { ClientRow } from '../../lib/types.js';

const CHANNELS = [
  { v: 'viber', l: 'Viber' },
  { v: 'whatsapp', l: 'WhatsApp' },
  { v: 'email', l: 'Мејл' },
];
const CALENDARS = [
  { v: 'standarden', l: 'Стандарден' },
  { v: 'specificen', l: 'Специфичен' },
];

export function AdminClients() {
  const { data, isLoading } = useClients();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<ClientRow | null>(null);

  return (
    <div>
      <div style={{ ...headerRow, justifyContent: 'flex-end' }}>
        <Button variant="primary" size="form" onClick={() => setCreating(true)}>
          + Нов клиент
        </Button>
      </div>

      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}

      <div style={grid}>
        {(data ?? []).map((c) => (
          <div key={c.id} style={{ ...card, borderLeft: `4px solid ${c.color}` }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 8 }}>
              <span style={{ width: 8, height: 8, borderRadius: '50%', background: c.color }} />
              <strong style={{ fontSize: 16 }}>{c.name}</strong>
              <span style={activeBadge}>{c.status === 'aktiven' ? 'Активен' : c.status}</span>
            </div>
            <dl style={cardMeta}>
              <dt style={dt}>Видео/мес</dt>
              <dd style={dd}>{c.videosPerMonth}</dd>
              <dt style={dt}>Графика/мес</dt>
              <dd style={dd}>{c.graphicsPerMonth}</dd>
              <dt style={dt}>Канал</dt>
              <dd style={dd}>
                {CHANNELS.find((x) => x.v === c.approvalChannel)?.l ?? c.approvalChannel}
              </dd>
              <dt style={dt}>Meta Ads</dt>
              <dd style={dd}>{c.usesMetaAds ? 'Да' : '—'}</dd>
              <dt style={dt}>Календар</dt>
              <dd style={dd}>
                {CALENDARS.find((x) => x.v === c.calendarType)?.l ?? c.calendarType}
              </dd>
            </dl>
            <div style={{ marginTop: 12 }}>
              <Button variant="ghost" size="toolbar" onClick={() => setEditing(c)}>
                Уреди
              </Button>
            </div>
          </div>
        ))}
      </div>

      {creating && <ClientModal onClose={() => setCreating(false)} />}
      {editing && <ClientModal client={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function ClientModal({ client, onClose }: { client?: ClientRow; onClose: () => void }) {
  const isEdit = !!client;
  const create = useCreateClient();
  const update = useUpdateClient(client?.id ?? '');
  const [toast, setToast] = useState<string | null>(null);

  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<ClientCreateInput>({
    resolver: zodResolver(isEdit ? clientUpdateSchema : clientCreateSchema),
    defaultValues: client
      ? {
          name: client.name,
          color: client.color,
          videosPerMonth: client.videosPerMonth,
          graphicsPerMonth: client.graphicsPerMonth,
          usesMetaAds: client.usesMetaAds,
          metaAdAccountId: client.metaAdAccountId ?? undefined,
          metaPageId: client.metaPageId ?? undefined,
          metaIgId: client.metaIgId ?? undefined,
          calendarType: client.calendarType as ClientCreateInput['calendarType'],
          approvalChannel: client.approvalChannel as ClientCreateInput['approvalChannel'],
          coverageAlarmDays: client.coverageAlarmDays,
        }
      : {
          color: '#0D9488',
          videosPerMonth: 0,
          graphicsPerMonth: 0,
          coverageAlarmDays: 7,
          usesMetaAds: false,
          calendarType: 'standarden',
          approvalChannel: 'viber',
        },
  });

  const watchMeta = watch('usesMetaAds');
  const pending = create.isPending || update.isPending;
  const onSubmit = (values: ClientCreateInput) => {
    // На уредување не праќај празни опциони полиња — инаку PATCH ги презапишува
    // постоечките вредности (пр. legalName/notes што не се во list payload-от) со празно.
    const payload = isEdit
      ? (Object.fromEntries(
          Object.entries(values).filter(([, v]) => v !== '' && v !== undefined && v !== null),
        ) as ClientCreateInput)
      : values;
    const mut = isEdit ? update : create;
    mut.mutate(payload, {
      onSuccess: () => onClose(),
      onError: (e) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
    });
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Уреди · ${client!.name}` : 'Нов клиент'}
      width={isEdit ? 560 : 480}
      footer={
        <>
          <Button variant="ghost" size="form" onClick={onClose}>
            Откажи
          </Button>
          <Button variant="primary" size="form" disabled={pending} onClick={handleSubmit(onSubmit)}>
            {pending ? 'Се зачувува…' : 'Зачувај'}
          </Button>
        </>
      }
    >
      <form onSubmit={handleSubmit(onSubmit)} style={form}>
        <Field label="Име" error={errors.name?.message}>
          <input className={fieldCls(!!errors.name)} {...register('name')} />
        </Field>
        <Field label="Правно име (по потреба)" error={errors.legalName?.message}>
          <input className={fieldCls(!!errors.legalName)} {...register('legalName')} />
        </Field>
        <div style={twoCol}>
          <Field label="Боја" error={errors.color?.message}>
            <input
              type="color"
              className={fieldCls(false)}
              style={{ padding: 2 }}
              {...register('color')}
            />
          </Field>
          <Field label="Аларм покриеност (дена)" error={errors.coverageAlarmDays?.message}>
            <input
              type="number"
              className={fieldCls(!!errors.coverageAlarmDays)}
              {...register('coverageAlarmDays', { valueAsNumber: true })}
            />
          </Field>
        </div>
        {!isEdit && (
          <div style={twoCol}>
            <Field label="Почеток на договор" error={errors.contractStart?.message}>
              <input
                type="date"
                className={fieldCls(!!errors.contractStart)}
                {...register('contractStart')}
              />
            </Field>
            <Field label="Времетраење (месеци)" error={errors.contractMonths?.message}>
              <input
                type="number"
                className={fieldCls(!!errors.contractMonths)}
                {...register('contractMonths', { valueAsNumber: true })}
              />
            </Field>
          </div>
        )}
        <div style={twoCol}>
          <Field label="Видео/мес" error={errors.videosPerMonth?.message}>
            <input
              type="number"
              className={fieldCls(!!errors.videosPerMonth)}
              {...register('videosPerMonth', { valueAsNumber: true })}
            />
          </Field>
          <Field label="Графика/мес" error={errors.graphicsPerMonth?.message}>
            <input
              type="number"
              className={fieldCls(!!errors.graphicsPerMonth)}
              {...register('graphicsPerMonth', { valueAsNumber: true })}
            />
          </Field>
        </div>
        <div style={twoCol}>
          <Field label="Календар" error={errors.calendarType?.message}>
            <select className={fieldCls(false)} {...register('calendarType')}>
              {CALENDARS.map((x) => (
                <option key={x.v} value={x.v}>
                  {x.l}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Канал за одобрување" error={errors.approvalChannel?.message}>
            <select className={fieldCls(false)} {...register('approvalChannel')}>
              {CHANNELS.map((x) => (
                <option key={x.v} value={x.v}>
                  {x.l}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <label style={checkRow}>
          <input type="checkbox" {...register('usesMetaAds')} /> Користи Meta Ads
        </label>
        {watchMeta && (
          <div style={{ display: 'grid', gap: 8 }}>
            <Field label="Meta Ad Account ID" error={errors.metaAdAccountId?.message}>
              <input
                className={fieldCls(false)}
                placeholder="act_..."
                {...register('metaAdAccountId')}
              />
            </Field>
            <Field label="Facebook Page ID" error={errors.metaPageId?.message}>
              <input className={fieldCls(false)} {...register('metaPageId')} />
            </Field>
            <Field label="Instagram ID" error={errors.metaIgId?.message}>
              <input className={fieldCls(false)} {...register('metaIgId')} />
            </Field>
          </div>
        )}
        <Field label="Белешки (по потреба)" error={errors.notes?.message}>
          <textarea className={fieldCls(false)} rows={2} {...register('notes')} />
        </Field>
      </form>

      {isEdit && <ContactsSection clientId={client!.id} />}
      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </Modal>
  );
}

function ContactsSection({ clientId }: { clientId: string }) {
  const { data: contacts } = useClientContacts(clientId);
  const createContact = useCreateContact(clientId);
  const updateContact = useUpdateContact(clientId);
  const {
    register,
    handleSubmit,
    reset,
    formState: { errors },
  } = useForm<ClientContactCreateInput>({ resolver: zodResolver(clientContactCreateSchema) });

  const onAdd = (v: ClientContactCreateInput) =>
    createContact.mutate(v, { onSuccess: () => reset() });

  return (
    <div style={{ marginTop: 20, borderTop: '1px solid var(--gd-border)', paddingTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, margin: '0 0 8px' }}>Контакти</h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6, marginBottom: 12 }}>
        {(contacts ?? [])
          .filter((c) => !c.archivedAt)
          .map((c) => (
            <div key={c.id} style={contactRow}>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 500, fontSize: 13 }}>
                  {c.name}
                  {c.roleAtClient ? ` · ${c.roleAtClient}` : ''}
                </div>
                <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>
                  {[c.phone, c.email].filter(Boolean).join(' · ') || '—'}
                </div>
              </div>
              <label style={{ fontSize: 12, display: 'flex', alignItems: 'center', gap: 4 }}>
                <input
                  type="checkbox"
                  checked={c.isApprover}
                  onChange={(e) =>
                    updateContact.mutate({ contactId: c.id, isApprover: e.target.checked })
                  }
                />
                одобрувач
              </label>
            </div>
          ))}
        {(contacts ?? []).filter((c) => !c.archivedAt).length === 0 && (
          <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>Нема контакти.</div>
        )}
      </div>
      <div style={twoCol}>
        <input className={fieldCls(!!errors.name)} placeholder="Име" {...register('name')} />
        <input
          className={fieldCls(false)}
          placeholder="Улога кај клиент"
          {...register('roleAtClient')}
        />
      </div>
      <div style={{ ...twoCol, marginTop: 8 }}>
        <input className={fieldCls(false)} placeholder="Телефон" {...register('phone')} />
        <input className={fieldCls(!!errors.email)} placeholder="Мејл" {...register('email')} />
      </div>
      <div style={{ marginTop: 8 }}>
        <Button
          variant="secondary"
          size="toolbar"
          disabled={createContact.isPending}
          onClick={handleSubmit(onAdd)}
        >
          + Додади контакт
        </Button>
      </div>
    </div>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: React.ReactNode;
}) {
  return (
    <label style={{ display: 'block' }}>
      <span style={fieldLabel}>{label}</span>
      {children}
      {error && <span style={errStyle}>{error}</span>}
    </label>
  );
}

const fieldCls = (err: boolean) => (err ? 'gd-field gd-field--error' : 'gd-field');

const headerRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  marginBottom: 20,
};
const grid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: 'repeat(auto-fill, minmax(340px, 1fr))',
  gap: 16,
};
const card: React.CSSProperties = {
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  background: 'var(--gd-surface)',
  padding: 16,
};
const activeBadge: React.CSSProperties = {
  marginLeft: 'auto',
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--gd-success-text)',
  background: 'rgba(22,163,74,.1)',
  borderRadius: 4,
  padding: '2px 6px',
};
const cardMeta: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '110px 1fr',
  rowGap: 4,
  margin: 0,
  fontSize: 13,
};
const dt: React.CSSProperties = { color: 'var(--gd-ink-muted)' };
const dd: React.CSSProperties = { margin: 0 };
const form: React.CSSProperties = { display: 'flex', flexDirection: 'column', gap: 12 };
const twoCol: React.CSSProperties = { display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 };
const fieldLabel: React.CSSProperties = {
  display: 'block',
  fontSize: 12,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  marginBottom: 4,
};
const checkRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  fontSize: 14,
};
const errStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 4,
  color: 'var(--gd-danger-text)',
  fontSize: 12,
};
const contactRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 8,
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
  padding: '6px 10px',
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
  zIndex: 200,
};
