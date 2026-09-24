import { prisma } from '../db/tenantExtension.js';
import { getPreviewGenerator } from './preview/previewGenerator.js';

/**
 * Генерирај преглед за фајл (B3, PRD §4): видео 720p / слика 1200px преку `PreviewGenerator`
 * адаптер. Idempotent — прескокнува ако веќе има преглед или типот не е поддржан. Го врзува
 * `source.previewFileId` кон новосоздадениот `FileAsset(kind=preview)`.
 */
export async function generatePreview(fileId: string) {
  const file = await prisma.fileAsset.findUnique({ where: { id: fileId } });
  if (!file || file.previewFileId || file.kind === 'preview') return null;

  const result = await getPreviewGenerator().generate({
    r2Key: file.r2Key,
    mime: file.mime,
    kind: file.kind,
  });
  if (!result) return null;

  const preview = await prisma.fileAsset.create({
    data: {
      ownerType: file.ownerType,
      ownerId: file.ownerId,
      kind: 'preview',
      r2Key: result.r2Key,
      size: BigInt(0),
      mime: result.mime,
      lifecycle: 'active',
    },
  });
  await prisma.fileAsset.update({ where: { id: file.id }, data: { previewFileId: preview.id } });
  return preview;
}
