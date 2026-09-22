import { randomUUID } from 'node:crypto';
import { Router } from 'express';
import type { Router as ExpressRouter } from 'express';
import { fileCompleteSchema, filePresignSchema } from '@gd/core';
import { prisma } from '../db/tenantExtension.js';
import { env } from '../env.js';
import { AppError } from '../lib/errors.js';
import { parse } from '../lib/validate.js';
import { requireAuth } from '../middleware/auth.js';
import {
  PART_SIZE,
  abortMultipart,
  completeMultipart,
  createMultipart,
  partCount,
  presignPut,
  presignUploadPart,
} from '../lib/storage.js';

export const filesRouter: ExpressRouter = Router();
filesRouter.use(requireAuth);

// Presign upload (PRD §4.14): мал фајл → еднократен PUT; голем → multipart со UploadSession.
filesRouter.post('/presign', async (req, res) => {
  const input = parse(filePresignSchema, req.body);
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
  const session = await prisma.uploadSession.findFirst({
    where: { fileAssetId: id, status: 'open' },
  });
  if (!session) throw new AppError('NOT_FOUND', 'Нема активна upload сесија.', 404);

  await completeMultipart(file.r2Key, session.r2UploadId, parts);
  await prisma.uploadSession.update({ where: { id: session.id }, data: { status: 'completed' } });
  res.json({ data: file });
});

filesRouter.post('/:id/abort', async (req, res) => {
  const id = (req.params as { id: string }).id;
  const file = await prisma.fileAsset.findUnique({ where: { id } });
  if (!file) throw new AppError('NOT_FOUND', 'Фајлот не е пронајден.', 404);
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
