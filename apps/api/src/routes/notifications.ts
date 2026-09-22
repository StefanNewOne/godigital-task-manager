import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';

export const notificationsRouter: ExpressRouter = Router();
notificationsRouter.use(requireAuth);

notificationsRouter.get('/', async (req, res) => {
  const unread = req.query.unread === '1' || req.query.unread === 'true';
  const items = await prisma.notification.findMany({
    where: { recipientId: req.auth!.sub, ...(unread ? { readAt: null } : {}) },
    orderBy: { createdAt: 'desc' },
    take: 100,
  });
  res.json({ data: items });
});

notificationsRouter.post('/:id/read', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const n = await prisma.notification.findUnique({ where: { id } });
  if (!n || n.recipientId !== req.auth!.sub) {
    throw new AppError('NOT_FOUND', 'Известувањето не е пронајдено.', 404);
  }
  const updated = await prisma.notification.update({ where: { id }, data: { readAt: new Date() } });
  res.json({ data: updated });
});
