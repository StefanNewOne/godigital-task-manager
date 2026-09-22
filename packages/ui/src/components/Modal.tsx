import { useEffect, type CSSProperties, type ReactNode } from 'react';
import { color, radius, shadow } from '../tokens.js';

/**
 * Модал (Handoff §Popover/Modal): затемнета позадина, центриран панел, `gd-fade-up`.
 * Затвора на Esc и клик надвор. Без нова зависност — X е inline SVG (не icon-set,
 * за `@gd/ui` да остане само со react peer).
 */
export interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
  footer?: ReactNode;
  width?: number;
}

export function Modal({ open, onClose, title, children, footer, width = 480 }: ModalProps) {
  useEffect(() => {
    if (!open) return;
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [open, onClose]);

  if (!open) return null;

  return (
    <div style={overlay} onMouseDown={onClose}>
      <div
        style={{ ...panel, width }}
        className="gd-fade-up"
        role="dialog"
        aria-modal="true"
        aria-label={title}
        onMouseDown={(e) => e.stopPropagation()}
      >
        <div style={head}>
          <h2 style={{ fontSize: 16, lineHeight: '24px', fontWeight: 600, margin: 0 }}>{title}</h2>
          <button type="button" onClick={onClose} style={closeBtn} aria-label="Затвори">
            <svg width="16" height="16" viewBox="0 0 24 24" fill="none" aria-hidden>
              <path
                d="M6 6l12 12M18 6L6 18"
                stroke="currentColor"
                strokeWidth="2"
                strokeLinecap="round"
              />
            </svg>
          </button>
        </div>
        <div style={body}>{children}</div>
        {footer && <div style={foot}>{footer}</div>}
      </div>
    </div>
  );
}

const overlay: CSSProperties = {
  position: 'fixed',
  inset: 0,
  background: 'rgba(0,0,0,.4)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  zIndex: 100,
  padding: 24,
};

const panel: CSSProperties = {
  background: color.surface,
  borderRadius: radius.card,
  boxShadow: shadow.popover,
  maxHeight: '85vh',
  display: 'flex',
  flexDirection: 'column',
  overflow: 'hidden',
};

const head: CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '14px 16px',
  borderBottom: `1px solid ${color.border}`,
};

const body: CSSProperties = { padding: 16, overflow: 'auto' };

const foot: CSSProperties = {
  display: 'flex',
  justifyContent: 'flex-end',
  gap: 8,
  padding: '12px 16px',
  borderTop: `1px solid ${color.border}`,
};

const closeBtn: CSSProperties = {
  border: 'none',
  background: 'transparent',
  cursor: 'pointer',
  color: color.inkMuted,
  display: 'flex',
  padding: 4,
};
