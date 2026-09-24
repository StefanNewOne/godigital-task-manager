import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { fileCompleteSchema, filePresignSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import { assertFileOwnerAccess } from '../services/fileAccess.js';
import { transitionTaskGroup } from '../services/workflow/groupTransition.js';
import type { FileKind, FileOwnerType } from '@gd/db';
import type { Role } from '@gd/core';

/**
 * #7: суров материјал качен на видео капа во статус „snimanje" ја затвора капата автоматски
 * (matrix note: „При прикачување суров материјал капата→zatvoren"). Системски преод (kam/dir).
 * Best-effort: ако guard-от сè уште не поминува, тивко прескокнува.
 */
async function maybeCloseCapaOnRaw(
  ownerType: FileOwnerType,
  ownerId: string,
  kind: FileKind,
  actor: { sub: string; role: Role },
): Promise<void> {
  if (ownerType !== 'group' || kind !== 'raw') return;
  const group = await prisma.taskGroup.findUnique({
    where: { id: ownerId },
    select: { status: true },
  });
  if (group?.status !== 'snimanje') return;
  await transitionTaskGroup(ownerId, 'zatvoren', {}, { id: actor.sub, role: actor.role }).catch(
    () => undefined,
  );
}
import {
  PART_SIZE,
  abortMultipart,
  completeMultipart,
  createMultipart,
  partCount,
  presignGet,
  presignPut,
  presignUploadPart,
} from '../lib/storage.js';

export const filesRouter: ExpressRouter = Router();
filesRouter.use(requireAuth);

const OWNER_TYPES = ['group', 'task', 'revision', 'approval', 'comment'] as const;

// Листа на активни фајлови за сопственик (A6) + presigned GET за преглед/симнување.
filesRouter.get('/', async (req, res) => {
  const ownerType = typeof req.query.ownerType === 'string' ? req.query.ownerType : undefined;
  const ownerId = typeof req.query.ownerId === 'string' ? req.query.ownerId : undefined;
  if (!ownerType || !OWNER_TYPES.includes(ownerType as (typeof OWNER_TYPES)[number]) || !ownerId) {
    throw new AppError('VALIDATION_FAILED', 'ownerType и ownerId се задолжителни.', 400);
  }
  await assertFileOwnerAccess(ownerType as FileOwnerType, ownerId, req.auth!, 'read');
  const files = await prisma.fileAsset.findMany({
    where: { ownerType: ownerType as FileOwnerType, ownerId, lifecycle: 'active' },
    orderBy: [{ version: 'asc' }, { createdAt: 'asc' }],
  });
  const data = await Promise.all(
    files.map(async (f) => ({
      id: f.id,
      kind: f.kind,
      mime: f.mime,
      size: f.size.toString(),
      version: f.version,
      createdAt: f.createdAt,
      url: await presignGet(f.r2Key),
    })),
  );
  res.json({ data });
});

// Presign upload (PRD §4.14): мал фајл → еднократен PUT; голем → multipart со UploadSession.
filesRouter.post('/presign', async (req, res) => {
  const input = parse(filePresignSchema, req.body);
  await assertFileOwnerAccess(input.ownerType, input.ownerId, req.auth!, 'write');
  const fileId = randomUUID();
  const key = `${env.DEFAULT_TENANT_ID}/${input.ownerType}/${input.ownerId}/${fileId}`;

  const file = await prisma.fileAsset.create({
    data: {
      id: fileId,
      ownerType: input.ownerType,
      ownerId: input.ownerId,
      kind: input.kind,
      r2Key: key,
      size: BigInt(input.size),
      mime: input.mime,
      lifecycle: 'active',
      uploadedById: req.auth!.sub,
    },
  });

  if (input.size <= PART_SIZE) {
    const url = await presignPut(key, input.mime);
    // Мал суров материјал (single PUT) нема /complete callback → авто-затворање тука (#7).
    await maybeCloseCapaOnRaw(input.ownerType, input.ownerId, input.kind, req.auth!);
    res.status(201).json({ data: { fileId: file.id, mode: 'single', url } });
    return;
  }

  // Multipart (multi-GB суров материјал; продолжување по прекин преку UploadSession).
  const uploadId = await createMultipart(key, input.mime);
  const n = partCount(input.size);
  const parts = await Promise.all(
    Array.from({ length: n }, (_, i) =>
      presignUploadPart(key, uploadId, i + 1).then((url) => ({ partNumber: i + 1, url })),
    ),
  );
  const expiresAt = new Date();
  expiresAt.setUTCHours(expiresAt.getUTCHours() + 24);
  await prisma.uploadSession.create({
    data: { fileAssetId: file.id, r2UploadId: uploadId, parts: [], status: 'open', expiresAt },
  });
  res.status(201).json({
    data: { fileId: file.id, mode: 'multipart', uploadId, partSize: PART_SIZE, parts },
  });
});

filesRouter.post('/:id/complete', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const { parts } = parse(fileCompleteSchema, req.body);
  const file = await prisma.fileAsset.findUnique({ where: { id } });
  if (!file) throw new AppError('NOT_FOUND', 'Фајлот не е пронајден.', 404);
  await assertFileOwnerAccess(file.ownerType, file.ownerId, req.auth!, 'write');
  const session = await prisma.uploadSession.findFirst({
    where: { fileAssetId: id, status: 'open' },
  });
  if (!session) throw new AppError('NOT_FOUND', 'Нема активна upload сесија.', 404);

  await completeMultipart(file.r2Key, session.r2UploadId, parts);
  await prisma.uploadSession.update({ where: { id: session.id }, data: { status: 'completed' } });

  // #7: качување суров материјал на капа во „snimanje" ја затвора автоматски (матрица note).
  await maybeCloseCapaOnRaw(file.ownerType, file.ownerId, file.kind, req.auth!);
  res.json({ data: file });
});

filesRouter.post('/:id/abort', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const file = await prisma.fileAsset.findUnique({ where: { id } });
  if (!file) throw new AppError('NOT_FOUND', 'Фајлот не е пронајден.', 404);
  await assertFileOwnerAccess(file.ownerType, file.ownerId, req.auth!, 'write');
  const session = await prisma.uploadSession.findFirst({
    where: { fileAssetId: id, status: 'open' },
  });
  if (session) {
    await abortMultipart(file.r2Key, session.r2UploadId);
    await prisma.uploadSession.update({ where: { id: session.id }, data: { status: 'aborted' } });
  }
  await prisma.fileAsset.update({ where: { id }, data: { lifecycle: 'deleted' } });
  res.json({ data: { ok: true } });
});
