import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import type { Prisma } from '@gd/db';
import { prisma } from '../db/tenantExtension.js';
import { requireAuth } from '../middleware/auth.js';

/**
 * Кампањи — САМО ЧИТАЊЕ (Модул 3 · Мета, D1/D2). Огледалото на Meta кампањите го полни sync-от
 * (`services/meta`), никогаш кориснички повик. Рачно креирање/менување е отстрането (одлука на
 * сопственикот: „покажи само вистински Мета кампањи"). Промени на реклами одат преку планови (§12).
 */
export const campaignsRouter: ExpressRouter = Router();
campaignsRouter.use(requireAuth);

// Листа кампањи (опционо по клиент и/или месец на преклопување).
campaignsRouter.get('/', async (req, res) => {
  const clientId = typeof req.query.clientId === 'string' ? req.query.clientId : undefined;
  const monthRaw = req.query.month;
  const where: Prisma.CampaignWhereInput = {};
  if (clientId) where.clientId = clientId;
  if (typeof monthRaw === 'string' && /^\d{4}-\d{2}$/.test(monthRaw)) {
    const [y, m] = monthRaw.split('-').map(Number);
    where.periodFrom = { lt: new Date(Date.UTC(y!, m!, 1)) };
    where.periodTo = { gte: new Date(Date.UTC(y!, m! - 1, 1)) };
  }
  const campaigns = await prisma.campaign.findMany({
    where,
    include: { client: { select: { name: true, color: true } } },
    orderBy: { periodFrom: 'desc' },
  });
  res.json({ data: campaigns });
});
