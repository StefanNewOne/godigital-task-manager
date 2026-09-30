import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { Link } from 'react-router-dom';
import { forgotPasswordSchema, type ForgotPasswordInput } from '@gd/core';
import { t } from '@gd/ui';
import { useForgotPassword } from '../api/auth.js';
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

/** H4 — барање за ресетирање: генерички одговор (без откривање дали сметката постои). */
export function ForgotPassword() {
  const forgot = useForgotPassword();
  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<ForgotPasswordInput>({ resolver: zodResolver(forgotPasswordSchema) });

  const onSubmit = (data: ForgotPasswordInput) => forgot.mutate(data);

  return (
    <div style={wrap}>
      <form onSubmit={handleSubmit(onSubmit)} style={card}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t('login.forgotTitle')}</h1>
        {forgot.isSuccess ? (
          <p style={okStyle}>{t('login.forgotDone')}</p>
        ) : (
          <>
            <p style={okStyle}>{t('login.forgotHint')}</p>
            <label style={labelStyle}>
              {t('login.email')}
              <input
                type="email"
                {...register('email')}
                style={inputStyle}
                autoComplete="username"
              />
              {errors.email && <span style={errStyle}>{errors.email.message}</span>}
            </label>
            <button type="submit" disabled={forgot.isPending} style={btnStyle}>
              {forgot.isPending ? t('login.forgotSending') : t('login.forgotSubmit')}
            </button>
          </>
        )}
        <Link to="/" style={linkStyle}>
          {t('login.backToLogin')}
        </Link>
      </form>
    </div>
  );
}
