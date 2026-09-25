import { useMutation, useQuery, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';
import type { FileAssetRow } from '../lib/types.js';

/**
 * Прикачување фајл преку presigned URLs (CLAUDE.md И7): frontend НИКОГАШ не праќа
 * фајл низ API серверот. Мал фајл → еднократен PUT; голем → multipart.
 * Забелешка: PUT кон R2/MinIO бара CORS на bucket-от (вкл. expose ETag) — за
 * end-to-end верификација мора да е кренат MinIO/R2.
 */

export type FileKind =
  | 'raw'
  | 'final'
  | 'graphic'
  | 'scenarioDoc'
  | 'briefRef'
  | 'sharedMaterial'
  | 'screenshot'
  | 'preview'
  | 'logo';

type OwnerType = 'group' | 'task' | 'revision' | 'approval' | 'comment';

interface PresignSingle {
  fileId: string;
  mode: 'single';
  url: string;
}
interface PresignMultipart {
  fileId: string;
  mode: 'multipart';
  uploadId: string;
  partSize: number;
  parts: Array<{ partNumber: number; url: string }>;
}
type PresignResponse = PresignSingle | PresignMultipart;

export interface UploadArgs {
  ownerType: OwnerType;
  ownerId: string;
  kind: FileKind;
  file: File;
  onProgress?: (fraction: number) => void;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

/** PUT на еден дел со retry + backoff (отпорно на flaky мобилна мрежа, C4). */
async function putWithRetry(url: string, body: BodyInit, headers?: HeadersInit): Promise<Response> {
  let lastErr: unknown;
  for (let attempt = 0; attempt < 4; attempt++) {
    try {
      const res = await fetch(url, { method: 'PUT', body, headers });
      if (res.ok) return res;
      // 5xx/429 се повторуваат; 4xx (освен 429) се трајни.
      if (res.status < 500 && res.status !== 429) return res;
      lastErr = new Error(`HTTP ${res.status}`);
    } catch (e) {
      lastErr = e;
    }
    await sleep(500 * 2 ** attempt); // 0.5s, 1s, 2s, 4s
  }
  throw lastErr instanceof Error ? lastErr : new Error('Неуспешно прикачување на дел.');
}

async function uploadFile({
  ownerType,
  ownerId,
  kind,
  file,
  onProgress,
}: UploadArgs): Promise<string> {
  const mime = file.type || 'application/octet-stream';
  const presign = await api.post<PresignResponse>('/files/presign', {
    ownerType,
    ownerId,
    kind,
    mime,
    size: file.size,
  });

  if (presign.mode === 'single') {
    const res = await putWithRetry(presign.url, file, { 'Content-Type': mime });
    if (!res.ok) throw new Error('Неуспешно прикачување на фајлот.');
    onProgress?.(1);
    return presign.fileId;
  }

  const parts: Array<{ PartNumber: number; ETag: string }> = [];
  const total = presign.parts.length;
  for (const p of presign.parts) {
    const start = (p.partNumber - 1) * presign.partSize;
    const chunk = file.slice(start, start + presign.partSize);
    const res = await putWithRetry(p.url, chunk);
    if (!res.ok) throw new Error(`Неуспешен дел ${p.partNumber}.`);
    const etag = (res.headers.get('ETag') ?? '').replaceAll('"', '');
    parts.push({ PartNumber: p.partNumber, ETag: etag });
    onProgress?.(parts.length / total);
  }
  await api.post(`/files/${presign.fileId}/complete`, { parts });
  return presign.fileId;
}

/** Mutation за прикачување фајл; при успех го освежува тековниот таск. */
export function useFileUpload(taskId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task', taskId] });
      void qc.invalidateQueries({ queryKey: ['activity', taskId] });
    },
  });
}

/** Листа на фајлови за сопственик (со presigned url за преглед/симнување). */
export function useFiles(ownerType: OwnerType, ownerId: string | null) {
  return useQuery({
    queryKey: ['files', ownerType, ownerId],
    queryFn: () =>
      api.get<FileAssetRow[]>(
        `/files?ownerType=${ownerType}&ownerId=${encodeURIComponent(ownerId ?? '')}`,
      ),
    enabled: !!ownerId,
  });
}

/** Прикачување фајл на капа (заеднички материјал, сценариски документ, суров материјал). */
export function useGroupUpload(groupId: string) {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: uploadFile,
    onSuccess: () => {
      void qc.invalidateQueries({ queryKey: ['task-group', groupId] });
      void qc.invalidateQueries({ queryKey: ['scenarios', groupId] });
    },
  });
}
