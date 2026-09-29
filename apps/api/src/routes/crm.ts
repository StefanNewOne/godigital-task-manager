import { Router } from 'express';
import type { Request, Router as ExpressRouter } from 'express';
import {
  crmDocUploadSchema,
  crmLeadCreateSchema,
  crmMeetingSchema,
  crmPackageSchema,
  crmPlanPutSchema,
  crmReassignSchema,
  crmTeamSchema,
  crmTransitionSchema,
} from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { parse } from '../lib/validate.js';
import { requireAuth, requireScreen } from '../middleware/auth.js';
import { transitionLead } from '../services/crm/transitionLead.js';
import {
  createLead,
  getLead,
  listLeads,
  meetingNoShow,
  reassignAgent,
  setContentPlan,
  updateMeeting,
  updatePackage,
  updateTeam,
  uploadDoc,
} from '../services/crm/leads.js';

/** Модул 2 · Продажен CRM. Mounted at /crm. Гледаат само `sales` и `dir` (requireScreen). */
export const crmRouter: ExpressRouter = Router();
crmRouter.use(requireAuth, requireScreen('crm'));

function actorOf(req: Request) {
  return { id: req.auth!.sub, role: req.auth!.role };
}

// Продажни агенти (за Директор: филтер по агент + доделување лид).
crmRouter.get('/agents', async (_req, res) => {
  const agents = await prisma.employee.findMany({
    where: { role: 'sales', active: true },
    select: { id: true, name: true, color: true },
    orderBy: { name: 'asc' },
  });
  res.json({ data: agents });
});

crmRouter.get('/leads', async (req, res) => {
  const { filter, agentId } = req.query as Record<string, string | undefined>;
  const data = await listLeads(actorOf(req), { filter, agentId });
  res.json({ data });
});

crmRouter.post('/leads', async (req, res) => {
  const input = parse(crmLeadCreateSchema, req.body);
  const lead = await createLead(input, actorOf(req));
  res.status(201).json({ data: lead });
});

crmRouter.get('/leads/:id', async (req, res) => {
  const lead = await getLead((req.params as { id: string }).id, actorOf(req));
  res.json({ data: lead });
});

crmRouter.post('/leads/:id/transition', async (req, res) => {
  const { to, payload } = parse(crmTransitionSchema, req.body);
  const lead = await transitionLead(
    (req.params as { id: string }).id,
    to,
    payload ?? {},
    actorOf(req),
  );
  res.json({ data: lead });
});

crmRouter.post('/leads/:id/docs', async (req, res) => {
  const input = parse(crmDocUploadSchema, req.body);
  const lead = await uploadDoc((req.params as { id: string }).id, input, actorOf(req));
  res.status(201).json({ data: lead });
});

crmRouter.put('/leads/:id/meeting', async (req, res) => {
  const input = parse(crmMeetingSchema, req.body);
  const lead = await updateMeeting((req.params as { id: string }).id, input, actorOf(req));
  res.json({ data: lead });
});

crmRouter.post('/leads/:id/meeting/no-show', async (req, res) => {
  const lead = await meetingNoShow((req.params as { id: string }).id, actorOf(req));
  res.json({ data: lead });
});

crmRouter.put('/leads/:id/package', async (req, res) => {
  const input = parse(crmPackageSchema, req.body);
  const lead = await updatePackage((req.params as { id: string }).id, input, actorOf(req));
  res.json({ data: lead });
});

crmRouter.put('/leads/:id/plan', async (req, res) => {
  const input = parse(crmPlanPutSchema, req.body);
  const lead = await setContentPlan((req.params as { id: string }).id, input, actorOf(req));
  res.json({ data: lead });
});

crmRouter.put('/leads/:id/team', async (req, res) => {
  const input = parse(crmTeamSchema, req.body);
  const lead = await updateTeam((req.params as { id: string }).id, input, actorOf(req));
  res.json({ data: lead });
});

crmRouter.put('/leads/:id/agent', async (req, res) => {
  const { agentId } = parse(crmReassignSchema, req.body);
  const lead = await reassignAgent((req.params as { id: string }).id, agentId, actorOf(req));
  res.json({ data: lead });
});
