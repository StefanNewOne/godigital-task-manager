/**
 * @gd/core — чисто доменско јадро (без I/O).
 * Единствен извор на вистина за: статуси, улоги, дозволи, матрица на преоди,
 * покриеност, рокови (CLAUDE.md И2/И3/И4, PRD §4).
 */
export * from './roles.js';
export * from './statuses.js';
export * from './permissions.js';
export * from './errors.js';
export * from './coverage.js';
export * from './deadlines.js';
export * from './schemas.js';
export * from './workflow/transitions.js';
export * from './workflow/specials.js';
export * from './slots/algorithm.js';
