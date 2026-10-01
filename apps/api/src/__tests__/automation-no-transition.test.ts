import { readFileSync, readdirSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, resolve } from 'node:path';
import { describe, expect, it } from 'vitest';

/**
 * ADR-001 инваријанта: Rule Builder engine-от и евалуаторите САМО читаат состојба и известуваат —
 * никогаш не вршат преод (`transitionTask`/`transitionTaskGroup`). State machine останува
 * единствен извор за преоди. Овој тест го чува тоа ограничување.
 */
const dir = resolve(dirname(fileURLToPath(import.meta.url)), '../services/automations');

describe('Rule Builder engine — ADR-001 инваријанта', () => {
  it('ниеден automations фајл не повикува transition', () => {
    const files = readdirSync(dir).filter((f) => f.endsWith('.ts'));
    expect(files.length).toBeGreaterThan(0);
    for (const f of files) {
      const src = readFileSync(resolve(dir, f), 'utf8');
      expect(src, `${f} не смее да повикува transition`).not.toMatch(
        /transitionTask\b|transitionTaskGroup\b/,
      );
    }
  });
});
