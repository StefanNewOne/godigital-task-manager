/** Парсирај декларативен guard/effect токен, пр. `G_TEXT(brief,50)` или `E_AUTO_NEXT(analitika)?`. */
export function parseToken(token: string): { name: string; args: string[] } {
  const match = token.match(/^([A-Z_]+)(?:\(([^)]*)\))?\??$/);
  if (!match) return { name: token, args: [] };
  const args = match[2] ? match[2].split(',').map((s) => s.trim()) : [];
  return { name: match[1]!, args };
}
