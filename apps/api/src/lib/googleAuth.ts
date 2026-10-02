import { OAuth2Client } from 'google-auth-library';
import { env } from '../env.js';

/**
 * Верификација на Google GIS `id_token` (ADR-002). Audience-pinned на `GOOGLE_CLIENT_ID`;
 * верификацијата користи јавни клучеви на Google (нема потреба од client secret). Инјектабилно
 * за тестови преку `setGoogleVerifier`.
 */
export interface GoogleIdentity {
  email: string;
  emailVerified: boolean;
  sub: string;
  hd?: string;
  name?: string;
}

export type GoogleVerifier = (idToken: string) => Promise<GoogleIdentity>;

let client: OAuth2Client | null = null;

async function defaultVerifier(idToken: string): Promise<GoogleIdentity> {
  if (!env.GOOGLE_CLIENT_ID) throw new Error('GOOGLE_CLIENT_ID не е конфигуриран.');
  if (!client) client = new OAuth2Client(env.GOOGLE_CLIENT_ID);
  const ticket = await client.verifyIdToken({ idToken, audience: env.GOOGLE_CLIENT_ID });
  const p = ticket.getPayload();
  if (!p || !p.email) throw new Error('Невалиден Google токен.');
  return {
    email: p.email,
    emailVerified: p.email_verified === true,
    sub: p.sub,
    hd: p.hd,
    name: p.name,
  };
}

let verifier: GoogleVerifier = defaultVerifier;

export function verifyGoogleIdToken(idToken: string): Promise<GoogleIdentity> {
  return verifier(idToken);
}

/** За тестови: инјектирај/ресетирај верификатор. */
export function setGoogleVerifier(v: GoogleVerifier | null): void {
  verifier = v ?? defaultVerifier;
}
