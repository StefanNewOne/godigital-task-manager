import type React from 'react';
import { useState } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import {
  ROLES,
  ROLE_LABEL,
  employeeCreateSchema,
  employeeUpdateSchema,
  type EmployeeCreateInput,
} from '@gd/core';
import { Button, Modal } from '@gd/ui';
import { useCreateEmployee, useEmployees, useUpdateEmployee } from '../../api/admin.js';
import { ApiRequestError } from '../../lib/api.js';
import { tableStyles as s } from '../../components/table.js';
import type { EmployeeRow } from '../../lib/types.js';

export function AdminEmployees() {
  const { data, isLoading } = useEmployees();
  const [creating, setCreating] = useState(false);
  const [editing, setEditing] = useState<EmployeeRow | null>(null);

  return (
    <div>
      <div style={headerRow}>
        <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>Вработени и улоги</h1>
        <Button variant="primary" size="form" onClick={() => setCreating(true)}>
          + Нов вработен
        </Button>
      </div>

      {isLoading && <p style={{ color: 'var(--gd-ink-muted)' }}>Вчитување…</p>}

      {data && (
        <div style={s.wrap}>
          <table style={s.table}>
            <thead>
              <tr>
                <th style={s.th}>Име и е-мејл</th>
                <th style={s.th}>Улога</th>
                <th style={s.th}>Статус</th>
                <th style={s.th}>Последна активност</th>
                <th style={{ ...s.th, textAlign: 'right' }}></th>
              </tr>
            </thead>
            <tbody>
              {data.map((e) => (
                <tr key={e.id}>
                  <td style={s.td}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                      <span
                        style={{ width: 8, height: 8, borderRadius: '50%', background: e.color }}
                      />
                      <div>
                        <div style={{ fontWeight: 500 }}>{e.name}</div>
                        <div style={{ fontSize: 13, color: 'var(--gd-ink-muted)' }}>{e.email}</div>
                      </div>
                    </div>
                  </td>
                  <td style={s.td}>
                    {ROLE_LABEL[e.role]}
                    {e.isScenaristToo ? ' (+ сценарист)' : ''}
                  </td>
                  <td style={s.td}>{e.active ? 'Активен' : 'Неактивен'}</td>
                  <td style={s.td}>
                    {e.lastActiveAt ? new Date(e.lastActiveAt).toLocaleString('mk-MK') : '—'}
                  </td>
                  <td style={{ ...s.td, textAlign: 'right' }}>
                    <Button variant="ghost" size="toolbar" onClick={() => setEditing(e)}>
                      Уреди
                    </Button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      {creating && <EmployeeModal onClose={() => setCreating(false)} />}
      {editing && <EmployeeModal employee={editing} onClose={() => setEditing(null)} />}
    </div>
  );
}

function EmployeeModal({ employee, onClose }: { employee?: EmployeeRow; onClose: () => void }) {
  const isEdit = !!employee;
  const create = useCreateEmployee();
  const update = useUpdateEmployee(employee?.id ?? '');
  const [toast, setToast] = useState<string | null>(null);

  type FormValues = EmployeeCreateInput & { active?: boolean };
  const {
    register,
    handleSubmit,
    watch,
    formState: { errors },
  } = useForm<FormValues>({
    resolver: zodResolver(isEdit ? employeeUpdateSchema : employeeCreateSchema),
    defaultValues: employee
      ? {
          name: employee.name,
          role: employee.role,
          color: employee.color,
          phone: employee.phone ?? undefined,
          capacityNote: employee.capacityNote ?? undefined,
          isScenaristToo: employee.isScenaristToo,
          active: employee.active,
        }
      : { role: 'diz', color: '#0EA5E9', isScenaristToo: false },
  });

  const role = watch('role');
  const pending = create.isPending || update.isPending;
  const onSubmit = (values: FormValues) => {
    const opts = {
      onSuccess: () => onClose(),
      onError: (e: unknown) => setToast(e instanceof ApiRequestError ? e.message : 'Грешка.'),
    };
    if (isEdit) update.mutate(values, opts);
    else create.mutate(values, opts);
  };

  return (
    <Modal
      open
      onClose={onClose}
      title={isEdit ? `Уреди · ${employee!.name}` : 'Нов вработен'}
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
        {!isEdit && (
          <>
            <Field label="Е-мејл" error={errors.email?.message}>
              <input className={fieldCls(!!errors.email)} type="email" {...register('email')} />
            </Field>
            <Field label="Лозинка" error={errors.password?.message}>
              <input
                className={fieldCls(!!errors.password)}
                type="password"
                {...register('password')}
              />
            </Field>
          </>
        )}
        <div style={twoCol}>
          <Field label="Улога" error={errors.role?.message}>
            <select className={fieldCls(false)} {...register('role')}>
              {ROLES.map((r) => (
                <option key={r} value={r}>
                  {ROLE_LABEL[r]}
                </option>
              ))}
            </select>
          </Field>
          <Field label="Боја" error={errors.color?.message}>
            <input
              type="color"
              className={fieldCls(false)}
              style={{ padding: 2 }}
              {...register('color')}
            />
          </Field>
        </div>
        <Field label="Телефон (по потреба)" error={errors.phone?.message}>
          <input className={fieldCls(false)} {...register('phone')} />
        </Field>
        <Field label="Белешка за капацитет (по потреба)" error={errors.capacityNote?.message}>
          <input className={fieldCls(false)} {...register('capacityNote')} />
        </Field>
        {role === 'rez' && (
          <label style={checkRow}>
            <input type="checkbox" {...register('isScenaristToo')} /> Е и сценарист
          </label>
        )}
        {isEdit && (
          <label style={checkRow}>
            <input type="checkbox" {...register('active')} /> Активен
          </label>
        )}
      </form>

      {toast && (
        <div style={toastStyle} onClick={() => setToast(null)}>
          {toast}
        </div>
      )}
    </Modal>
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
