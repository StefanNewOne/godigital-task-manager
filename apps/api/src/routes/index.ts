import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { prisma } from '../db/tenantExtension.js';
import { AppError } from '../lib/errors.js';
import { requireAuth } from '../middleware/auth.js';
import { authRouter, employeeSafeSelect } from './auth.js';
import { clientsRouter } from './clients.js';
import { calendarConfigRouter } from './calendarConfig.js';
import { employeesRouter } from './employees.js';
import { holidaysRouter } from './holidays.js';
import { clientSlotsRouter, slotsRouter } from './slots.js';
import { tasksRouter } from './tasks.js';
import { cronRouter } from './cron.js';

export const apiRouter: ExpressRouter = Router();

apiRouter.use('/auth', authRouter);

apiRouter.get('/me', requireAuth, async (req, res) => {
  const employee = await prisma.employee.findUnique({
    where: { id: req.auth!.sub },
    select: employeeSafeSelect,
  });
  if (!employee) throw new AppError('NOT_FOUND', 'Вработениот не е пронајден.', 404);
  res.json({ data: employee });
});

apiRouter.use('/clients', clientsRouter);
apiRouter.use('/clients/:id/calendar-config', calendarConfigRouter);
apiRouter.use('/clients/:id/slots', clientSlotsRouter);
apiRouter.use('/slots', slotsRouter);
apiRouter.use('/employees', employeesRouter);
apiRouter.use('/holidays', holidaysRouter);
apiRouter.use('/tasks', tasksRouter);
apiRouter.use('/cron', cronRouter);
