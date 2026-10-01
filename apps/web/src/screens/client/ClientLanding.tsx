import { useEffect, useRef } from 'react';
import { useForm } from 'react-hook-form';
import { zodResolver } from '@hookform/resolvers/zod';
import { useNavigate, useSearchParams } from 'react-router-dom';
import { magicLinkRequestSchema, type MagicLinkRequestInput } from '@gd/core';
import { t } from '@gd/ui';
import { useConsumeMagicLink, useRequestMagicLink } from '../../api/client.js';
import { wrap, card, inputStyle, labelStyle, errStyle, btnStyle, okStyle } from '../authStyles.js';

/**
 * Клиентски вход (Фаза D). Со `?token` → автоматски троши magic-link и влегува; инаку бара е-мејл
 * за нов линк (генерички одговор, без enumeration).
 */
export function ClientLanding() {
  const [params] = useSearchParams();
  const token = params.get('token');
  const navigate = useNavigate();
  const consume = useConsumeMagicLink();
  const request = useRequestMagicLink();

  const consumeMut = consume.mutate;
  const triedRef = useRef(false);
  useEffect(() => {
    if (token && !triedRef.current) {
      triedRef.current = true;
      consumeMut({ token }, { onSuccess: () => navigate('/client/approvals', { replace: true }) });
    }
  }, [token, consumeMut, navigate]);

  const {
    register,
    handleSubmit,
    formState: { errors },
  } = useForm<MagicLinkRequestInput>({ resolver: zodResolver(magicLinkRequestSchema) });

  // Фаза на верификација на токен.
  if (token && (consume.isPending || consume.isIdle)) {
    return (
      <div style={wrap}>
        <div style={card}>
          <p style={okStyle}>{t('client.landing.verifying')}</p>
        </div>
      </div>
    );
  }

  const showInvalid = !!token && consume.isError;

  return (
    <div style={wrap}>
      <form onSubmit={handleSubmit((d) => request.mutate(d))} style={card}>
        <h1 style={{ fontSize: 18, fontWeight: 600, margin: 0 }}>{t('client.landing.title')}</h1>
        {showInvalid && <p style={errStyle}>{t('client.landing.invalid')}</p>}
        {request.isSuccess ? (
          <p style={okStyle}>{t('client.landing.sent')}</p>
        ) : (
          <>
            <p style={okStyle}>{t('client.landing.hint')}</p>
            <label style={labelStyle}>
              {t('client.landing.email')}
              <input
                type="email"
                {...register('email')}
                style={inputStyle}
                autoComplete="username"
              />
              {errors.email && <span style={errStyle}>{errors.email.message}</span>}
            </label>
            <button type="submit" disabled={request.isPending} style={btnStyle}>
              {request.isPending ? t('client.landing.sending') : t('client.landing.submit')}
            </button>
          </>
        )}
      </form>
    </div>
  );
}
