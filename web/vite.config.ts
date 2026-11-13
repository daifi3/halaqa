import react from '@vitejs/plugin-react';
import { fileURLToPath, URL } from 'node:url';
import { defineConfig } from 'vite';
import { VitePWA } from 'vite-plugin-pwa';

export default defineConfig({
  plugins: [
    react(),
    // Installable PWA: web manifest + a service worker that precaches the app shell.
    // The API and LiveKit are on other origins, so they always go to the network.
    VitePWA({
      registerType: 'autoUpdate',
      includeAssets: ['favicon.png', 'icons/apple-touch-icon.png'],
      manifest: {
        id: '/',
        name: 'Halaqa',
        short_name: 'Halaqa',
        description: 'Live classes, a shared whiteboard, homework, exams and recorded lessons.',
        lang: 'en',
        start_url: '/',
        scope: '/',
        display: 'standalone',
        orientation: 'any',
        background_color: '#F4F2EE',
        theme_color: '#F4F2EE',
        categories: ['education'],
        icons: [
          { src: '/icons/icon-192.png', sizes: '192x192', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'any' },
          { src: '/icons/icon-512.png', sizes: '512x512', type: 'image/png', purpose: 'maskable' },
        ],
      },
      workbox: {
        globPatterns: ['**/*.{js,css,html,png,svg,ico,woff2}'],
        // The classroom chunk (LiveKit + MathJax) is ~2.3 MB, over Workbox's 2 MB default.
        maximumFileSizeToCacheInBytes: 5 * 1024 * 1024,
        navigateFallback: '/index.html',
        navigateFallbackDenylist: [/^\/\.well-known\//],
      },
    }),
  ],
  resolve: {
    alias: { '@': fileURLToPath(new URL('./src', import.meta.url)) },
  },
  // MathJax reads PACKAGE_VERSION if the bundler defines it, instead of eval('require').
  define: { PACKAGE_VERSION: JSON.stringify('3.2.1') },
  server: { port: 5173, host: true },
});
