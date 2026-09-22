/**
 * @gd/ui — дизајн токени + заеднички компоненти + i18n.
 * Компонентите (Button, Badge, TaskCard, Toast, …) се додаваат во A1/A3 по Handoff §5.
 */
export * as tokens from './tokens.js';
export { default as mk } from './i18n/mk.json' with { type: 'json' };

// Базни компоненти (Handoff §5) — се шират при реизградбата екран-по-екран.
export { Button } from './components/Button.js';
export type { ButtonProps, ButtonVariant, ButtonSize } from './components/Button.js';
export { StatusBadge } from './components/StatusBadge.js';
export type { StatusBadgeProps } from './components/StatusBadge.js';
