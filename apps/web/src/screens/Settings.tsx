import type React from 'react';
import { useEffect, useState } from 'react';
import { Bell, Smartphone } from 'lucide-react';
import { t } from '@gd/ui';
import { useMe } from '../api/auth.js';
import { useUpdateNotificationPrefs } from '../api/settings.js';
import { disablePush, enablePush, pushSubscribed, pushSupported } from '../lib/push.js';

/**
 * Лични поставки (H6). Засега: известувања. По §16 вработен може да ги исклучи само
 * потсетниците (`potsetnik`); `alarm` и `kritichen` се задолжителни и не се исклучуваат.
 */
export function Settings() {
  const { data: me } = useMe();
  const update = useUpdateNotificationPrefs();

  // Default: потсетниците се вклучени додека вработениот експлицитно не ги исклучи.
  const remindersOn = me?.notificationPrefs?.reminders ?? true;

  // Push е по уред (не серверска преференца). Локална состојба + проверка при монтирање.
  const supported = pushSupported();
  const [pushOn, setPushOn] = useState(false);
  const [pushBusy, setPushBusy] = useState(false);
  const [pushMsg, setPushMsg] = useState<string | null>(null);
  useEffect(() => {
    if (supported) void pushSubscribed().then(setPushOn);
  }, [supported]);

  const togglePush = async () => {
    setPushBusy(true);
    setPushMsg(null);
    try {
      if (pushOn) {
        await disablePush();
        setPushOn(false);
      } else {
        const r = await enablePush();
        if (r === 'ok') setPushOn(true);
        else if (r === 'denied') setPushMsg(t('settings.pushDenied'));
        else if (r === 'no-key') setPushMsg(t('settings.pushNoKey'));
        else setPushMsg(t('settings.pushUnsupported'));
      }
    } catch {
      setPushMsg(t('settings.pushFailed'));
    } finally {
      setPushBusy(false);
    }
  };

  return (
    <div style={{ padding: '24px 20px 48px', display: 'flex', flexDirection: 'column', gap: 16 }}>
      <div>
        <h2 style={sectionTitle}>{t('settings.title')}</h2>
        <p style={sectionHint}>{t('settings.hint')}</p>
      </div>

      <div style={card}>
        <Row
          icon={<Bell size={18} aria-hidden />}
          title={t('settings.reminders')}
          desc={t('settings.remindersDesc')}
        >
          <button
            role="switch"
            aria-checked={remindersOn}
            aria-label={t('settings.reminders')}
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
          title={t('settings.alarm')}
          desc={t('settings.alarmDesc')}
        >
          <span style={lockedBadge}>{t('settings.alwaysOn')}</span>
        </Row>

        <div style={divider} />

        <Row
          icon={<Bell size={18} aria-hidden />}
          title={t('settings.critical')}
          desc={t('settings.criticalDesc')}
        >
          <span style={lockedBadge}>{t('settings.alwaysOn')}</span>
        </Row>

        <div style={divider} />

        <Row
          icon={<Smartphone size={18} aria-hidden />}
          title={t('settings.push')}
          desc={t('settings.pushDesc')}
        >
          {supported ? (
            <button
              role="switch"
              aria-checked={pushOn}
              aria-label={t('settings.push')}
              disabled={pushBusy}
              onClick={() => void togglePush()}
              style={toggle(pushOn)}
            >
              <span style={knob(pushOn)} />
            </button>
          ) : (
            <span style={lockedBadge}>{t('settings.notSupported')}</span>
          )}
        </Row>
      </div>
      {pushMsg && (
        <p style={{ color: 'var(--gd-warning-text)', fontSize: 13, margin: 0 }}>{pushMsg}</p>
      )}
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
    background: on ? 'var(--gd-primary)' : 'var(--gd-border)',
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
