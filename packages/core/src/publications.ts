/**
 * Извлекување на `externalRef` од permalink (PRD §4.8). Чиста функција.
 * Worker-от подоцна го резолвира `metaMediaId` (B2); ова е првиот детерминистички чекор.
 */

export type Platform = 'fb' | 'ig' | 'tiktok';

/** Извлечи го надворешниот идентификатор од линкот на објавата, или null ако не се препознае. */
export function extractExternalRef(permalink: string): string | null {
  // Instagram: /p/{code} или /reel/{code}
  let m = permalink.match(/instagram\.com\/(?:p|reel|reels)\/([A-Za-z0-9_-]+)/);
  if (m) return m[1] ?? null;

  // TikTok: /@{user}/video/{id}
  m = permalink.match(/tiktok\.com\/@[^/]+\/video\/(\d+)/);
  if (m) return m[1] ?? null;

  // Facebook: {page}/posts|videos|reel/{id}
  m = permalink.match(/facebook\.com\/(?:[^/?#]+\/)?(?:posts|videos|reel)\/(\d+)/);
  if (m) return m[1] ?? null;

  // Facebook: ?fbid= или ?story_fbid=
  m = permalink.match(/[?&](?:story_)?fbid=(\d+)/);
  if (m) return m[1] ?? null;

  return null;
}

/** Погоди платформа од доменот на линкот. */
export function platformOf(permalink: string): Platform | null {
  if (/instagram\.com/.test(permalink)) return 'ig';
  if (/tiktok\.com/.test(permalink)) return 'tiktok';
  if (/facebook\.com|fb\.watch/.test(permalink)) return 'fb';
  return null;
}
