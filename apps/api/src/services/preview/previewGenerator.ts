export interface PreviewSource {
  r2Key: string;
  mime: string;
  kind: string;
}

export interface PreviewResult {
  r2Key: string;
  mime: string;
}

/**
 * Генератор на прегледи (B3): видео 720p, слика 1200px. Реалната ffmpeg обработка е зад адаптер;
 * без `FFMPEG_PATH` се користи детерминистички stub (dev/тест) што само го изведува preview key.
 */
export interface PreviewGenerator {
  /** Врати preview артефакт, или null ако типот не поддржува преглед. */
  generate(src: PreviewSource): Promise<PreviewResult | null>;
}

/** Stub: не допира R2/ffmpeg; враќа детерминистички preview key за слика/видео. */
export class StubPreviewGenerator implements PreviewGenerator {
  async generate(src: PreviewSource): Promise<PreviewResult | null> {
    if (src.mime.startsWith('image/'))
      return { r2Key: `${src.r2Key}/preview.jpg`, mime: 'image/jpeg' };
    if (src.mime.startsWith('video/'))
      return { r2Key: `${src.r2Key}/preview.mp4`, mime: 'video/mp4' };
    return null;
  }
}

let singleton: PreviewGenerator | null = null;

/**
 * Фабрика. Денес секогаш враќа stub — реалниот ffmpeg генератор (видео 720p / слика 1200px:
 * download од R2 → ffmpeg → upload preview) се приклучува ТУКА кога `FFMPEG_PATH` бинарот е
 * во worker сликата (deployment). Пајплајнот (endpoint + врзување previewFileId) е ист.
 */
export function getPreviewGenerator(): PreviewGenerator {
  if (!singleton) singleton = new StubPreviewGenerator();
  return singleton;
}

/** За тестови: инјектирај/ресетирај го генераторот. */
export function setPreviewGenerator(gen: PreviewGenerator | null): void {
  singleton = gen;
}
