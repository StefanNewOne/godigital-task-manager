/**
 * Извлекување на `externalRef` од permalink (PRD §4.8). Чиста функција.
 * Worker-от подоцна го резолвира `metaMediaId` (B2); ова е првиот детерминистички чекор.
 */

export type Platform = 'fb' | 'ig' | 'tiktok';

/** Патерни по платформа; секој има точно една задолжителна фаќачка група со идентификаторот. */
const REF_PATTERNS: readonly RegExp[] = [
  /instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/, // IG: /p/{code} или /reel/{code}
  /tiktok\.com\/@[^/]+\/video\/(\d+)/, // TikTok: /@{user}/video/{id}
  /facebook\.com\/(?:[^/?#]+\/)?(?:posts|videos|reel)\/(\d+)/, // FB: {page}/posts|videos|reel/{id}
  /[?&](?:story_)?fbid=(\d+)/, // FB: ?fbid= или ?story_fbid=
];

/** Извлечи го надворешниот идентификатор од линкот на објавата, или null ако не се препознае. */
export function extractExternalRef(permalink: string): string | null {
  for (const re of REF_PATTERNS) {
    const m = permalink.match(re);
    // Групата е задолжителна во секој патерн → m[1] е секогаш дефиниран при match;
    // `?? null` постои само заради типовите (noUncheckedIndexedAccess) и е недостижен.
    /* v8 ignore next */
    if (m) return m[1] ?? null;
  }
  return null;
}

/** Погоди платформа од доменот на линкот. */
export function platformOf(permalink: string): Platform | null {
  if (/instagram\.com/.test(permalink)) return 'ig';
  if (/tiktok\.com/.test(permalink)) return 'tiktok';
  if (/facebook\.com|fb\.watch/.test(permalink)) return 'fb';
  return null;
}
