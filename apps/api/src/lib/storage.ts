import {
  AbortMultipartUploadCommand,
  CompleteMultipartUploadCommand,
  CreateMultipartUploadCommand,
  GetObjectCommand,
  PutObjectCommand,
  S3Client,
  UploadPartCommand,
} from '@aws-sdk/client-s3';
import { getSignedUrl } from '@aws-sdk/s3-request-presigner';
import { env } from '../env.js';

/** Cloudflare R2 / S3-compatible. Presigned URL-и; фронтендот качува директно (CLAUDE.md И7). */
export const PART_SIZE = 50 * 1024 * 1024; // 50 MB (PRD §4.14)

const s3 = new S3Client({
  region: env.R2_REGION,
  endpoint: env.R2_ENDPOINT,
  forcePathStyle: true,
  credentials: {
    accessKeyId: env.R2_ACCESS_KEY_ID,
    secretAccessKey: env.R2_SECRET_ACCESS_KEY,
  },
});

export const partCount = (size: number): number => Math.ceil(size / PART_SIZE);

/** Presigned PUT за еднократно качување (мали фајлови) — потпис локално, без сервер. */
export function presignPut(key: string, mime: string): Promise<string> {
  return getSignedUrl(
    s3,
    new PutObjectCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: mime }),
    { expiresIn: 900 }, // 15 мин (download/upload)
  );
}

export function presignGet(key: string): Promise<string> {
  return getSignedUrl(s3, new GetObjectCommand({ Bucket: env.R2_BUCKET, Key: key }), {
    expiresIn: 900,
  });
}

/** Иницирај multipart upload (multi-GB суров материјал) — контактира R2. */
export async function createMultipart(key: string, mime: string): Promise<string> {
  const r = await s3.send(
    new CreateMultipartUploadCommand({ Bucket: env.R2_BUCKET, Key: key, ContentType: mime }),
  );
  if (!r.UploadId) throw new Error('R2 не врати UploadId.');
  return r.UploadId;
}

export function presignUploadPart(
  key: string,
  uploadId: string,
  partNumber: number,
): Promise<string> {
  return getSignedUrl(
    s3,
    new UploadPartCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      PartNumber: partNumber,
    }),
    { expiresIn: 86400 }, // 24 ч (multipart)
  );
}

export async function completeMultipart(
  key: string,
  uploadId: string,
  parts: Array<{ PartNumber: number; ETag: string }>,
): Promise<void> {
  await s3.send(
    new CompleteMultipartUploadCommand({
      Bucket: env.R2_BUCKET,
      Key: key,
      UploadId: uploadId,
      MultipartUpload: { Parts: parts },
    }),
  );
}

export async function abortMultipart(key: string, uploadId: string): Promise<void> {
  await s3.send(
    new AbortMultipartUploadCommand({ Bucket: env.R2_BUCKET, Key: key, UploadId: uploadId }),
  );
}
