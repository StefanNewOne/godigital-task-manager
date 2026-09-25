import react from '@vitejs/plugin-react';
import tailwindcss from '@tailwindcss/vite';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig(({ mode }) => ({
  plugins: [
    react(),
    tailwindcss(),
    // PWA plugin само надвор од тест-режим (virtual module не е потребен во vitest).
    ...(mode === 'test'
      ? []
      : [
          VitePWA({
            registerType: 'autoUpdate',
            // SW е исклучен во dev по default за да не пречи на локалното тестирање.
            devOptions: { enabled: false },
            includeAssets: ['apple-touch-icon.png'],
            manifest: {
              name: 'GoDigital Task Manager',
              short_name: 'GoDigital',
              description: 'Интерен таск-менаџер за GoDigital.',
              lang: 'mk',
              theme_color: '#0866FF',
              background_color: '#12161C',
              display: 'standalone',
              start_url: '/',
              scope: '/',
              icons: [
                { src: 'pwa-192x192.png', sizes: '192x192', type: 'image/png' },
                { src: 'pwa-512x512.png', sizes: '512x512', type: 'image/png' },
                {
                  src: 'maskable-icon-512x512.png',
                  sizes: '512x512',
                  type: 'image/png',
                  purpose: 'maskable',
                },
              ],
            },
            workbox: {
              globPatterns: ['**/*.{js,css,html,ico,png,svg,woff2}'],
              navigateFallbackDenylist: [/^\/api\//],
              // Офлајн читање: последно вчитани GET-ови за таскови/преглед (C2).
              runtimeCaching: [
                {
                  urlPattern: ({ url }) => url.pathname.startsWith('/api/'),
                  handler: 'NetworkFirst',
                  method: 'GET',
                  options: {
                    cacheName: 'gd-api-get',
                    expiration: { maxEntries: 200, maxAgeSeconds: 60 * 60 * 24 },
                    cacheableResponse: { statuses: [0, 200] },
                  },
                },
              ],
            },
          }),
        ]),
  ],
  server: {
    port: 5173,
    proxy: {
      '/api': { target: 'http://localhost:3001', changeOrigin: true },
    },
  },
  test: {
    globals: true,
    environment: 'jsdom',
    setupFiles: ['./src/test/setup.ts'],
    css: false,
  },
}));
