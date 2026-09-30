import { t } from '@gd/ui';

export function Placeholder({ title }: { title: string }) {
  return (
    <div style={{ padding: '24px 20px' }}>
      <h1 style={{ fontSize: 20, fontWeight: 600 }}>{title}</h1>
      <p style={{ color: 'var(--gd-ink-muted)' }}>{t('placeholder.building')}</p>
    </div>
  );
}
