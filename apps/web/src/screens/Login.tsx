import type React from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { loginSchema, type LoginInput } from '@gd/core';
import { ApiRequestError } from '../lib/api.js';
import { useLogin } from '../api/auth.js';

export function Login() {
  const login = useLogin();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<LoginInput>({ resolver: zodResolver(loginSchema) });

  const onSubmit = (data: LoginInput) => login.mutate(data);
  const serverError = login.error instanceof ApiRequestError ? login.error.message : null;

  return (
    <div
      style={{
        display: 'flex',
        minHeight: '100vh',
        alignItems: 'center',
        justifyContent: 'center',
        background: 'var(--gd-surface-alt)',
      }}
    >
      <form
        onSubmit={handleSubmit(onSubmit)}
        style={{
          width: 360,
          background: 'var(--gd-surface)',
          border: '1px solid var(--gd-border)',
          borderRadius: 'var(--gd-radius-card)',
          padding: 24,
          display: 'flex',
          flexDirection: 'column',
          gap: 16,
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          <span
            style={{
              width: 32,
              height: 32,
              borderRadius: 8,
              background: '#0866FF',
              color: '#fff',
              fontSize: 12,
              fontWeight: 700,
              display: 'grid',
              placeItems: 'center',
            }}
            aria-hidden
          >
            GD
          </span>
          <h1 style={{ fontSize: 20, fontWeight: 600, margin: 0 }}>GoDigital Таск-менаџер</h1>
        </div>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gd-ink-muted)' }}>
          Е-мејл
          <input type="email" {...register('email')} style={inputStyle} autoComplete="username" />
          {errors.email && <span style={errStyle}>{errors.email.message}</span>}
        </label>
        <label style={{ fontSize: 12, fontWeight: 500, color: 'var(--gd-ink-muted)' }}>
          Лозинка
          <input
            type="password"
            {...register('password')}
            style={inputStyle}
            autoComplete="current-password"
          />
          {errors.password && <span style={errStyle}>{errors.password.message}</span>}
        </label>
        {serverError && <span style={errStyle}>{serverError}</span>}
        <button type="submit" disabled={login.isPending} style={btnStyle}>
          {login.isPending ? 'Најавување…' : 'Најави се'}
        </button>
      </form>
    </div>
  );
}

const inputStyle: React.CSSProperties = {
  display: 'block',
  width: '100%',
  height: 36,
  marginTop: 4,
  padding: '0 10px',
  border: '1px solid var(--gd-border)',
  borderRadius: 'var(--gd-radius-field)',
  fontSize: 14,
  boxSizing: 'border-box',
};

const errStyle: React.CSSProperties = {
  display: 'block',
  marginTop: 4,
  color: 'var(--gd-danger-text)',
  fontSize: 12,
  fontWeight: 400,
};

const btnStyle: React.CSSProperties = {
  height: 36,
  background: 'var(--gd-primary)',
  color: '#fff',
  border: 'none',
  borderRadius: 'var(--gd-radius-button)',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};
