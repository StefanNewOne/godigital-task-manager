import type React from 'react';
import { useState } from 'react';
import { Sparkles, X } from 'lucide-react';
import { useAssistant, type AssistantResponse } from '../api/assistant.js';

/** Claude помошник панел (B4, 360px). Прашај за знаење; одговара само од системот, со извори. */
export function AssistantPanel({ onClose }: { onClose: () => void }) {
  const ask = useAssistant();
  const [question, setQuestion] = useState('');
  const [result, setResult] = useState<AssistantResponse | null>(null);
  const [error, setError] = useState<string | null>(null);

  const submit = () => {
    const q = question.trim();
    if (!q) return;
    setError(null);
    ask.mutate(
      { question: q },
      {
        onSuccess: (r) => setResult(r),
        onError: () => setError('Помошникот не е достапен во моментов.'),
      },
    );
  };

  return (
    <aside style={panel} className="gd-slide-in" aria-label="Claude помошник">
      <div style={header}>
        <span style={{ display: 'inline-flex', alignItems: 'center', gap: 8, fontWeight: 600 }}>
          <Sparkles size={16} aria-hidden /> Прашај
        </span>
        <button onClick={onClose} style={iconBtn} title="Затвори" aria-label="Затвори">
          <X size={16} />
        </button>
      </div>

      <div style={{ padding: 16, overflow: 'auto', flex: 1 }}>
        <p style={{ fontSize: 13, color: 'var(--gd-ink-muted)', marginTop: 0 }}>
          Прашај за задачи, клиенти, правила или доцнења. Помошникот чита од знаењето на системот и
          не менува ништо.
        </p>

        <textarea
          value={question}
          onChange={(e) => setQuestion(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter' && (e.metaKey || e.ctrlKey)) submit();
          }}
          placeholder="На пр.: Зошто доцни таскот за Астибо?"
          rows={3}
          style={textarea}
        />
        <button onClick={submit} disabled={ask.isPending || !question.trim()} style={askBtn}>
          {ask.isPending ? 'Размислувам…' : 'Прашај'}
        </button>

        {error && (
          <div style={{ color: 'var(--gd-danger)', fontSize: 13, marginTop: 12 }}>{error}</div>
        )}

        {result && (
          <div style={{ marginTop: 16 }}>
            <div style={answerBox}>{result.answer}</div>
            {result.sources.length > 0 && (
              <div style={{ marginTop: 12 }}>
                <div style={{ fontSize: 12, color: 'var(--gd-ink-muted)', marginBottom: 6 }}>
                  Извори
                </div>
                <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
                  {result.sources.map((s, i) => (
                    <div key={`${s.sourceId}-${i}`} style={sourceItem}>
                      <span style={sourceTag}>{s.sourceType}</span>
                      <span style={{ fontSize: 12, color: 'var(--gd-ink-muted)' }}>{s.text}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </div>
        )}
      </div>
    </aside>
  );
}

const panel: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  right: 0,
  bottom: 0,
  width: 360,
  background: 'var(--gd-surface)',
  borderLeft: '1px solid var(--gd-border)',
  boxShadow: '-8px 0 24px rgba(0,0,0,0.08)',
  display: 'flex',
  flexDirection: 'column',
  zIndex: 40,
};
const header: React.CSSProperties = {
  height: 56,
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'space-between',
  padding: '0 16px',
  borderBottom: '1px solid var(--gd-border)',
};
const iconBtn: React.CSSProperties = {
  background: 'none',
  border: 'none',
  cursor: 'pointer',
  color: 'var(--gd-ink-muted)',
  display: 'grid',
  placeItems: 'center',
};
const textarea: React.CSSProperties = {
  width: '100%',
  padding: 10,
  borderRadius: 8,
  border: '1px solid var(--gd-border)',
  background: 'var(--gd-surface)',
  fontSize: 14,
  resize: 'vertical',
  boxSizing: 'border-box',
  fontFamily: 'inherit',
};
const askBtn: React.CSSProperties = {
  marginTop: 8,
  height: 36,
  width: '100%',
  borderRadius: 8,
  border: 'none',
  background: 'var(--gd-primary)',
  color: '#fff',
  fontSize: 14,
  fontWeight: 500,
  cursor: 'pointer',
};
const answerBox: React.CSSProperties = {
  background: 'var(--gd-surface-alt)',
  border: '1px solid var(--gd-border)',
  borderRadius: 8,
  padding: 12,
  fontSize: 14,
  lineHeight: '20px',
  whiteSpace: 'pre-wrap',
};
const sourceItem: React.CSSProperties = {
  display: 'flex',
  gap: 8,
  alignItems: 'baseline',
  padding: '6px 8px',
  border: '1px solid var(--gd-border)',
  borderRadius: 6,
};
const sourceTag: React.CSSProperties = {
  fontSize: 11,
  fontWeight: 500,
  color: 'var(--gd-ink-muted)',
  background: 'var(--gd-surface-alt)',
  borderRadius: 9999,
  padding: '1px 8px',
  whiteSpace: 'nowrap',
};
