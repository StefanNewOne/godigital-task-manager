import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { notificationPrefsSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { authRouter, employeeSafeSelect } from './auth.js';
import { clientsRouter } from './clients.js';
import { clientContactsRouter, contactsRouter } from './clientContacts.js';
import { calendarConfigRouter } from './calendarConfig.js';
import { employeesRouter } from './employees.js';
import { holidaysRouter } from './holidays.js';
import { clientSlotsRouter, slotsRouter } from './slots.js';
import { tasksRouter } from './tasks.js';
import { taskGroupsRouter } from './taskGroups.js';
import { scenariosRouter } from './scenarios.js';
import { publicationsRouter } from './publications.js';
import { overviewRouter } from './overview.js';
import { analyticsRouter } from './analytics.js';
import { campaignsRouter } from './campaigns.js';
import { reportsRouter } from './reports.js';
import { knowledgeRouter } from './knowledge.js';
import { filesRouter } from './files.js';
import { notificationsRouter } from './notifications.js';
import { automationRulesRouter, automationRunsRouter } from './automation.js';
import { monthlyPlanRouter } from './monthlyPlan.js';
import { cronRouter } from './cron.js';

export const apiRouter: ExpressRouter = Router();

apiRouter.use('/auth', authRouter);

apiRouter.get('/me', requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.auth!.sub },
    select: { ...employeeSafeSelect, notificationPrefs: true },
  });
  if (!employee) throw new AppError('NOT_FOUND', 'Вработениот не е пронајден.', 404);
  res.json({ data: employee });
});

// Поставки за известувања (§13: вработен може да ги исклучи потсетниците).
apiRouter.patch('/me/notification-prefs', requireAuth, async (req, res) => {
  const input = parse(notificationPrefsSchema, req.body);
  await prisma.employee.update({
    where: { id: req.auth!.sub },
    data: { notificationPrefs: { reminders: input.reminders } },
  });
  res.json({ data: { reminders: input.reminders } });
});

apiRouter.use('/clients', clientsRouter);
apiRouter.use('/clients/:id/contacts', clientContactsRouter);
apiRouter.use('/contacts', contactsRouter);
apiRouter.use('/clients/:id/calendar-config', calendarConfigRouter);
apiRouter.use('/clients/:id/slots', clientSlotsRouter);
apiRouter.use('/slots', slotsRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/holidays', holidaysRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/task-groups', taskGroupsRouter);
apiRouter.use('/scenarios', scenariosRouter);
apiRouter.use('/publications', publicationsRouter);
apiRouter.use('/overview', overviewRouter);
apiRouter.use('/analytics', analyticsRouter);
apiRouter.use('/campaigns', campaignsRouter);
apiRouter.use('/reports', reportsRouter);
apiRouter.use('/knowledge', knowledgeRouter);
apiRouter.use('/files', filesRouter);
apiRouter.use('/notifications', notificationsRouter);
apiRouter.use('/automation-rules', automationRulesRouter);
apiRouter.use('/automation-runs', automationRunsRouter);
apiRouter.use('/monthly-plan', monthlyPlanRouter);
apiRouter.use('/cron', cronRouter);
