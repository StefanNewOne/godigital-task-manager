import { useMutation, useQueryClient } from '@tanstack/react-query';
import { api } from '../lib/api.js';

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
}

async function uploadFile({ ownerType, ownerId, kind, file }: UploadArgs): Promise<string> {
  const mime = file.type || 'application/octet-stream';
  const presign = await api.post<PresignResponse>('/files/presign', {
    ownerType,
    ownerId,
    kind,
    mime,
    size: file.size,
  });

  if (presign.mode === 'single') {
    const res = await fetch(presign.url, {
      method: 'PUT',
      headers: { 'Content-Type': mime },
      body: file,
    });
    if (!res.ok) throw new Error('Неуспешно прикачување на фајлот.');
    return presign.fileId;
  }

  const parts: Array<{ PartNumber: number; ETag: string }> = [];
  for (const p of presign.parts) {
    const start = (p.partNumber - 1) * presign.partSize;
    const chunk = file.slice(start, start + presign.partSize);
    const res = await fetch(p.url, { method: 'PUT', body: chunk });
    if (!res.ok) throw new Error(`Неуспешен дел ${p.partNumber}.`);
    const etag = (res.headers.get('ETag') ?? '').replaceAll('"', '');
    parts.push({ PartNumber: p.partNumber, ETag: etag });
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
