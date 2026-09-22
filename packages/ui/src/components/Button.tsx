import type { ButtonHTMLAttributes, CSSProperties } from 'react';
import { color, radius } from '../tokens.js';

/**
 * Копче (Handoff §Button). Варијанти: primary (бренд сина), secondary (рамка),
 * danger (црвена рамка), ghost (без рамка). Висини: form 36 / toolbar 28 / mobile 44.
 * НЕМА сиви исклучени копчиња — ако дејство не е достапно, копчето воопшто го нема
 * (CLAUDE.md §8.5). `disabled` се користи само за краткотрајно „во тек" (pending).
 */
export type ButtonVariant = 'primary' | 'secondary' | 'danger' | 'ghost';
export type ButtonSize = 'form' | 'toolbar' | 'mobile';

export interface ButtonProps extends ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: ButtonVariant;
  size?: ButtonSize;
}

const HEIGHT: Record<ButtonSize, number> = { form: 36, toolbar: 28, mobile: 44 };

const VARIANT: Record<ButtonVariant, CSSProperties> = {
  primary: { background: color.primary, color: '#FFFFFF', border: '1px solid transparent' },
  secondary: {
    background: color.surface,
    color: color.inkSecondary,
    border: `1px solid ${color.border}`,
  },
  danger: { background: color.surface, color: color.danger, border: `1px solid ${color.danger}` },
  ghost: { background: 'transparent', color: color.inkSecondary, border: '1px solid transparent' },
};

export function Button({ variant = 'primary', size = 'form', style, ...rest }: ButtonProps) {
  const base: CSSProperties = {
    height: HEIGHT[size],
    padding: size === 'toolbar' ? '0 10px' : '0 14px',
    borderRadius: radius.button,
    fontSize: size === 'toolbar' ? 12 : 14,
    fontWeight: 500,
    cursor: rest.disabled ? 'default' : 'pointer',
    opacity: rest.disabled ? 0.6 : 1,
    display: 'inline-flex',
    alignItems: 'center',
    justifyContent: 'center',
    gap: 6,
    whiteSpace: 'nowrap',
    ...VARIANT[variant],
    ...style,
  };
  return <button style={base} {...rest} />;
}
