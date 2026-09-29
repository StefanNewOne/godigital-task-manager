import mk from './mk.json' with { type: 'json' };

/**
 * Лесен i18n runtime (CLAUDE.md §4) — mk-само, без надворешна зависност (§18).
 * Поддржува:
 *  - lookup по точка-патека од `mk.json`;
 *  - `{var}` интерполација;
 *  - ICU plural: `{count, plural, one {# ден} few {# таска} other {# дена}}` со македонски
 *    категории (one/few/other) и `#` → бројот.
 */

type Dict = { [k: string]: string | Dict };

function lookup(key: string): string | undefined {
  const parts = key.split('.');
  let node: string | Dict = mk as Dict;
  for (const p of parts) {
    if (typeof node !== 'object' || node === null || !(p in node)) return undefined;
    node = (node as Dict)[p]!;
  }
  return typeof node === 'string' ? node : undefined;
}

/** Македонска CLDR категорија за кардинал: one / few (паукал 2–4) / other. */
export function pluralCategory(n: number): 'one' | 'few' | 'other' {
  const abs = Math.abs(n);
  const mod10 = abs % 10;
  const mod100 = abs % 100;
  if (mod10 === 1 && mod100 !== 11) return 'one';
  if (mod10 >= 2 && mod10 <= 4 && !(mod100 >= 12 && mod100 <= 14)) return 'few';
  return 'other';
}

/** Извади ги ICU plural формите `one {…} few {…} other {…}` од блок. */
function parseForms(body: string): Partial<Record<'one' | 'few' | 'other' | 'zero', string>> {
  const forms: Record<string, string> = {};
  const re = /(zero|one|few|other)\s*\{([^{}]*)\}/g;
  let m: RegExpExecArray | null;
  while ((m = re.exec(body))) forms[m[1]!] = m[2]!;
  return forms;
}

/** Замени еден ICU plural блок за дадениот број. */
function formatPlural(count: number, body: string): string {
  const forms = parseForms(body);
  const cat = pluralCategory(count);
  const chosen = forms[cat] ?? forms.other ?? '';
  return chosen.replace(/#/g, String(count));
}

/**
 * Замени ги ICU plural блоковите `{name, plural, …}` (со balanced-brace скенирање за вгнездени
 * форми) со избраната форма за `vars[name]`. Останатиот текст останува непроменет.
 */
function applyPlurals(raw: string, vars?: Record<string, string | number>): string {
  let out = '';
  let i = 0;
  while (i < raw.length) {
    const open = raw.indexOf('{', i);
    if (open === -1) {
      out += raw.slice(i);
      break;
    }
    // Најди го balanced затворот на овој блок.
    let depth = 0;
    let end = open;
    for (; end < raw.length; end++) {
      if (raw[end] === '{') depth++;
      else if (raw[end] === '}') {
        depth--;
        if (depth === 0) break;
      }
    }
    const inner = raw.slice(open + 1, end); // без надворешните { }
    const m = inner.match(/^(\w+),\s*plural,\s*([^]*)$/);
    if (m) {
      const count = Number(vars?.[m[1]!]);
      out += raw.slice(i, open);
      out += Number.isFinite(count) ? formatPlural(count, m[2]!) : raw.slice(open, end + 1);
    } else {
      // Не е plural блок (обичен {var}) — остави го за втората фаза.
      out += raw.slice(i, end + 1);
    }
    i = end + 1;
  }
  return out;
}

/** Преведи по клуч со `{var}` интерполација + ICU plural. Врати го клучот ако недостасува. */
export function t(key: string, vars?: Record<string, string | number>): string {
  const raw = lookup(key);
  if (raw === undefined) return key;
  const withPlural = applyPlurals(raw, vars);
  if (!vars) return withPlural;
  return withPlural.replace(/\{(\w+)\}/g, (_, name: string) =>
    name in vars ? String(vars[name]) : `{${name}}`,
  );
}

/**
 * Програмски плурал (кога формите не се во mk.json). Формите содржат `#` за бројот.
 * `few` е опционален — ако недостасува, паукалот паѓа на `other`.
 */
export function plural(n: number, forms: { one: string; few?: string; other: string }): string {
  const cat = pluralCategory(n);
  const form = cat === 'one' ? forms.one : cat === 'few' ? (forms.few ?? forms.other) : forms.other;
  return form.replace(/#/g, String(n));
}
