import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import type { Prisma } from '@gd/db';
import { campaignCreateSchema, campaignUpdateSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { recordEvent } from '../lib/events.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';

export const campaignsRouter: ExpressRouter = Router();
campaignsRouter.use(requireAuth);

/** Кампањите ги управува Аналитичарот (плюс Директор, D-5). */
function requireAnalyst(role: string): void {
  if (role !== 'ana' && role !== 'dir') {
    throw new AppError('FORBIDDEN_ROLE', 'Само Аналитичар може да управува со кампањи.', 403);
  }
}

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

campaignsRouter.post('/', async (req, res) => {
  requireAnalyst(req.auth!.role);
  const input = parse(campaignCreateSchema, req.body);
  const campaign = await prisma.$transaction(async (tx) => {
    const c = await tx.campaign.create({ data: { ...input, analystId: req.auth!.sub } });
    await recordEvent(tx, {
      eventType: 'campaign.created',
      objectType: 'campaign',
      objectId: c.id,
      clientId: c.clientId,
      narrative: `Креирана кампања „${c.name}" (буџет ${input.budget} €).`,
    });
    return c;
  });
  res.status(201).json({ data: campaign });
});

campaignsRouter.patch('/:id', async (req, res) => {
  requireAnalyst(req.auth!.role);
  const id = (req.params as { id: string }).id;
  const input = parse(campaignUpdateSchema, req.body);
  const existing = await prisma.campaign.findUnique({ where: { id } });
  if (!existing) throw new AppError('NOT_FOUND', 'Кампањата не е пронајдена.', 404);
  const campaign = await prisma.$transaction(async (tx) => {
    const c = await tx.campaign.update({ where: { id }, data: input });
    await recordEvent(tx, {
      eventType: 'campaign.updated',
      objectType: 'campaign',
      objectId: id,
      clientId: c.clientId,
      narrative: `Ажурирана кампања „${c.name}".`,
    });
    return c;
  });
  res.json({ data: campaign });
});
