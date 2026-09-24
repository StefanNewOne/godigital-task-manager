/** Плурал за денови (мк): `1 ден`, `N дена` (README §4 — не `1 дена`). */
export const daysLabel = (n: number): string => `${n} ${n === 1 ? 'ден' : 'дена'}`;
