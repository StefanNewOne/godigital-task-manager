import { StrictMode } from 'react';
import { createRoot } from 'react-dom/client';
import { PersistQueryClientProvider } from '@tanstack/react-query-persist-client';
import { App } from './App.js';
import { PwaStatus } from './components/PwaStatus.js';
import { idbPersister, queryClient } from './lib/pwa.js';
import './index.css';

const rootEl = document.getElementById('root');
if (!rootEl) throw new Error('Недостасува #root елемент.');

createRoot(rootEl).render(
  <StrictMode>
    <PersistQueryClientProvider
      client={queryClient}
      persistOptions={{ persister: idbPersister, maxAge: 1000 * 60 * 60 * 24 }}
    >
      <App />
      <PwaStatus />
    </PersistQueryClientProvider>
  </StrictMode>,
);
