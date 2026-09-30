import type React from 'react';
import { useState } from 'react';
import { Link, useSearchParams } from 'react-router-dom';
import { t } from '@gd/ui';
import { useResetPassword } from '../api/auth.js';
import {
  wrap,
  card,
  inputStyle,
  labelStyle,
  errStyle,
  btnStyle,
  linkStyle,
  okStyle,
} from './authStyles.js';

/** H4 — поставување нова лозинка преку токен од email линкот (`?token=`). */
export function ResetPassword() {
  const [params] = useSearchParams();
  const token = params.get('token') ?? '';
  const reset = useResetPassword();
  const [password, setPassword] = useState('');
  const [confirm, setConfirm] = useState('');
  const [err, setErr] = useState<string | null>(null);

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    setErr(null);
    if (!token) return setErr(t('login.missingToken'));
    if (password.length < 8) return setErr(t('login.passwordMin'));
    if (password !== confirm) return setErr(t('login.mismatch'));
    reset.mutate({ token, password });
  };

  return (
    <div style={wrap}>
      <form onSubmit={submit} style={card}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t('login.resetTitle')}</h1>
        {reset.isSuccess ? (
          <>
            <p style={okStyle}>{t('login.resetDone')}</p>
            <Link to="/" style={linkStyle}>
              {t('login.backToLogin')}
            </Link>
          </>
        ) : (
          <>
            <p style={okStyle}>{t('login.resetHint')}</p>
            <label style={labelStyle}>
              {t('login.newPassword')}
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
            </label>
            <label style={labelStyle}>
              {t('login.confirmPassword')}
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                style={inputStyle}
                autoComplete="new-password"
              />
            </label>
            {err && <span style={errStyle}>{err}</span>}
            {reset.isError && <span style={errStyle}>{t('login.resetInvalid')}</span>}
            <button type="submit" disabled={reset.isPending} style={btnStyle}>
              {reset.isPending ? t('login.resetting') : t('login.resetSubmit')}
            </button>
            <Link to="/" style={linkStyle}>
              {t('login.backToLogin')}
            </Link>
          </>
        )}
      </form>
    </div>
  );
}
