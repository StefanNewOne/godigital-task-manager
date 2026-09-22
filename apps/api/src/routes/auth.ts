import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { loginSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import {
  hashPassword,
  signAccessToken,
  signRefreshToken,
  verifyPassword,
  verifyRefreshToken,
} from '../lib/auth.js';

export const authRouter: ExpressRouter = Router();

export const employeeSafeSelect = {
  id: true,
  name: true,
  email: true,
  role: true,
  isScenaristToo: true,
  color: true,
  active: true,
  lastActiveAt: true,
} as const;

const accessCookie = { httpOnly: true, sameSite: 'lax', path: '/' } as const;

authRouter.post('/login', async (req, res) => {
  const { email, password } = parse(loginSchema, req.body);
  const employee = await prisma.employee.findUnique({ where: { email } });
  if (!employee || !employee.active) {
    throw new AppError('UNAUTHENTICATED', 'Погрешен е-мејл или лозинка.', 401);
  }
  const ok = await verifyPassword(password, employee.passwordHash);
  if (!ok) throw new AppError('UNAUTHENTICATED', 'Погрешен е-мејл или лозинка.', 401);

  const payload = { sub: employee.id, tenantId: employee.tenantId, role: employee.role };
  const access = signAccessToken(payload);
  const refresh = signRefreshToken(payload);

  await prisma.employee.update({
    where: { id: employee.id },
    data: { lastActiveAt: new Date() },
  });

  res
    .cookie('access_token', access, accessCookie)
    .cookie('refresh_token', refresh, { ...accessCookie, path: '/api/auth' })
    .json({
      data: {
        accessToken: access,
        employee: {
          id: employee.id,
          name: employee.name,
          email: employee.email,
          role: employee.role,
          color: employee.color,
        },
      },
    });
});

authRouter.post('/refresh', async (req, res) => {
  const token = (req.cookies as Record<string, string> | undefined)?.refresh_token;
  if (!token) throw new AppError('UNAUTHENTICATED', 'Сесијата е истечена.', 401);
  let payload;
  try {
    payload = verifyRefreshToken(token);
  } catch {
    throw new AppError('UNAUTHENTICATED', 'Сесијата е истечена.', 401);
  }
  const access = signAccessToken({
    sub: payload.sub,
    tenantId: payload.tenantId,
    role: payload.role,
  });
  res.cookie('access_token', access, accessCookie).json({ data: { accessToken: access } });
});

authRouter.post('/logout', (_req, res) => {
  res
    .clearCookie('access_token', accessCookie)
    .clearCookie('refresh_token', { ...accessCookie, path: '/api/auth' })
    .json({ data: { ok: true } });
});

// Помошна: hash за seed/тестови (не е рута).
export { hashPassword };
