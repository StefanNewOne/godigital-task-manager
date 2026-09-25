import type React from 'react';
import { useEffect, useState } from 'react';
import { useRegisterSW } from 'virtual:pwa-register/react';
import { queryClient } from '../lib/pwa.js';
import { flushQueue, onQueueChange } from '../lib/offlineQueue.js';

/** Офлајн банер + чекани промени + „нова верзија" prompt (C1/C2/C3). Се рендерира еднаш. */
export function PwaStatus() {
  const {
    needRefresh: [needRefresh, setNeedRefresh],
    updateServiceWorker,
  } = useRegisterSW();
  const [online, setOnline] = useState(typeof navigator === 'undefined' ? true : navigator.onLine);
  const [pending, setPending] = useState(0);

  useEffect(() => onQueueChange(setPending), []);

  useEffect(() => {
    const sync = async () => {
      setOnline(true);
      const { sent } = await flushQueue();
      if (sent > 0) await queryClient.invalidateQueries();
    };
    const off = () => setOnline(false);
    window.addEventListener('online', sync);
    window.addEventListener('offline', off);
    if (typeof navigator !== 'undefined' && navigator.onLine) void sync();
    return () => {
      window.removeEventListener('online', sync);
      window.removeEventListener('offline', off);
    };
  }, []);

  return (
    <>
      {!online && (
        <div style={offlineBanner} role="status">
          Офлајн — прикажани се последно вчитани податоци.
          {pending > 0 && ` · ${pending} чекани промени`}
        </div>
      )}
      {online && pending > 0 && (
        <div style={offlineBanner} role="status">
          Синхронизирање… {pending} чекани промени.
        </div>
      )}
      {needRefresh && (
        <div style={updateToast} role="alert">
          <span>Нова верзија е достапна.</span>
          <button style={updateBtn} onClick={() => void updateServiceWorker(true)}>
            Освежи
          </button>
          <button style={dismissBtn} aria-label="Затвори" onClick={() => setNeedRefresh(false)}>
            ×
          </button>
        </div>
      )}
    </>
  );
}

const offlineBanner: React.CSSProperties = {
  position: 'fixed',
  top: 0,
  left: 0,
  right: 0,
  zIndex: 90,
  background: '#12161C',
  color: '#fff',
  fontSize: 13,
  textAlign: 'center',
  padding: '6px 12px',
};
const updateToast: React.CSSProperties = {
  position: 'fixed',
  bottom: 20,
  left: '50%',
  transform: 'translateX(-50%)',
  zIndex: 90,
  display: 'flex',
  alignItems: 'center',
  gap: 10,
  background: '#12161C',
  color: '#fff',
  padding: '10px 14px',
  borderRadius: 8,
  fontSize: 14,
  boxShadow: '0 8px 24px rgba(0,0,0,.24)',
};
const updateBtn: React.CSSProperties = {
  border: 'none',
  background: '#0866FF',
  color: '#fff',
  fontSize: 13,
  fontWeight: 500,
  padding: '4px 12px',
  borderRadius: 6,
  cursor: 'pointer',
};
const dismissBtn: React.CSSProperties = {
  border: 'none',
  background: 'transparent',
  color: '#8A93A0',
  fontSize: 18,
  cursor: 'pointer',
  lineHeight: 1,
};
