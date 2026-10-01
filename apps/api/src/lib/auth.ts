import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import type { Role } from '@gd/core';
import { env } from '../env.js';

export interface JwtPayload {
  sub: string; // employeeId
  tenantId: string;
  role: Role;
}

/** Клиентски PWA сесија (Фаза D) — ОДДЕЛЕН realm; никогаш employee права. */
export interface ClientJwtPayload {
  sub: string; // clientContactId
  tenantId: string;
  clientId: string;
  realm: 'client';
}

const CLIENT_SESSION_TTL = '2h'; // кратка клиентска сесија

export function hashPassword(plain: string): Promise<string> {
  return bcrypt.hash(plain, 10);
}

export function verifyPassword(plain: string, hash: string): Promise<boolean> {
  return bcrypt.compare(plain, hash);
}

export function signAccessToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_ACCESS_SECRET, {
    expiresIn: env.JWT_ACCESS_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function signRefreshToken(payload: JwtPayload): string {
  return jwt.sign(payload, env.JWT_REFRESH_SECRET, {
    expiresIn: env.JWT_REFRESH_TTL as jwt.SignOptions['expiresIn'],
  });
}

export function verifyAccessToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_ACCESS_SECRET) as JwtPayload;
}

export function verifyRefreshToken(token: string): JwtPayload {
  return jwt.verify(token, env.JWT_REFRESH_SECRET) as JwtPayload;
}

export function signClientToken(payload: Omit<ClientJwtPayload, 'realm'>): string {
  return jwt.sign({ ...payload, realm: 'client' }, env.JWT_ACCESS_SECRET, {
    expiresIn: CLIENT_SESSION_TTL,
  });
}

export function verifyClientToken(token: string): ClientJwtPayload {
  const p = jwt.verify(token, env.JWT_ACCESS_SECRET) as ClientJwtPayload;
  if (p.realm !== 'client') throw new Error('WRONG_REALM');
  return p;
}
