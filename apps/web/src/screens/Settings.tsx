import type React from 'react';
import { Bell } from 'lucide-react';
import { useMe } from '../api/auth.js';
import { useUpdateNotificationPrefs } from '../api/settings.js';

/**
 * Лични поставки (H6). Засега: известувања. По §16 вработен може да ги исклучи само
 * потсетниците (`potsetnik`); `alarm` и `kritichen` се задолжителни и не се исклучуваат.
 */
export function Settings() {
  const { data: me } = useMe();
  const update = useUpdateNotificationPrefs();

  // Default: потсетниците се вклучени додека вработениот експлицитно не ги исклучи.
  const remindersOn = me?.notificationPrefs?.reminders ?? true;

  return (
    <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={sectionTitle}>Известувања</h2>
        <p style={sectionHint}>
          Избери кои известувања сакаш да ги примаш. Аларм и критичните известувања се задолжителни
          и не можат да се исклучат.
        </p>
      </div>

      <div style={card}>
        <Row
          icon={<Bell size={18} aria-hidden />}
          title="Потсетници"
          desc="Нова задача, враќање, @споменување и рокови — во апликацијата."
        >
          <button
            role="switch"
            aria-checked={remindersOn}
            aria-label="Потсетници"
            disabled={update.isPending}
            onClick={() => update.mutate(!remindersOn)}
            style={toggle(remindersOn)}
          >
            <span style={knob(remindersOn)} />
          </button>
        </Row>

        <div style={divider} />

        <Row
          icon={<Bell size={18} aria-hidden />}
          title="Аларм"
          desc="Ниска покриеност, доцнење над рок — во апликацијата и на е-пошта."
        >
          <span style={lockedBadge}>Секогаш вклучено</span>
        </Row>

        <div style={divider} />

        <Row
          icon={<Bell size={18} aria-hidden />}
          title="Критично"
          desc="Трето враќање од клиент, вишок сценарија — со задолжителна потврда „Видено“."
        >
          <span style={lockedBadge}>Секогаш вклучено</span>
        </Row>
      </div>
    </div>
  );
}

function Row({
  icon,
  title,
  desc,
  children,
}: {
  icon: React.ReactNode;
  title: string;
  desc: string;
  children: React.ReactNode;
}) {
  return (
    <div style={row}>
      <span style={rowIcon}>{icon}</span>
      <div style={{ flex: 1, minWidth: 0 }}>
        <div style={{ fontWeight: 500 }}>{title}</div>
        <div style={{ color: 'var(--gd-ink-muted)', fontSize: 13 }}>{desc}</div>
      </div>
      {children}
    </div>
  );
}

const sectionTitle: React.CSSProperties = { fontSize: 16, fontWeight: 600, margin: 0 };
const sectionHint: React.CSSProperties = {
  color: 'var(--gd-ink-muted)',
  fontSize: 13,
  margin: '4px 0 0',
  maxWidth: 560,
};
const card: React.CSSProperties = {
  background: 'var(--gd-surface)',
  border: '1px solid var(--gd-border)',
  borderRadius: 12,
  maxWidth: 640,
};
const row: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 12,
  padding: 16,
};
const rowIcon: React.CSSProperties = {
  display: 'grid',
  placeItems: 'center',
  width: 32,
  height: 32,
  borderRadius: 8,
  background: 'var(--gd-surface-alt)',
  color: 'var(--gd-ink-muted)',
  flexShrink: 0,
};
const divider: React.CSSProperties = { height: 1, background: 'var(--gd-border)' };
const lockedBadge: React.CSSProperties = {
  fontSize: 12,
  color: 'var(--gd-ink-muted)',
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
  borderRadius: 9999,
  padding: '4px 10px',
  whiteSpace: 'nowrap',
};

function toggle(on: boolean): React.CSSProperties {
  return {
    position: 'relative',
    width: 44,
    height: 26,
    borderRadius: 9999,
    border: 'none',
    cursor: 'pointer',
    flexShrink: 0,
    background: on ? 'var(--gd-brand)' : 'var(--gd-border)',
    transition: 'background 150ms',
  };
}
function knob(on: boolean): React.CSSProperties {
  return {
    position: 'absolute',
    top: 3,
    left: on ? 21 : 3,
    width: 20,
    height: 20,
    borderRadius: '50%',
    background: '#fff',
    transition: 'left 150ms',
  };
}
