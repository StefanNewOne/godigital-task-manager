/**
 * Дизајн токени — точни вредности од Handoff README (§Design Tokens) + Design Brief §2.
 * Ова е канонскиот TS извор; `tokens.css` ги огледува како CSS променливи.
 * Бренд сина се користи САМО за: примарна акција, активна навигација, избран ред, фокус, модул блок.
 */

export const color = {
  // бренд
  primary: '#0866FF',
  primaryHover: '#0052D9',
  primaryTint: '#EBF2FF',
  primaryBorder: '#C7DCFF',
  primaryWash: 'rgba(8,102,255,.04)',
  // мастило / текст
  ink: '#12161C',
  inkSecondary: '#5C6672',
  inkMuted: '#8A93A0',
  // површини / рамки
  border: '#E2E7EB',
  borderStrong: '#8A93A0',
  surface: '#FFFFFF',
  surfaceAlt: '#F7F8FA',
  surfacePad: '#FAFBFC',
  dividerLight: '#C9D0D8',
  // семантички
  danger: '#DC2626',
  dangerText: '#B91C1C',
  warning: '#D97706',
  warningText: '#B45309',
  success: '#16A34A',
  successText: '#15803D',
} as const;

/** Боја по статус (Handoff): точка, беџ, лента во календар. */
export const statusColor = {
  mrtov: '#9AA3AF',
  cekaSnimanje: '#6B7280',
  brifing: '#6B7280',
  scenarija: '#0D9488',
  dizajn: '#0D9488',
  montaza: '#0D9488',
  chekaRezija: '#7C3AED',
  vnatresno: '#7C3AED',
  scenKajKlient: '#D97706',
  kajKlient: '#D97706',
  zaObjavuvanje: '#65A30D',
  objaveno: '#16A34A',
  analitika: '#DB2777',
  zavrseno: '#16A34A',
  pauza: '#9AA3AF',
  otkazano: '#6B7280',
} as const;

/** Палета на бои по клиент (16 нијанси, доделени автоматски). */
export const clientPalette = [
  '#0D9488',
  '#7C3AED',
  '#D97706',
  '#DB2777',
  '#65A30D',
  '#0EA5E9',
] as const;

/** Растојанија — скала од 4 (Handoff). */
export const space = [2, 3, 4, 6, 8, 10, 12, 16, 20, 24, 32, 48] as const;

/** Заоблување. */
export const radius = {
  button: 6,
  field: 8,
  badge: 4,
  card: 8,
  pill: 9999,
} as const;

/** Сенки. */
export const shadow = {
  popover: '0 12px 32px rgba(0,0,0,.14)',
  toast: '0 12px 32px rgba(0,0,0,.24)',
  cardHover: '0 1px 3px rgba(0,0,0,.08)',
  drag: '0 8px 24px rgba(0,0,0,.16)',
} as const;

/** Клучни димензии (Handoff §Sizes / Design Brief §4). */
export const size = {
  rail: 64,
  contextSidebar: 240,
  topBar: 56,
  toolbar: 48,
  detailPanel: 480,
  boardColumn: 300,
  rowHeight: 44,
  rowHeightCompact: 32,
} as const;

/** Движење (Handoff §Motion). */
export const motion = {
  slideIn: '200ms ease-out',
  fadeUp: '150ms ease-out',
  hover: '100ms ease-out',
} as const;

export const font = {
  family: "'Inter', system-ui, sans-serif",
} as const;
